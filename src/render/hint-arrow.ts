import * as THREE from "three";

const ARROW_LENGTH = 0.4;
const ARROW_HEAD_LENGTH = 0.16;
const ARROW_HEAD_WIDTH = 0.12;
// Single color for the whole hint family (frame, marker, arrow, HINT switch).
export const HINT_COLOR = 0xc6ff00;
export const HINT_COLOR_CSS = `#${HINT_COLOR.toString(16).padStart(6, "0")}`;
const ARROW_COLOR = HINT_COLOR;

// Two ArrowHelpers sharing one origin. For 180° moves the second one points the
// opposite way, making a double-headed arrow: a half turn has no direction. Added to
// the scene (not cubeGroup) because position and direction are computed in world space.
export interface HintArrow extends THREE.Group {
  readonly primary: THREE.ArrowHelper;
  readonly secondary: THREE.ArrowHelper;
}

function makeArrow(): THREE.ArrowHelper {
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), ARROW_LENGTH, ARROW_COLOR, ARROW_HEAD_LENGTH, ARROW_HEAD_WIDTH);
  // transparent so setHintArrowOpacity can pulse
  (arrow.line.material as THREE.LineBasicMaterial).transparent = true;
  (arrow.cone.material as THREE.MeshBasicMaterial).transparent = true;
  return arrow;
}

export function createHintArrow(): HintArrow {
  const group = new THREE.Group() as HintArrow;
  const primary = makeArrow();
  const secondary = makeArrow();
  group.add(primary);
  group.add(secondary);
  Object.assign(group, { primary, secondary });
  group.visible = false;
  return group;
}

export function showHintArrow(arrow: HintArrow, worldPosition: THREE.Vector3, worldDirection: THREE.Vector3, double = false): void {
  const direction = worldDirection.clone().normalize();
  arrow.position.copy(worldPosition);
  arrow.primary.position.set(0, 0, 0);
  arrow.primary.setDirection(direction);
  arrow.secondary.visible = double;
  if (double) {
    arrow.secondary.position.set(0, 0, 0);
    arrow.secondary.setDirection(direction.clone().negate());
  }
  arrow.visible = true;
}

export function hideHintArrow(arrow: HintArrow): void {
  arrow.visible = false;
}

export function setHintArrowOpacity(arrow: HintArrow, opacity: number): void {
  for (const a of [arrow.primary, arrow.secondary]) {
    (a.line.material as THREE.LineBasicMaterial).opacity = opacity;
    (a.cone.material as THREE.MeshBasicMaterial).opacity = opacity;
  }
}
