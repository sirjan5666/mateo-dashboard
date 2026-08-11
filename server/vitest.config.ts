import { defineConfig } from 'vitest/config';

/**
 * `npm run build` emits compiled copies of the test files into dist/. Without
 * this exclude, vitest discovers BOTH src/**\/*.test.ts and dist/**\/*.test.js
 * and runs the DB-backed suites twice, concurrently, against the same MongoDB —
 * which makes them fail on tenancy and erasure assertions that are actually
 * correct. Build-then-test is exactly what CI does, so this has to be excluded.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
