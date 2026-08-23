import type { CubeState, Mat3, MoveName } from "../cube-engine/types";
import { IDENTITY, transposeMat3, multiplyMat3 } from "../cube-engine/mat3";
import { currentPosition, createSolvedState, HOME_POSITIONS } from "../cube-engine/state";
import { AXIS_INDEX, applyMoveName, moveToName, parseMove } from "../cube-engine/moves";
import type { Axis, Move } from "../cube-engine/types";

// Reference corner id=7 (home [-1,-1,-1]). normalize() rotates the whole cube so this
// corner is always at identity, removing whole-cube rotation from the encoding.
// In that frame D≡U, L≡R, B≡F, so the state space is covered by the 9 U/R/F moves.
const REFERENCE_ID = 7;
const INDEPENDENT_MOVES: readonly MoveName[] = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];

export const PERMUTATION_COUNT = 5040; // 7!
// All 7 twists are encoded (3^7). The classic "sum of twists mod 3 = 0" shortcut does not
// hold here because twist zero is an arbitrary per-(id, slot) reference (see buildTwistTables).
export const ORIENTATION_COUNT = 2187; // 3^7
export const STATE_COUNT = PERMUTATION_COUNT * ORIENTATION_COUNT; // address space; 3,674,160 reachable

// The 7 non-reference corners, in the fixed order used by perm/twist arrays.
export const CORNER_IDS = [0, 1, 2, 3, 4, 5, 6] as const;

// Compact solver representation: for CORNER_IDS[i], its slot (HOME_POSITIONS index) and twist.
export interface Corners {
  readonly perm: readonly number[]; // length 7
  readonly twist: readonly number[]; // length 7
}

// Rotates the whole state so the reference corner is at identity.
function normalize(state: CubeState): CubeState {
  const reference = state.find((c) => c.id === REFERENCE_ID);
  if (!reference) throw new Error("Reference corner (id=7) missing");
  const inverse = transposeMat3(reference.orientation);
  return state.map((c) => ({ ...c, orientation: multiplyMat3(inverse, c.orientation) }));
}

// solve() works in the normalized frame: its "U" means "the layer that is U when the
// reference corner is at identity". Once the reference corner has been rotated (D/L/B
// moves do that) the physical face differs, so every solver move must go through here
// before being applied or shown.
//
// Math: pos_solver = R·pos_phys with R = inv(ref), so the physical axis is the `axis`
// column of ref (a single ±1 entry). A negative sign flips both the layer and the turn
// direction.
export function toPhysicalMove(state: CubeState, solverMove: MoveName): MoveName {
  const reference = state.find((c) => c.id === REFERENCE_ID);
  if (!reference) throw new Error("Reference corner (id=7) missing");
  const move = parseMove(solverMove);
  const column = AXIS_INDEX[move.axis];
  const axes: readonly Axis[] = ["x", "y", "z"];
  let physicalAxis: Axis | null = null;
  let sign = 0;
  for (let row = 0; row < 3; row++) {
    const v = reference.orientation[row][column];
    if (v !== 0) {
      physicalAxis = axes[row];
      sign = v;
    }
  }
  if (!physicalAxis || (sign !== 1 && sign !== -1)) throw new Error(`Reference orientation is not a rotation matrix: ${mat3Key(reference.orientation)}`);
  const physical: Move = {
    axis: physicalAxis,
    layer: (sign * move.layer) as 1 | -1,
    turns: sign === 1 ? move.turns : ((4 - move.turns) as 1 | 2 | 3),
  };
  return moveToName(physical);
}

function positionSlotOf(pos: readonly [number, number, number]): number {
  return HOME_POSITIONS.findIndex((h) => h[0] === pos[0] && h[1] === pos[1] && h[2] === pos[2]);
}

function mat3Key(m: Mat3): string {
  return `${m[0][0]},${m[0][1]},${m[0][2]},${m[1][0]},${m[1][1]},${m[1][2]},${m[2][0]},${m[2][1]},${m[2][2]}`;
}

function stateKey(state: CubeState): string {
  return state.map((c) => `${c.id}:${mat3Key(c.orientation)}`).join("|");
}

// Twist depends on (id, slot), not slot alone: each pair has its own set of 3
// orientations. twist=0 is identity at the home slot (so the solved state encodes to 0)
// and an arbitrary but stable BFS-first orientation elsewhere. Tables are learned from
// the cube engine instead of derived by formula to avoid sign/chirality mistakes.
function buildTwistTables(): ReadonlyArray<ReadonlyArray<ReadonlyMap<string, number>>> {
  // tables[id][slot] = Map<orientationKey, twist>
  const tables: Map<string, number>[][] = CORNER_IDS.map(() => Array.from({ length: 7 }, () => new Map()));
  for (const id of CORNER_IDS) {
    const homeSlot = positionSlotOf(HOME_POSITIONS[id]);
    tables[id][homeSlot].set(mat3Key(IDENTITY), 0);
  }

  const isComplete = () => tables.every((perId) => perId.every((t) => t.size === 3));

  const seen = new Set<string>();
  let frontier: CubeState[] = [createSolvedState()];
  seen.add(stateKey(frontier[0]));

  while (frontier.length > 0 && !isComplete()) {
    const next: CubeState[] = [];
    for (const state of frontier) {
      for (const cubie of state) {
        if (cubie.id === REFERENCE_ID) continue;
        const slot = positionSlotOf(currentPosition(cubie));
        const key = mat3Key(cubie.orientation);
        const table = tables[cubie.id][slot];
        if (!table.has(key) && table.size < 3) table.set(key, table.size);
      }
      if (isComplete()) break;
      for (const move of INDEPENDENT_MOVES) {
        const child = applyMoveName(state, move);
        const key = stateKey(child);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(child);
        }
      }
    }
    frontier = next;
  }

  if (!isComplete()) throw new Error("Twist table incomplete");
  return tables;
}

const TWIST_TABLES = buildTwistTables();

function cornerTwist(orientation: Mat3, id: number, slot: number): number {
  const twist = TWIST_TABLES[id][slot].get(mat3Key(orientation));
  if (twist === undefined) throw new Error(`Unknown orientation (id=${id}, slot=${slot}): ${mat3Key(orientation)}`);
  return twist;
}

// Normalizes the state and reads slot + twist of every non-reference corner.
export function stateToCorners(state: CubeState): Corners {
  const normalized = normalize(state);
  const positionOf = new Map<number, number>();
  const twistOf = new Map<number, number>();
  for (const cubie of normalized) {
    if (cubie.id === REFERENCE_ID) continue;
    const slot = positionSlotOf(currentPosition(cubie));
    positionOf.set(cubie.id, slot);
    twistOf.set(cubie.id, cornerTwist(cubie.orientation, cubie.id, slot));
  }
  return {
    perm: CORNER_IDS.map((id) => positionOf.get(id)!),
    twist: CORNER_IDS.map((id) => twistOf.get(id)!),
  };
}

// Lehmer code: permutation → index.
function encodePermutation(perm: readonly number[]): number {
  let index = 0;
  for (let i = 0; i < perm.length; i++) {
    let smallerCount = 0;
    for (let j = i + 1; j < perm.length; j++) {
      if (perm[j] < perm[i]) smallerCount++;
    }
    index = index * (perm.length - i) + smallerCount;
  }
  return index;
}

// Inverse of encodePermutation.
function decodePermutation(index: number, n: number): number[] {
  const available = Array.from({ length: n }, (_, i) => i);
  const perm: number[] = [];
  let remaining = index;
  for (let i = n; i >= 1; i--) {
    const factorial = factorialOf(i - 1);
    const choice = Math.floor(remaining / factorial);
    remaining %= factorial;
    perm.push(available[choice]);
    available.splice(choice, 1);
  }
  return perm;
}

function factorialOf(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// Corners → single integer in 0..STATE_COUNT-1.
export function encodeCorners({ perm, twist }: Corners): number {
  const permIndex = encodePermutation(perm);
  let twistIndex = 0;
  for (let i = 0; i < 7; i++) twistIndex = twistIndex * 3 + twist[i];
  return permIndex * ORIENTATION_COUNT + twistIndex;
}

// Inverse of encodeCorners.
export function decodeCorners(code: number): Corners {
  const permIndex = Math.floor(code / ORIENTATION_COUNT);
  let twistIndex = code % ORIENTATION_COUNT;
  const perm = decodePermutation(permIndex, 7);

  const twist: number[] = new Array(7).fill(0);
  for (let i = 6; i >= 0; i--) {
    twist[i] = twistIndex % 3;
    twistIndex = Math.floor(twistIndex / 3);
  }

  return { perm, twist };
}

// Whole-cube-rotation-independent state code; the solved state encodes to 0.
export function encodeState(state: CubeState): number {
  return encodeCorners(stateToCorners(state));
}
