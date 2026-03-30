import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        functions: 80,
        lines: 80,
      },
      include: [
        "src/utils/**",
        "src/lib/**",
        "functions/src/shared/xirr.js",
        "functions/src/shared/monteCarlo.js",
        "functions/src/alts/helpers.js",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
