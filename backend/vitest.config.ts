import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // forces Node.js environment, no browser mocks
    globals: true, // allows use of describe/test/expect without imports
    setupFiles: ['dotenv/config'], // loads .env, same as the app itself
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'], // test location, test naming convention
    fileParallelism: false, // files share one db/redis
    env: {
      NODE_ENV: 'test',
    },
  },
});
