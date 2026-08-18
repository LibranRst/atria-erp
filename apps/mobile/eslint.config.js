const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@atria/web", "@atria/web/*"],
              allowTypeImports: true,
              message: "Mobile hanya boleh mengimpor tipe dari @atria/web/api.",
            },
          ],
        },
      ],
    },
  },
]);
