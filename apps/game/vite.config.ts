import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        arcade: resolve(root, 'arcade.html'),
      },
    },
  },
});
