import {
  getAdministrationOverview,
  type AdministrationOverview,
} from "@/app/actions/administration";
import {
  getOwnerOnboardingBankAccounts,
  getOwnerOnboardingOverview,
  type OwnerOnboardingBankAccount,
} from "@/app/actions/onboarding";
import {
  getInitialStockCandidates,
  getInventoryOpeningBatches,
  type InitialStockCandidate,
  type InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import {
  getPricingTemplates,
  type PricingTemplateRow,
} from "@/app/actions/settings/pricing-library";
import { getSettingsOverview, type SettingsOverview } from "@/app/actions/settings/system";
import type { OwnerOnboardingOverview } from "@/lib/onboarding/owner-onboarding";
import type { OnboardingVerificationSnapshot } from "@/lib/onboarding/owner-onboarding";
import { isDeveloperAccountSimulationEnabled } from "@/lib/auth/developer-account-simulation";
import type { DeveloperAccountSimulationState } from "@/lib/auth/developer-account-simulation";
import { getDeveloperAccountSimulationState } from "@/app/actions/developer-account-simulation";
import type { ActionResponse } from "@/lib/types/action-response";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";

export type WorkspaceSource<T> =
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "error"; readonly message: string };

export type OwnerOnboardingWorkspaceData = {
  readonly overview: OwnerOnboardingOverview;
  readonly settings: WorkspaceSource<SettingsOverview>;
  readonly administration: WorkspaceSource<AdministrationOverview>;
  readonly bankAccounts: WorkspaceSource<readonly OwnerOnboardingBankAccount[]>;
  readonly library: WorkspaceSource<readonly PricingTemplateRow[]>;
  readonly initialStock: WorkspaceSource<{
    readonly candidates: readonly InitialStockCandidate[];
    readonly batches: readonly InventoryOpeningBatchView[];
  }>;
  readonly verificationSnapshots: readonly OnboardingVerificationSnapshot[];
  readonly developerSimulation: WorkspaceSource<DeveloperAccountSimulationState>;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

function buildVerificationSnapshots(input: {
  readonly overview: OwnerOnboardingOverview;
  readonly settings: WorkspaceSource<SettingsOverview>;
  readonly administration: WorkspaceSource<AdministrationOverview>;
  readonly bankAccounts: WorkspaceSource<readonly OwnerOnboardingBankAccount[]>;
  readonly library: WorkspaceSource<readonly PricingTemplateRow[]>;
  readonly initialStock: OwnerOnboardingWorkspaceData["initialStock"];
}): readonly OnboardingVerificationSnapshot[] {
  const capturedAt = new Date().toISOString();
  const status = (stepId: OnboardingVerificationSnapshot["kind"]) =>
    input.overview.readiness.find((row) => row.id === stepId)?.status ?? "INCOMPLETE";
  const technicalEnabled = isDeveloperAccountSimulationEnabled();
  const settings = input.settings.status === "ready" ? input.settings.data : null;
  const administration = input.administration.status === "ready" ? input.administration.data : null;
  const accounts = input.bankAccounts.status === "ready" ? input.bankAccounts.data : [];
  const templates = input.library.status === "ready" ? input.library.data : [];
  const batches = input.initialStock.status === "ready" ? input.initialStock.data.batches : [];
  const budget = settings?.budgetAllocationSetting;
  const totalAllocation =
    budget?.categories
      .filter((row) => row.isEnabled)
      .reduce((sum, row) => sum + row.ratioPercentage, 0) ?? 0;
  const coreRoles = ["finance_admin", "project_manager", "purchasing"];
  const snapshots: OnboardingVerificationSnapshot[] = [
    {
      kind: "welcome",
      capturedAt,
      status: status("welcome"),
      title: "Konfirmasi ruang lingkup",
      facts: [
        {
          label: "Mutasi otomatis",
          value: "Tidak ada",
          detail: "Data hanya berubah setelah aksi eksplisit disimpan.",
        },
      ],
    },
    {
      kind: "financial_defaults",
      capturedAt,
      status: status("financial_defaults"),
      title: "Default finansial aktual",
      facts: [
        {
          label: "Budget cap",
          value: budget ? `${formatNumber(budget.budgetCapRatio * 100)}%` : "Belum aktif",
        },
        { label: "Total alokasi", value: `${formatNumber(totalAllocation * 100)}%` },
        { label: "Buffer", value: `${formatNumber(Math.max(0, 1 - totalAllocation) * 100)}%` },
        ...(budget?.categories
          .filter((row) => row.isEnabled)
          .map((row) => ({
            label: row.name,
            value: `${formatNumber(row.ratioPercentage * 100)}%`,
            detail: row.code,
          })) ?? []),
      ],
      technical:
        technicalEnabled && budget ? [{ label: "Budget setting ID", value: budget.id }] : undefined,
    },
    {
      kind: "team_vendors",
      capturedAt,
      status: status("team_vendors"),
      title: "Akun tim aktual",
      facts: [
        ...coreRoles.map((roleName) => {
          const member = administration?.users.find(
            (row) => row.roleName.toLowerCase() === roleName && row.isActive,
          );
          return {
            label: formatBusinessLabel(roleName),
            value: member ? member.name : "Belum tersedia",
            detail: member
              ? member.mustChangePassword
                ? "Aktif · password sementara"
                : "Aktif"
              : undefined,
          };
        }),
        {
          label: "Vendor aktif (opsional)",
          value: String(administration?.vendors.filter((row) => row.isActive).length ?? 0),
        },
      ],
    },
    {
      kind: "bank_accounts",
      capturedAt,
      status: status("bank_accounts"),
      title: "Rekening dan dampak kas",
      facts: accounts.flatMap((account) => [
        {
          label: account.name,
          value: `Rp ${formatNumber(account.balance)}`,
          detail: `${account.bankName} · ${account.accountNumber}`,
        },
        ...(account.openingBalanceTransaction
          ? [
              {
                label: "Ledger saldo awal",
                value: `Rp ${formatNumber(account.openingBalanceTransaction.amount)}`,
                detail: account.openingBalanceTransaction.description,
              },
            ]
          : [{ label: "Ledger saldo awal", value: "Tidak ada mutasi" }]),
      ]),
      technical: technicalEnabled
        ? accounts.flatMap((account) => [
            { label: "Bank account ID", value: account.id },
            ...(account.openingBalanceTransaction
              ? [
                  {
                    label: "Cash transaction ID",
                    value: account.openingBalanceTransaction.id,
                    detail: account.openingBalanceTransaction.referenceId ?? undefined,
                  },
                ]
              : []),
          ])
        : undefined,
    },
    {
      kind: "material_foundation",
      capturedAt,
      status: status("material_foundation"),
      title: "Fondasi inventory aktual",
      facts: [
        { label: "Lokasi aktif", value: String(settings?.inventoryLocations.length ?? 0) },
        ...(settings?.materials
          .filter((row) => row.isActive)
          .flatMap((material) => {
            const currentStock = material.inventory.reduce((sum, row) => sum + row.currentStock, 0);
            return [
              {
                label: material.name,
                value: material.unit,
                detail: `Minimum stock ${formatNumber(material.inventory.reduce((sum, row) => sum + row.minimumStock, 0))}`,
              },
              {
                label: "Inventory aktual",
                value: formatNumber(currentStock),
                detail:
                  currentStock === 0
                    ? "Masih nol sebelum saldo awal diposting"
                    : "Sudah berubah melalui mutasi stok canonical",
              },
            ];
          }) ?? []),
      ],
    },
    {
      kind: "item_library",
      capturedAt,
      status: status("item_library"),
      title: "Library aktual (opsional)",
      facts: templates
        .filter((row) => row.isActive)
        .map((row) => ({
          label: row.name,
          value: row.unit,
          detail: `${row.expenseCategoryCode}${row.materialId ? " · tertaut Material Master" : ""}`,
        })),
      technical: technicalEnabled
        ? templates.map((row) => ({ label: "Template ID", value: row.id }))
        : undefined,
    },
    {
      kind: "initial_stock",
      capturedAt,
      status: status("initial_stock"),
      title: "Batch dan dampak saldo awal",
      facts:
        batches.length === 0
          ? [
              {
                label: "Keputusan saldo awal",
                value:
                  status("initial_stock") === "NOT_APPLICABLE"
                    ? "Tidak ada stok lama"
                    : status("initial_stock") === "SKIPPED"
                      ? "Isi nanti (blocker)"
                      : "Belum final",
              },
              { label: "Dampak", value: "Tidak ada mutasi stok maupun kas" },
            ]
          : batches.flatMap((batch) => [
              {
                label: batch.batchNumber,
                value: batch.status,
                detail: `Pengaju ${batch.requestedByName} · Checker ${batch.approvedByName ?? "belum ada"}`,
              },
              {
                label: "Alasan keputusan",
                value:
                  batch.decisionReason ??
                  batch.rejectedReason ??
                  (batch.status === "POSTED"
                    ? "Alasan keputusan belum tercatat pada data lama"
                    : "Belum diputus"),
              },
              ...batch.items.flatMap((item) => [
                {
                  label: `${item.materialName} · ${item.locationName}`,
                  value: `${formatNumber(item.quantity)} ${item.unit}`,
                  detail: `Unit cost Rp ${formatNumber(item.unitCost)} · subtotal Rp ${formatNumber(item.totalValue)}`,
                },
                ...(batch.status === "POSTED"
                  ? [
                      {
                        label: "Posisi stok",
                        value: `${formatNumber(item.currentStock)} ${item.unit}`,
                        detail: `Reserved ${formatNumber(item.reservedStock)} · Available ${formatNumber(item.availableStock)} · average cost Rp ${formatNumber(item.averageCost)}`,
                      },
                    ]
                  : []),
              ]),
              { label: "Total batch", value: `Rp ${formatNumber(batch.totalValue)}` },
              {
                label: "Dampak non-stok",
                value: "Kas, utang vendor, actual cost proyek tidak berubah",
              },
            ]),
      technical: technicalEnabled
        ? batches.flatMap((batch) => [
            { label: "Batch ID", value: batch.id },
            ...batch.items.flatMap((item) => [
              { label: "Opening item ID", value: item.id },
              ...(item.stockMovementId
                ? [
                    {
                      label: "Movement OPENING_BALANCE",
                      value: item.stockMovementId,
                      detail: batch.id,
                    },
                  ]
                : []),
            ]),
          ])
        : undefined,
    },
  ];
  return snapshots;
}

function source<T>(result: ActionResponse<T>): WorkspaceSource<T> {
  return result.success
    ? { status: "ready", data: result.data }
    : { status: "error", message: result.error.message };
}

function settledAction<T>(
  result: PromiseSettledResult<ActionResponse<T>>,
  fallback: string,
): ActionResponse<T> {
  if (result.status === "fulfilled") return result.value;
  return {
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: fallback },
  };
}

export async function getOwnerOnboardingWorkspaceData(): Promise<
  ActionResponse<OwnerOnboardingWorkspaceData>
> {
  const [
    overviewResult,
    settingsResult,
    administrationResult,
    bankAccountsResult,
    libraryResult,
    candidatesResult,
    batchesResult,
    simulationResult,
  ] = await Promise.allSettled([
    getOwnerOnboardingOverview(),
    getSettingsOverview(),
    getAdministrationOverview(),
    getOwnerOnboardingBankAccounts(),
    getPricingTemplates(true),
    getInitialStockCandidates(),
    getInventoryOpeningBatches(),
    getDeveloperAccountSimulationState(),
  ]);

  const overview = settledAction(overviewResult, "Onboarding belum dapat dimuat.");
  const settings = settledAction(
    settingsResult,
    "Default finansial dan Material Master belum dapat dimuat.",
  );
  const administration = settledAction(administrationResult, "Tim dan vendor belum dapat dimuat.");
  const bankAccounts = settledAction(bankAccountsResult, "Rekening perusahaan belum dapat dimuat.");
  const library = settledAction(libraryResult, "Library Item & Harga belum dapat dimuat.");
  const candidates = settledAction(
    candidatesResult,
    "Kandidat saldo awal stok belum dapat dimuat.",
  );
  const batches = settledAction(batchesResult, "Riwayat saldo awal stok belum dapat dimuat.");
  const simulation = settledAction(simulationResult, "Mode simulasi developer belum dapat dimuat.");

  if (!overview.success) return overview;

  const initialStock: OwnerOnboardingWorkspaceData["initialStock"] =
    candidates.success && batches.success
      ? {
          status: "ready",
          data: { candidates: candidates.data, batches: batches.data },
        }
      : {
          status: "error",
          message:
            (!candidates.success && candidates.error.message) ||
            (!batches.success && batches.error.message) ||
            "Data saldo awal stok belum dapat dimuat.",
        };

  return {
    success: true,
    data: {
      overview: overview.data,
      settings: source(settings),
      administration: source(administration),
      bankAccounts: source(bankAccounts),
      library: source(library),
      initialStock,
      verificationSnapshots: buildVerificationSnapshots({
        overview: overview.data,
        settings: source(settings),
        administration: source(administration),
        bankAccounts: source(bankAccounts),
        library: source(library),
        initialStock,
      }),
      developerSimulation: source(simulation),
    },
  };
}
