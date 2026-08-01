import path from "node:path";
import { fileURLToPath } from "node:url";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import type { StorybookConfig } from "@storybook/nextjs";
import type { RuleSetRule } from "webpack";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
  webpackFinal: async (webpackConfig, { configType }) => {
    webpackConfig.resolve ??= {};
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      "@/lib/auth-client$": path.resolve(dirname, "mocks/auth-client.ts"),
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
        if (!rule || typeof rule !== "object" || !("use" in rule) || !Array.isArray(rule.use)) continue;
        const loaders = rule.use as (string | { loader?: string })[];
        const styleLoaderIndex = loaders.findIndex(
          (l) => (typeof l === "string" ? l : (l.loader ?? "")).includes("style-loader"),
        );
        if (styleLoaderIndex !== -1) loaders[styleLoaderIndex] = MiniCssExtractPlugin.loader;
      }
    }

    return webpackConfig;
  },
};

export default config;
