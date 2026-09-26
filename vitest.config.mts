import path from "node:path";
import { defineConfig } from "vitest/config";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/registre_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    env: {
      DATABASE_URL: testDatabaseUrl,
      APP_URL: "https://app.example.com",
      STORAGE_DRIVER: "local",
      AUTH_SECRET: "test-secret",
      BCRYPT_ROUNDS: "4",
    },
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          // Base partagée : exécution séquentielle des fichiers.
          fileParallelism: false,
        },
      },
    ],
  },
});
