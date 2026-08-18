import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * `@atria/core` tidak memakai Next.js, React, maupun Tailwind — jadi konfigurasi
 * di sini sengaja jauh lebih tipis daripada `apps/web`. Batas kemurnian paket
 * ini ditegakkan oleh `src/purity.test.ts`, bukan oleh lint rule.
 */
const eslintConfig = defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  globalIgnores(["node_modules/**"]),
]);

export default eslintConfig;
