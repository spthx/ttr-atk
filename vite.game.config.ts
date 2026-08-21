import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { realpathSync } from 'fs';
import { defineConfig } from 'vite';

// Keep Vite's project root on the same canonical Windows drive as resolved modules.
// Codex worktrees can be exposed through a C: junction while their real files live
// on D:, which otherwise makes build-html emit an invalid absolute asset name.
const projectRoot = realpathSync(process.cwd());
const publicAssetBase = (process.env.VITE_PUBLIC_BASE || '/').replace(/\/?$/, '/');

export default defineConfig({
  root: projectRoot,
  base: './',
  publicDir: 'public',
  build: {
    copyPublicDir: false,
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'game-html-public-assets',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          return `${html
            .replaceAll('__PUBLIC_ASSET_BASE__', publicAssetBase)
            .trimEnd()}\n`;
        },
      },
    },
  ],
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
});
