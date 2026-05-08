import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "test/**/*.test.ts",
      "test/**/*.test.tsx",
      "packages/*/src/**/*.test.ts",
      "packages/*/src/**/*.test.tsx",
      "packages/*/test/**/*.test.ts",
      "packages/*/test/**/*.test.tsx",
    ],
    setupFiles: ["packages/ui/src/test-setup.ts"],
    reporters: ["default"],
    pool: "forks",
  },
});
