import { describe, expect, it } from "vitest";
import { directionForFingerCount, moveForDirection, referenceFaceForAxis, targetForMove, type Direction } from "./layer-swipe";
import type { Axis } from "../cube-engine/types";
import type { GridCell } from "./face-grid";

const CELL: GridCell = {
  cubieId: 0,
  quadrant: "TR",
  horizontalLayer: { axis: "y", layer: 1 }, // U
  verticalLayer: { axis: "x", layer: 1 }, // R
};

// 4 cells of the z-facing face (horizontalAxis=y, verticalAxis=x), same layout as face-grid.test.ts.
const CELLS: readonly GridCell[] = [
  { cubieId: 0, quadrant: "TR", horizontalLayer: { axis: "y", layer: 1 }, verticalLayer: { axis: "x", layer: 1 } },
  { cubieId: 1, quadrant: "TL", horizontalLayer: { axis: "y", layer: 1 }, verticalLayer: { axis: "x", layer: -1 } },
  { cubieId: 2, quadrant: "BR", horizontalLayer: { axis: "y", layer: -1 }, verticalLayer: { axis: "x", layer: 1 } },
  { cubieId: 3, quadrant: "BL", horizontalLayer: { axis: "y", layer: -1 }, verticalLayer: { axis: "x", layer: -1 } },
];

describe("directionForFingerCount", () => {
  it("1 finger → right", () => {
    expect(directionForFingerCount(1)).toBe("right");
  });

  it("2 fingers → left", () => {
    expect(directionForFingerCount(2)).toBe("left");
  });

  it("3 fingers → up", () => {
    expect(directionForFingerCount(3)).toBe("up");
  });

  it("4 fingers → down", () => {
    expect(directionForFingerCount(4)).toBe("down");
  });

  it("returns null for 0 or an invalid count", () => {
    expect(directionForFingerCount(0)).toBeNull();
    expect(directionForFingerCount(5)).toBeNull();
  });
});

describe("moveForDirection", () => {
  it("right → normal move of the cell's horizontal layer", () => {
    expect(moveForDirection(CELL, "right")).toBe("U");
  });

  it("left → inverse (') of the horizontal layer", () => {
    expect(moveForDirection(CELL, "left")).toBe("U'");
  });

  it("up → normal move of the cell's vertical layer", () => {
    expect(moveForDirection(CELL, "up")).toBe("R");
  });

  it("down → inverse (') of the vertical layer", () => {
    expect(moveForDirection(CELL, "down")).toBe("R'");
  });
});

// Round-trip check of the pure logic behind the on-cube hint.
describe("targetForMove — inverse of moveForDirection (round trip)", () => {
  const DIRECTIONS: readonly Direction[] = ["right", "left", "up", "down"];

  for (const cell of CELLS) {
    for (const direction of DIRECTIONS) {
      it(`move from ${cell.quadrant} + ${direction} resolves back to the same target`, () => {
        const move = moveForDirection(cell, direction);
        const target = targetForMove(move, CELLS);
        expect(target).not.toBeNull();
        expect(target?.direction).toBe(direction);
        const isHorizontal = direction === "left" || direction === "right";
        const expectedLayer = isHorizontal ? cell.horizontalLayer : cell.verticalLayer;
        const actualLayer = isHorizontal ? target?.cell.horizontalLayer : target?.cell.verticalLayer;
        expect(actualLayer).toEqual(expectedLayer);
      });
    }
  }

  it("returns null when the move axis is the facing face's own axis", () => {
    expect(targetForMove("F", CELLS)).toBeNull();
    expect(targetForMove("F'", CELLS)).toBeNull();
    expect(targetForMove("B2", CELLS)).toBeNull();
  });

  it("picks the positive direction for '2' moves", () => {
    expect(targetForMove("U2", CELLS)).toEqual(targetForMove("U", CELLS));
    expect(targetForMove("R2", CELLS)).toEqual(targetForMove("R", CELLS));
  });

  it("returns null for an empty cell list", () => {
    expect(targetForMove("U", [])).toBeNull();
  });
});

describe("referenceFaceForAxis", () => {
  it("never returns the excluded axis", () => {
    for (const axis of ["x", "y", "z"] as const) {
      expect(referenceFaceForAxis(axis).axis).not.toBe(axis);
    }
  });

  it("is deterministic for a given axis", () => {
    const axes: readonly Axis[] = ["x", "y", "z"];
    for (const axis of axes) {
      const first = referenceFaceForAxis(axis);
      const second = referenceFaceForAxis(axis);
      expect(second).toEqual(first);
    }
  });
});
