import { defineConfig } from 'vitest/config';

export default defineConfig({
  // A relative base makes the build work from any sub-path (e.g. GitHub Pages
  // project sites at https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets/bundle',
    sourcemap: false,
    // Phaser itself is ~1.2 MB minified; this keeps the build output free of noise.
    chunkSizeWarningLimit: 1600,
  },
  server: {
    open: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
