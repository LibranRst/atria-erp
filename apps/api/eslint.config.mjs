import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Preserve legacy transaction bodies; adopt new ESLint 10 checks separately.
      "no-useless-assignment": "off",
    },
  },
  globalIgnores(["node_modules/**", "dist/**", "drizzle/**"]),
]);
