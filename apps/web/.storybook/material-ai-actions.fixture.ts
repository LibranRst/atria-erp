import {
  materialFieldsSchema,
  materialStartSchema,
  materialDraftIdentitySchema,
  materialPatchSchema,
  materialSelectionSchema,
  materialSaveSchema,
  materialConfirmReferenceSchema,
  normalizeMaterialIdentity,
  type MaterialDraftView,
} from "@atria/core/ai/material-import";
import type { ActionResponse } from "@atria/core/types/action-response";

export const materialReviewScenarios = [
  "batch-500",
  "all-selected",
  "partial-selected",
  "partial-saved",
  "all-saved",
  "none-selected",
  "needs-review",
  "analysing",
  "failed",
  "cancelled",
  "empty",
  "save-error",
] as const;
export type MaterialReviewScenario = (typeof materialReviewScenarios)[number];
const drafts = new Map<string, MaterialDraftView>();
const proposals = new Map<string, string>();
const saveFailures = new Set<string>();

function fixture(scenario: MaterialReviewScenario): MaterialDraftView {
  const total = scenario === "empty" ? 0 : scenario === "batch-500" ? 500 : 8;
  const rows = Array.from({ length: total }, (_, index) => {
    const saved =
      scenario === "all-saved" || (["partial-saved", "cancelled"].includes(scenario) && index < 3);
    const issues =
      scenario === "needs-review"
        ? index === 1
          ? ["Duplikat: nama atau kode sudah digunakan."]
          : ["Kategori belum ditemukan atau ambigu."]
        : scenario === "batch-500" && index === 1
          ? ["Kategori belum ditemukan atau ambigu."]
          : [];
    return {
      id: crypto.randomUUID(),
      fields: materialFieldsSchema.parse({
        name: index === 0 ? "MDF 18 mm putih" : `Material contoh ${index + 1}`,
        categoryName: issues.some((issue) => issue.startsWith("Kategori"))
          ? "Kategori baru"
          : "Papan",
        unit: "lembar",
        locationName: "Gudang utama",
        withoutVendor: true,
        lastPurchasePrice: 125000,
      }),
      source: {
        fileName: "katalog-contoh.xlsx",
        sheet: "Material",
        row: index + 2,
        raw: "Nama: MDF 18 mm putih; Satuan: lembar; Harga: 125.000",
      },
      selected:
        !saved &&
        scenario !== "none-selected" &&
        scenario !== "needs-review" &&
        (scenario === "partial-selected"
          ? index < 3
          : scenario === "partial-saved"
            ? index < 5
            : true),
      needsSourceReview: false,
      materialId: saved ? crypto.randomUUID() : null,
      similarNames: [],
      issues,
    };
  });
  return {
    id: crypto.randomUUID(),
    revision: 1,
    canCreateVendor: false,
    options: { categories: ["Papan"], locations: ["Gudang utama"], vendors: ["Supplier contoh"] },
    payload: {
      conversationId: "10000000-0000-4000-8000-000000000001",
      toolCallId: scenario,
      analysisStatus:
        scenario === "analysing"
          ? "PROCESSING"
          : scenario === "failed"
            ? "FAILED"
            : scenario === "cancelled"
              ? "CANCELLED"
              : "READY",
      progress: scenario === "analysing" ? 3 : total,
      error:
        scenario === "failed"
          ? "Sumber belum dapat dibaca karena koneksi terputus. Progres terakhir aman."
          : null,
      appliedCorrections: [],
      referenceReceipts: {},
      rows,
      receipts: rows.some((row) => row.materialId)
        ? [
            {
              operationId: crypto.randomUUID(),
              rows: rows.flatMap((row) =>
                row.materialId ? [{ rowId: row.id, materialId: row.materialId }] : [],
              ),
            },
          ]
        : [],
    },
  };
}
function result(draft: MaterialDraftView): ActionResponse<MaterialDraftView> {
  return { success: true, data: structuredClone(draft) };
}
function commit(draft: MaterialDraftView): ActionResponse<MaterialDraftView> {
  const updated = { ...draft, revision: draft.revision + 1 };
  drafts.set(updated.id, updated);
  return result(updated);
}
function failure(message: string): ActionResponse<MaterialDraftView> {
  return { success: false, error: { code: "VALIDATION_ERROR", message } };
}
function find(id: string): MaterialDraftView {
  const draft = drafts.get(id);
  if (!draft) throw new Error("Draft contoh tidak ditemukan.");
  return draft;
}
function validate(draft: MaterialDraftView): void {
  for (const row of draft.payload.rows) {
    if (row.materialId || row.issues.some((issue) => issue.startsWith("Duplikat"))) continue;
    row.issues = draft.options.categories.some(
      (name) =>
        normalizeMaterialIdentity(name) === normalizeMaterialIdentity(row.fields.categoryName),
    )
      ? []
      : ["Kategori belum ditemukan atau ambigu."];
  }
}
async function pause(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
}
export async function startAiMaterialAnalysis(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const { toolCallId } = materialStartSchema.parse(input);
  const existing = proposals.get(toolCallId);
  if (existing) return result(find(existing));
  const scenario = materialReviewScenarios.find((name) => name === toolCallId) ?? "batch-500";
  const draft = fixture(scenario);
  drafts.set(draft.id, draft);
  proposals.set(toolCallId, draft.id);
  return result(draft);
}
export async function getAiMaterialDraft(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  await pause();
  return result(find(materialDraftIdentitySchema.parse(input).draftId));
}
export async function patchAiMaterialDraft(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const patch = materialPatchSchema.parse(input),
    draft = find(patch.draftId);
  await pause();
  if (patch.expectedRevision !== draft.revision)
    return failure("Draft berubah. Cek pembaruan sebelum melanjutkan.");
  for (const edit of patch.rows) {
    const row = draft.payload.rows.find((item) => item.id === edit.id);
    if (row && !row.materialId) {
      row.fields = edit.fields;
      row.selected = edit.selected;
      row.needsSourceReview = false;
    }
  }
  validate(draft);
  return commit(draft);
}
export async function selectAiMaterialRows(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const selection = materialSelectionSchema.parse(input),
    draft = find(selection.draftId);
  await pause();
  if (selection.expectedRevision !== draft.revision)
    return failure("Draft berubah. Cek pembaruan sebelum melanjutkan.");
  for (const row of draft.payload.rows)
    if (!row.materialId) row.selected = selection.selectedRowIds.includes(row.id);
  return commit(draft);
}
export async function saveAiMaterialRows(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const save = materialSaveSchema.parse(input),
    draft = find(save.draftId);
  await pause();
  if (draft.payload.receipts.some((receipt) => receipt.operationId === save.operationId))
    return result(draft);
  if (draft.payload.toolCallId === "save-error" && !saveFailures.has(draft.id)) {
    saveFailures.add(draft.id);
    return failure("Penyimpanan belum berhasil. Pilihan tetap aman; coba simpan lagi.");
  }
  if (save.expectedRevision !== draft.revision)
    return failure("Draft berubah. Cek pembaruan sebelum melanjutkan.");
  const selected = draft.payload.rows.filter((row) => save.rowIds.includes(row.id));
  if (selected.some((row) => row.materialId || !row.selected || row.issues.length))
    return failure("Baris pilihan belum valid.");
  const receipt: MaterialDraftView["payload"]["receipts"][number] = {
    operationId: save.operationId,
    rows: [],
  };
  for (const row of selected) {
    row.materialId = crypto.randomUUID();
    row.selected = false;
    receipt.rows.push({ rowId: row.id, materialId: row.materialId });
  }
  draft.payload.receipts.push(receipt);
  return commit(draft);
}
export async function confirmAiMaterialReference(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const confirm = materialConfirmReferenceSchema.parse(input),
    draft = find(confirm.draftId);
  await pause();
  if (confirm.expectedRevision !== draft.revision)
    return failure("Draft berubah. Cek pembaruan sebelum melanjutkan.");
  const references =
    "references" in confirm ? confirm.references : [{ reference: confirm.reference }];
  for (const { reference } of references) {
    const kind = reference.kind,
      key = kind === "category" ? "categories" : kind === "location" ? "locations" : "vendors";
    draft.options[key].push(reference.name);
  }
  validate(draft);
  return commit(draft);
}
export async function retryAiMaterialAnalysis(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const draft = find(materialDraftIdentitySchema.parse(input).draftId);
  await pause();
  draft.payload.analysisStatus = "READY";
  draft.payload.error = null;
  return commit(draft);
}
export async function discardAiMaterialDraft(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const draft = find(materialDraftIdentitySchema.parse(input).draftId);
  await pause();
  draft.payload.analysisStatus = "CANCELLED";
  return commit(draft);
}
