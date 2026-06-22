import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { CC_API_KEY_ENV } from "./config.js";

/**
 * Resolve the Command Code API key from environment, explicit option,
 * or auth files (~/.commandcode/auth.json, ~/.pi/agent/auth.json).
 */
export function resolveApiKey(options?: {
  apiKey?: string;
  env?: Record<string, string | undefined>;
}): string | undefined {
  if (options?.apiKey) return options.apiKey;

  const envKey = options?.env?.[CC_API_KEY_ENV] ?? process.env[CC_API_KEY_ENV];
  if (envKey) return envKey;

  const authPaths = [
    join(homedir(), ".commandcode", "auth.json"),
    join(homedir(), ".pi", "agent", "auth.json"),
  ];

  for (const p of authPaths) {
    if (!existsSync(p)) continue;
    try {
      const parsed = JSON.parse(readFileSync(p, "utf-8"));
      if (typeof parsed === "object" && parsed !== null) {
        if (typeof parsed.apiKey === "string") return parsed.apiKey;
        if (typeof parsed.commandcode === "string") return parsed.commandcode;
        if (
          typeof parsed.commandcode === "object" &&
          parsed.commandcode !== null &&
          parsed.commandcode.type === "oauth" &&
          typeof parsed.commandcode.access === "string"
        ) {
          return parsed.commandcode.access;
        }
      }
    } catch {}
  }

  return undefined;
}

/**
 * Resolve the Command Code session token for accessing internal endpoints
 * like /internal/usage. Stored in ~/.commandcode/auth.json or OAuth credentials.
 */
export function resolveSessionToken(): string | undefined {
  const authPaths = [
    join(homedir(), ".commandcode", "auth.json"),
    join(homedir(), ".pi", "agent", "auth.json"),
  ];

  for (const p of authPaths) {
    if (!existsSync(p)) continue;
    try {
      const parsed = JSON.parse(readFileSync(p, "utf-8"));
      if (typeof parsed === "object" && parsed !== null) {
        // Direct session token
        if (typeof parsed.sessionToken === "string") return parsed.sessionToken;
        // OAuth credential format
        if (
          typeof parsed.commandcode === "object" &&
          parsed.commandcode !== null &&
          parsed.commandcode.type === "oauth" &&
          typeof parsed.commandcode.sessionToken === "string"
        ) {
          return parsed.commandcode.sessionToken;
        }
      }
    } catch {}
  }

  return undefined;
}

/** Full credentials including optional session token. */
export interface CCAuth {
  apiKey: string;
  sessionToken?: string;
}

/** Resolve both API key and session token. */
export function resolveAuth(): CCAuth | undefined {
  const apiKey = resolveApiKey();
  if (!apiKey) return undefined;
  return {
    apiKey,
    sessionToken: resolveSessionToken(),
  };
}
