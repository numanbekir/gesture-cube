import type { Axis, CubeState, Mat3, Move, MoveName } from "./types";
import { mat3Power, multiplyMat3 } from "./mat3";
import { currentPosition } from "./state";

const RX: Mat3 = [
  [1, 0, 0],
  [0, 0, -1],
  [0, 1, 0],
];
const RY: Mat3 = [
  [0, 0, 1],
  [0, 1, 0],
  [-1, 0, 0],
];
const RZ: Mat3 = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
];

const BASE_ROTATIONS: Record<Axis, Mat3> = { x: RX, y: RY, z: RZ };

export type Face = "U" | "D" | "L" | "R" | "F" | "B";

const BASE: Record<Face, { axis: Axis; layer: 1 | -1; turns: 1 | 3 }> = {
  U: { axis: "y", layer: 1, turns: 3 },
  D: { axis: "y", layer: -1, turns: 1 },
  L: { axis: "x", layer: -1, turns: 1 },
  R: { axis: "x", layer: 1, turns: 3 },
  F: { axis: "z", layer: 1, turns: 3 },
  B: { axis: "z", layer: -1, turns: 1 },
};

// Inverse of BASE: (axis, layer) → face letter.
export function faceForAxisLayer(axis: Axis, layer: 1 | -1): Face {
  const entry = (Object.entries(BASE) as [Face, { axis: Axis; layer: 1 | -1; turns: 1 | 3 }][]).find(([, base]) => base.axis === axis && base.layer === layer);
  if (!entry) throw new Error(`No face for (${axis}, ${layer})`);
  return entry[0];
}

// Inverse of parseMove; covers all six faces (needed by encoding.ts toPhysicalMove).
export function moveToName(move: Move): MoveName {
  const face = faceForAxisLayer(move.axis, move.layer);
  const base = BASE[face];
  if (move.turns === 2) return `${face}2` as MoveName;
  return (move.turns === base.turns ? face : `${face}'`) as MoveName;
}

export function parseMove(name: MoveName): Move {
  const face = name[0] as Face;
  const suffix = name.slice(1);
  const base = BASE[face];
  const turns: 1 | 2 | 3 = suffix === "2" ? 2 : suffix === "'" ? ((4 - base.turns) as 1 | 3) : base.turns;
  return { axis: base.axis, layer: base.layer, turns };
}

function moveRotationMatrix(move: Move): Mat3 {
  return mat3Power(BASE_ROTATIONS[move.axis], move.turns);
}

export const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export function applyMove(state: CubeState, move: Move): CubeState {
  const rotation = moveRotationMatrix(move);
  const axisIndex = AXIS_INDEX[move.axis];
  return state.map((cubie) => {
    const pos = currentPosition(cubie);
    if (Math.round(pos[axisIndex]) !== move.layer) return cubie;
    return { ...cubie, orientation: multiplyMat3(rotation, cubie.orientation) };
  });
}

export function applyMoveName(state: CubeState, name: MoveName): CubeState {
  return applyMove(state, parseMove(name));
}
