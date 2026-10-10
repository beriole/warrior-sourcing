import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    // Les tests de bout en bout partagent une seule base : ils ne doivent pas se croiser.
    fileParallelism: false,
    include: ['test/**/*.e2e-spec.ts'],
  },
});
