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
const budgetDefaultsSheetPath = new URL(
  "../components/panels/onboarding-budget-defaults-sheet.tsx",
  import.meta.url,
);
const loaderPath = new URL(
  "../../../../api/src/backend/features/onboarding/server/get-owner-onboarding-workspace-data.ts",
  import.meta.url,
);
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
const openingEntryFormPath = new URL(
  "../../materials/components/workspaces/opening-inventory-entry-form.tsx",
  import.meta.url,
);
const dashboardTabsPath = new URL(
  "../../finance-dashboard/components/tabs/tab-overview.tsx",
  import.meta.url,
);
const setupCardPath = new URL(
  "../components/quick-start/organization-setup-card.tsx",
  import.meta.url,
);
const quickStartWorkspacePath = new URL(
  "../components/quick-start/quick-start-workspace.tsx",
  import.meta.url,
);
const firstProjectPath = new URL(
  "../components/quick-start/first-project-panel.tsx",
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
    const [source, sheet] = await Promise.all([
      Bun.file(financialPanelPath).text(),
      Bun.file(budgetDefaultsSheetPath).text(),
    ]);
    expect(source).toContain("OnboardingBudgetDefaultsSheet");
    expect(source).not.toContain("BudgetSettingsManager");
    expect(source).not.toContain("<FormSheet");
    expect(source).toContain("OnboardingStage");
    expect(source).toContain("OnboardingSurface");
    expect(sheet).toContain("WorkflowFormSheet");
    expect(sheet).toContain("updateBudgetAllocationDefaults");
    expect(sheet).toContain("Proyek aktif tidak berubah");
    expect(sheet).not.toContain("sticky");
    expect(sheet).not.toContain("SettingsInverseSurface");
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
    const setupCardSource = await Bun.file(setupCardPath).text();

    expect(workspaceSource).toContain("showExitConfirm");
    expect(workspaceSource).toContain("Jeda setup sekarang?");
    expect(workspaceSource).toContain("grid grid-cols-2 gap-2");
    // Action feedback belongs to the shared Button, rather than per-feature
    // motion wrappers; the shared button suite verifies its spring and hold.
    expect(workspaceSource).toContain("<Button");
    expect(dashboardSource).toContain("OrganizationSetupCard");
    expect(setupCardSource).toContain('role="progressbar"');
    expect(setupCardSource).toContain("aria-valuetext");
    expect(setupCardSource).toContain("ButtonLink");
    expect(setupCardSource).not.toContain("animate-pulse");
  });

  test("quick start reaches a real Draft project with honest financial inputs", async () => {
    const workspace = await Bun.file(quickStartWorkspacePath).text();
    const project = await Bun.file(firstProjectPath).text();

    expect(workspace).toContain("Sekitar 10–15 menit");
    expect(workspace).toContain("Quick start hanya membuat project Draft");
    expect(project).toContain("createFirstProjectQuickStart");
    expect(project).toContain("Nilai project");
    expect(project).toContain("RAB disetujui");
    expect(project).toContain("Belum ditugaskan");
    expect(project).toContain("Preview budget awal");
    expect(project).toContain('className="px-4 py-3"');
  });

  test("renders only the step whose data payload was loaded by the server", async () => {
    const workspace = await Bun.file(quickStartWorkspacePath).text();
    const loader = await Bun.file(
      new URL(
        "../../../../api/src/backend/features/onboarding/server/get-quick-start-workspace-data.ts",
        import.meta.url,
      ),
    ).text();

    expect(loader).toContain("readonly activeStep: QuickStartStepId");
    expect(loader).toContain("activeStep: step");
    expect(workspace).toContain("initialData.activeStep");
    expect(workspace).not.toContain("initialData.overview.quickStart.state.currentStep");
    expect(workspace).not.toContain("setStep(result.data.currentStep)");
  });

  test("the legacy initial-stock footer cannot continue without an explicit decision", async () => {
    const source = await Bun.file(workspaceActionsPath).text();
    expect(source).toContain('overview.state.initialStockDecision !== "UNDECIDED"');
    expect(source).toContain('overview.state.initialStockDecision !== "SKIPPED"');
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

  test("gives the onboarding saldo-awal sheet one fixed action owner", async () => {
    const [panel, entry] = await Promise.all([
      Bun.file(initialStockPanelPath).text(),
      Bun.file(openingEntryFormPath).text(),
    ]);

    expect(panel).toContain("OpeningInventoryEntryForm");
    expect(panel).toContain('presentation="sheet"');
    expect(panel).not.toContain("OpeningInventoryWorkspace");
    expect(panel).not.toContain("<FormSheet");
    expect(entry).toContain("<OperationalFormSheet");
    expect(entry).toContain('formId="onboarding-opening-inventory-form"');
    expect(entry).toMatch(/submitLabel=\{[^\n]*"Ajukan saldo awal"/);
    expect(entry).toContain("disabledReason={submitDisabledReason}");
  });
});
