import * as THREE from "three";
import type { CubeState, Cubie, Mat3 } from "../cube-engine/types";

export const SPACING = 0.351;
export const CUBIE_SIZE = 0.641;

// Neon palette. Chosen to stay distinct from the selection (cyan) and hint (lime) markers.
const COLORS = {
  right: 0xff1a1a, // red
  left: 0xff7a00, // orange
  up: 0x9d4bff, // violet
  down: 0xff2d95, // pink
  front: 0x00ff6a, // green
  back: 0x2979ff, // blue
  hidden: 0x111111,
};

// Slight emissive keeps the colors saturated on the shaded sides.
function cubieMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.35 });
}

function mat3ToQuaternion(m: Mat3): THREE.Quaternion {
  const matrix = new THREE.Matrix4().set(
    m[0][0], m[0][1], m[0][2], 0,
    m[1][0], m[1][1], m[1][2], 0,
    m[2][0], m[2][1], m[2][2], 0,
    0, 0, 0, 1,
  );
  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}

function createCubieMesh(cubie: Cubie): THREE.Mesh {
  const [hx, hy, hz] = cubie.home;
  const geometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
  const materials = [
    cubieMaterial(hx === 1 ? COLORS.right : COLORS.hidden),
    cubieMaterial(hx === -1 ? COLORS.left : COLORS.hidden),
    cubieMaterial(hy === 1 ? COLORS.up : COLORS.hidden),
    cubieMaterial(hy === -1 ? COLORS.down : COLORS.hidden),
    cubieMaterial(hz === 1 ? COLORS.front : COLORS.hidden),
    cubieMaterial(hz === -1 ? COLORS.back : COLORS.hidden),
  ];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.position.set(hx * SPACING, hy * SPACING, hz * SPACING);
  return mesh;
}

export function createCubieMeshes(state: CubeState, parent: THREE.Object3D): Map<number, THREE.Mesh> {
  const meshes = new Map<number, THREE.Mesh>();
  for (const cubie of state) {
    const mesh = createCubieMesh(cubie);
    parent.add(mesh);
    meshes.set(cubie.id, mesh);
  }
  return meshes;
}

// Snaps mesh transforms exactly to the state after an animation.
export function syncCubieTransforms(state: CubeState, meshes: Map<number, THREE.Mesh>): void {
  for (const cubie of state) {
    const mesh = meshes.get(cubie.id);
    if (!mesh) continue;
    const quaternion = mat3ToQuaternion(cubie.orientation);
    const position = new THREE.Vector3(...cubie.home).applyQuaternion(quaternion).multiplyScalar(SPACING);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
  }
}
