import { defineConfig } from 'vite';

// Dev serves at '/'; production build targets GitHub Pages at /handspeak/.
// All runtime asset fetches are prefixed with import.meta.env.BASE_URL.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/handspeak/' : '/',
  server: { port: 5173, fs: { allow: ['..'] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
}));
