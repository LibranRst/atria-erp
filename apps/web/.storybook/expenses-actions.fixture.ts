import type { ActionResponse } from "@atria/core/types/action-response";
import type { ExpenseDraftRecord, ExpenseDraftSummary } from "@/app/actions/finance/expense-drafts";
import type { ProjectForExpense } from "@/app/actions/project/budget";
import type { VendorBillFormData } from "@/app/actions/finance/submit-vendor-bill";
import type { VendorBillDraftSummary } from "@/app/actions/finance/vendor-bill-drafts";
import type { ActivityDetailRequest, ActivityDetailView } from "@atria/core/activity-detail/types";
import {
  EXPENSES_FIXTURE_DRAFTS,
  expensesFixtureData,
  expensesFixtureDraft,
  type ExpensesFixtureScenario,
} from "./expenses-data.fixture";
export { approveFieldRequest, approveVendorPayment } from "./approvals-actions.fixture";

let scenario: ExpensesFixtureScenario = "complete";
export function setExpensesFixtureScenario(next: ExpensesFixtureScenario): void {
  scenario = next;
}

async function fixtureWrite(): Promise<ActionResponse<never>> {
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Fixture visual: tindakan ini tidak menyimpan data atau menghubungi backend.",
    },
  };
}

export async function listExpenseDrafts(): Promise<ActionResponse<readonly ExpenseDraftSummary[]>> {
  if (scenario === "drafts-error")
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Fixture: draft belum dapat dimuat. Coba lagi.",
      },
    };
  if (scenario === "drafts-loading")
    await new Promise<void>((resolve) => setTimeout(resolve, 10_000));
  return {
    success: true,
    data:
      scenario === "empty" || scenario === "read-only"
        ? []
        : scenario === "assigned"
          ? EXPENSES_FIXTURE_DRAFTS.slice(0, 1)
          : EXPENSES_FIXTURE_DRAFTS,
  };
}
export async function getExpenseDraft({
  draftId,
}: {
  readonly draftId: string;
}): Promise<ActionResponse<ExpenseDraftRecord>> {
  return { success: true, data: expensesFixtureDraft(draftId) };
}
export async function getActiveProjectsForExpense(): Promise<ActionResponse<ProjectForExpense[]>> {
  return { success: true, data: expensesFixtureData(scenario).projects };
}
export async function getVendorBillFormData(): Promise<ActionResponse<VendorBillFormData>> {
  const data = expensesFixtureData(scenario);
  return {
    success: true,
    data: { projects: data.projects, vendors: data.vendors, userRole: "Fixture" },
  };
}
export async function listVendorBillDrafts(): Promise<
  ActionResponse<readonly VendorBillDraftSummary[]>
> {
  return { success: true, data: [] };
}

export async function getActivityDetail(
  request: ActivityDetailRequest,
): Promise<ActionResponse<ActivityDetailView>> {
  const cost =
    request.kind === "PROJECT_COST"
      ? expensesFixtureData(scenario).costs.find((row) => row.id === request.id)
      : undefined;
  if (!cost)
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Detail aktivitas ini tidak tersedia pada fixture visual.",
      },
    };
  return {
    success: true,
    data: {
      kind: "PROJECT_COST",
      id: cost.id,
      title: cost.description,
      subtitle: cost.project?.name ?? "Proyek tidak tersedia",
      status: cost.status,
      statusTone:
        cost.status === "REJECTED"
          ? "DANGER"
          : cost.status === "PAID" || cost.status === "APPROVED"
            ? "SUCCESS"
            : "PENDING",
      occurredAt: cost.createdAt.toISOString(),
      actorName: cost.requestedBy?.name ?? "Pemohon tidak tersedia",
      facts: [
        { label: "Nominal", value: { type: "MONEY", value: Number(cost.amount) } },
        {
          label: "Kategori",
          value: {
            type: "TEXT",
            value: cost.budgetCategory?.expenseCategory?.name ?? "Kategori tidak tersedia",
          },
        },
      ],
      comparisons: [],
      impacts: [],
      notes: [],
      evidenceIncomplete: true,
      source: { label: "Buka pengeluaran", href: "/expenses?tab=field-claims" },
    },
  };
}

export {
  fixtureWrite as verifyFieldRequest,
  fixtureWrite as payFieldRequest,
  fixtureWrite as rejectFieldRequest,
  fixtureWrite as discardExpenseDraft,
  fixtureWrite as saveExpenseDraft,
  fixtureWrite as submitExpenseDraft,
  fixtureWrite as submitFieldRequest,
  fixtureWrite as submitFieldRequests,
  fixtureWrite as payVendorBill,
  fixtureWrite as scheduleVendorBillPayment,
  fixtureWrite as submitVendorBill,
  fixtureWrite as getVendorBillDraft,
  fixtureWrite as saveVendorBillDraft,
  fixtureWrite as discardVendorBillDraft,
  fixtureWrite as submitVendorBillDraft,
  fixtureWrite as processReceipt,
};
