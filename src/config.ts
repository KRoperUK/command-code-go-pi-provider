/** Command Code API constants and provider configuration. */

export const CC_PROVIDER = "commandcode" as const;
export const CC_API = "commandcode" as const;
export const CC_BASE_URL = "https://api.commandcode.ai" as const;
export const CC_GENERATE_PATH = "/alpha/generate" as const;
export const CC_VERSION = "0.26.20" as const;
export const CC_API_KEY_ENV = "COMMANDCODE_API_KEY" as const;

/** Full generate endpoint URL. */
export function ccGenerateUrl(baseUrl?: string): string {
  return `${baseUrl ?? CC_BASE_URL}${CC_GENERATE_PATH}`;
}
