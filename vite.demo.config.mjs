import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const path = value => fileURLToPath(new URL(value, import.meta.url));

export default defineConfig({
  root: path('./src/demo/'),
  base: '/demo/',
  publicDir: false,
  plugins: [react()],
  resolve: { alias: [{ find: './native-api.js', replacement: path('./src/demo/api.js') }] },
  build: { outDir: path('./site-dist/demo/'), emptyOutDir: true, sourcemap: false },
});
