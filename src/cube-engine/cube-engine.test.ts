import { describe, expect, it } from "vitest";
import { createSolvedState, currentPosition, isSolved } from "./state";
import { applyMoveName, faceForAxisLayer, parseMove } from "./moves";
import type { CubeState, MoveName } from "./types";

const ALL_MOVE_NAMES: MoveName[] = [
  "U", "U'", "U2",
  "D", "D'", "D2",
  "L", "L'", "L2",
  "R", "R'", "R2",
  "F", "F'", "F2",
  "B", "B'", "B2",
];

function positionSet(state: CubeState): string {
  return state
    .map((cubie) => currentPosition(cubie).join(","))
    .sort()
    .join(" | ");
}

describe("cube-engine", () => {
  it("the solved state reports isSolved", () => {
    expect(isSolved(createSolvedState())).toBe(true);
  });

  it("every move followed by its inverse returns to identity", () => {
    const faces: [MoveName, MoveName][] = [
      ["U", "U'"], ["D", "D'"], ["L", "L'"],
      ["R", "R'"], ["F", "F'"], ["B", "B'"],
    ];
    for (const [move, inverse] of faces) {
      let state = createSolvedState();
      state = applyMoveName(state, move);
      state = applyMoveName(state, inverse);
      expect(isSolved(state)).toBe(true);
    }
  });

  it("applying a move 4 times returns to identity", () => {
    for (const name of ["U", "D", "L", "R", "F", "B"] as const) {
      let state = createSolvedState();
      for (let i = 0; i < 4; i++) state = applyMoveName(state, name);
      expect(isSolved(state)).toBe(true);
    }
  });

  it("X2 equals X applied twice", () => {
    for (const [double, single] of [["U2", "U"], ["R2", "R"], ["F2", "F"]] as [MoveName, MoveName][]) {
      const viaDouble = applyMoveName(createSolvedState(), double);
      let viaTwoSingles = createSolvedState();
      viaTwoSingles = applyMoveName(viaTwoSingles, single);
      viaTwoSingles = applyMoveName(viaTwoSingles, single);
      expect(positionSet(viaDouble)).toBe(positionSet(viaTwoSingles));
    }
  });

  it("positions stay unique and form the original set after every move", () => {
    let state = createSolvedState();
    const solvedPositions = positionSet(state);
    for (const name of ALL_MOVE_NAMES) {
      state = applyMoveName(state, name);
      const positions = new Set(state.map((c) => currentPosition(c).join(",")));
      expect(positions.size).toBe(8);
      expect(positionSet(state)).toBe(solvedPositions);
    }
  });

  it("a long scramble leaves the cube unsolved", () => {
    let state = createSolvedState();
    const scramble: MoveName[] = ["U", "R", "F'", "L2", "D", "B", "U'", "R2"];
    for (const name of scramble) state = applyMoveName(state, name);
    expect(isSolved(state)).toBe(false);
  });

  it("faceForAxisLayer inverts the (axis, layer) part of parseMove for every face", () => {
    for (const face of ["U", "D", "L", "R", "F", "B"] as const) {
      const { axis, layer } = parseMove(face);
      expect(faceForAxisLayer(axis, layer)).toBe(face);
    }
  });
});
