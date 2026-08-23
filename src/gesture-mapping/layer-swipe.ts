import type { Axis, MoveName } from "../cube-engine/types";
import { faceForAxisLayer, parseMove } from "../cube-engine/moves";
import type { GridCell } from "./face-grid";

export type Direction = "up" | "down" | "left" | "right";

// Left-hand finger count → swipe direction.
const FINGER_COUNT_TO_DIRECTION: Record<number, Direction> = { 1: "right", 2: "left", 3: "up", 4: "down" };

export function directionForFingerCount(count: number): Direction | null {
  return FINGER_COUNT_TO_DIRECTION[count] ?? null;
}

// left/right → horizontal layer, up/down → vertical layer; right/up normal, left/down prime.
export function moveForDirection(cell: GridCell, direction: Direction): MoveName {
  const isHorizontal = direction === "left" || direction === "right";
  const layerRef = isHorizontal ? cell.horizontalLayer : cell.verticalLayer;
  const positive = direction === "right" || direction === "up";
  const face = faceForAxisLayer(layerRef.axis, layerRef.layer);
  return (positive ? face : `${face}'`) as MoveName;
}

// Inverse of moveForDirection, for hints: which cell of the facing face to select and
// which way to swipe to perform `moveName`. The hint must live on a face the gesture can
// actually operate from — a face never turns itself. Returns null if the move's axis is
// the facing face's own axis (unreachable from here).
export function targetForMove(moveName: MoveName, cells: readonly GridCell[]): { readonly cell: GridCell; readonly direction: Direction } | null {
  if (cells.length === 0) return null;
  const horizontalAxis = cells[0].horizontalLayer.axis;
  const verticalAxis = cells[0].verticalLayer.axis;
  const move = parseMove(moveName);
  // For "2" moves either direction works; the positive one is used.
  const isReverse = moveName.endsWith("'");
  if (move.axis === horizontalAxis) {
    const cell = cells.find((c) => c.horizontalLayer.layer === move.layer);
    return cell ? { cell, direction: isReverse ? "left" : "right" } : null;
  }
  if (move.axis === verticalAxis) {
    const cell = cells.find((c) => c.verticalLayer.layer === move.layer);
    return cell ? { cell, direction: isReverse ? "down" : "up" } : null;
  }
  return null;
}

const AXIS_ORDER: readonly Axis[] = ["x", "y", "z"];

// Four different facing faces can reach the same move. Pick one deterministically (from
// the move axis only) so the hint frame and marker always appear on a single face.
export function referenceFaceForAxis(excludeAxis: Axis): { readonly axis: Axis; readonly layer: 1 | -1 } {
  const axis = AXIS_ORDER.find((a) => a !== excludeAxis) ?? "x";
  return { axis, layer: 1 };
}
