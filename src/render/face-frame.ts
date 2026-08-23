import * as THREE from "three";
import type { Axis } from "../cube-engine/types";
import { CUBIE_SIZE, SPACING } from "./cubies";

const FACE_SIZE = 2 * SPACING + CUBIE_SIZE;
const FRAME_OFFSET = 0.03; // sits just above the face to avoid z-fighting
const BAR_THICKNESS = 0.045;
const DEFAULT_FRAME_COLOR = 0x00ffff; // selection cyan

// Four bars outlining one face. A single instance is repositioned each frame; a second
// instance (lime) is used for the hint frame.
export function createFaceFrame(color: number = DEFAULT_FRAME_COLOR): THREE.Group {
  const half = FACE_SIZE / 2;
  // one shared material so setFaceFrameOpacity affects all four bars
  const material = new THREE.MeshBasicMaterial({ color, transparent: true });
  const horizontal = new THREE.BoxGeometry(FACE_SIZE + BAR_THICKNESS, BAR_THICKNESS, BAR_THICKNESS);
  const vertical = new THREE.BoxGeometry(BAR_THICKNESS, FACE_SIZE + BAR_THICKNESS, BAR_THICKNESS);

  const top = new THREE.Mesh(horizontal, material);
  top.position.set(0, half, 0);
  const bottom = new THREE.Mesh(horizontal, material);
  bottom.position.set(0, -half, 0);
  const left = new THREE.Mesh(vertical, material);
  left.position.set(-half, 0, 0);
  const right = new THREE.Mesh(vertical, material);
  right.position.set(half, 0, 0);

  const group = new THREE.Group();
  group.add(top, bottom, left, right);
  group.visible = false;
  group.userData.material = material;
  return group;
}

export function setFaceFrameOpacity(frame: THREE.Group, opacity: number): void {
  (frame.userData.material as THREE.MeshBasicMaterial).opacity = opacity;
}

export function showFaceFrame(frame: THREE.Group, axis: Axis, layer: 1 | -1): void {
  const distance = FACE_SIZE / 2 + FRAME_OFFSET;
  if (axis === "x") {
    frame.position.set(layer * distance, 0, 0);
    frame.rotation.set(0, Math.PI / 2, 0);
  } else if (axis === "y") {
    frame.position.set(0, layer * distance, 0);
    frame.rotation.set(Math.PI / 2, 0, 0);
  } else {
    frame.position.set(0, 0, layer * distance);
    frame.rotation.set(0, 0, 0);
  }
  frame.visible = true;
}

export function hideFaceFrame(frame: THREE.Group): void {
  frame.visible = false;
}
