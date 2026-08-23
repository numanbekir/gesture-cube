// Copies the MediaPipe WASM runtime from the installed package into public/, so the
// files served at /mediapipe/wasm always match the @mediapipe/tasks-vision version in
// package.json. Runs on postinstall; public/mediapipe is git-ignored.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = join(root, "public", "mediapipe", "wasm");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`mediapipe wasm → ${target}`);
