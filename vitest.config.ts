import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["test/unit/**/*.test.ts"],
          globalSetup: ["test/unit/support/buildScripts.ts"],
          // Many tests start several Node processes, and some delete thousands of files. Windows does both slowly.
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["test/dom/**/*.test.ts"],
        },
      },
    ],
  },
});
