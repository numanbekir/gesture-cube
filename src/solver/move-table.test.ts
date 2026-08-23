import { describe, expect, it } from "vitest";
import { createSolvedState } from "../cube-engine/state";
import { applyMoveName } from "../cube-engine/moves";
import type { MoveName } from "../cube-engine/types";
import { encodeCorners, encodeState, stateToCorners } from "./encoding";
import { applyMoveToCorners, INDEPENDENT_MOVES } from "./move-table";

describe("applyMoveToCorners", () => {
  it("matches the cube-engine (Mat3) encoding after each of the 9 independent moves", () => {
    // two independent paths (cube-engine Mat3 math vs. move-table lookup) must agree
    const solvedCorners = stateToCorners(createSolvedState());
    for (const move of INDEPENDENT_MOVES) {
      const viaMoveTable = encodeCorners(applyMoveToCorners(solvedCorners, move));
      const viaCubeEngine = encodeState(applyMoveName(createSolvedState(), move));
      expect(viaMoveTable).toBe(viaCubeEngine);
    }
  });

  it("fuzz: both methods agree at every step of 300 random move chains", () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    let state = createSolvedState();
    let corners = stateToCorners(state);

    for (let i = 0; i < 300; i++) {
      const move = INDEPENDENT_MOVES[Math.floor(rand() * INDEPENDENT_MOVES.length)];
      state = applyMoveName(state, move);
      corners = applyMoveToCorners(corners, move);
      expect(encodeCorners(corners)).toBe(encodeState(state));
    }
  });

  it("a move followed by its inverse leaves corners unchanged", () => {
    const inverseOf: Record<string, MoveName> = {
      U: "U'", "U'": "U", U2: "U2",
      R: "R'", "R'": "R", R2: "R2",
      F: "F'", "F'": "F", F2: "F2",
    };
    for (const move of INDEPENDENT_MOVES) {
      const start = stateToCorners(createSolvedState());
      const afterMove = applyMoveToCorners(start, move);
      const afterInverse = applyMoveToCorners(afterMove, inverseOf[move]);
      expect(afterInverse.perm).toEqual(start.perm);
      expect(afterInverse.twist).toEqual(start.twist);
    }
  });

  it("three quarter turns differ from X2, four return to identity", () => {
    for (const base of ["U", "R", "F"] as const) {
      let corners = stateToCorners(createSolvedState());
      for (let i = 0; i < 4; i++) corners = applyMoveToCorners(corners, base);
      expect(encodeCorners(corners)).toBe(0);
    }
  });
});
