import { type Corners, stateToCorners } from "./encoding";
import { applyMoveToCorners, INDEPENDENT_MOVES } from "./move-table";
import { createSolvedState } from "../cube-engine/state";

// Lehmer code of the 7-corner permutation (0..5039), ignoring twist.
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

export const PERMUTATION_STATE_COUNT = 5040; // 7!

// Permutation updates are independent of twist (verified empirically), so a
// permutation-only distance table is a valid lower bound. Twist is not independent of
// permutation, so no separate twist table is possible — and none is needed for a 2x2.
// Built once at module load by BFS from the solved state; -1 = unreached.
function buildPermutationDistanceTable(): Int8Array {
  const distances = new Int8Array(PERMUTATION_STATE_COUNT).fill(-1);
  const solved = stateToCorners(createSolvedState());
  const startIndex = encodePermutation(solved.perm);
  distances[startIndex] = 0;

  let frontier: Corners[] = [solved];
  let distance = 0;
  while (frontier.length > 0) {
    const next: Corners[] = [];
    for (const corners of frontier) {
      for (const move of INDEPENDENT_MOVES) {
        const child = applyMoveToCorners(corners, move);
        const index = encodePermutation(child.perm);
        if (distances[index] === -1) {
          distances[index] = distance + 1;
          next.push(child);
        }
      }
    }
    frontier = next;
    distance++;
  }

  if (distances.includes(-1)) throw new Error("Permutation pruning table incomplete");
  return distances;
}

const PERMUTATION_DISTANCE = buildPermutationDistanceTable();

// Admissible lower bound for IDA*: moves needed to fix the permutation alone.
export function permutationDistance(corners: Corners): number {
  return PERMUTATION_DISTANCE[encodePermutation(corners.perm)];
}
