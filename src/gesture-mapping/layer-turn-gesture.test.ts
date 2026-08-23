import { describe, expect, it } from "vitest";
import { LayerTurnGesture, type LayerTurnInput } from "./layer-turn-gesture";
import type { GridCell } from "./face-grid";
import type { Point2D } from "../hand-tracking/gesture-detector";

// z-facing face: horizontalAxis=y, verticalAxis=x (same layout as layer-swipe.test.ts)
const CELLS: readonly GridCell[] = [
  { cubieId: 0, quadrant: "TL", horizontalLayer: { axis: "y", layer: 1 }, verticalLayer: { axis: "x", layer: -1 } },
  { cubieId: 1, quadrant: "TR", horizontalLayer: { axis: "y", layer: 1 }, verticalLayer: { axis: "x", layer: 1 } },
  { cubieId: 2, quadrant: "BL", horizontalLayer: { axis: "y", layer: -1 }, verticalLayer: { axis: "x", layer: -1 } },
  { cubieId: 3, quadrant: "BR", horizontalLayer: { axis: "y", layer: -1 }, verticalLayer: { axis: "x", layer: 1 } },
];

// hand with `count` clearly extended fingers (thumb curled); see gesture-detector.test.ts
function hand(count: number, thumbOpen = false): Point2D[] {
  const l: Point2D[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  l[9] = { x: 0, y: 0.1 };
  const joints: readonly [number, number][] = [[8, 5], [12, 9], [16, 13], [20, 17]];
  joints.forEach(([tip, mcp], i) => {
    l[mcp] = { x: 0, y: 0.1 };
    l[tip] = { x: 0, y: i < count ? 0.2 : 0.05 };
  });
  // thumb metric: |thumbTip - indexMcp(5)| / |middleMcp(9) - wrist| → 1.5 (open) vs 0.2 (curled)
  l[4] = { x: thumbOpen ? 0.15 : 0.02, y: 0.1 };
  return l;
}

function input(partial: Partial<LayerTurnInput>): LayerTurnInput {
  return { rightHand: null, leftHand: null, cells: CELLS, hintMove: null, canEnqueue: true, ...partial };
}

function run(g: LayerTurnGesture, frames: number, partial: Partial<LayerTurnInput>) {
  let last = g.update(input(partial));
  for (let i = 1; i < frames; i++) last = g.update(input(partial));
  return last;
}

describe("LayerTurnGesture", () => {
  it("selects the cell from the right-hand finger count", () => {
    const g = new LayerTurnGesture();
    expect(g.update(input({ rightHand: hand(2) })).selectedCell?.quadrant).toBe("TR");
    expect(g.update(input({ rightHand: hand(3) })).selectedCell?.quadrant).toBe("BL");
  });

  it("treats a fully open right hand as no selection", () => {
    const g = new LayerTurnGesture();
    expect(g.update(input({ rightHand: hand(4, true) })).selectedCell).toBeNull();
    expect(g.update(input({ rightHand: hand(4) })).selectedCell?.quadrant).toBe("BR");
  });

  it("fires a move only after a stable direction streak", () => {
    const g = new LayerTurnGesture();
    const frames = [1, 2, 3].map(() => g.update(input({ rightHand: hand(2), leftHand: hand(1) })));
    expect(frames.every((f) => f.move === null)).toBe(true);
    expect(g.update(input({ rightHand: hand(2), leftHand: hand(1) })).move).toBe("U"); // TR + right → U
  });

  it("does not re-fire until a sustained neutral period", () => {
    const g = new LayerTurnGesture();
    run(g, 4, { rightHand: hand(2), leftHand: hand(1) });
    expect(run(g, 10, { rightHand: hand(2), leftHand: hand(1) }).move).toBeNull();
    run(g, 3, { rightHand: hand(2), leftHand: null }); // too short to re-arm
    expect(run(g, 4, { rightHand: hand(2), leftHand: hand(1) }).move).toBeNull();
    run(g, 8, { rightHand: hand(2), leftHand: null });
    expect(run(g, 4, { rightHand: hand(2), leftHand: hand(1) }).move).toBe("U");
  });

  it("ignores a fully open left hand as direction", () => {
    const g = new LayerTurnGesture();
    expect(run(g, 6, { rightHand: hand(2), leftHand: hand(4, true) }).move).toBeNull();
  });

  it("waits for canEnqueue", () => {
    const g = new LayerTurnGesture();
    expect(run(g, 4, { rightHand: hand(2), leftHand: hand(1), canEnqueue: false }).move).toBeNull();
    expect(g.update(input({ rightHand: hand(2), leftHand: hand(1) })).move).toBe("U");
  });

  it("applies a shown '2' hint as a full half turn regardless of swipe direction", () => {
    const g = new LayerTurnGesture();
    expect(run(g, 4, { rightHand: hand(2), leftHand: hand(2), hintMove: "U2" }).move).toBe("U2"); // left swipe → U' → upgraded
    g.reset();
    expect(run(g, 4, { rightHand: hand(2), leftHand: hand(3), hintMove: "U2" }).move).toBe("R"); // other layer, unchanged
  });

  it("reset() clears the streak and re-arms", () => {
    const g = new LayerTurnGesture();
    run(g, 4, { rightHand: hand(2), leftHand: hand(1) });
    g.reset();
    expect(run(g, 4, { rightHand: hand(2), leftHand: hand(1) }).move).toBe("U");
  });
});
