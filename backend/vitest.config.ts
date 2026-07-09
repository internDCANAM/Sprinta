import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // forces Node.js environment, no browser mocks
    globals: true, // allows use of describe/test/expect without imports
    setupFiles: ['dotenv/config'], // global setup files go here (like DB reset scripts)
    include: ['tests/**/*.ts', 'src/**/*.test.ts'], // test location, test naming convention
  },
});
