import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwindCanonicalClasses from "eslint-plugin-tailwind-canonical-classes";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  ...tailwindCanonicalClasses.configs["flat/recommended"],
  {
    rules: {
      "tailwind-canonical-classes/tailwind-canonical-classes": [
        "warn",
        {
          cssPath: "./app/globals.css",
          rootFontSize: 16,
          calleeFunctions: ["cn", "clsx", "classNames", "twMerge", "cva"],
        },
      ],
    },
  },
  globalIgnores([
    // Local agent/plugin tooling:
    ".agents/**",
    ".claude/**",
    "scratch/**",

    // Generated/vendored, gitignored (see .gitignore):
    "ds-bundle/**",
    ".ds-sync/**",
    ".design-sync/sb-reference/**",
    ".design-sync/dts-out/**",
    ".design-sync/learnings/**",
    ".design-sync/.cache/**",
    ".design-sync/node_modules/**",

    // Keluaran build Storybook: sudah di-gitignore, tetapi eslint tidak membaca
    // .gitignore, sehingga bundel terminifikasinya ikut dilint dan menggagalkan
    // gate dengan galat yang bukan milik kode sumber mana pun.
    "storybook-static/**",

    // Netlify emits bundled third-party SSR/edge runtime and static artifacts.
    ".netlify/**",

    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**",
    "test-results/**",
    "playwright-report/**",
    ".next-admin-verify/**",
    ".next-admin-dev/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
