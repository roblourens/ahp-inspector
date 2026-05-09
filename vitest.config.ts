import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      vscode: new URL("./packages/extension/src/__test__/vscode-stub.ts", import.meta.url)
        .pathname,
    },
  },
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
