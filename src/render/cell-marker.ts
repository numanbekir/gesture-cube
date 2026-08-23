import * as THREE from "three";
import type { Axis } from "../cube-engine/types";
import { CUBIE_SIZE } from "./cubies";

export const MARKER_RADIUS = 0.12;
const MARKER_OFFSET = 0.03; // sits just above the face to avoid z-fighting
const MARKER_COLOR = 0x00ffff; // selection cyan, same family as the active face frame

// Ring marker on the selected cell. Child of cubeGroup, so it is positioned in cube-local
// space and follows whole-cube rotation. Also used (smaller, lime) for the hint marker.
export function createCellMarker(color: number = MARKER_COLOR, radius: number = MARKER_RADIUS): THREE.Mesh {
  const geometry = new THREE.RingGeometry(radius * 0.55, radius, 24);
  // transparent so setCellMarkerOpacity can pulse the hint marker
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  return mesh;
}

export function setCellMarkerOpacity(marker: THREE.Mesh, opacity: number): void {
  (marker.material as THREE.MeshBasicMaterial).opacity = opacity;
}

// `offset` lets two markers share a cell without z-fighting.
export function showCellMarker(marker: THREE.Mesh, cubieLocalPosition: THREE.Vector3, faceAxis: Axis, faceLayer: 1 | -1, offset: number = MARKER_OFFSET): void {
  const normal = new THREE.Vector3(faceAxis === "x" ? faceLayer : 0, faceAxis === "y" ? faceLayer : 0, faceAxis === "z" ? faceLayer : 0);
  marker.position.copy(cubieLocalPosition).addScaledVector(normal, CUBIE_SIZE / 2 + offset);
  // RingGeometry lies in XY; rotate its +Z normal onto the face normal.
  marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  marker.visible = true;
}

export function hideCellMarker(marker: THREE.Mesh): void {
  marker.visible = false;
}
