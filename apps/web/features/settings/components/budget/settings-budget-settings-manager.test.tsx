import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  BudgetAllocationSettingRow,
  ExpenseCategorySettingRow,
} from "@/app/actions/settings/system";
import SettingsLoading from "@/app/settings/loading";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { ApprovalControlManager } from "./approval-control-manager";
import { SettingsBudgetSettingsManager } from "./settings-budget-settings-manager";

const setting: BudgetAllocationSettingRow = {
  id: "budget-default",
  name: "Standar Residential",
  budgetCapRatio: 0.8,
  notes: "Gunakan untuk project baru.",
  isActive: true,
  categories: [
    {
      id: "allocation-material",
      expenseCategoryId: "category-material",
      code: "MATERIAL",
      name: "Material",
      ratioPercentage: 0.4,
      isEnabled: true,
      sortOrder: 1,
    },
    {
      id: "allocation-other",
      expenseCategoryId: "category-other",
      code: "LAIN_LAIN",
      name: "Lain-lain",
      ratioPercentage: 0.1,
      isEnabled: true,
      sortOrder: 2,
    },
  ],
};

const categories: readonly ExpenseCategorySettingRow[] = setting.categories.map(
  (category, index) => ({
    id: category.expenseCategoryId,
    code: category.code,
    name: category.name,
    description: index === 0 ? "Pembelian bahan proyek." : null,
    defaultRatio: category.ratioPercentage,
    sortOrder: category.sortOrder,
    isActive: category.isEnabled,
    isCore: true,
  }),
);

function renderBudget(
  overrides: Partial<React.ComponentProps<typeof SettingsBudgetSettingsManager>> = {},
  desktop = false,
): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation={desktop ? "desktop" : "mobile"}>
      <SettingsBudgetSettingsManager
        initialSetting={setting}
        initialCategories={categories}
        canManageBudget
        canManageCategories
        {...overrides}
      />
    </WorkspacePresentationProvider>,
  );
}

describe("Settings financial presentation", () => {
  test("renders one scan-first summary and three calm controls", () => {
    const budgetHtml = renderBudget();
    const approvalHtml = renderToStaticMarkup(
      <ApprovalControlManager
        fieldCostCents={500_000_000}
        vendorPaymentCents={750_000_000}
        canManage
      />,
    );

    expect(budgetHtml.match(/bg-surface-inverse/g)?.length).toBe(1);
    expect(budgetHtml).toContain("Uji nominal proyek");
    expect(budgetHtml).toContain("Formula");
    expect(budgetHtml).toContain("Alokasi");
    expect(approvalHtml).toContain("Persetujuan");
    expect(approvalHtml).not.toContain("bg-surface-inverse");
  });

  test("keeps internal category codes out of the settings UI", () => {
    const html = renderBudget();

    expect(html).toContain("Material");
    expect(html).toContain("Lain-lain");
    expect(html).not.toContain("MATERIAL");
    expect(html).not.toContain("LAIN_LAIN");
  });

  test("communicates read-only access without edit affordances", () => {
    const html = renderBudget({ canManageBudget: false, canManageCategories: false });

    expect(html).toContain("Hanya baca");
    expect(html).not.toContain("Ubah formula");
    expect(html).not.toContain("Ubah alokasi");
  });

  test("marks allocation above 100 percent with text and an icon", () => {
    const html = renderBudget({
      initialSetting: {
        ...setting,
        categories: setting.categories.map((category) => ({
          ...category,
          ratioPercentage: 0.6,
        })),
      },
    });

    expect(html).toContain("Melebihi batas");
    expect(html).toContain("Total alokasi harus kembali ke 100% atau kurang.");
    expect(html).toContain("text-error");
    expect(html).toContain("<svg");
  });

  test("accepts an allocation exactly at 100 percent without an error state", () => {
    const html = renderBudget({
      initialSetting: {
        ...setting,
        categories: setting.categories.map((category, index) => ({
          ...category,
          ratioPercentage: index === 0 ? 0.6 : 0.4,
        })),
      },
    });

    expect(html).toContain("Teralokasi 100%");
    expect(html).toContain("Sisa 0%");
    expect(html).not.toContain("Total alokasi harus kembali ke 100% atau kurang.");
  });

  test("uses a skeleton matching the final financial hierarchy", () => {
    const html = renderToStaticMarkup(<SettingsLoading />);

    expect(html).toContain("bg-surface-inverse");
    expect(html).toContain("rounded-[22px]");
    expect(html.match(/rounded-owner bg-white shadow-surface/g)?.length).toBe(3);
  });

  test("desktop compares allocation in a native table with explicit simulation context", () => {
    const html = renderBudget({}, true);

    expect(html).toContain("Default alokasi kategori budget");
    expect(html).toContain("<table");
    expect(html).toContain("Pembelian bahan proyek.");
    expect(html).toContain("bukan saldo proyek");
    expect(html).toContain("Budget proyek yang sudah dibuat tetap memakai pengaturannya");
    expect(html).not.toContain("bg-surface-inverse");
    expect(html).not.toContain("MATERIAL");
  });

  test("desktop keeps a disabled category visible with zero effective allocation", () => {
    const html = renderBudget(
      {
        initialSetting: {
          ...setting,
          categories: setting.categories.map((category) => ({ ...category, isEnabled: false })),
        },
      },
      true,
    );

    expect(html).toContain("Material");
    expect(html).toContain("Nonaktif");
    expect(html).toContain("0%");
    expect(html).not.toContain("Melebihi batas");
  });

  test("desktop preserves separate finance/category access and marks over-allocation", () => {
    const html = renderBudget(
      {
        canManageBudget: false,
        canManageCategories: false,
        initialSetting: {
          ...setting,
          categories: setting.categories.map((category) => ({ ...category, ratioPercentage: 0.6 })),
        },
      },
      true,
    );

    expect(html).toContain("Hanya baca");
    expect(html).toContain("Melebihi batas");
    expect(html).toContain("Total alokasi harus kembali ke 100% atau kurang.");
    expect(html).not.toContain("Ubah formula");
    expect(html).not.toContain("Ubah alokasi");
    expect(html).toContain("Buka detail kategori Material");
  });

  test("desktop thresholds compare exact cents and clarify zero/new-request policy", () => {
    const html = renderToStaticMarkup(
      <WorkspacePresentationProvider presentation="desktop">
        <ApprovalControlManager
          fieldCostCents={0}
          vendorPaymentCents={750_000_125}
          canManage={false}
        />
      </WorkspacePresentationProvider>,
    );

    expect(html).toContain("Nol berarti");
    expect(html).toContain("setiap pengajuan terkait");
    expect(html).toContain("jalur persetujuan awal");
    expect(html).toContain("7.500.001,25");
    expect(html).toContain("Hanya baca");
    expect(html).not.toContain("Ubah ambang");
  });
});

describe("Settings financial workflow contracts", () => {
  test("keeps formula and allocation checkpoints separate", async () => {
    const source = await Bun.file(
      new URL("./settings-budget-settings-manager.tsx", import.meta.url),
    ).text();

    expect(source).toContain("name: formulaDraft.name");
    expect(source).toContain("categories: setting.categories.map");
    expect(source).toContain("name: setting.name");
    expect(source).toContain("categories: allocationDraft.map");
    expect(source).toContain("confirmAllocationDiscard");
  });

  test("syncs category metadata without creating a false allocation dirty state", async () => {
    const source = await Bun.file(
      new URL("./settings-budget-settings-manager.tsx", import.meta.url),
    ).text();

    expect(source).toContain("setSetting((current) =>");
    expect(source).toContain("setAllocationDraft((current) =>");
    expect(source).toContain("category.expenseCategoryId === result.data.id");
  });

  test("keeps category metadata permission independent from budget permission", async () => {
    const source = await Bun.file(
      new URL("./settings-budget-settings-manager.tsx", import.meta.url),
    ).text();

    expect(source).toContain("canManageBudget: boolean");
    expect(source).toContain("canManageCategories: boolean");
    expect(source).toContain("disabled={!canManageCategories}");
    expect(source).toContain("hideSubmit={!canManageCategories}");
  });

  test("renders approval controls independently from missing budget defaults", async () => {
    const source = await Bun.file(
      new URL("../navigation/settings-dashboard.tsx", import.meta.url),
    ).text();
    const emptyStateIndex = source.indexOf("Default budget belum tersedia");
    const approvalIndex = source.indexOf("<ApprovalControlManager");

    expect(emptyStateIndex).toBeGreaterThan(-1);
    expect(approvalIndex).toBeGreaterThan(emptyStateIndex);
    expect(source).toContain(
      "canManageCategories={overview.permissions.canManageExpenseCategories}",
    );
  });

  test("renders project nominal simulation inside a grouped surface instead of inline plain", async () => {
    const source = await Bun.file(
      new URL("./settings-budget-settings-manager.tsx", import.meta.url),
    ).text();

    expect(source).toContain("<FormDisclosure");
    expect(source).toContain('title="Uji nominal proyek"');
    expect(source).toContain('presentation="grouped"');
    expect(source).not.toContain('presentation="plain"');
  });
});
