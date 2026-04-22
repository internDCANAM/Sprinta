import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiTarget = env.VITE_API_URL ?? "http://localhost:4000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@sprintaiso/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
