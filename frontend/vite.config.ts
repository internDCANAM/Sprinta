import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiTarget = env.VITE_API_URL ?? 'http://localhost:4000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@sprintaiso/dict': fileURLToPath(
          new URL('../backend/src/lib/dict/index.ts', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
