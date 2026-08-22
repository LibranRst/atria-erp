import { describe, expect, test } from "bun:test";

const workspacePath = new URL(
  "../components/workspaces/owner-onboarding-workspace.tsx",
  import.meta.url,
);
const stepContentPath = new URL(
  "../components/workspaces/onboarding-step-content.tsx",
  import.meta.url,
);
const workspaceActionsPath = new URL(
  "../components/workspaces/onboarding-workspace-actions.tsx",
  import.meta.url,
);
const accountPanelPath = new URL(
  "../components/panels/setup-bank-accounts-panel.tsx",
  import.meta.url,
);
const financialPanelPath = new URL(
  "../components/panels/financial-defaults-panel.tsx",
  import.meta.url,
);
const loaderPath = new URL("../server/get-owner-onboarding-workspace-data.ts", import.meta.url);
const financeReviewPath = new URL(
  "../components/workspaces/onboarding-finance-review.tsx",
  import.meta.url,
);
const verificationPanelPath = new URL(
  "../components/panels/onboarding-verification-panel.tsx",
  import.meta.url,
);
const initialStockPanelPath = new URL(
  "../components/panels/initial-stock-setup-panel.tsx",
  import.meta.url,
);
const dashboardTabsPath = new URL(
  "../../finance-dashboard/components/tabs/tab-overview.tsx",
  import.meta.url,
);

async function readWorkspaceSource(): Promise<string> {
  return [
    await Bun.file(workspacePath).text(),
    await Bun.file(stepContentPath).text(),
    await Bun.file(workspaceActionsPath).text(),
  ].join("\n");
}

describe("inline owner onboarding workspace", () => {
  test("keeps setup actions inside onboarding instead of linking to operational modules", async () => {
    const source = await readWorkspaceSource();
    expect(source).not.toContain('href="/settings');
    expect(source).not.toContain('href="/materials');
    expect(source).not.toContain('href="/ledger');
    expect(source).toContain("router.replace(`/onboarding?step=${next}`");
  });

  test("uses a setup-only account surface", async () => {
    const source = await Bun.file(accountPanelPath).text();
    expect(source).toContain("SetupBankAccountsPanel");
    expect(source).toContain("createBankAccount");
    expect(source).toContain("updateBankAccount");
    expect(source).not.toContain("postManualCashMovement");
    expect(source).not.toContain("transferBetweenBankAccounts");
    expect(source).not.toContain("reconcileCashTransaction");
  });

  test("uses dedicated onboarding presentation instead of Settings headers", async () => {
    const source = await Bun.file(financialPanelPath).text();
    expect(source).toContain('presentation="onboarding"');
    expect(source).toContain("OnboardingStage");
    expect(source).toContain("OnboardingSurface");
    expect(source).not.toContain("SettingsHeader");
    expect(source).not.toContain("WorkspaceModuleHeader");
  });

  test("loads independent setup sources in parallel with isolated source errors", async () => {
    const source = await Bun.file(loaderPath).text();
    expect(source).toContain("Promise.allSettled");
    expect(source).toContain('status: "error"');
    expect(source).toContain("getOwnerOnboardingBankAccounts");
    expect(source).toContain("getInitialStockCandidates");
    expect(source).toContain("getInventoryOpeningBatches");
    expect(source).toContain("buildVerificationSnapshots");
    expect(source).toContain("Movement OPENING_BALANCE");
    expect(source).toContain("harga rata-rata");
  });

  test("uses one atomic advancement action and hard completion state", async () => {
    const source = await readWorkspaceSource();
    expect(source).toContain("advanceOwnerOnboardingStep");
    expect(source).not.toContain("updateOwnerOnboardingStep");
    expect(source).toContain("overview.canComplete");
    expect(source).toContain("Wajib diselesaikan");
    expect(source).toContain("Boleh dilengkapi nanti");
  });

  test("keeps pause confirmation and dashboard continuation accessible without decorative motion", async () => {
    const workspaceSource = await readWorkspaceSource();
    const dashboardSource = await Bun.file(dashboardTabsPath).text();

    expect(workspaceSource).toContain("showExitConfirm");
    expect(workspaceSource).toContain("Jeda setup sekarang?");
    expect(workspaceSource).toContain("grid grid-cols-2 gap-2");
    expect(workspaceSource).toContain("transition={transitionSpringSnappy}");
    expect(dashboardSource).toContain('role="progressbar"');
    expect(dashboardSource).toContain("aria-valuetext");
    expect(dashboardSource).toContain("Lanjutkan setup");
    expect(dashboardSource).not.toContain("animate-pulse");
  });

  test("keeps Finance setup review on the canonical opening mutation", async () => {
    const source = await Bun.file(financeReviewPath).text();
    expect(source).toContain("decideInventoryOpening");
    expect(source).toContain("Alasan keputusan");
    expect(source.replace(/\s+/g, " ")).toContain(
      "Kas, utang vendor, dan realisasi biaya proyek tidak berubah",
    );
    expect(source).not.toContain("update(materialInventory)");
    expect(source).toContain("amount={active.totalValue}");
    expect(source).toContain('className="min-w-0 flex-1"');
    expect(source).toContain('decision === "APPROVE"');
    expect(source).toContain('"/onboarding?step=summary"');
    expect(source).toContain("window.location.replace");
    expect(source).toContain("remainingBatches");
  });

  test("keeps verification detail collapsed behind one accessible disclosure", async () => {
    const source = await Bun.file(verificationPanelPath).text();
    expect(source).toContain("React.useState(false)");
    expect(source).toContain("aria-expanded={expanded}");
    expect(source).toContain("aria-controls={contentId}");
    expect(source).toContain("Status langkah");
    expect(source).not.toContain("Dibaca langsung dari database");
    expect(source).toContain("AnimatePresence");
    expect(source).toContain("useReducedMotion");
    expect(source).not.toContain("Verification snapshot");
  });

  test("confirms inline Finance simulation with the shared modal", async () => {
    const source = await Bun.file(initialStockPanelPath).text();
    expect(source).toContain("ConfirmationDialog");
    expect(source).toContain("Masuk sebagai Finance Admin?");
    expect(source).toContain("Konsekuensi audit");
    expect(source).toContain('context: "ONBOARDING_SETUP_REVIEW"');
    expect(source).not.toContain("window.confirm");
  });

  test("opens saldo awal detail at natural height with consistent wrapping rows", async () => {
    const source = await Bun.file(initialStockPanelPath).text();
    const detailSheetStart = source.indexOf('title="Detail saldo awal"');
    const detailSheetTagEnd = source.indexOf(">", detailSheetStart);
    expect(detailSheetStart).toBeGreaterThan(-1);
    expect(source.slice(detailSheetStart, detailSheetTagEnd)).not.toContain("initialExpanded");
    expect(source).toContain("OpeningDetailRow");
    expect(source).toContain('label="Alasan keputusan"');
    expect(source).toContain("wrap-anywhere");
    expect(source).toContain("Saldo awal sudah disetujui");
    expect(source).toContain("Catat saldo awal lainnya");
  });
});
