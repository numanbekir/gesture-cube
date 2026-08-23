import { describe, expect, it } from "vitest";
import { createSolvedState, isSolved } from "../cube-engine/state";
import { applyMoveName } from "../cube-engine/moves";
import type { MoveName } from "../cube-engine/types";
import { decodeCorners, encodeCorners, encodeState, stateToCorners, STATE_COUNT, toPhysicalMove } from "./encoding";
import { solve } from "./solver";

const ALL_MOVE_NAMES: MoveName[] = [
  "U", "U'", "U2",
  "D", "D'", "D2",
  "L", "L'", "L2",
  "R", "R'", "R2",
  "F", "F'", "F2",
  "B", "B'", "B2",
];

describe("encodeState", () => {
  it("encodes the solved state as 0", () => {
    expect(encodeState(createSolvedState())).toBe(0);
  });

  it("is deterministic", () => {
    let state = createSolvedState();
    state = applyMoveName(state, "R");
    state = applyMoveName(state, "U");
    const a = encodeState(state);
    const b = encodeState(state);
    expect(a).toBe(b);
  });

  it("every code is within [0, STATE_COUNT)", () => {
    let state = createSolvedState();
    const scramble: MoveName[] = ["U", "R", "F'", "L2", "D", "B", "U'", "R2", "D'", "L", "B2", "F"];
    for (const name of scramble) {
      state = applyMoveName(state, name);
      const code = encodeState(state);
      expect(code).toBeGreaterThanOrEqual(0);
      expect(code).toBeLessThan(STATE_COUNT);
    }
  });

  it("a move and its inverse return to 0, including D/L/B which move the reference corner", () => {
    const faces: [MoveName, MoveName][] = [
      ["U", "U'"], ["D", "D'"], ["L", "L'"],
      ["R", "R'"], ["F", "F'"], ["B", "B'"],
    ];
    for (const [move, inverse] of faces) {
      let state = createSolvedState();
      state = applyMoveName(state, move);
      expect(encodeState(state)).not.toBe(0); // intermediate state is not solved
      state = applyMoveName(state, inverse);
      expect(encodeState(state)).toBe(0);
    }
  });

  it("opposite faces (U/D, L/R, F/B) are equivalent in the normalized space", () => {
    // Not a bug: normalize() applies a whole-cube rotation, so D + normalize ≡ U.
    // The state space is covered by the 9 U/R/F moves.
    const pairs: [MoveName, MoveName][] = [
      ["U", "D"], ["U'", "D'"], ["U2", "D2"],
      ["L", "R"], ["L'", "R'"], ["L2", "R2"],
      ["F", "B"], ["F'", "B'"], ["F2", "B2"],
    ];
    for (const [a, b] of pairs) {
      const codeA = encodeState(applyMoveName(createSolvedState(), a));
      const codeB = encodeState(applyMoveName(createSolvedState(), b));
      expect(codeA).toBe(codeB);
    }
  });

  it("states one move from solved map to exactly 9 distinct codes", () => {
    const codes = new Set<number>();
    for (const name of ALL_MOVE_NAMES) {
      const state = applyMoveName(createSolvedState(), name);
      codes.add(encodeState(state));
    }
    expect(codes.size).toBe(9);
  });

  it("the 9 independent moves produce distinct codes", () => {
    const independentMoves: MoveName[] = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];
    const codes = new Set<number>();
    for (const name of independentMoves) {
      codes.add(encodeState(applyMoveName(createSolvedState(), name)));
    }
    expect(codes.size).toBe(independentMoves.length);
  });

  it("encodes consistently after a move with whole-cube effect (D)", () => {
    // D moves the reference corner; without normalize() this would throw or encode out of range
    let state = createSolvedState();
    state = applyMoveName(state, "D");
    const code = encodeState(state);
    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThan(STATE_COUNT);
    expect(code).not.toBe(0);
  });
});

describe("encodeCorners / decodeCorners round-trip", () => {
  it("decodes the solved corners", () => {
    const corners = stateToCorners(createSolvedState());
    const code = encodeCorners(corners);
    const decoded = decodeCorners(code);
    expect(decoded.perm).toEqual(corners.perm);
    expect(decoded.twist).toEqual(corners.twist);
  });

  it("decode(encode(corners)) === corners for random scrambles", () => {
    const scrambles: MoveName[][] = [
      ["U", "R", "U'", "R'"],
      ["F", "U", "R", "U'", "R'", "F'"],
      ["U", "U", "R", "R", "F", "F", "U'", "R'", "F'", "U2"],
      ["R", "U2", "R'", "U'", "R", "U'", "R'"],
    ];
    for (const scramble of scrambles) {
      let state = createSolvedState();
      for (const name of scramble) state = applyMoveName(state, name);
      const corners = stateToCorners(state);
      const decoded = decodeCorners(encodeCorners(corners));
      expect(decoded.perm).toEqual(corners.perm);
      expect(decoded.twist).toEqual(corners.twist);
    }
  });

  it("encodeCorners(decodeCorners(code)) === code at boundary values", () => {
    const samples = [0, 1, 728, 729, 1000, STATE_COUNT - 1, Math.floor(STATE_COUNT / 2)];
    for (const code of samples) {
      expect(encodeCorners(decodeCorners(code))).toBe(code);
    }
  });

  it("fuzz: 500 random scrambles encode/decode without errors and stay in range", () => {
    // broad sample (deterministic RNG) to catch any missing (id, slot, twist) table entry
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const independentMoves: MoveName[] = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];

    for (let trial = 0; trial < 500; trial++) {
      let state = createSolvedState();
      const length = 5 + Math.floor(rand() * 15);
      for (let i = 0; i < length; i++) {
        const name = independentMoves[Math.floor(rand() * independentMoves.length)];
        state = applyMoveName(state, name);
      }
      const corners = stateToCorners(state);
      const code = encodeCorners(corners);
      expect(code).toBeGreaterThanOrEqual(0);
      expect(code).toBeLessThan(STATE_COUNT);
      const decoded = decodeCorners(code);
      expect(decoded.perm).toEqual(corners.perm);
      expect(decoded.twist).toEqual(corners.twist);
    }
  });
});

// solve() speaks in the normalized frame; toPhysicalMove converts to the physical cube.
describe("toPhysicalMove — converts solver output to the physical frame", () => {
  function applyAll(moves: readonly MoveName[], start = createSolvedState()) {
    return moves.reduce((s, m) => applyMoveName(s, m), start);
  }

  it("is the identity while the reference corner is home (U/R/F only)", () => {
    const state = applyAll(["R", "U", "F'", "R'", "U2", "F"]);
    for (const m of solve(stateToCorners(state))) expect(toPhysicalMove(state, m)).toBe(m);
  });

  it("with D/L/B scrambles the raw output fails and the converted output solves", () => {
    for (const extra of ["D", "L", "B", "D'", "L'", "B'", "D2", "L2", "B2"] as MoveName[]) {
      const state = applyAll(["R", "U", extra, "F'", "R'"]);
      const raw = solve(stateToCorners(state));
      const physical = raw.map((m) => toPhysicalMove(state, m));
      expect(isSolved(applyAll(physical, state)), `${extra}: converted solution ${physical.join(" ")} did not solve`).toBe(true);
      expect(physical.length).toBe(raw.length);
    }
  });

  it("converted solutions solve 300 random six-face scrambles", () => {
    let seed = 99;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let trial = 0; trial < 300; trial++) {
      const length = 1 + Math.floor(rand() * 12);
      const scramble: MoveName[] = [];
      for (let i = 0; i < length; i++) scramble.push(ALL_MOVE_NAMES[Math.floor(rand() * ALL_MOVE_NAMES.length)]);
      const state = applyAll(scramble);
      const physical = solve(stateToCorners(state)).map((m) => toPhysicalMove(state, m));
      expect(isSolved(applyAll(physical, state)), `scramble=${scramble.join(" ")}`).toBe(true);
    }
  });
});
