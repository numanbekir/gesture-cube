import type { MoveName } from "../cube-engine/types";
import { INDEPENDENT_MOVES } from "./move-table";

const DEFAULT_SCRAMBLE_LENGTH = 11; // God's number of the 2x2 (quarter-turn metric)

function sameFace(a: MoveName, b: MoveName): boolean {
  return a[0] === b[0];
}

// Random scramble from the U/R/F family, never repeating a face back to back.
// `random` is injectable for deterministic tests.
export function generateScramble(length: number = DEFAULT_SCRAMBLE_LENGTH, random: () => number = Math.random): MoveName[] {
  const scramble: MoveName[] = [];
  let lastMove: MoveName | null = null;
  while (scramble.length < length) {
    const candidate = INDEPENDENT_MOVES[Math.floor(random() * INDEPENDENT_MOVES.length)];
    if (lastMove && sameFace(candidate, lastMove)) continue;
    scramble.push(candidate);
    lastMove = candidate;
  }
  return scramble;
}
