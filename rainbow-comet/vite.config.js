import { defineConfig } from 'vite';

export default defineConfig({
  base: '/games/rainbow-comet/',
  build: {
    chunkSizeWarningLimit: 700,
  },
});
