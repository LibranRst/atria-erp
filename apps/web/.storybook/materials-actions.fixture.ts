import type { ActionResponse } from "@atria/core/types/action-response";
import type { ActivityDetailRequest, ActivityDetailView } from "@atria/core/activity-detail/types";
import type { MaterialMovementPage } from "@/app/actions/material/operations-dashboard";
import {
  materialDesktopActivityInputSchema,
  type MaterialDesktopActivityData,
  type MaterialDesktopActivityInput,
  type MaterialDesktopActivityRequest,
} from "@atria/core/material/material-desktop";
import {
  MATERIALS_FIXTURE_REFERENCE,
  materialsFixtureCounts,
  materialsFixtureData,
  materialsFixtureMovements,
  materialsFixtureReceipts,
  materialsFixtureTransfers,
  type MaterialsFixtureScenario,
} from "./materials-data.fixture";
import { getActivityDetail as getExpenseActivityDetail } from "./expenses-actions.fixture";

let scenario: MaterialsFixtureScenario = "complete";
const pendingWrites = new Set<() => void>();
export function setMaterialsFixtureScenario(next: MaterialsFixtureScenario): void {
  for (const release of pendingWrites) release();
  pendingWrites.clear();
  scenario = next;
}
function failure(message: string): ActionResponse<never> {
  return { success: false, error: { code: "VALIDATION_ERROR", message } };
}
async function fixtureWrite(): Promise<ActionResponse<never>> {
  if (scenario === "pending") await new Promise<void>((resolve) => pendingWrites.add(resolve));
  return failure("Fixture visual: tindakan tidak menyimpan stok, audit, atau data ke backend.");
}
export const reserveMaterialForProject = fixtureWrite;
export const returnMaterialFromProject = fixtureWrite;
export const useMaterialForProject = fixtureWrite;
export const wasteMaterialForProject = fixtureWrite;
export const createInventoryLocation = fixtureWrite;
export const createStockTransfer = fixtureWrite;
export const approveStockCount = fixtureWrite;
export const rejectStockCount = fixtureWrite;
export const saveStockCount = fixtureWrite;
export const submitStockCount = fixtureWrite;
export const approveGoodsReceiptReversal = fixtureWrite;
export const rejectGoodsReceiptReversal = fixtureWrite;
export const requestGoodsReceiptReversal = fixtureWrite;
export const emergencyAdjustStock = fixtureWrite;
export const postGoodsReceipt = fixtureWrite;

export async function getMaterialMovementPage(): Promise<ActionResponse<MaterialMovementPage>> {
  return {
    success: true,
    data: {
      items: scenario === "empty" ? [] : materialsFixtureMovements().slice(50),
      hasMore: false,
    },
  };
}

function page<Row>(
  rows: readonly Row[],
  input: MaterialDesktopActivityInput,
  predicate: (row: Row) => boolean,
  sortValue: (row: Row) => string | number,
): { readonly rows: readonly Row[]; readonly total: number; readonly page: number } {
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  const filtered = rows.filter(predicate).map((row, index) => ({ row, index }));
  filtered.sort((a, b): number => {
    const av = sortValue(a.row),
      bv = sortValue(b.row);
    const result =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : collator.compare(String(av), String(bv));
    return (input.direction === "descending" ? -result : result) || a.index - b.index;
  });
  const current = Math.min(input.page, Math.max(1, Math.ceil(filtered.length / input.pageSize)));
  return {
    rows: filtered
      .slice((current - 1) * input.pageSize, current * input.pageSize)
      .map(({ row }) => row),
    total: filtered.length,
    page: current,
  };
}

/** Complete synthetic collections exercise pagination without touching the API or database. */
export async function readMaterialDesktopActivity(
  request: MaterialDesktopActivityRequest,
): Promise<ActionResponse<MaterialDesktopActivityData>> {
  if (scenario === "activity-error")
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Fixture: aktivitas belum dapat dimuat. Coba lagi.",
      },
    };
  const parsed = materialDesktopActivityInputSchema.safeParse(request);
  if (!parsed.success) return failure("Fixture: filter aktivitas tidak valid.");
  const input = parsed.data;
  const search = input.search.toLocaleLowerCase("id-ID");
  const data = materialsFixtureData(scenario);
  const location = data.locations.find((row) => row.id === input.locationId)?.name;
  const periodStart =
    input.period === "all"
      ? 0
      : Date.parse(MATERIALS_FIXTURE_REFERENCE) - Number(input.period) * 86400000;
  const matches = (text: string, date: Date, status: string): boolean =>
    text.toLocaleLowerCase("id-ID").includes(search) &&
    date.getTime() >= periodStart &&
    (input.status === "all" || input.status === status);
  const assignedProject = scenario === "assigned" ? data.projects[0]?.id : undefined;
  const common = { pageSize: input.pageSize, updatedAt: new Date(MATERIALS_FIXTURE_REFERENCE) };
  if (input.kind === "movements")
    return {
      success: true,
      data: {
        ...common,
        kind: "movements",
        ...page(
          scenario === "empty" ? [] : materialsFixtureMovements(),
          input,
          (row) =>
            (!input.projectId || row.projectId === input.projectId) &&
            (!assignedProject || row.projectId === assignedProject) &&
            (!input.locationId || row.locationId === input.locationId) &&
            matches(
              `${row.materialName} ${row.projectName ?? ""} ${row.locationName} ${row.note ?? ""}`,
              row.createdAt,
              row.movementType,
            ),
          (row) =>
            input.sort === "date"
              ? row.createdAt.getTime()
              : input.sort === "name"
                ? row.materialName
                : input.sort === "quantity"
                  ? row.quantity
                  : input.sort === "value"
                    ? row.quantity * row.unitCost
                    : row.movementType,
        ),
      },
    };
  if (input.kind === "receipts")
    return {
      success: true,
      data: {
        ...common,
        kind: "receipts",
        ...page(
          scenario === "empty" ? [] : materialsFixtureReceipts(),
          input,
          (row) =>
            (!input.projectId || row.projectId === input.projectId) &&
            (!assignedProject || row.projectId === assignedProject) &&
            (!input.locationId || row.locationId === input.locationId) &&
            matches(
              `${row.receiptNumber} ${row.projectName} ${row.locationName} ${row.items.map((item) => item.materialName).join(" ")}`,
              row.receivedAt,
              row.status,
            ),
          (row) =>
            input.sort === "date"
              ? row.receivedAt.getTime()
              : input.sort === "name"
                ? row.receiptNumber
                : input.sort === "value"
                  ? row.total
                  : row.status,
        ),
      },
    };
  if (input.kind === "transfers")
    return {
      success: true,
      data: {
        ...common,
        kind: "transfers",
        ...page(
          scenario === "empty" ? [] : materialsFixtureTransfers(),
          input,
          (row) =>
            !input.projectId &&
            (!location || row.fromLocationName === location || row.toLocationName === location) &&
            matches(
              `${row.transferNumber} ${row.fromLocationName} ${row.toLocationName} ${row.note} ${row.items.map((item) => item.materialName).join(" ")}`,
              row.transferredAt,
              "all",
            ),
          (row) =>
            input.sort === "date"
              ? row.transferredAt.getTime()
              : input.sort === "name"
                ? row.transferNumber
                : row.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
        ),
      },
    };
  return {
    success: true,
    data: {
      ...common,
      kind: "counts",
      ...page(
        scenario === "empty" ? [] : materialsFixtureCounts(),
        input,
        (row) =>
          !input.projectId &&
          (!input.locationId || row.locationId === input.locationId) &&
          matches(
            `${row.countNumber} ${row.locationName} ${row.note ?? ""} ${row.items.map((item) => item.materialName).join(" ")}`,
            row.countedAt,
            row.status,
          ),
        (row) =>
          input.sort === "date"
            ? row.countedAt.getTime()
            : input.sort === "name"
              ? row.countNumber
              : row.status,
      ),
    },
  };
}
export const getMaterialDesktopActivity = readMaterialDesktopActivity;

export async function getActivityDetail(
  request: ActivityDetailRequest,
): Promise<ActionResponse<ActivityDetailView>> {
  const data = materialsFixtureData(scenario);
  const count =
    request.kind === "STOCK_COUNT"
      ? materialsFixtureCounts().find((row) => row.id === request.id)
      : undefined;
  const receipt =
    request.kind === "GOODS_RECEIPT"
      ? materialsFixtureReceipts().find((row) => row.id === request.id)
      : undefined;
  const transfer =
    request.kind === "STOCK_TRANSFER"
      ? materialsFixtureTransfers().find((row) => row.id === request.id)
      : undefined;
  const movement =
    request.kind === "STOCK_MOVEMENT"
      ? materialsFixtureMovements().find((row) => row.id === request.id)
      : undefined;
  if (!count && !receipt && !transfer && !movement) return getExpenseActivityDetail(request);
  const status = count?.status ?? receipt?.status ?? "POSTED";
  const title =
    count?.countNumber ??
    receipt?.receiptNumber ??
    transfer?.transferNumber ??
    movement?.materialName ??
    "Aktivitas material";
  const occurredAt =
    count?.countedAt ??
    receipt?.receivedAt ??
    transfer?.transferredAt ??
    movement?.createdAt ??
    new Date(MATERIALS_FIXTURE_REFERENCE);
  const location =
    count?.locationName ??
    receipt?.locationName ??
    transfer?.fromLocationName ??
    movement?.locationName ??
    "Lokasi tidak tersedia";
  return {
    success: true,
    data: {
      kind: request.kind,
      id: request.id,
      title,
      subtitle: location,
      status,
      statusTone:
        status === "PENDING_APPROVAL" || status === "REVERSAL_REQUESTED"
          ? "PENDING"
          : status === "REJECTED" || status === "REVERSED"
            ? "WARNING"
            : "SUCCESS",
      occurredAt: occurredAt.toISOString(),
      actorName:
        count?.createdByName ?? receipt?.receivedByName ?? movement?.createdByName ?? "Karin Putri",
      facts: [
        { label: "Lokasi", value: { type: "TEXT", value: location } },
        ...(receipt
          ? [{ label: "Nilai penerimaan", value: { type: "MONEY" as const, value: receipt.total } }]
          : []),
        ...(movement
          ? [
              {
                label: "Jumlah",
                value: { type: "QUANTITY" as const, value: movement.quantity, unit: movement.unit },
              },
            ]
          : []),
        ...(count
          ? [
              {
                label: "Material diperiksa",
                value: { type: "TEXT" as const, value: `${count.items.length} jenis material` },
              },
            ]
          : []),
      ],
      comparisons: count
        ? count.items.map((item) => ({
            label: item.materialName,
            before: {
              type: "QUANTITY",
              value: item.systemQuantity,
              unit: data.inventory.find((row) => row.materialId === item.materialId)?.unit,
            },
            after: {
              type: "QUANTITY",
              value: item.countedQuantity,
              unit: data.inventory.find((row) => row.materialId === item.materialId)?.unit,
            },
          }))
        : [],
      impacts: [
        {
          label: "Keuangan",
          value: {
            type: "TEXT",
            value: "Penerimaan atau perubahan stok tidak mencairkan pembayaran.",
          },
        },
      ],
      notes: [
        {
          label: "Catatan",
          value: {
            type: "TEXT",
            value:
              count?.note ??
              receipt?.reversalReason ??
              transfer?.note ??
              movement?.note ??
              "Bukti fisik sudah diperiksa.",
          },
        },
      ],
      source: null,
      evidenceIncomplete: false,
    },
  };
}
