import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ESV tests are integration tests that spawn the app server
    testTimeout: 30000,
    hookTimeout: 60000,
    // Run tests sequentially to avoid port conflicts
    sequence: {
      concurrent: false,
    },
    // Include test files
    include: ['tests/**/*.test.ts'],
  },
});
