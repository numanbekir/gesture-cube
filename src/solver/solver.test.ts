import { describe, expect, it } from "vitest";
import { createSolvedState } from "../cube-engine/state";
import { applyMoveName } from "../cube-engine/moves";
import type { MoveName } from "../cube-engine/types";
import { encodeCorners, stateToCorners, type Corners } from "./encoding";
import { applyMoveToCorners, INDEPENDENT_MOVES } from "./move-table";
import { solve } from "./solver";

function applyMoves(corners: Corners, moves: readonly MoveName[]): Corners {
  return moves.reduce((c, m) => applyMoveToCorners(c, m), corners);
}

function isSolvedCorners(corners: Corners): boolean {
  return encodeCorners(corners) === 0;
}

describe("solve", () => {
  it("returns an empty list for the solved state", () => {
    expect(solve(stateToCorners(createSolvedState()))).toEqual([]);
  });

  it("solves one-move scrambles in one move", () => {
    for (const move of INDEPENDENT_MOVES) {
      const corners = applyMoveToCorners(stateToCorners(createSolvedState()), move);
      const solution = solve(corners);
      expect(solution.length).toBe(1);
      expect(isSolvedCorners(applyMoves(corners, solution))).toBe(true);
    }
  });

  it("solutions actually solve 200 random scrambles", () => {
    let seed = 55;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let trial = 0; trial < 200; trial++) {
      let state = createSolvedState();
      const length = 1 + Math.floor(rand() * 14);
      for (let i = 0; i < length; i++) {
        const name = INDEPENDENT_MOVES[Math.floor(rand() * INDEPENDENT_MOVES.length)];
        state = applyMoveName(state, name);
      }
      const corners = stateToCorners(state);
      const solution = solve(corners);
      expect(isSolvedCorners(applyMoves(corners, solution))).toBe(true);
      // the inverse scramble is a solution of the same length; optimal cannot be longer
      expect(solution.length).toBeLessThanOrEqual(length);
    }
  });

  it("is optimal: matches true minimum distances from a depth-4 BFS", () => {
    // depth-4 BFS gives true minimum distances, independent of the solver heuristic
    const solved = stateToCorners(createSolvedState());
    const distanceByCode = new Map<number, number>();
    const cornersByCode = new Map<number, Corners>();
    distanceByCode.set(encodeCorners(solved), 0);
    cornersByCode.set(encodeCorners(solved), solved);

    let frontier: Corners[] = [solved];
    for (let depth = 0; depth < 4; depth++) {
      const next: Corners[] = [];
      for (const corners of frontier) {
        for (const move of INDEPENDENT_MOVES) {
          const child = applyMoveToCorners(corners, move);
          const code = encodeCorners(child);
          if (!distanceByCode.has(code)) {
            distanceByCode.set(code, depth + 1);
            cornersByCode.set(code, child);
            next.push(child);
          }
        }
      }
      frontier = next;
    }

    let sampleCount = 0;
    for (const [code, expectedDistance] of distanceByCode) {
      if (expectedDistance === 0 || sampleCount >= 150) continue;
      sampleCount++;
      const corners = cornersByCode.get(code)!;
      const solution = solve(corners);
      expect(solution.length).toBe(expectedDistance);
    }
    expect(sampleCount).toBeGreaterThan(0);
  });
});
