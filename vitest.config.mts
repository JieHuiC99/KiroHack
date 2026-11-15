import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const stub = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true, // "@/..." imports, same as Next
    alias: { "server-only": stub("./tests/server-only-stub.ts") }, // server-only throws outside RSC
  },
  test: {
    env: loadEnv("test", process.cwd(), ""), // .env + .env.test → points at app_test
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false, // one shared test database
        },
      },
    ],
  },
});
