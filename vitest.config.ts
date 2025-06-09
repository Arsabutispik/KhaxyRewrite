import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    exclude: ["**/node_modules", "**/dist", ".idea", ".git", ".cache"],
    passWithNoTests: true,
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.json",
    },
    coverage: {
      enabled: true,
      all: true,
      include: ["src/**/*.{ts,js}"],
    },
  },
});
