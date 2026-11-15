import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  diffCatalog,
  fetchCatalog,
  mergeCatalog,
  serializeModels,
} from "../src/catalog.js";
import type { CCModelEntry } from "../src/models.js";
import { loadModels } from "../src/models.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function entry(overrides: Partial<CCModelEntry> = {}): CCModelEntry {
  return {
    id: "test-model",
    name: "Test",
    tier: "open-source",
    reasoning: true,
    tool_call: true,
    cost: { input: 1, output: 2 },
    limit: { context: 100_000, output: 4_096 },
    ...overrides,
  };
}

describe("diffCatalog", () => {
  test("reports added, removed and updated models", () => {
    const local = [entry({ id: "kept", name: "Kept", limit: { context: 1, output: 1 } }), entry({ id: "gone" })];
    const remote = [
      { id: "kept", name: "Kept Renamed", context_length: 1 },
      { id: "new", name: "New" },
    ];

    const diff = diffCatalog(local, remote);

    expect(diff.added.map((m) => m.id)).toEqual(["new"]);
    expect(diff.removed.map((m) => m.id)).toEqual(["gone"]);
    expect(diff.updated.map((m) => m.id)).toEqual(["kept"]);
  });

  test("empty diff when catalog matches", () => {
    const local = [entry({ id: "a", name: "A", limit: { context: 5, output: 1 } })];
    const remote = [{ id: "a", name: "A", context_length: 5 }];

    expect(diffCatalog(local, remote)).toEqual({ added: [], removed: [], updated: [] });
  });
});

describe("mergeCatalog", () => {
  test("refreshes known models and appends placeholders for new ones", () => {
    const local = [entry({ id: "known", name: "Old", limit: { context: 1, output: 100 } })];
    const remote = [
      { id: "known", name: "New", context_length: 2 },
      { id: "fresh", name: "Fresh", context_length: 3 },
    ];

    const { models, added, removed } = mergeCatalog(local, remote);

    expect(removed).toEqual([]);
    expect(added.map((m) => m.id)).toEqual(["fresh"]);
    expect(models[0]!.name).toBe("New");
    expect(models[0]!.limit.context).toBe(2);
    expect(models[0]!.limit.output).toBe(100);
    const fresh = models[1]!;
    expect(fresh.cost).toEqual({ input: 0, output: 0 });
    expect(fresh.limit).toEqual({ context: 3, output: 0 });
  });

  test("keeps models missing from the catalog", () => {
    const { models, removed } = mergeCatalog([entry({ id: "stale" })], []);

    expect(models.map((m) => m.id)).toEqual(["stale"]);
    expect(removed.map((m) => m.id)).toEqual(["stale"]);
  });
});

describe("fetchCatalog", () => {
  test("parses an OpenAI-style model list via an injected fetch", async () => {
    const stub = async () =>
      new Response(JSON.stringify({ object: "list", data: [{ id: "x", name: "X" }] }));

    const models = await fetchCatalog(
      "https://example.invalid/models",
      stub as typeof fetch,
    );

    expect(models).toEqual([{ id: "x", name: "X" }]);
  });

  test("rejects non-model-list payloads", async () => {
    const stub = async () => new Response(JSON.stringify({ data: [{ nope: 1 }] }));

    await expect(fetchCatalog("https://example.invalid/models", stub as typeof fetch)).rejects.toThrow();
  });
});

describe("serializeModels", () => {
  test("round-trips the committed models.json byte-for-byte", () => {
    const raw = readFileSync(join(__dirname, "..", "models.json"), "utf-8");

    expect(serializeModels(loadModels())).toBe(raw);
  });
});
