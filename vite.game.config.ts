import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { realpathSync } from 'fs';
import { defineConfig } from 'vite';

// Keep Vite's project root on the same canonical Windows drive as resolved modules.
// Codex worktrees can be exposed through a C: junction while their real files live
// on D:, which otherwise makes build-html emit an invalid absolute asset name.
const projectRoot = realpathSync(process.cwd());

export default defineConfig({
  root: projectRoot,
  base: './',
  publicDir: 'public',
  build: {
    copyPublicDir: false,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
});
