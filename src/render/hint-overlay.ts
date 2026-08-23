import * as THREE from "three";
import type { CubeState, MoveName } from "../cube-engine/types";
import { parseMove } from "../cube-engine/moves";
import { computeFaceGrid } from "../gesture-mapping/face-grid";
import { referenceFaceForAxis, targetForMove } from "../gesture-mapping/layer-swipe";
import type { SnapOrientation } from "./cube-snap";
import { createFaceFrame, hideFaceFrame, setFaceFrameOpacity, showFaceFrame } from "./face-frame";
import { createCellMarker, hideCellMarker, showCellMarker, setCellMarkerOpacity, MARKER_RADIUS } from "./cell-marker";
import { createHintArrow, showHintArrow, hideHintArrow, setHintArrowOpacity, HINT_COLOR } from "./hint-arrow";

const PULSE_PERIOD_MS = 1400;
const PULSE_MIN_OPACITY = 0.55;
// Larger than the selection ring's offset so both rings can share a cell.
const MARKER_OFFSET = 0.045;
const ARROW_BOB_AMPLITUDE = 0.06;
const ARROW_BOB_PERIOD_MS = 900;
// Max quaternion distance (rad) between cubeGroup and the snap preview for the cube to
// count as "settled"; the marker/arrow are shown only then.
const SETTLE_ANGLE_THRESHOLD = 0.02;

export interface HintFrameInput {
  readonly move: MoveName | null; // null hides everything
  readonly preview: SnapOrientation;
  readonly cubeState: CubeState;
  readonly settled: boolean; // false while snapping
  readonly cameraRight: THREE.Vector3;
  readonly cameraUp: THREE.Vector3;
  readonly now: number;
}

export interface HintOverlay {
  readonly render: (input: HintFrameInput) => void;
  readonly hide: () => void;
}

// Frame + ring + arrow that show the next solver move on the cube. The frame and ring
// are cubeGroup children (cube-local space); the arrow is a scene child (world space).
//
// The marker/arrow are drawn on a reachable neighbor face, never on the move's own face
// (a face cannot turn itself); referenceFaceForAxis picks that face deterministically.
export function createHintOverlay(scene: THREE.Scene, cubeGroup: THREE.Group, meshes: ReadonlyMap<number, THREE.Mesh>): HintOverlay {
  const frame = createFaceFrame(HINT_COLOR);
  frame.scale.setScalar(0.88); // smaller than the selection frame so both can be seen together
  const marker = createCellMarker(HINT_COLOR, MARKER_RADIUS * 0.5);
  const arrow = createHintArrow();
  cubeGroup.add(frame, marker);
  scene.add(arrow);

  function hide() {
    hideFaceFrame(frame);
    hideCellMarker(marker);
    hideHintArrow(arrow);
  }

  function pulse(now: number) {
    const phase = (now % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    const t = (Math.sin(phase * Math.PI * 2) + 1) / 2;
    const opacity = PULSE_MIN_OPACITY + (1 - PULSE_MIN_OPACITY) * t;
    if (frame.visible) setFaceFrameOpacity(frame, opacity);
    if (marker.visible) setCellMarkerOpacity(marker, opacity);
    if (arrow.visible) setHintArrowOpacity(arrow, opacity);
  }

  function render({ move: nextMove, preview, cubeState, settled, cameraRight, cameraUp, now }: HintFrameInput) {
    if (!nextMove) {
      hide();
      return;
    }
    const move = parseMove(nextMove);
    const reference = referenceFaceForAxis(move.axis);
    showFaceFrame(frame, reference.axis, reference.layer);

    // marker/arrow only while facing the reference face and the cube is settled
    const onReferenceFace = preview.axis === reference.axis && preview.layer === reference.layer;
    const isSettled = settled && cubeGroup.quaternion.angleTo(preview.quaternion) < SETTLE_ANGLE_THRESHOLD;
    const cells = onReferenceFace && isSettled ? computeFaceGrid(preview.axis, preview.layer, cubeState, cubeGroup.quaternion, cameraRight, cameraUp) : null;
    const target = cells ? targetForMove(nextMove, cells) : null;
    const cubieMesh = target ? meshes.get(target.cell.cubieId) : undefined;
    if (!target || !cubieMesh) {
      hideCellMarker(marker);
      hideHintArrow(arrow);
      pulse(now);
      return;
    }
    // via world position: during an animation the mesh may be parented to a layer pivot
    const localPos = cubeGroup.worldToLocal(cubieMesh.getWorldPosition(new THREE.Vector3()));
    showCellMarker(marker, localPos, preview.axis, preview.layer, MARKER_OFFSET);

    const worldDirection =
      target.direction === "right" ? cameraRight
      : target.direction === "left" ? cameraRight.clone().negate()
      : target.direction === "up" ? cameraUp
      : cameraUp.clone().negate();
    const origin = cubeGroup.localToWorld(marker.position.clone());
    const bobPhase = (now % ARROW_BOB_PERIOD_MS) / ARROW_BOB_PERIOD_MS;
    origin.addScaledVector(worldDirection, Math.sin(bobPhase * Math.PI * 2) * ARROW_BOB_AMPLITUDE);
    showHintArrow(arrow, origin, worldDirection, nextMove.endsWith("2")); // double-headed for 180°
    pulse(now);
  }

  return { render, hide };
}
