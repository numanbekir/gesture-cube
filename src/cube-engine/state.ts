import type { Cubie, CubeState, Vec3 } from "./types";
import { IDENTITY, applyMat3, mat3Equals } from "./mat3";

export const HOME_POSITIONS: readonly Vec3[] = [
  [-1, 1, 1],
  [1, 1, 1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, -1, -1],
  [-1, -1, -1],
];

export function createSolvedState(): CubeState {
  return HOME_POSITIONS.map((home, id) => ({ id, home, orientation: IDENTITY }));
}

export function currentPosition(cubie: Cubie): Vec3 {
  return applyMat3(cubie.orientation, cubie.home);
}

// Solved = all corners share one orientation. Not necessarily identity: the whole cube
// may end up rigidly rotated, which is still physically solved (encodeState returns 0).
export function isSolved(state: CubeState): boolean {
  const reference = state[0]?.orientation ?? IDENTITY;
  return state.every((cubie) => mat3Equals(cubie.orientation, reference));
}
