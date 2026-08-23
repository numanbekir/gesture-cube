export type Axis = "x" | "y" | "z";

export type Vec3 = readonly [number, number, number];

// integer 3x3 rotation matrix, row-major
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export interface Move {
  readonly axis: Axis;
  readonly layer: 1 | -1;
  readonly turns: 1 | 2 | 3;
}

export type MoveName =
  | "U" | "U'" | "U2"
  | "D" | "D'" | "D2"
  | "L" | "L'" | "L2"
  | "R" | "R'" | "R2"
  | "F" | "F'" | "F2"
  | "B" | "B'" | "B2";

export interface Cubie {
  readonly id: number;
  readonly home: Vec3;
  readonly orientation: Mat3;
}

export type CubeState = readonly Cubie[];
