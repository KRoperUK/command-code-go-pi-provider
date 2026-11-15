import type { CCModelEntry } from "./models.js";

/** Public Command Code provider catalog (OpenAI-style model list, no auth). */
export const CC_CATALOG_URL = "https://api.commandcode.ai/provider/v1/models";

export interface CatalogModel {
  id: string;
  name?: string;
  context_length?: number;
}

export interface CatalogDiff {
  /** In the live catalog but missing from models.json. */
  added: CatalogModel[];
  /** In models.json but missing from the live catalog (never auto-deleted). */
  removed: CCModelEntry[];
  /** Present in both, but the catalog name or context window changed. */
  updated: CatalogModel[];
}

function isCatalogModel(m: unknown): m is CatalogModel {
  if (typeof m !== "object" || m === null) return false;
  return typeof (m as { id?: unknown }).id === "string";
}

/** Fetch the live model list from Command Code's public provider catalog. */
export async function fetchCatalog(
  url: string = CC_CATALOG_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<CatalogModel[]> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { data?: unknown };
  if (!body || !Array.isArray(body.data) || !body.data.every(isCatalogModel)) {
    throw new Error("Catalog response is not an OpenAI-style model list");
  }
  return body.data;
}

/** Compare the committed models.json entries against the live catalog. */
export function diffCatalog(local: CCModelEntry[], remote: CatalogModel[]): CatalogDiff {
  const localById = new Map(local.map((m) => [m.id, m]));
  const remoteById = new Map(remote.map((m) => [m.id, m]));

  const added = remote.filter((m) => !localById.has(m.id));
  const removed = local.filter((m) => !remoteById.has(m.id));
  const updated = remote.filter((m) => {
    const entry = localById.get(m.id);
    if (!entry) return false;
    return (
      (m.name !== undefined && m.name !== entry.name) ||
      (m.context_length !== undefined && m.context_length !== entry.limit.context)
    );
  });

  return { added, removed, updated };
}

export interface MergeResult {
  models: CCModelEntry[];
  added: CatalogModel[];
  removed: CCModelEntry[];
}

/**
 * Merge the live catalog into the committed entries: refresh names and
 * context windows for known models, append unknown models with placeholder
 * pricing (input/output 0, output limit 0) that must be filled in manually.
 * Models missing from the catalog are kept, never deleted.
 */
export function mergeCatalog(local: CCModelEntry[], remote: CatalogModel[]): MergeResult {
  const remoteById = new Map(remote.map((m) => [m.id, m]));

  const models: CCModelEntry[] = local.map((entry) => {
    const match = remoteById.get(entry.id);
    if (!match) return entry;
    return {
      ...entry,
      name: match.name ?? entry.name,
      limit: {
        ...entry.limit,
        context: match.context_length ?? entry.limit.context,
      },
    };
  });

  const localIds = new Set(local.map((m) => m.id));
  const added = remote.filter((m) => !localIds.has(m.id));
  for (const m of added) {
    models.push({
      id: m.id,
      name: m.name ?? m.id,
      tier: "open-source",
      reasoning: true,
      tool_call: true,
      cost: { input: 0, output: 0 },
      limit: { context: m.context_length ?? 0, output: 0 },
    });
  }

  const removed = local.filter((m) => !remoteById.has(m.id));
  return { models, added, removed };
}

function serializeCost(cost: CCModelEntry["cost"]): string {
  const parts = [`"input": ${cost.input}`, `"output": ${cost.output}`];
  if (cost.cache_read !== undefined) parts.push(`"cache_read": ${cost.cache_read}`);
  if (cost.cache_write !== undefined) parts.push(`"cache_write": ${cost.cache_write}`);
  return `{ ${parts.join(", ")} }`;
}

/**
 * Serialize entries in the exact layout of the committed models.json
 * (2-space indent, inline cost/limit objects) so sync rewrites only
 * change what the catalog changed.
 */
export function serializeModels(models: CCModelEntry[]): string {
  const blocks = models.map((m) => {
    const lines = [
      `    "id": ${JSON.stringify(m.id)},`,
      `    "name": ${JSON.stringify(m.name)},`,
      ...(m.vision ? [`    "vision": true,`] : []),
      `    "tier": ${JSON.stringify(m.tier)},`,
      `    "reasoning": ${m.reasoning},`,
      `    "tool_call": ${m.tool_call},`,
      `    "cost": ${serializeCost(m.cost)},`,
      `    "limit": { "context": ${m.limit.context}, "output": ${m.limit.output} }`,
    ];
    return `  {\n${lines.join("\n")}\n  }`;
  });
  return `[\n${blocks.join(",\n")}\n]\n`;
}
