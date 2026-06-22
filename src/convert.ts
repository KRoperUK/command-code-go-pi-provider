/**
 * Convert Pi's Context messages and tools to the Command Code
 * /alpha/generate request envelope.
 */

import type {
  AssistantMessage,
  Message,
  TextContent,
  ThinkingContent,
  ToolCall as PiToolCall,
  ToolResultMessage,
  UserMessage,
  Tool,
  Context,
} from "@oh-my-pi/pi-ai";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// --- CC wire types ---

type CCMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: CCAssistantContent[] }
  | { role: "tool"; content: CCToolResultContent[] };

type CCAssistantContent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown };

type CCToolResultContent = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: { type: "text"; value: string } | { type: "error-text"; value: string };
};

type CCTool = {
  type: "function";
  name: string;
  description?: string;
  input_schema: unknown;
};

export interface CCRequestEnvelope {
  config: {
    workingDir: string;
    date: string;
    environment: string;
    structure: unknown[];
    isGitRepo: boolean;
    currentBranch: string;
    mainBranch: string;
    gitStatus: string;
    recentCommits: unknown[];
  };
  memory: string;
  taste: string;
  skills: null;
  permissionMode: string;
  params: {
    model: string;
    messages: CCMessage[];
    tools: CCTool[];
    system: string;
    max_tokens: number;
    stream: true;
    temperature?: number;
    top_p?: number;
    top_k?: number;
  };
}

// --- Message conversion ---

function extractText(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p): p is { type: "text"; text: string } =>
        typeof p === "object" && p !== null && (p as { type?: string }).type === "text",
      )
      .map((p) => p.text)
      .join("\n");
  }
  return "";
}

function convertUserMessage(msg: UserMessage): CCMessage | null {
  const text = extractText(msg.content);
  if (!text) return null;
  return { role: "user", content: text };
}

function convertAssistantMessage(msg: AssistantMessage): CCMessage | null {
  if (!msg.content || msg.content.length === 0) return null;

  const parts: CCAssistantContent[] = [];
  for (const part of msg.content) {
    switch (part.type) {
      case "text":
        parts.push({ type: "text", text: (part as TextContent).text });
        break;
      case "thinking":
        parts.push({ type: "reasoning", text: (part as ThinkingContent).text });
        break;
      case "toolCall": {
        const tc = part as PiToolCall;
        let input: unknown;
        try {
          input = JSON.parse(tc.arguments || "{}");
        } catch {
          input = {};
        }
        parts.push({
          type: "tool-call",
          toolCallId: tc.id,
          toolName: tc.name,
          input,
        });
        break;
      }
    }
  }
  if (parts.length === 0) return null;
  return { role: "assistant", content: parts };
}

function convertToolResult(msg: ToolResultMessage): CCMessage | null {
  const text = extractText(msg.content);
  const output: CCToolResultContent["output"] = msg.isError
    ? { type: "error-text", value: text || "Tool execution failed" }
    : { type: "text", value: text };

  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: msg.toolCallId,
        toolName: msg.toolName,
        output,
      },
    ],
  };
}

function convertMessage(msg: Message): CCMessage | null {
  switch (msg.role) {
    case "user":
      return convertUserMessage(msg as UserMessage);
    case "developer":
      return convertUserMessage(msg as unknown as UserMessage);
    case "assistant":
      return convertAssistantMessage(msg as AssistantMessage);
    case "toolResult":
      return convertToolResult(msg as ToolResultMessage);
    default:
      return null;
  }
}

// --- Tool conversion ---

export function convertTools(tools: Tool[] | undefined): CCTool[] {
  if (!tools || tools.length === 0) return [];
  return tools.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description ?? undefined,
    input_schema: t.parameters,
  }));
}

// --- Main build function ---

let _gitInfo: { isRepo: boolean; branch: string } | undefined;
function getGitInfo(): { isRepo: boolean; branch: string } {
  if (_gitInfo !== undefined) return _gitInfo;
  try {
    const cwd = process.cwd?.() ?? ".";
    const dotGit = join(cwd, ".git");
    if (!existsSync(dotGit)) return (_gitInfo = { isRepo: false, branch: "" });
    const head = readFileSync(join(dotGit, "HEAD"), "utf-8").trim();
    let branch = "";
    if (head.startsWith("ref: refs/heads/")) {
      branch = head.slice(16);
    } else {
      branch = head.slice(0, 8); // detached HEAD, use short hash
    }
    return (_gitInfo = { isRepo: true, branch });
  } catch {
    return (_gitInfo = { isRepo: false, branch: "" });
  }
}

export function buildRequest(
  modelId: string,
  context: Context,
  maxTokens?: number | null,
): CCRequestEnvelope {
  let systemPrompt = "";
  const messages: CCMessage[] = [];

  for (const msg of context.messages) {
    if (msg.role === "system") {
      systemPrompt += (systemPrompt ? "\n\n" : "") + extractText((msg as UserMessage).content);
      continue;
    }
    const converted = convertMessage(msg);
    if (converted) messages.push(converted);
  }

  // Append context.systemPrompt arrays
  if (context.systemPrompt && context.systemPrompt.length > 0) {
    systemPrompt += (systemPrompt ? "\n\n" : "") + context.systemPrompt.join("\n\n");
  }

  const git = getGitInfo();

  const params: CCRequestEnvelope["params"] = {
    model: modelId,
    messages,
    tools: convertTools(context.tools),
    system: systemPrompt,
    max_tokens: Math.min(maxTokens ?? 16384, 200_000),
    stream: true,
  };

  return {
    config: {
      workingDir: process.cwd?.() ?? "/",
      date: new Date().toISOString().split("T")[0] ?? "",
      environment: `${process.platform ?? "unknown"}-${process.arch ?? "unknown"}`,
      structure: [],
      isGitRepo: git.isRepo,
      currentBranch: git.branch,
      mainBranch: "",
      gitStatus: "",
      recentCommits: [],
    },
    memory: "",
    taste: "",
    skills: null,
    permissionMode: "standard",
    params,
  };
}
