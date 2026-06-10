import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
  // Resolve o alias `@/*` lendo o tsconfig.json nativamente (Vite 6+).
  resolve: {
    tsconfigPaths: true,
  },
});
