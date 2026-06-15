import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ProviderModelConfig } from "@oh-my-pi/pi-coding-agent";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CCModelEntry {
  id: string;
  name: string;
  tier: "premium" | "open-source";
  reasoning: boolean;
  tool_call: boolean;
  cost: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
  limit: {
    context: number;
    output: number;
  };
}

let _cachedModels: CCModelEntry[] | null = null;

/** Load and parse the models.json catalog shipped with this package. */
export function loadModels(): CCModelEntry[] {
  if (_cachedModels) return _cachedModels;
  const modelsPath = join(__dirname, "..", "models.json");
  _cachedModels = JSON.parse(readFileSync(modelsPath, "utf-8")) as CCModelEntry[];
  return _cachedModels;
}

/** Convert a raw CC model entry to Pi's ProviderModelConfig shape. */
export function toPiModel(entry: CCModelEntry): ProviderModelConfig {
  return {
    id: entry.id,
    name: entry.name,
    reasoning: entry.reasoning,
    input: ["text" as const],
    cost: {
      input: entry.cost.input,
      output: entry.cost.output,
      cacheRead: entry.cost.cache_read ?? 0,
      cacheWrite: entry.cost.cache_write ?? 0,
    },
    contextWindow: entry.limit.context,
    maxTokens: entry.limit.output,
  };
}

/** Load all models and convert to Pi provider format. */
export function loadPiModels(): ProviderModelConfig[] {
  return loadModels().map(toPiModel);
}
