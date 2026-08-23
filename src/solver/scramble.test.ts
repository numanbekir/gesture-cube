import { describe, expect, it } from "vitest";
import { createSolvedState } from "../cube-engine/state";
import { applyMoveName } from "../cube-engine/moves";
import { stateToCorners } from "./encoding";
import { solve } from "./solver";
import { generateScramble } from "./scramble";
import { INDEPENDENT_MOVES } from "./move-table";

function deterministicRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe("generateScramble", () => {
  it("produces a move list of the requested length", () => {
    expect(generateScramble(11, deterministicRandom(1)).length).toBe(11);
    expect(generateScramble(5, deterministicRandom(2)).length).toBe(5);
  });

  it("defaults to length 11", () => {
    expect(generateScramble(undefined, deterministicRandom(3)).length).toBe(11);
  });

  it("only uses the 9 independent moves", () => {
    const scramble = generateScramble(30, deterministicRandom(4));
    for (const move of scramble) expect(INDEPENDENT_MOVES).toContain(move);
  });

  it("never repeats a face back to back", () => {
    const scramble = generateScramble(40, deterministicRandom(5));
    for (let i = 1; i < scramble.length; i++) {
      expect(scramble[i][0]).not.toBe(scramble[i - 1][0]);
    }
  });

  it("none of 50 default-length scrambles is already solved", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const scramble = generateScramble(undefined, deterministicRandom(seed));
      let state = createSolvedState();
      for (const move of scramble) state = applyMoveName(state, move);
      const solution = solve(stateToCorners(state));
      expect(solution.length).toBeGreaterThan(0);
    }
  });

  it("works with the default Math.random and varies per call", () => {
    const a = generateScramble();
    const b = generateScramble();
    expect(a.length).toBe(11);
    expect(a.join(" ")).not.toBe(b.join(" ")); // collision odds ≈ 1 in 9^11
  });
});
