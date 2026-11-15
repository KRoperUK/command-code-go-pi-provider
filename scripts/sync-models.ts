#!/usr/bin/env bun
/**
 * Sync models.json with Command Code's live provider catalog.
 *
 *   bun run sync           refresh names/context windows, append new models
 *   bun run sync --check   report drift without writing (used by CI)
 *   bun run sync --url=..  override the catalog endpoint (or CC_CATALOG_URL)
 *
 * New catalog models are appended with placeholder pricing (0/0) and must
 * be filled in manually. Models missing from the catalog are reported but
 * never deleted.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CC_CATALOG_URL, diffCatalog, fetchCatalog, mergeCatalog, serializeModels } from "../src/catalog.js";
import { loadModels } from "../src/models.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_PATH = join(__dirname, "..", "models.json");

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const checkOnly = process.argv.includes("--check");
const url = argValue("url") ?? process.env.CC_CATALOG_URL ?? CC_CATALOG_URL;

const local = loadModels();
let remote;
try {
  remote = await fetchCatalog(url);
} catch (err) {
  console.error(`Failed to fetch catalog from ${url}: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const { added, removed, updated } = diffCatalog(local, remote);
console.log(`Catalog: ${remote.length} models, local: ${local.length} models.`);
for (const m of added) console.log(`  added: ${m.id}`);
for (const m of removed) console.log(`  removed from catalog (kept): ${m.id}`);
for (const m of updated) console.log(`  updated: ${m.id}`);

if (checkOnly) {
  if (added.length > 0 || removed.length > 0 || updated.length > 0) {
    console.error("Drift detected between models.json and the live catalog.");
    process.exit(1);
  }
  console.log("models.json matches the live catalog.");
} else {
  if (added.length === 0 && updated.length === 0) {
    console.log("models.json is already up to date.");
  } else {
    const merged = mergeCatalog(local, remote);
    writeFileSync(MODELS_PATH, serializeModels(merged.models));
    // Reload check: read back through JSON to confirm the file parses.
    JSON.parse(readFileSync(MODELS_PATH, "utf-8"));
    console.log(`Wrote ${MODELS_PATH} (${merged.models.length} models).`);
    if (merged.added.length > 0) {
      console.warn(
        `WARNING: fill in pricing/limits manually for: ${merged.added.map((m) => m.id).join(", ")}`,
      );
    }
  }
  if (removed.length > 0) {
    console.warn(
      `WARNING: ${removed.length} committed model(s) missing from the catalog (kept, not deleted).`,
    );
  }
}
