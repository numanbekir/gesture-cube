import type { Mat3, Vec3 } from "./types";

export const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  const r = (i: number, j: number) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return [
    [r(0, 0), r(0, 1), r(0, 2)],
    [r(1, 0), r(1, 1), r(1, 2)],
    [r(2, 0), r(2, 1), r(2, 2)],
  ];
}

export function applyMat3(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function mat3Equals(a: Mat3, b: Mat3): boolean {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

export function mat3Power(m: Mat3, n: number): Mat3 {
  let result = IDENTITY;
  for (let i = 0; i < n; i++) result = multiplyMat3(m, result);
  return result;
}

// Rotation matrices are orthogonal: transpose = inverse.
export function transposeMat3(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}
