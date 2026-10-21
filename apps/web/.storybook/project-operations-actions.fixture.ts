import type { ActionResponse } from "@atria/core/types/action-response";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
import type { ActivityDetailRequest, ActivityDetailView } from "@atria/core/activity-detail/types";
import { getActivityDetail as getMaterialActivityDetail } from "./materials-actions.fixture";
import {
  PROJECT_OPERATIONS_FIXTURE_PROJECT,
  projectOperationsFixtureMovements,
} from "./project-operations-data.fixture";
import { projectMovementLabel } from "@/features/projects/detail/components/stock/project-stock-desktop-model";

export async function activateProjectAction(
  ...args: WebRpcArgs<"app/actions/project/activation.activateProjectAction">
): Promise<WebRpcResult<"app/actions/project/activation.activateProjectAction">> {
  void args;
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Preview Stok/Pengeluaran: tindakan ini tidak mengubah data.",
    },
  };
}

export async function getProjectClosingChecklist(
  ...args: WebRpcArgs<"app/actions/project/closing.getProjectClosingChecklist">
): Promise<WebRpcResult<"app/actions/project/closing.getProjectClosingChecklist">> {
  void args;
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Preview Stok/Pengeluaran: tindakan ini tidak mengubah data.",
    },
  };
}

export async function completeProject(
  ...args: WebRpcArgs<"app/actions/project/closing.completeProject">
): Promise<WebRpcResult<"app/actions/project/closing.completeProject">> {
  void args;
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Preview Stok/Pengeluaran: tindakan ini tidak mengubah data.",
    },
  };
}

export async function recordClientPayment(
  ...args: WebRpcArgs<"app/actions/finance/record-client-payment.recordClientPayment">
): Promise<WebRpcResult<"app/actions/finance/record-client-payment.recordClientPayment">> {
  void args;
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Preview Stok/Pengeluaran: tindakan ini tidak mengubah data.",
    },
  };
}

export async function generateClientInvoiceSchedule(
  ...args: WebRpcArgs<"app/actions/finance/generate-invoice-schedule.generateClientInvoiceSchedule">
): Promise<
  WebRpcResult<"app/actions/finance/generate-invoice-schedule.generateClientInvoiceSchedule">
> {
  void args;
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Preview Stok/Pengeluaran: tindakan ini tidak mengubah data.",
    },
  };
}

export async function createClientInvoice(
  ...args: WebRpcArgs<"app/actions/finance/create-client-invoice.createClientInvoice">
): Promise<WebRpcResult<"app/actions/finance/create-client-invoice.createClientInvoice">> {
  void args;
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Preview Stok/Pengeluaran: tindakan ini tidak mengubah data.",
    },
  };
}

export async function getInvoicePrefillContext(
  ...args: WebRpcArgs<"app/actions/finance/get-invoice-prefill-context.getInvoicePrefillContext">
): Promise<
  WebRpcResult<"app/actions/finance/get-invoice-prefill-context.getInvoicePrefillContext">
> {
  void args;
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Preview Stok/Pengeluaran: tindakan ini tidak mengubah data.",
    },
  };
}

/** Only this preview's exact movement IDs are intercepted. All mutations retain existing failure fixtures. */
export async function getActivityDetail(
  request: ActivityDetailRequest,
): Promise<ActionResponse<ActivityDetailView>> {
  const row =
    request.kind === "STOCK_MOVEMENT"
      ? projectOperationsFixtureMovements().find((move) => move.id === request.id)
      : undefined;
  if (!row) return getMaterialActivityDetail(request);
  return {
    success: true,
    data: {
      kind: "STOCK_MOVEMENT",
      id: row.id,
      title: row.material.name,
      subtitle: projectMovementLabel(row.movementType),
      status: "POSTED",
      statusTone: "SUCCESS",
      occurredAt: row.createdAt.toISOString(),
      actorName: row.createdBy.name,
      facts: [
        {
          label: "Proyek",
          value: { type: "TEXT", value: PROJECT_OPERATIONS_FIXTURE_PROJECT.name },
        },
        { label: "Lokasi", value: { type: "TEXT", value: row.location.name } },
        {
          label: "Jumlah",
          value: { type: "QUANTITY", value: Number(row.quantity), unit: row.material.unit },
        },
        { label: "Biaya per unit", value: { type: "MONEY", value: Number(row.unitCost) } },
      ],
      comparisons: [],
      impacts: [
        {
          label: "Kas",
          value: { type: "TEXT", value: "Gerakan stok ini tidak mencairkan pembayaran." },
        },
      ],
      notes: [{ label: "Catatan", value: { type: "TEXT", value: row.note ?? "Contoh sintetis." } }],
      source: null,
      evidenceIncomplete: false,
    },
  };
}
