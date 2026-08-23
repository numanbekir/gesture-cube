// Public entry for embedding hosts (the Tanırım platform). Standalone mode uses main.ts.
export { initGestureCube } from "./app";
export type { GestureCubeOptions, GestureCubeInstance, GestureCubeEventType, GestureCubeStatus } from "./app";
export type { HandDelegate, HandAssetPaths } from "./hand-tracking/hand-landmarker";
export { DEFAULT_HAND_ASSET_PATHS } from "./hand-tracking/hand-landmarker";
export { STRINGS_BY_LOCALE, TR_STRINGS, EN_STRINGS, resolveLocale } from "./strings";
export type { GestureCubeStrings, GestureCubeLocale } from "./strings";
