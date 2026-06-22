import { describe, expect, test } from "bun:test";
import type { UserMessage } from "@oh-my-pi/pi-ai";
import { buildRequest, convertTools } from "../src/convert.js";

// We test via buildRequest which exposes the internal conversion pipeline.
// Direct imports of convertUserMessage etc. are not exported — this is intentional:
// the public API is buildRequest, and that's what callers depend on.

describe("buildRequest", () => {
  test("converts a simple user message", () => {
    const result = buildRequest("test-model", {
      messages: [
        {
          role: "user",
          content: "Hello, world",
        } as UserMessage,
      ],
    });

    expect(result.params.model).toBe("test-model");
    expect(result.params.messages).toHaveLength(1);
    expect(result.params.messages[0]!.role).toBe("user");
    expect(result.params.messages[0]!.content).toBe("Hello, world");
  });

  test("extracts text from array content", () => {
    const result = buildRequest("test-model", {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: "Second part" },
          ],
        } as unknown as UserMessage,
      ],
    });

    expect(result.params.messages[0]!.content).toBe("First part\nSecond part");
  });

  test("filters out empty user messages", () => {
    const result = buildRequest("test-model", {
      messages: [
        {
          role: "user",
          content: "",
        } as UserMessage,
        {
          role: "user",
          content: "Valid message",
        } as UserMessage,
      ],
    });

    expect(result.params.messages).toHaveLength(1);
    expect(result.params.messages[0]!.content).toBe("Valid message");
  });

  test("collects system messages into systemPrompt", () => {
    const result = buildRequest("test-model", {
      messages: [
        { role: "system", content: "You are helpful." } as UserMessage,
        { role: "user", content: "Hello" } as UserMessage,
        { role: "system", content: "Be concise." } as UserMessage,
      ],
    });

    expect(result.params.system).toContain("You are helpful.");
    expect(result.params.system).toContain("Be concise.");
    expect(result.params.messages).toHaveLength(1);
    expect(result.params.messages[0]!.role).toBe("user");
  });

  test("appends context.systemPrompt", () => {
    const result = buildRequest("test-model", {
      messages: [{ role: "user", content: "Hi" } as UserMessage],
      systemPrompt: ["Custom instruction 1", "Custom instruction 2"],
    });

    expect(result.params.system).toContain("Custom instruction 1");
    expect(result.params.system).toContain("Custom instruction 2");
  });

  test("respects maxTokens parameter", () => {
    const result = buildRequest("test-model", { messages: [] }, 4096);

    expect(result.params.max_tokens).toBe(4096);
  });

  test("clamps maxTokens to 200K ceiling", () => {
    const result = buildRequest("test-model", { messages: [] }, 384_000);

    expect(result.params.max_tokens).toBe(200_000);
  });

  test("defaults max_tokens to 16384 when not provided", () => {
    const result = buildRequest("test-model", { messages: [] });

    expect(result.params.max_tokens).toBe(16384);
  });

  test("stream is always true", () => {
    const result = buildRequest("test-model", { messages: [] });

    expect(result.params.stream).toBe(true);
  });

  test("includes config section with git info", () => {
    const result = buildRequest("test-model", { messages: [] });

    expect(result.config).toBeDefined();
    expect(result.config.workingDir).toBeString();
    expect(result.config.environment).toBeString();
    expect(typeof result.config.isGitRepo).toBe("boolean");
    expect(result.config.currentBranch).toBeString();
  });
});

describe("convertTools", () => {
  test("returns empty array for undefined", () => {
    expect(convertTools(undefined)).toEqual([]);
  });

  test("returns empty array for empty tools", () => {
    expect(convertTools([])).toEqual([]);
  });

  test("converts tools to CC format", () => {
    const result = convertTools([
      {
        name: "read_file",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("function");
    expect(result[0]!.name).toBe("read_file");
    expect(result[0]!.description).toBe("Read a file");
    expect(result[0]!.input_schema).toBeDefined();
  });

  test("omits description when undefined", () => {
    const result = convertTools([
      {
        name: "simple_tool",
        parameters: { type: "object", properties: {} },
      },
    ]);

    expect(result[0]!.description).toBeUndefined();
  });
});
