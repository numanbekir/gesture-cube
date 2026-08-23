import { describe, expect, it } from "vitest";
import { EN_STRINGS, TR_STRINGS, resolveLocale } from "./strings";

describe("resolveLocale", () => {
  it("?lang overrides the browser language", () => {
    expect(resolveLocale("?lang=en", "tr-TR")).toBe("en");
    expect(resolveLocale("?lang=tr", "en-US")).toBe("tr");
  });
  it("ignores an invalid ?lang and falls back to the browser language", () => {
    expect(resolveLocale("?lang=de", "en-GB")).toBe("en");
    expect(resolveLocale("", "tr")).toBe("tr");
  });
  it("defaults to tr when the browser language is unknown", () => {
    expect(resolveLocale("", undefined)).toBe("tr");
  });
});

describe("EN_STRINGS", () => {
  // same key tree in both languages
  function keys(o: unknown, prefix = ""): string[] {
    if (typeof o !== "object" || o === null) return [prefix];
    return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  }
  it("has the same key structure as TR", () => {
    expect(keys(EN_STRINGS)).toEqual(keys(TR_STRINGS));
  });
});
