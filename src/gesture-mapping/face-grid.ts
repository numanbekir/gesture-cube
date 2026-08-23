import * as THREE from "three";
import type { Axis, CubeState, Vec3 } from "../cube-engine/types";
import { AXIS_INDEX } from "../cube-engine/moves";
import { currentPosition, HOME_POSITIONS } from "../cube-engine/state";

export type Quadrant = "TL" | "TR" | "BL" | "BR";

export interface LayerRef {
  readonly axis: Axis;
  readonly layer: 1 | -1;
}

export interface GridCell {
  readonly cubieId: number;
  readonly quadrant: Quadrant;
  // turned by a left/right swipe
  readonly horizontalLayer: LayerRef;
  // turned by an up/down swipe
  readonly verticalLayer: LayerRef;
}

const AXES: readonly Axis[] = ["x", "y", "z"];

function axisVector(axis: Axis): THREE.Vector3 {
  return new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
}

function positionsEqual(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// Maps the 4 corners of the facing face to screen quadrants (TL/TR/BL/BR) and to the two
// layers each one belongs to.
//
// Axis choice is counter-intuitive: points rotating about an axis move in the plane
// perpendicular to it, so the axis most parallel to camera UP is the horizontal-swipe
// layer and the one most parallel to camera RIGHT is the vertical-swipe layer.
//
// `cubeState` is required because the cubie occupying a slot changes after scrambling.
export function computeFaceGrid(faceAxis: Axis, faceLayer: 1 | -1, cubeState: CubeState, cubeGroupQuaternion: THREE.Quaternion, cameraRight: THREE.Vector3, cameraUp: THREE.Vector3): readonly GridCell[] {
  const [axisA, axisB] = AXES.filter((a) => a !== faceAxis);
  const worldOf = (axis: Axis) => axisVector(axis).applyQuaternion(cubeGroupQuaternion);

  const rightAlignA = Math.abs(worldOf(axisA).dot(cameraRight));
  const rightAlignB = Math.abs(worldOf(axisB).dot(cameraRight));
  // rotation about the axis parallel to RIGHT moves vertically on screen
  const verticalAxis = rightAlignA >= rightAlignB ? axisA : axisB;
  const horizontalAxis = verticalAxis === axisA ? axisB : axisA;

  const cells: GridCell[] = [];
  for (const slotHome of HOME_POSITIONS) {
    if (slotHome[AXIS_INDEX[faceAxis]] !== faceLayer) continue;

    const occupant = cubeState.find((cubie) => positionsEqual(currentPosition(cubie), slotHome));
    if (!occupant) continue;

    const localPos = new THREE.Vector3(...slotHome).applyQuaternion(cubeGroupQuaternion);
    const screenX = localPos.dot(cameraRight);
    const screenY = localPos.dot(cameraUp);
    const quadrant: Quadrant = screenY >= 0 ? (screenX >= 0 ? "TR" : "TL") : screenX >= 0 ? "BR" : "BL";

    cells.push({
      cubieId: occupant.id,
      quadrant,
      horizontalLayer: { axis: horizontalAxis, layer: slotHome[AXIS_INDEX[horizontalAxis]] as 1 | -1 },
      verticalLayer: { axis: verticalAxis, layer: slotHome[AXIS_INDEX[verticalAxis]] as 1 | -1 },
    });
  }
  return cells;
}

// Right-hand finger count → quadrant, in reading order.
const FINGER_COUNT_TO_QUADRANT: Record<number, Quadrant> = { 1: "TL", 2: "TR", 3: "BL", 4: "BR" };

export function quadrantForFingerCount(count: number): Quadrant | null {
  return FINGER_COUNT_TO_QUADRANT[count] ?? null;
}

export function cellForQuadrant(cells: readonly GridCell[], quadrant: Quadrant): GridCell | undefined {
  return cells.find((cell) => cell.quadrant === quadrant);
}
