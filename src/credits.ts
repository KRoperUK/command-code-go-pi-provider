import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CreditOffer {
  model: string;
  multiplier?: string;
  discount?: string;
}

export interface CreditStretchFile {
  source: string;
  offers: CreditOffer[];
}

/** Built-in fallback used when credit-stretch.json is missing or invalid. */
export const DEFAULT_CREDIT_OFFERS: CreditOffer[] = [
  { model: "DeepSeek V4 Pro", multiplier: "4×" },
  { model: "Nemotron 3 Ultra", multiplier: "2.3×" },
  { model: "Qwen 3.7 Max", multiplier: "2×" },
  { model: "MiniMax M3", multiplier: "2×" },
  { model: "MiMo V2.5 Pro", discount: "99%" },
];

let _cachedOffers: CreditOffer[] | null = null;

function isOffer(o: unknown): o is CreditOffer {
  if (typeof o !== "object" || o === null) return false;
  const { model, multiplier, discount } = o as Record<string, unknown>;
  if (typeof model !== "string") return false;
  if (multiplier !== undefined && typeof multiplier !== "string") return false;
  if (discount !== undefined && typeof discount !== "string") return false;
  return multiplier !== undefined || discount !== undefined;
}

/** Parse and validate an unknown value into a list of credit offers. */
export function parseCreditOffers(data: unknown): CreditOffer[] | null {
  if (typeof data !== "object" || data === null) return null;
  const offers = (data as { offers?: unknown }).offers;
  if (!Array.isArray(offers) || !offers.every(isOffer)) return null;
  return offers.map((o) => ({ ...o }));
}

/** Load credit stretch offers from credit-stretch.json, falling back to defaults. */
export function loadCreditOffers(): CreditOffer[] {
  if (_cachedOffers) return _cachedOffers;
  try {
    const offersPath = join(__dirname, "..", "credit-stretch.json");
    const parsed = parseCreditOffers(JSON.parse(readFileSync(offersPath, "utf-8")));
    _cachedOffers = parsed ?? [...DEFAULT_CREDIT_OFFERS];
  } catch {
    _cachedOffers = [...DEFAULT_CREDIT_OFFERS];
  }
  return _cachedOffers;
}

/** Format offers as the display lines shown by `/commandcode usage`. */
export function formatCreditLines(offers: CreditOffer[]): string[] {
  return offers.map((o) =>
    o.discount !== undefined
      ? `  Up to ${o.discount} off on ${o.model}`
      : `  Credits stretch ${o.multiplier} on ${o.model}`,
  );
}
