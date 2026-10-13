import path from "node:path";
import { fileURLToPath } from "node:url";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import type { StorybookConfig } from "@storybook/nextjs";
import type { RuleSetRule } from "webpack";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    "../components/**/*.stories.@(ts|tsx)",
    "../features/ai-chat/components/proposal-cards/material-master-proposal-card.stories.tsx",
    "../features/notifications/**/*.stories.@(ts|tsx)",
    "../features/projects/list/components/drawers/project-drawer.stories.tsx",
    "../features/finance-dashboard/components/bank-accounts/manual-form-panels.stories.tsx",
    "../features/settings/components/materials/material-editor-sheet.stories.tsx",
    "../features/administration/components/roles/role-desktop-panels.stories.tsx",
    "../features/expenses/components/forms/expense-form-sections.stories.tsx",
  ],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs",
    options: {
      builder: {
        // Tanpa `fsCache`, setiap `storybook dev` membangun ulang seluruh bundle
        // preview dari nol. `lazyCompilation` hanya berlaku di dev (builder
        // mengabaikannya saat build produksi), jadi story dikompilasi saat dibuka.
        fsCache: true,
        lazyCompilation: true,
      },
    },
  },
  staticDirs: ["../public"],
  webpackFinal: async (webpackConfig, { configType }) => {
    // Resolver/cache changes must invalidate cached server-action modules.
    if (typeof webpackConfig.cache === "object" && webpackConfig.cache.type === "filesystem") {
      webpackConfig.cache.version = "atria-ui-fixtures-no-server-actions-v2";
    }
    webpackConfig.resolve ??= {};
    webpackConfig.resolve.alias = {
      "@/app/actions/ai/material-master$": path.resolve(dirname, "material-ai-actions.fixture.ts"),
      [path.resolve(dirname, "../app/actions/ai/material-master")]: path.resolve(
        dirname,
        "material-ai-actions.fixture.ts",
      ),
      "@/lib/auth-client$": path.resolve(dirname, "mocks/auth-client.ts"),
      "@/app/actions/project/crud$": path.resolve(dirname, "project-actions.fixture.ts"),
      "@/lib/media/upload-to-imagekit$": path.resolve(dirname, "project-upload.fixture.ts"),
      "@/app/actions/material/warehouse$": path.resolve(dirname, "warehouse-actions.fixture.ts"),
      [path.resolve(dirname, "../app/actions/material/warehouse")]: path.resolve(
        dirname,
        "warehouse-actions.fixture.ts",
      ),
      [path.resolve(dirname, "../app/actions/material/warehouse.ts")]: path.resolve(
        dirname,
        "warehouse-actions.fixture.ts",
      ),
      [path.resolve(dirname, "../app/actions/project/crud")]: path.resolve(
        dirname,
        "project-actions.fixture.ts",
      ),
      [path.resolve(dirname, "../app/actions/project/crud.ts")]: path.resolve(
        dirname,
        "project-actions.fixture.ts",
      ),
      [path.resolve(dirname, "../lib/media/upload-to-imagekit")]: path.resolve(
        dirname,
        "project-upload.fixture.ts",
      ),
      [path.resolve(dirname, "../lib/media/upload-to-imagekit.ts")]: path.resolve(
        dirname,
        "project-upload.fixture.ts",
      ),
      ...webpackConfig.resolve.alias,
    };

    // Production builds (storybook build, used for the design-sync reference)
    // need a real static stylesheet — the converter's CSS fallback scrapes a
    // <link rel="stylesheet"> from iframe.html, which style-loader's injected
    // <style> tags never produce. Dev keeps style-loader for HMR speed.
    if (configType === "PRODUCTION") {
      webpackConfig.plugins ??= [];
      webpackConfig.plugins.push(new MiniCssExtractPlugin());
      const rules = (webpackConfig.module?.rules ?? []) as RuleSetRule[];
      for (const rule of rules) {
        if (!rule || typeof rule !== "object" || !("use" in rule) || !Array.isArray(rule.use))
          continue;
        const loaders = rule.use as (string | { loader?: string })[];
        const styleLoaderIndex = loaders.findIndex((l) =>
          (typeof l === "string" ? l : (l.loader ?? "")).includes("style-loader"),
        );
        if (styleLoaderIndex !== -1) loaders[styleLoaderIndex] = MiniCssExtractPlugin.loader;
      }
    }

    return webpackConfig;
  },
};

export default config;
