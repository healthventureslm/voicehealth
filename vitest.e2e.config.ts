import { defineConfig } from "vitest/config";
import path from "path";
import { config } from "dotenv";

// Load .env so VITE_* vars are available during E2E test runs
config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  test: {
    // E2E tests call real Supabase edge functions — generous timeout
    testTimeout: 45_000,
    hookTimeout: 15_000,
    environment: "node",
    globals: true,
    include: ["src/__tests__/e2e/**/*.test.ts"],
    // Run sequentially to avoid hammering the AI gateway
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "",
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
