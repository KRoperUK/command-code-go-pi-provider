import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CREDIT_OFFERS,
  formatCreditLines,
  loadCreditOffers,
  parseCreditOffers,
} from "../src/credits.js";

describe("parseCreditOffers", () => {
  test("accepts a well-formed file", () => {
    const parsed = parseCreditOffers({
      source: "manual",
      offers: [{ model: "DeepSeek V4 Pro", multiplier: "4×" }],
    });

    expect(parsed).toEqual([{ model: "DeepSeek V4 Pro", multiplier: "4×" }]);
  });

  test("rejects malformed input", () => {
    expect(parseCreditOffers(null)).toBeNull();
    expect(parseCreditOffers({})).toBeNull();
    expect(parseCreditOffers({ offers: [{ model: "X" }] })).toBeNull();
    expect(parseCreditOffers({ offers: [{ stretch: "4×" }] })).toBeNull();
    expect(parseCreditOffers({ offers: "nope" })).toBeNull();
  });
});

describe("loadCreditOffers", () => {
  test("loads offers from credit-stretch.json", () => {
    const offers = loadCreditOffers();

    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expect(o.model).toBeString();
      expect(o.multiplier !== undefined || o.discount !== undefined).toBe(true);
    }
  });
});

describe("formatCreditLines", () => {
  test("formats multipliers and discounts like the old hardcoded copy", () => {
    expect(formatCreditLines(DEFAULT_CREDIT_OFFERS)).toEqual([
      "  Credits stretch 4× on DeepSeek V4 Pro",
      "  Credits stretch 2.3× on Nemotron 3 Ultra",
      "  Credits stretch 2× on Qwen 3.7 Max",
      "  Credits stretch 2× on MiniMax M3",
      "  Up to 99% off on MiMo V2.5 Pro",
    ]);
  });
});
