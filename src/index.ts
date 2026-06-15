/**
 * Command Code API provider for Oh My Pi (omp/pi-coding-agent).
 *
 * Registers a "commandcode" provider with all models from the Command Code
 * catalog and implements custom streaming for the /alpha/generate endpoint.
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import type {
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  SimpleStreamOptions,
} from "@oh-my-pi/pi-ai";
import type { Api, Model } from "@oh-my-pi/pi-catalog";
import { AssistantMessageEventStream as StreamImpl } from "@oh-my-pi/pi-ai";

import { resolveApiKey } from "./auth.js";
import {
  CC_API,
  CC_API_KEY_ENV,
  CC_BASE_URL,
  CC_PROVIDER,
} from "./config.js";
import { buildRequest } from "./convert.js";
import { loadPiModels } from "./models.js";
import { createOutput, parseSSEStream } from "./stream.js";

// --- streamSimple ---

function streamSimple(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const apiKey =
    (typeof options?.apiKey === "string" && !(options.apiKey as string).startsWith("$")
      ? (options.apiKey as string)
      : undefined) ??
    resolveApiKey();

  if (!apiKey) {
    throw new Error(
      `No API key for Command Code. Set ${CC_API_KEY_ENV} env var, ` +
        `create ~/.commandcode/auth.json, or run /login commandcode.`,
    );
  }

  const baseUrl = model.baseUrl ?? CC_BASE_URL;
  const ccModelId = model.requestModelId ?? model.id;
  const request = buildRequest(ccModelId, context);
  const stream = new StreamImpl();
  const output = createOutput(request.params.model);

  (async () => {
    try {
      stream.push({ type: "start", partial: output });

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(new Error("Request timed out after 5 minutes")),
        300_000,
      );

      if (options?.signal) {
        const onAbort = () => controller.abort(options.signal!.reason);
        options.signal.addEventListener("abort", onAbort, { once: true });
      }

      const url = `${baseUrl}/alpha/generate`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "x-command-code-version": "0.26.20",
          "x-cli-environment": "production",
          "x-project-slug": "oh-my-pi",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        let errorMessage = `Command Code API error: ${response.status} ${response.statusText}`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.error?.message) errorMessage = parsed.error.message;
          else if (parsed.message) errorMessage = parsed.message;
        } catch {
          // error body is not JSON
        }
        throw new Error(`${errorMessage} [model=${request.params.model}]`);
      }

      if (!response.body) {
        throw new Error(`Command Code API returned no body [model=${request.params.model}]`);
      }

      await parseSSEStream(response.body, output, stream, controller.signal);

      // Close any remaining open block (closed by finish/done events normally)
      output.timestamp = Date.now();
      stream.push({
        type: "done",
        reason: (output.stopReason as "stop" | "length" | "toolUse") || "stop",
        message: output,
      });
      stream.end(output);
    } catch (error) {
      if (options?.signal?.aborted) {
        output.stopReason = "aborted";
      } else {
        output.stopReason = "error";
        output.errorMessage =
          error instanceof Error ? error.message : String(error);
      }
      stream.push({
        type: "error",
        reason: output.stopReason as "aborted" | "error",
        error: output,
      });
      stream.end(output);
    }
  })();

  return stream;
}

// --- Provider registration ---

function registerCommandCode(pi: ExtensionAPI): void {
  const models = loadPiModels();

  pi.registerProvider(CC_PROVIDER, {
    api: CC_API,
    apiKey: `$${CC_API_KEY_ENV}`,
    baseUrl: CC_BASE_URL,
    models,
    streamSimple,
    oauth: {
      name: "Command Code",
      async login(callbacks) {
        callbacks.onAuth({
          url: "https://commandcode.ai",
          instructions:
            "1. Sign in to Command Code\n" +
            "2. Open DevTools → Application → Cookies → commandcode.ai\n" +
            "3. Copy __Secure-commandcode_prod_.session_token\n",
        });
        callbacks.onProgress?.("Waiting for session token…");
        const sessionToken = await callbacks.onPrompt({
          message: "Paste your __Secure-commandcode_prod_.session_token:",
          placeholder: "session token from browser cookies",
        });
        if (!sessionToken) throw new Error("Session token required");

        // Normalise: URL-decode if pasted encoded (e.g. from curl -b), store raw
        const rawToken = sessionToken.includes("%") ? decodeURIComponent(sessionToken) : sessionToken;

        // Store session token in auth file so resolveSessionToken() can find it
        const { writeFileSync, existsSync, readFileSync, mkdirSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { homedir } = await import("node:os");
        const authPath = join(homedir(), ".commandcode", "auth.json");
        mkdirSync(join(homedir(), ".commandcode"), { recursive: true });
        let existing: Record<string, unknown> = {};
        if (existsSync(authPath)) {
          try { existing = JSON.parse(readFileSync(authPath, "utf-8")); } catch { /* ignore */ }
        }
        existing.sessionToken = rawToken;
        writeFileSync(authPath, JSON.stringify(existing, null, 2));

        const apiKey = process.env[CC_API_KEY_ENV] ?? resolveApiKey() ?? "";
        return {
          access: apiKey,
          refresh: rawToken,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        };
      },
      async refreshToken(creds) {
        return creds;
      },
      getApiKey(creds) {
        return creds.access ?? "";
      },
    },
  });

  pi.registerCommand("commandcode", {
    description:
      "Command Code: /commandcode [status|models|usage|login]",
    async handler(
      args: string,
      ctx: { ui: { notify: (msg: string, type?: string) => void } },
    ) {
      const trimmed = args.trim();
      const action = trimmed.toLowerCase() || "status";

      if (action === "models" || action === "list-models") {
        const allModels = loadPiModels();
        const lines = allModels.map(
          (m) =>
            `  • ${m.id} — ${m.name} (${m.contextWindow?.toLocaleString() ?? "?"} ctx, ${m.reasoning ? "reasoning" : "standard"})`,
        );
        ctx.ui.notify(
          `Command Code models (${allModels.length}):\n${lines.join("\n")}`,
          "info",
        );
        return;
      }

      if (action === "refresh-models") {
        const { loadModels } = await import("./models.js");
        const fresh = loadModels();
        ctx.ui.notify(
          `Refreshed Command Code catalog: ${fresh.length} models available.`,
          "info",
        );
        return;
      }

        {
      if (action === "usage") {
        const { resolveSessionToken } = await import("./auth.js");
        const sessionToken = resolveSessionToken();
        if (!sessionToken) {
          ctx.ui.notify(
            "No session token configured. Run /login commandcode to set one up.\n\n" +
            "You'll need your browser session token from commandcode.ai cookies.",
            "warn",
          );
          return;
        }

        ctx.ui.notify("Fetching usage from Command Code...", "info");

        try {
          const cookieHeader = `__Secure-commandcode_prod_.session_token=${encodeURIComponent(sessionToken)}`;
          const baseHeaders = { accept: "application/json", Cookie: cookieHeader };

          // Fetch billing-period summary and credits in parallel
          const [summaryRes, creditsRes] = await Promise.all([
            fetch("https://api.commandcode.ai/internal/usage/summary?", { headers: baseHeaders }),
            fetch("https://api.commandcode.ai/internal/billing/credits", { headers: baseHeaders }),
          ]);

          if (!summaryRes.ok) {
            if (summaryRes.status === 401) {
              ctx.ui.notify("Session token expired. Re-run /login commandcode.", "error");
            } else {
              ctx.ui.notify(`Usage API error: ${summaryRes.status} ${summaryRes.statusText}`, "error");
            }
            return;
          }

          const summary = await summaryRes.json() as {
            totalCost?: number; totalCredits?: number; totalCount?: number;
            totalTokensIn?: string; totalTokensOut?: string; periodBasis?: string;
            models?: Array<{ model: string; totalCost: number; count: number }>;
          };

          let availableCredits = 0;
          if (creditsRes.ok) {
            const creditsData = await creditsRes.json() as {
              credits?: { monthlyCredits?: number };
            };
            availableCredits = creditsData.credits?.monthlyCredits ?? 0;
          }

          const totalCredits = summary.totalCredits ?? summary.totalCost ?? 0;
          const totalCount = summary.totalCount ?? 0;

          if (totalCount === 0) {
            ctx.ui.notify("No usage found for this billing period.", "info");
            return;
          }



          // Progress bar (20 chars wide)
          const pct = availableCredits > 0 ? ((totalCredits / availableCredits) * 100).toFixed(0) : null;
          const pctNum = pct !== null ? parseInt(pct, 10) : 0;
          const remainingPct = 100 - pctNum;
          const tokIn = parseInt(summary.totalTokensIn ?? "0", 10);
          const tokOut = parseInt(summary.totalTokensOut ?? "0", 10);

          // Progress bar
          const barWidth = 28;
          const filled = Math.round(pctNum / 100 * barWidth);
          const bar = "█".repeat(filled) + "▒".repeat(Math.min(1, barWidth - filled)) + "░".repeat(Math.max(0, barWidth - filled - 1));

          // Model breakdown
          const modelTable = (summary.models ?? [])
            .sort((a, b) => b.totalCost - a.totalCost)
            .map((m) => {
              const name = m.model.padEnd(34);
              const count = String(m.count).padStart(4);
              const cost = `$${m.totalCost.toFixed(4)}`.padStart(10);
              return `${name} ${count} req  ${cost}`;
            });

          const lines = [
            "Command Code",
          ];

          if (availableCredits > 0) {
            lines.push(
              `  ${bar}  ${remainingPct}% free`,
              `  $${totalCredits.toFixed(2)} consumed / $${availableCredits.toFixed(2)} available`,
            );
          } else {
            lines.push(`  $${totalCredits.toFixed(2)} consumed`);
          }

          lines.push("");
          lines.push(`  ${totalCount} requests · ${tokIn.toLocaleString()} in / ${tokOut.toLocaleString()} out tok · ${summary.periodBasis === "billing-period" ? "billing period" : summary.periodBasis ?? "all time"}`);
          lines.push("");

          if (modelTable.length > 0) {
            lines.push("  Model                                 req      cost");
            lines.push("  ────                                 ───      ────");
            for (const row of modelTable.slice(0, 8)) {
              lines.push(`  ${row}`);
            }
          }

          lines.push("");
          lines.push("  Credits stretch 4× on DeepSeek V4 Pro");
          lines.push("  Credits stretch 2.3× on Nemotron 3 Ultra");
          lines.push("  Credits stretch 2× on Qwen 3.7 Max");
          lines.push("  Credits stretch 2× on MiniMax M3");
          lines.push("  Up to 99% off on MiMo V2.5 Pro");
          lines.push("");
          lines.push("  Full balance → https://commandcode.ai");
          ctx.ui.notify(lines.join("\n"), "info");
        } catch (err) {
          ctx.ui.notify(`Failed to fetch usage: ${err instanceof Error ? err.message : String(err)}`, "error");
        }
        } // end if (action === "usage")
        }

      // Default: status
      const { resolveApiKey, resolveSessionToken } = await import("./auth.js");
      const key = resolveApiKey();
      const sessionToken = resolveSessionToken();
      const allModels = loadPiModels();
      ctx.ui.notify(
        [
          `Command Code provider: registered`,
          `API key: ${key ? "configured ✅" : "missing ❌"}`,
          `Session token: ${sessionToken ? "configured ✅" : "not set — /login to add for /usage"}`,
          `Models: ${allModels.length} available`,
          ``,
          `Base URL: ${CC_BASE_URL}`,
          `Endpoint: /alpha/generate`,
          ``,
          `Commands: /commandcode status | models | usage | login`,
        ].join("\n"),
        "info",
      );
    },
  });
}

// --- Entry point ---

export default function commandCodePiProvider(pi: ExtensionAPI): void {
  registerCommandCode(pi);
}
