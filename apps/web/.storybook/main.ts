import path from "node:path";
import { fileURLToPath } from "node:url";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import type { StorybookConfig } from "@storybook/nextjs";
import type { RuleSetRule } from "webpack";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const settingsActionFixtures = Object.fromEntries(
  [
    "settings/system",
    "settings/pricing-library",
    "settings/material-import",
    "settings/approval-thresholds",
    "administration",
    "administration-users",
    "administration-vendors",
    "administration-roles",
    "material/opening-inventory",
    "material/opening-inventory-queries",
    "material/opening-inventory-mutations",
    "quick-start",
    "developer-account-simulation",
  ].flatMap((name): readonly [string, string][] => {
    const fixture = path.resolve(dirname, "settings-actions.fixture.ts");
    return [
      [`@/app/actions/${name}$`, fixture],
      [path.resolve(dirname, `../app/actions/${name}`), fixture],
      [path.resolve(dirname, `../app/actions/${name}.ts`), fixture],
    ];
  }),
);

const expenseActionFixtures = Object.fromEntries(
  [
    "finance/field-requests",
    "finance/expense-drafts",
    "finance/expense-draft-storage",
    "finance/expense-draft-submit",
    "finance/vendor-bill-drafts",
    "finance/pay-vendor-bill",
    "finance/schedule-vendor-bill",
    "finance/submit-vendor-bill",
    "project/budget",
    "ai/process-receipt",
    "activity-detail",
  ].flatMap((name): readonly [string, string][] => {
    const fixture = path.resolve(dirname, "expenses-actions.fixture.ts");
    return [
      [`@/app/actions/${name}$`, fixture],
      [path.resolve(dirname, `../app/actions/${name}`), fixture],
      [path.resolve(dirname, `../app/actions/${name}.ts`), fixture],
    ];
  }),
);

const reconciliationActionFixtures = Object.fromEntries(
  [
    "app/actions/finance/reconciliation-workspace",
    "app/actions/finance/reconciliation-workspace-query",
    "app/actions/finance/reconciliation-statement-actions",
    "app/actions/finance/reconcile-cash-transaction",
    "app/actions/finance/analyze-bank-statement",
    "app/actions/finance/reconciliation-desktop",
    "features/reconciliation/hooks/reconciliation-read-client",
  ].flatMap((name): readonly [string, string][] => {
    const fixture = path.resolve(dirname, "reconciliation-actions.fixture.ts");
    return [
      [`@/${name}$`, fixture],
      [path.resolve(dirname, `../${name}`), fixture],
      [path.resolve(dirname, `../${name}.ts`), fixture],
    ];
  }),
);

const materialActionFixtures = Object.fromEntries(
  [
    "app/actions/material/inventory",
    "app/actions/material/operations-dashboard",
    "app/actions/material/warehouse",
    "app/actions/material/warehouse-transfer",
    "app/actions/material/warehouse-stock-count",
    "app/actions/material/warehouse-receipt-reversal",
    "app/actions/material/warehouse-adjustment",
    "app/actions/material/goods-receipt",
    "app/actions/activity-detail",
    "features/materials/hooks/material-desktop-read-client",
  ].flatMap((name): readonly [string, string][] => {
    const fixture = path.resolve(dirname, "materials-actions.fixture.ts");
    return [
      [`@/${name}$`, fixture],
      [path.resolve(dirname, `../${name}`), fixture],
      [path.resolve(dirname, `../${name}.ts`), fixture],
    ];
  }),
);

const projectsActionFixtures = Object.fromEntries(
  [
    "app/actions/project/crud",
    "app/actions/project/excel-budget",
    "app/actions/project/workflow-governance",
  ].flatMap((name): readonly [string, string][] => {
    const fixture = path.resolve(dirname, "projects-actions.fixture.ts");
    return [
      [`@/${name}$`, fixture],
      [path.resolve(dirname, `../${name}`), fixture],
      [path.resolve(dirname, `../${name}.ts`), fixture],
    ];
  }),
);

const rapRabActionFixtures = Object.fromEntries(
  ["rap-rab", "category-plan", "rap-setup", "revision-change-order", "workflow-governance"].flatMap(
    (name): readonly [string, string][] => {
      const fixture = path.resolve(dirname, "rap-rab-actions.fixture.ts");
      return [
        [`@/app/actions/project/${name}$`, fixture],
        [path.resolve(dirname, `../app/actions/project/${name}`), fixture],
        [path.resolve(dirname, `../app/actions/project/${name}.ts`), fixture],
      ];
    },
  ),
);

const projectOperationsActionFixtures = Object.fromEntries(
  [
    "app/actions/activity-detail",
    "app/actions/project/activation",
    "app/actions/project/closing",
    "app/actions/finance/record-client-payment",
    "app/actions/finance/generate-invoice-schedule",
    "app/actions/finance/create-client-invoice",
    "app/actions/finance/get-invoice-prefill-context",
  ].flatMap((name): readonly [string, string][] => {
    const fixture = path.resolve(dirname, "project-operations-actions.fixture.ts");
    return [
      [`@/${name}$`, fixture],
      [path.resolve(dirname, `../${name}`), fixture],
      [path.resolve(dirname, `../${name}.ts`), fixture],
    ];
  }),
);

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
    "../features/settings/components/navigation/settings-desktop.stories.tsx",
    "../features/expenses/components/lists/expenses-desktop.stories.tsx",
    "../features/approvals/components/views/approvals-desktop.stories.tsx",
    "../features/reconciliation/components/reconciliation-desktop.stories.tsx",
    "../features/materials/components/desktop/materials-desktop.stories.tsx",
    "../features/projects/list/components/views/projects-desktop.stories.tsx",
    "../features/projects/detail/components/overview/project-overview-desktop.stories.tsx",
    "../features/projects/detail/components/shared/rap-rab-desktop.stories.tsx",
    "../features/projects/detail/components/shared/project-operations-desktop.stories.tsx",
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
      webpackConfig.cache.version = "atria-ui-fixtures-no-server-actions-v12";
    }
    webpackConfig.resolve ??= {};
    webpackConfig.resolve.alias = {
      ...settingsActionFixtures,
      ...expenseActionFixtures,
      ...reconciliationActionFixtures,
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
      ...materialActionFixtures,
      ...projectsActionFixtures,
      ...rapRabActionFixtures,
      ...projectOperationsActionFixtures,
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
