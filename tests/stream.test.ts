import { describe, expect, test } from "bun:test";
import { createOutput } from "../src/stream.js";

describe("createOutput", () => {
  test("returns an AssistantMessage with correct shape", () => {
    const output = createOutput("claude-sonnet-4-6");

    expect(output.role).toBe("assistant");
    expect(output.content).toEqual([]);
    expect(output.api).toBe("commandcode");
    expect(output.provider).toBe("commandcode");
    expect(output.model).toBe("claude-sonnet-4-6");
    expect(output.stopReason).toBe("stop");
    expect(output.usage).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
    });
    expect(output.timestamp).toBeNumber();
  });
});
