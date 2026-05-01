import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Use a self-signed cert if present (generated once via openssl, see README).
// Falls back to plain HTTP if the files are missing.
function httpsConfig() {
  const key = path.resolve('localhost.key');
  const cert = path.resolve('localhost.crt');
  if (fs.existsSync(key) && fs.existsSync(cert)) {
    return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
  }
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https: httpsConfig(),
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'], // contains WASM, must not be pre-bundled
  },
});
