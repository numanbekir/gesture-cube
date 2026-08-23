import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vite";

// `pnpm dev:https` serves over HTTPS on the LAN so a phone can open the camera
// (getUserMedia requires a secure context outside localhost). Certificates come from
// mkcert (see README "Testing on a phone"); certs/ is git-ignored.
const CERT = "certs/dev-cert.pem";
const KEY = "certs/dev-key.pem";

export default defineConfig(({ mode }) => {
  const https = mode === "https";
  if (https && !(existsSync(CERT) && existsSync(KEY))) {
    throw new Error(`HTTPS mode needs ${CERT} and ${KEY} — run: mkcert -cert-file ${CERT} -key-file ${KEY} localhost <lan-ip>`);
  }
  return {
    server: {
      host: https,
      https: https ? { cert: readFileSync(CERT), key: readFileSync(KEY) } : undefined,
    },
  };
});
