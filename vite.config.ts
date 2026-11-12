import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The game is served from https://<user>.github.io/animalplanet/
  base: '/animalplanet/',
  build: {
    // Phaser is one large dependency; keep it in its own chunk.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.includes('node_modules/phaser') ? 'phaser' : undefined;
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
