import { describe, expect, test } from "bun:test";
import { loadModels, loadPiModels, toPiModel } from "../src/models.js";
import type { CCModelEntry } from "../src/models.js";

describe("loadModels", () => {
  test("loads models.json successfully", () => {
    const models = loadModels();

    expect(models).toBeArray();
    expect(models.length).toBeGreaterThan(0);
  });

  test("every model has required fields", () => {
    const models = loadModels();

    for (const model of models) {
      expect(model.id).toBeString();
      expect(model.name).toBeString();
      expect(model.tier).toBeString();
      expect(typeof model.reasoning).toBe("boolean");
      expect(typeof model.tool_call).toBe("boolean");
      expect(model.cost.input).toBeNumber();
      expect(model.cost.output).toBeNumber();
      expect(model.limit.context).toBeNumber();
      expect(model.limit.output).toBeNumber();
      expect(model.limit.output).toBeGreaterThan(0);
      expect(model.limit.context).toBeGreaterThan(0);
    }
  });

  test("returns cached result on second call", () => {
    const first = loadModels();
    const second = loadModels();

    expect(first).toBe(second); // Same reference — cached
  });
});

describe("toPiModel", () => {
  test("converts a CC model entry to Pi model config", () => {
    const entry: CCModelEntry = {
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      tier: "premium",
      reasoning: true,
      tool_call: true,
      cost: {
        input: 3.0,
        output: 15.0,
        cache_read: 0.3,
        cache_write: 3.75,
      },
      limit: {
        context: 200_000,
        output: 8_192,
      },
    };

    const result = toPiModel(entry);

    expect(result.id).toBe("claude-sonnet-4-6");
    expect(result.name).toBe("Claude Sonnet 4.6");
    expect(result.reasoning).toBe(true);
    expect(result.input).toEqual(["text"]);
    expect(result.cost.input).toBe(3.0);
    expect(result.cost.output).toBe(15.0);
    expect(result.cost.cacheRead).toBe(0.3);
    expect(result.cost.cacheWrite).toBe(3.75);
    expect(result.contextWindow).toBe(200_000);
    expect(result.maxTokens).toBe(8_192);
  });

  test("handles missing cache fields", () => {
    const entry: CCModelEntry = {
      id: "test-model",
      name: "Test",
      tier: "open-source",
      reasoning: false,
      tool_call: true,
      cost: { input: 1.0, output: 2.0 },
      limit: { context: 100_000, output: 4_096 },
    };

    const result = toPiModel(entry);

    expect(result.cost.cacheRead).toBe(0);
    expect(result.cost.cacheWrite).toBe(0);
  });
});

describe("loadPiModels", () => {
  test("returns array of Pi model configs", () => {
    const models = loadPiModels();

    expect(models).toBeArray();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]!.id).toBeString();
    expect(models[0]!.name).toBeString();
    expect(models[0]!.maxTokens).toBeNumber();
  });
});
