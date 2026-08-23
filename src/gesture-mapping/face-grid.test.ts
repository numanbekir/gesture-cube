import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Axis, MoveName, Vec3 } from "../cube-engine/types";
import { createSolvedState, HOME_POSITIONS } from "../cube-engine/state";
import { applyMoveName } from "../cube-engine/moves";
import { nearestSnapOrientation } from "../render/cube-snap";
import { cellForQuadrant, computeFaceGrid, quadrantForFingerCount, type GridCell, type Quadrant } from "./face-grid";

const RIGHT = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const SOLVED = createSolvedState();

function cubieIdAt(home: Vec3): number {
  return HOME_POSITIONS.findIndex((h) => h[0] === home[0] && h[1] === home[1] && h[2] === home[2]);
}

describe("computeFaceGrid (identity quaternion, axis-aligned camera, solved state)", () => {
  const cells = computeFaceGrid("z", 1, SOLVED, new THREE.Quaternion(), RIGHT, UP);

  it("front face (z=1) has exactly 4 cells", () => {
    expect(cells.length).toBe(4);
  });

  it("the 4 cells land in 4 distinct quadrants", () => {
    const quadrants = new Set(cells.map((c) => c.quadrant));
    expect(quadrants.size).toBe(4);
  });

  // R (x axis) maps to the VERTICAL layer and U (y axis) to the HORIZONTAL one — see computeFaceGrid
  it("home=(1,1,1) is TR, at the intersection of R (vertical) and U (horizontal)", () => {
    const cell = cells.find((c) => c.cubieId === cubieIdAt([1, 1, 1]));
    expect(cell?.quadrant).toBe("TR");
    expect(cell?.verticalLayer).toEqual({ axis: "x", layer: 1 }); // R
    expect(cell?.horizontalLayer).toEqual({ axis: "y", layer: 1 }); // U
  });

  it("home=(-1,1,1) is TL, at the intersection of L (vertical) and U (horizontal)", () => {
    const cell = cells.find((c) => c.cubieId === cubieIdAt([-1, 1, 1]));
    expect(cell?.quadrant).toBe("TL");
    expect(cell?.verticalLayer).toEqual({ axis: "x", layer: -1 }); // L
    expect(cell?.horizontalLayer).toEqual({ axis: "y", layer: 1 }); // U
  });

  it("home=(1,-1,1) is BR, at the intersection of R (vertical) and D (horizontal)", () => {
    const cell = cells.find((c) => c.cubieId === cubieIdAt([1, -1, 1]));
    expect(cell?.quadrant).toBe("BR");
    expect(cell?.verticalLayer).toEqual({ axis: "x", layer: 1 }); // R
    expect(cell?.horizontalLayer).toEqual({ axis: "y", layer: -1 }); // D
  });

  it("home=(-1,-1,1) is BL, at the intersection of L (vertical) and D (horizontal)", () => {
    const cell = cells.find((c) => c.cubieId === cubieIdAt([-1, -1, 1]));
    expect(cell?.quadrant).toBe("BL");
    expect(cell?.verticalLayer).toEqual({ axis: "x", layer: -1 }); // L
    expect(cell?.horizontalLayer).toEqual({ axis: "y", layer: -1 }); // D
  });
});

describe("computeFaceGrid — consistency across all 6 faces (camera facing each face)", () => {
  // simulate nearestSnapOrientation by moving the camera onto each face normal
  function faceNormal(axis: Axis, layer: 1 | -1): THREE.Vector3 {
    return new THREE.Vector3(axis === "x" ? layer : 0, axis === "y" ? layer : 0, axis === "z" ? layer : 0);
  }

  const faces: [Axis, 1 | -1][] = [
    ["x", 1], ["x", -1],
    ["y", 1], ["y", -1],
    ["z", 1], ["z", -1],
  ];

  for (const [axis, layer] of faces) {
    it(`${axis}${layer > 0 ? "+" : "-"} face: 4 cells, 4 distinct quadrants, consistent layers`, () => {
      const cameraForward = faceNormal(axis, layer).negate();
      const worldUpRef = axis === "y" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const cameraRight = new THREE.Vector3().crossVectors(cameraForward, worldUpRef).normalize();
      const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraForward).normalize();

      const cells = computeFaceGrid(axis, layer, SOLVED, new THREE.Quaternion(), cameraRight, cameraUp);
      expect(cells.length).toBe(4);
      expect(new Set(cells.map((c) => c.quadrant)).size).toBe(4);
      for (const cell of cells) {
        // no layer may share the facing axis
        expect(cell.horizontalLayer.axis).not.toBe(axis);
        expect(cell.verticalLayer.axis).not.toBe(axis);
        expect(cell.horizontalLayer.axis).not.toBe(cell.verticalLayer.axis);
      }
    });
  }
});

describe("computeFaceGrid — with a real snapped orientation (nearestSnapOrientation)", () => {
  it("still yields 4 distinct quadrants after rotating and snapping", () => {
    const cameraForward = new THREE.Vector3(-3, -3, -4).normalize(); // scene.ts camera at (3,3,4) looking at the origin
    const worldUp = new THREE.Vector3(0, 1, 0);
    const cameraRight = new THREE.Vector3().crossVectors(cameraForward, worldUp).normalize();
    const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraForward).normalize();

    // rotate randomly, snap to the nearest face — the real app flow
    const arbitrary = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 1.3, 0.4));
    const snap = nearestSnapOrientation(arbitrary, cameraForward, cameraUp);

    const cells = computeFaceGrid(snap.axis, snap.layer, SOLVED, snap.quaternion, cameraRight, cameraUp);
    expect(cells.length).toBe(4);
    expect(new Set(cells.map((c) => c.quadrant)).size).toBe(4);
  });
});

describe("computeFaceGrid — scrambled state (cubieId must be the real occupant)", () => {
  it("quadrant→cubieId mapping of the front face changes after an R move", () => {
    // R turns the x=1 layer (half of the front face); the mapping must change because
    // computeFaceGrid reads occupants from the real state, not HOME_POSITIONS
    const solvedCells = computeFaceGrid("z", 1, SOLVED, new THREE.Quaternion(), RIGHT, UP);
    const scrambled = applyMoveName(SOLVED, "R" as MoveName);
    const scrambledCells = computeFaceGrid("z", 1, scrambled, new THREE.Quaternion(), RIGHT, UP);

    const solvedMap = Object.fromEntries(solvedCells.map((c) => [c.quadrant, c.cubieId]));
    const scrambledMap = Object.fromEntries(scrambledCells.map((c) => [c.quadrant, c.cubieId]));
    expect(scrambledMap).not.toEqual(solvedMap);
  });

  it("scrambled state still has 4 distinct quadrants with consistent layers", () => {
    const scrambled = applyMoveName(applyMoveName(SOLVED, "R" as MoveName), "U" as MoveName);
    const cells = computeFaceGrid("z", 1, scrambled, new THREE.Quaternion(), RIGHT, UP);
    expect(cells.length).toBe(4);
    expect(new Set(cells.map((c) => c.quadrant)).size).toBe(4);
    for (const cell of cells) {
      expect(cell.horizontalLayer.axis).not.toBe("z");
      expect(cell.verticalLayer.axis).not.toBe("z");
    }
  });
});

describe("quadrantForFingerCount / cellForQuadrant", () => {
  it("maps 1-4 fingers to TL/TR/BL/BR", () => {
    expect(quadrantForFingerCount(1)).toBe("TL");
    expect(quadrantForFingerCount(2)).toBe("TR");
    expect(quadrantForFingerCount(3)).toBe("BL");
    expect(quadrantForFingerCount(4)).toBe("BR");
  });

  it("returns null for 0 and 5+ fingers", () => {
    expect(quadrantForFingerCount(0)).toBeNull();
    expect(quadrantForFingerCount(5)).toBeNull();
  });

  it("cellForQuadrant finds the right cell", () => {
    const cells = computeFaceGrid("z", 1, SOLVED, new THREE.Quaternion(), RIGHT, UP);
    const cell = cellForQuadrant(cells, "TR" as Quadrant) as GridCell;
    expect(cell.cubieId).toBe(cubieIdAt([1, 1, 1]));
  });
});
