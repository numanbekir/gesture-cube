import type { CubeState, MoveName } from "../cube-engine/types";
import { createSolvedState } from "../cube-engine/state";
import { applyMoveName } from "../cube-engine/moves";
import { CORNER_IDS, type Corners, stateToCorners } from "./encoding";

// The 2x2 state space is fully covered by U/R/F moves (D≡U, L≡R, B≡F, see encoding.ts).
export const INDEPENDENT_MOVES: readonly MoveName[] = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];

function effectKey(id: number, slot: number, twist: number): string {
  return `${id}:${slot}:${twist}`;
}

interface MoveEffect {
  readonly slot: number;
  readonly twist: number;
}

function mat3Key(m: readonly (readonly number[])[]): string {
  return m.flat().join(",");
}

function stateKey(state: CubeState): string {
  return state.map((c) => `${c.id}:${mat3Key(c.orientation)}`).join("|");
}

// Per move: (id, slot, twist) → (slot, twist) after the move. All 7×7×3 = 147 combinations
// are learned once at module load by running the cube engine over a BFS of states.
function buildMoveEffectTables(): ReadonlyMap<MoveName, ReadonlyMap<string, MoveEffect>> {
  const tables = new Map<MoveName, Map<string, MoveEffect>>();
  for (const move of INDEPENDENT_MOVES) tables.set(move, new Map());

  const TARGET_SIZE = 7 * 7 * 3;
  const isComplete = () => INDEPENDENT_MOVES.every((move) => tables.get(move)!.size === TARGET_SIZE);

  const seen = new Set<string>();
  let frontier: CubeState[] = [createSolvedState()];
  seen.add(stateKey(frontier[0]));

  while (frontier.length > 0 && !isComplete()) {
    const next: CubeState[] = [];
    for (const state of frontier) {
      const before = stateToCorners(state);
      for (const move of INDEPENDENT_MOVES) {
        const after = applyMoveName(state, move);
        const afterCorners = stateToCorners(after);
        const table = tables.get(move)!;
        for (let i = 0; i < CORNER_IDS.length; i++) {
          const id = CORNER_IDS[i];
          const key = effectKey(id, before.perm[i], before.twist[i]);
          if (!table.has(key)) table.set(key, { slot: afterCorners.perm[i], twist: afterCorners.twist[i] });
        }
        const key = stateKey(after);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(after);
        }
      }
      if (isComplete()) break;
    }
    frontier = next;
  }

  if (!isComplete()) throw new Error("Move effect table incomplete");
  return tables;
}

const MOVE_EFFECT_TABLES = buildMoveEffectTables();

// Applies a move to Corners by table lookup only (hot path of the IDA* search).
export function applyMoveToCorners(corners: Corners, move: MoveName): Corners {
  const table = MOVE_EFFECT_TABLES.get(move);
  if (!table) throw new Error(`Unsupported move: ${move} (only U/R/F family)`);

  const perm: number[] = new Array(7);
  const twist: number[] = new Array(7);
  for (let i = 0; i < CORNER_IDS.length; i++) {
    const id = CORNER_IDS[i];
    const effect = table.get(effectKey(id, corners.perm[i], corners.twist[i]));
    if (!effect) throw new Error(`Unknown move effect: id=${id} slot=${corners.perm[i]} twist=${corners.twist[i]}`);
    perm[i] = effect.slot;
    twist[i] = effect.twist;
  }
  return { perm, twist };
}
