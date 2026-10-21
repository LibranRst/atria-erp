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
              message:
                "Mobile tidak boleh bergantung pada aplikasi web. Gunakan @atria/api/contract untuk tipe API.",
            },
            {
              regex: "^@atria/api(?:$|/(?!contract$))",
              message: "Mobile hanya boleh memakai subpath publik @atria/api/contract.",
            },
            {
              group: ["@atria/api/contract"],
              allowTypeImports: true,
              message: "Mobile hanya boleh mengimpor tipe dari @atria/api/contract.",
            },
          ],
        },
      ],
    },
  },
]);
