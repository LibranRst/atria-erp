import { z } from "zod";
import { rapIdSchema, rapDraftIdentitySchema } from "./rap-draft";
import { packageCategorySchema, packageSnapshotSchema } from "./category-plan";
import { assertRapCategoryReady, assertRapSetupTransition } from "../project/rap-setup";

export const RAP_SETUP_KIND = "RAP_SETUP_ACTIONS";
export const setupStageSchema = z.enum(["MATERIAL", "TUKANG", "SUBCON", "REVIEW", "COMPLETE"]);
export const setupPackageSchema = z.object({
  id: rapIdSchema,
  category: packageCategorySchema,
  status: z.string(),
  snapshot: packageSnapshotSchema.extend({
    name: z.string(),
    area: z.string(),
    unit: z.string(),
    scopeDescription: z.string().nullable(),
    internalNote: z.string().nullable(),
    quantity: z.number(),
    estimatedUnitCost: z.number(),
    estimatedTotalCost: z.number(),
  }),
});
export const setupStateSchema = z.object({
  stage: setupStageSchema,
  status: z.enum(["DRAFT", "LOCKED"]),
  materialCount: z.number().int().nonnegative(),
  tukangSkipped: z.boolean(),
  subconSkipped: z.boolean(),
  packages: z.array(setupPackageSchema),
});
export const setupStepSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("READY_PACKAGES"),
      itemIds: z
        .array(rapIdSchema)
        .min(1)
        .max(50)
        .refine(
          (ids) => new Set(ids).size === ids.length,
          "Paket yang sama tidak boleh dipilih dua kali.",
        ),
    })
    .strict(),
  z
    .object({
      action: z.literal("SET_SCOPE"),
      category: packageCategorySchema,
      skipped: z.boolean(),
    })
    .strict(),
  z
    .object({ action: z.literal("ADVANCE"), targetStage: z.enum(["TUKANG", "SUBCON", "REVIEW"]) })
    .strict(),
  z.object({ action: z.literal("FINALIZE") }).strict(),
]);
export const setupInputSchema = z
  .object({ projectId: rapIdSchema, steps: z.array(setupStepSchema).min(1).max(50) })
  .strict()
  .refine((input) => {
    const ids = input.steps.flatMap((step) =>
      step.action === "READY_PACKAGES" ? step.itemIds : [],
    );
    return ids.length <= 50 && new Set(ids).size === ids.length;
  }, "Maksimal 50 paket unik dapat ditandai Siap dalam satu usulan.")
  .refine((input) => {
    const i = input.steps.findIndex((s) => s.action === "FINALIZE");
    return i < 0 || i === input.steps.length - 1;
  }, "Finalisasi harus menjadi langkah terakhir.");
export type SetupStep = z.infer<typeof setupStepSchema>;
export type SetupInput = z.infer<typeof setupInputSchema>;
export type SetupState = z.infer<typeof setupStateSchema>;
export function setupStepPermission(
  step: SetupStep,
  before: SetupState,
): "update:budget" | "update:rap" | "lock:rap" {
  return step.action === "FINALIZE"
    ? "lock:rap"
    : step.action === "ADVANCE" && before.stage === "MATERIAL"
      ? "update:rap"
      : "update:budget";
}
export function simulateSetupStep(before: SetupState, step: SetupStep): SetupState {
  if (before.status !== "DRAFT") throw new Error("RAP sudah terkunci. Gunakan alur revisi.");
  const state: SetupState = { ...before, packages: before.packages.map((p) => ({ ...p })) };
  const rows = (): { categoryCode: string; status: string }[] =>
    state.packages.map((p) => ({ categoryCode: p.category, status: p.status }));
  if (step.action === "READY_PACKAGES")
    for (const id of step.itemIds) {
      const pkg = state.packages.find((p) => p.id === id);
      if (!pkg || pkg.status !== "DRAFT")
        throw new Error("Pilih paket Draft terbaru untuk ditandai Siap.");
      if (pkg.category === "TUKANG" ? state.tukangSkipped : state.subconSkipped)
        throw new Error("Buka kembali scope sebelum menyiapkan paket.");
      pkg.status = "ACTIVE";
    }
  else if (step.action === "SET_SCOPE") {
    const key = step.category === "TUKANG" ? "tukangSkipped" : "subconSkipped";
    if (state[key] === step.skipped) throw new Error("Keputusan scope tidak berubah.");
    if (
      step.skipped &&
      state.packages.some(
        (p) => p.category === step.category && ["DRAFT", "ACTIVE"].includes(p.status),
      )
    )
      throw new Error(
        "Scope masih memiliki paket. Hapus paket Draft atau pertahankan scope yang digunakan.",
      );
    state[key] = step.skipped;
  } else if (step.action === "ADVANCE") {
    assertRapSetupTransition(state.stage, step.targetStage);
    if (state.stage === "MATERIAL" && state.materialCount === 0)
      throw new Error("Tambahkan minimal satu material sebelum lanjut.");
    if (state.stage === "TUKANG") assertRapCategoryReady(rows(), "TUKANG", state.tukangSkipped);
    if (state.stage === "SUBCON") assertRapCategoryReady(rows(), "SUBCON", state.subconSkipped);
    state.stage = step.targetStage;
  } else {
    if (state.stage !== "REVIEW" || state.materialCount === 0)
      throw new Error("Selesaikan tahap Material, Tukang, Subcon dan Review sebelum finalisasi.");
    assertRapCategoryReady(rows(), "TUKANG", state.tukangSkipped);
    assertRapCategoryReady(rows(), "SUBCON", state.subconSkipped);
    state.stage = "COMPLETE";
    state.status = "LOCKED";
  }
  return state;
}
export function setupReadiness(state: SetupState): {
  material: boolean;
  tukang: boolean;
  subcon: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  const rows = state.packages.map((p) => ({ categoryCode: p.category, status: p.status }));
  const material = state.materialCount > 0;
  if (!material) blockers.push("Material RAP masih kosong.");
  function check(category: "TUKANG" | "SUBCON", skipped: boolean): boolean {
    try {
      assertRapCategoryReady(rows, category, skipped);
      return true;
    } catch (error: unknown) {
      blockers.push(
        error instanceof Error
          ? error.message
              .replaceAll("TUKANG", "Tukang")
              .replaceAll("SUBCON", "Subcon")
              .replaceAll("DRAFT", "Draft")
              .replaceAll("package", "paket")
          : "Scope belum siap.",
      );
      return false;
    }
  }
  return {
    material,
    tukang: check("TUKANG", state.tukangSkipped),
    subcon: check("SUBCON", state.subconSkipped),
    blockers,
  };
}
export const setupProposalSchema = z
  .object({
    kind: z.literal(RAP_SETUP_KIND),
    projectId: rapIdSchema,
    projectName: z.string(),
    projectRapId: rapIdSchema,
    expectedContext: z.string().regex(/^[a-f0-9]{64}$/),
    request: setupInputSchema,
    before: setupStateSchema,
    after: setupStateSchema,
    steps: z
      .array(
        z.object({
          step: setupStepSchema,
          permission: z.enum(["update:budget", "update:rap", "lock:rap"]),
          label: z.string(),
          detail: z.string(),
          packageIds: z.array(rapIdSchema),
        }),
      )
      .min(1)
      .max(50),
    budget: z.object({
      projectValue: z.number(),
      internalCap: z.number(),
      planTotal: z.number(),
      actual: z.number(),
      pending: z.number(),
      remaining: z.number(),
      marginAmount: z.number(),
      categories: z.array(
        z.object({
          id: rapIdSchema,
          code: z.string(),
          name: z.string(),
          allocated: z.number(),
          planned: z.number().nullable(),
          actual: z.number(),
          pending: z.number(),
          remaining: z.number(),
          overAllocation: z.number(),
        }),
      ),
    }),
  })
  .strict();
export const setupIdentitySchema = rapDraftIdentitySchema;
export const setupViewSchema = z.object({
  proposal: setupProposalSchema,
  status: z.enum(["READY", "STALE", "EXPIRED", "CONFIRMED"]),
  confirmedAt: z.string().nullable(),
});
export const setupReceiptSchema = z.object({
  projectRapId: rapIdSchema,
  stage: setupStageSchema,
  status: z.enum(["DRAFT", "LOCKED"]),
  alreadyConfirmed: z.boolean(),
});
export type SetupProposal = z.infer<typeof setupProposalSchema>;
export type SetupView = z.infer<typeof setupViewSchema>;
export type SetupReceipt = z.infer<typeof setupReceiptSchema>;
