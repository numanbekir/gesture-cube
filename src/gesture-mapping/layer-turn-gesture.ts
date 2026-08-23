import type { MoveName } from "../cube-engine/types";
import { parseMove } from "../cube-engine/moves";
import type { Point2D } from "../hand-tracking/gesture-detector";
import { deliberateFingerCount, isThumbExtended } from "../hand-tracking/gesture-detector";
import { cellForQuadrant, quadrantForFingerCount, type GridCell } from "./face-grid";
import { directionForFingerCount, moveForDirection, type Direction } from "./layer-swipe";

// frames of a stable left-hand count before a move fires
const DIRECTION_STREAK_REQUIRED = 4;
// frames of continuous neutral input before another move can fire (guards against
// single-frame count jitter re-triggering the same move)
const NEUTRAL_STREAK_REQUIRED = 8;

export interface LayerTurnInput {
  readonly rightHand: readonly Point2D[] | null;
  readonly leftHand: readonly Point2D[] | null;
  readonly cells: readonly GridCell[];
  // the move currently shown by the hint, if any (see "2" handling below)
  readonly hintMove: MoveName | null;
  // false while a move is animating: no new move is queued
  readonly canEnqueue: boolean;
}

export interface LayerTurnResult {
  readonly selectedCell: GridCell | null;
  readonly move: MoveName | null;
}

// Right-hand finger count selects a cell, left-hand finger count selects the direction.
// Debounced with a streak and re-armed only after a neutral period. Pure state machine:
// one update() per tracking frame, no DOM or three.js.
export class LayerTurnGesture {
  private pendingDirection: Direction | null = null;
  private directionStreak = 0;
  private directionTriggered = false;
  private neutralStreak = 0;

  reset(): void {
    this.pendingDirection = null;
    this.directionStreak = 0;
    this.directionTriggered = false;
    this.neutralStreak = 0;
  }

  update({ rightHand, leftHand, cells, hintMove, canEnqueue }: LayerTurnInput): LayerTurnResult {
    // ambiguous hand → no selection; a fully open hand is neutral (the thumb is not
    // counted, so it would otherwise read as 4)
    const rightCount = rightHand ? (deliberateFingerCount(rightHand) ?? 0) : 0;
    const rightAllOpen = rightCount === 4 && rightHand !== null && isThumbExtended(rightHand);
    const quadrant = rightAllOpen ? null : quadrantForFingerCount(rightCount);
    const selectedCell = quadrant ? (cellForQuadrant(cells, quadrant) ?? null) : null;

    const leftCount = leftHand ? (deliberateFingerCount(leftHand) ?? 0) : 0;
    const leftAllOpen = leftCount === 4 && leftHand !== null && isThumbExtended(leftHand);
    const direction = selectedCell && !leftAllOpen ? directionForFingerCount(leftCount) : null;

    if (!direction) {
      // back to neutral; re-arm only after a sustained neutral period
      this.pendingDirection = null;
      this.directionStreak = 0;
      this.neutralStreak++;
      if (this.neutralStreak >= NEUTRAL_STREAK_REQUIRED) this.directionTriggered = false;
      return { selectedCell, move: null };
    }

    this.neutralStreak = 0;
    this.directionStreak = direction === this.pendingDirection ? this.directionStreak + 1 : 1;
    this.pendingDirection = direction;
    if (this.directionStreak < DIRECTION_STREAK_REQUIRED || this.directionTriggered || !selectedCell || !canEnqueue) {
      return { selectedCell, move: null };
    }

    let move = moveForDirection(selectedCell, direction);
    // If the hint is a "2" and the gesture targets that layer, apply the full 180° at
    // once regardless of direction (R2 = R·R = R'·R'); splitting it caused an R2 ↔ R'
    // loop when the second half went the other way.
    if (hintMove?.endsWith("2")) {
      const shown = parseMove(hintMove);
      const gesture = parseMove(move);
      if (shown.axis === gesture.axis && shown.layer === gesture.layer) move = hintMove;
    }
    this.directionTriggered = true;
    return { selectedCell, move };
  }
}
