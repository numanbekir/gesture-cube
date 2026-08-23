import type { MoveName } from "../cube-engine/types";
import type { Corners } from "./encoding";
import { applyMoveToCorners, INDEPENDENT_MOVES } from "./move-table";
import { permutationDistance } from "./pruning";

function isSolved(corners: Corners): boolean {
  return corners.perm.every((slot, i) => slot === i) && corners.twist.every((t) => t === 0);
}

// Two consecutive turns of the same face always collapse into one move; prune them.
function sameFace(a: MoveName, b: MoveName): boolean {
  return a[0] === b[0];
}

// IDA* with permutationDistance as the admissible heuristic. The 2x2 God's number is 11
// (quarter-turn metric), so random scrambles solve in milliseconds without a twist table.
//
// Output is in the NORMALIZED frame (corner id=7 fixed to identity): convert with
// encoding.ts toPhysicalMove before applying or displaying on the physical cube.
export function solve(start: Corners): MoveName[] {
  let bound = permutationDistance(start);
  const path: MoveName[] = [];

  // Returns true when found, otherwise the next bound to try.
  function search(node: Corners, g: number, previousInPath: MoveName | null): number | true {
    const f = g + permutationDistance(node);
    if (f > bound) return f;
    if (isSolved(node)) return true;

    let min = Infinity;
    for (const move of INDEPENDENT_MOVES) {
      if (previousInPath && sameFace(move, previousInPath)) continue;
      const child = applyMoveToCorners(node, move);
      path.push(move);
      const result = search(child, g + 1, move);
      if (result === true) return true;
      if (result < min) min = result;
      path.pop();
    }
    return min;
  }

  if (isSolved(start)) return [];

  while (true) {
    const result = search(start, 0, null);
    if (result === true) return [...path];
    if (result === Infinity) throw new Error("No solution found: pruning or move table is inconsistent");
    bound = result;
  }
}
