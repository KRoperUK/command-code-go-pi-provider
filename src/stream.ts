/**
 * Parse Command Code SSE stream events and push them into
 * a Pi AssistantMessageEventStream with correct contentIndex tracking.
 *
 * CC /alpha/generate event flow:
 *   start → start-step → text-start → text-delta… → text-end → finish-step → finish → provider-metadata
 *   (reasoning-start/delta/end interleave with text)
 */

import type { AssistantMessage, AssistantMessageEventStream, StopReason } from "@oh-my-pi/pi-ai";

// --- SSE types ---

type RawEvent = Record<string, unknown> & { type: string };

interface ActiveBlock {
  contentIndex: number;
  type: "text" | "thinking" | "toolcall";
  buffer: string;
  toolCallId?: string;
  toolCallName?: string;
}

// --- Output creation ---

export function createOutput(modelId: string): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: "commandcode",
    provider: "commandcode",
    model: modelId,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

// --- Process a single SSE event ---

function processEvent(
  event: RawEvent,
  output: AssistantMessage,
  stream: AssistantMessageEventStream,
  incoming: ActiveBlock | null,
): ActiveBlock | null {
  let active = incoming;
  switch (event.type) {
    // --- Text ---
    case "text-start": {
      if (active) closeBlock(active, output, stream);
      const idx = output.content.length;
      output.content.push({ type: "text", text: "" });
      stream.push({ type: "text_start", contentIndex: idx, partial: output });
      return { contentIndex: idx, type: "text", buffer: "" };
    }

    case "text-delta": {
      const text = (event.text ?? event.delta ?? "") as string;
      if (!text) return active;
      if (!active || active.type !== "text") {
        // Implicit start if no active block
        if (active) closeBlock(active, output, stream);
        const idx = output.content.length;
        output.content.push({ type: "text", text: "" });
        stream.push({ type: "text_start", contentIndex: idx, partial: output });
        active = { contentIndex: idx, type: "text", buffer: text };
        stream.push({ type: "text_delta", contentIndex: idx, delta: text, partial: output });
      } else {
        active.buffer += text;
        stream.push({
          type: "text_delta",
          contentIndex: active.contentIndex,
          delta: text,
          partial: output,
        });
      }
      return active;
    }

    case "text-end": {
      if (active && active.type === "text") {
        closeBlock(active, output, stream);
        return null;
      }
      return active;
    }

    // --- Reasoning/Thinking ---
    case "reasoning-start": {
      if (active) closeBlock(active, output, stream);
      const idx = output.content.length;
      output.content.push({ type: "thinking", text: "" });
      stream.push({ type: "thinking_start", contentIndex: idx, partial: output });
      return { contentIndex: idx, type: "thinking", buffer: "" };
    }

    case "reasoning-delta": {
      const text = (event.text ?? event.delta ?? "") as string;
      if (!text) return active;
      if (!active || active.type !== "thinking") {
        if (active) closeBlock(active, output, stream);
        const idx = output.content.length;
        output.content.push({ type: "thinking", text: "" });
        stream.push({ type: "thinking_start", contentIndex: idx, partial: output });
        active = { contentIndex: idx, type: "thinking", buffer: text };
        stream.push({ type: "thinking_delta", contentIndex: idx, delta: text, partial: output });
      } else {
        active.buffer += text;
        stream.push({
          type: "thinking_delta",
          contentIndex: active.contentIndex,
          delta: text,
          partial: output,
        });
      }
      return active;
    }

    case "reasoning-end": {
      if (active && active.type === "thinking") {
        closeBlock(active, output, stream);
        return null;
      }
      return active;
    }

    // --- Tool calls ---
    case "tool-call-start": {
      const id = event.toolCallId as string;
      const name = event.toolName as string;
      if (!id || !name) return active;
      if (active) closeBlock(active, output, stream);

      const idx = output.content.length;
      output.content.push({ type: "toolCall", id, name, arguments: "" });
      stream.push({ type: "toolcall_start", contentIndex: idx, partial: output });
      return {
        contentIndex: idx,
        type: "toolcall",
        buffer: "",
        toolCallId: id,
        toolCallName: name,
      };
    }

    case "tool-call-delta": {
      const id = event.toolCallId as string;
      const delta = (event.delta ?? "") as string;
      if (!active || active.type !== "toolcall" || active.toolCallId !== id || !delta) break;
      active.buffer += delta;
      stream.push({
        type: "toolcall_delta",
        contentIndex: active.contentIndex,
        delta,
        partial: output,
      });
      return active;
    }

    case "tool-call-end": {
      const id = event.toolCallId as string;
      if (!active || active.type !== "toolcall" || active.toolCallId !== id) break;

      const entry = output.content[active.contentIndex];
      if (entry && entry.type === "toolCall") {
        entry.arguments = active.buffer;
      }

      stream.push({
        type: "toolcall_end",
        contentIndex: active.contentIndex,
        toolCall: {
          type: "toolCall",
          id: active.toolCallId ?? id,
          name: active.toolCallName ?? "",
          arguments: active.buffer,
        },
        partial: output,
      });
      return null;
    }

    // --- Usage (from finish-step / finish events) ---
    case "finish-step": {
      const usage = event.usage as Record<string, number> | undefined;
      if (usage) {
        output.usage.input = usage.inputTokens ?? output.usage.input;
        output.usage.output = usage.outputTokens ?? output.usage.output;
        output.usage.cacheRead = usage.cacheReadInputTokens ?? 0;
        output.usage.cacheWrite = usage.cacheCreationInputTokens ?? 0;
        output.usage.totalTokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
      }
      // Extract stop reason if present
      const reason = event.finishReason as string | undefined;
      if (reason) output.stopReason = mapStopReason(reason);
      break;
    }

    case "finish": {
      // Final usage from totalUsage
      const totalUsage = event.totalUsage as Record<string, number> | undefined;
      if (totalUsage) {
        output.usage.input = totalUsage.inputTokens ?? output.usage.input;
        output.usage.output = totalUsage.outputTokens ?? output.usage.output;
        output.usage.cacheRead = totalUsage.cacheReadInputTokens ?? 0;
        output.usage.cacheWrite = totalUsage.cacheCreationInputTokens ?? 0;
        output.usage.totalTokens = (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0);
      }
      const reason = event.finishReason as string | undefined;
      if (reason) output.stopReason = mapStopReason(reason);

      // Close any open block
      if (active) {
        closeBlock(active, output, stream);
        active = null;
      }
      break;
    }

    // --- Provider metadata ---
    case "provider-metadata": {
      // Extract gateway cost and cache info
      const meta = event.providerMetadata as Record<string, Record<string, unknown>> | undefined;
      if (meta) {
        const gateway = meta.gateway;
        if (gateway) {
          const costStr = (gateway.cost ?? gateway.gatewayCost ?? gateway.inferenceCost) as
            | string
            | undefined;
          if (typeof costStr === "string") {
            output.costCents = Math.round(Number.parseFloat(costStr) * 100 * 100) / 100;
            if (!output.providerPayload) output.providerPayload = {};
            (output.providerPayload as Record<string, unknown>).cost = costStr;
            (output.providerPayload as Record<string, unknown>).generationId = gateway.generationId;
          }
        }
        for (const providerMeta of Object.values(meta)) {
          if (typeof providerMeta.promptCacheHitTokens === "number") {
            output.usage.cacheRead = providerMeta.promptCacheHitTokens as number;
          }
        }
      }
      break;
    }

    // --- Error ---
    case "error": {
      if (active) {
        closeBlock(active, output, stream);
        active = null;
      }
      const message = (event.message ?? event.error ?? "Unknown error") as string;
      output.stopReason = "error";
      output.errorMessage = message;
      stream.push({ type: "error", reason: "error", error: output });
      break;
    }

    default:
      // start, start-step, and unknown events are silently ignored
      break;
  }

  return active;
}

function closeBlock(
  block: ActiveBlock,
  output: AssistantMessage,
  stream: AssistantMessageEventStream,
): void {
  const entry = output.content[block.contentIndex];
  if (!entry) return;

  switch (block.type) {
    case "text":
      (entry as { type: string; text: string }).text = block.buffer;
      stream.push({
        type: "text_end",
        contentIndex: block.contentIndex,
        content: block.buffer,
        partial: output,
      });
      break;
    case "thinking":
      (entry as { type: string; text: string }).text = block.buffer;
      stream.push({
        type: "thinking_end",
        contentIndex: block.contentIndex,
        content: block.buffer,
        partial: output,
      });
      break;
    case "toolcall":
      // handled by tool-call-end
      break;
  }
}

function mapStopReason(raw: string): StopReason {
  switch (raw) {
    case "stop":
    case "end_turn":
      return "stop";
    case "tool_calls":
    case "tool-calls":
      return "toolUse";
    case "length":
    case "max_tokens":
      return "length";
    case "content_filter":
      return "error";
    default:
      return "stop";
  }
}

// --- SSE line parser ---

export async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  output: AssistantMessage,
  stream: AssistantMessageEventStream,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let active: ActiveBlock | null = null;

  try {
    while (true) {
      if (signal?.aborted) {
        output.stopReason = "aborted";
        stream.push({ type: "error", reason: "aborted", error: output });
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        let jsonStr = trimmed;
        if (trimmed.startsWith("data:")) {
          jsonStr = trimmed.slice(5).trim();
        }
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const event = JSON.parse(jsonStr) as RawEvent;
          if (event && typeof event.type === "string") {
            active = processEvent(event, output, stream, active);
          }
        } catch {}
      }
    }

    // Flush remaining buffer
    const remaining = buffer.trim();
    if (remaining && !remaining.startsWith(":")) {
      const jsonStr = remaining.startsWith("data:") ? remaining.slice(5).trim() : remaining;
      if (jsonStr && jsonStr !== "[DONE]") {
        try {
          const event = JSON.parse(jsonStr) as RawEvent;
          if (event && typeof event.type === "string") {
            active = processEvent(event, output, stream, active);
          }
        } catch {
          /* skip */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
