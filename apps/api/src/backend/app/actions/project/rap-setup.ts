import { cookies } from "@runtime/request-context";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { auditLog, projectCategoryPlanItem, projectRap } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { assertPermission, resolveRoleName } from "@backend/lib/auth/permissions";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  assertRapCategoryReady,
  assertRapSetupTransition,
  type RapSetupStage,
} from "@atria/core/project/rap-setup";
import {
  advanceProjectRapSetupSchema,
  finalizeProjectInternalPlanSchema,
  markProjectCategoryPlanItemDraftSchema,
  setProjectRapScopeSkippedSchema,
} from "@atria/core/validations/workflow-governance";

type SessionUser = { readonly id: string; readonly roleId?: string };
type Rap = typeof projectRap.$inferSelect;
type Package = typeof projectCategoryPlanItem.$inferSelect;

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  return session?.user ? (session.user as SessionUser) : null;
}

function failure<T>(error: unknown, fallback: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("FORBIDDEN") || message.includes("Akses"))
    return { success: false, error: { code: "FORBIDDEN", message } };
  if (message.includes("NOT_FOUND"))
    return { success: false, error: { code: "NOT_FOUND", message: fallback } };
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

async function assertScoped(
  user: SessionUser,
  projectId: string,
  permission: "update:rap" | "update:budget" | "lock:rap",
): Promise<string> {
  await assertPermission(user, permission);
  const roleName = await resolveRoleName(user.roleId ?? "");
  await assertProjectAccess(projectId, user.id, roleName);
  return roleName;
}

async function getPackages(
  projectId: string,
): Promise<Array<Package & { readonly categoryCode: string }>> {
  const rows = await db.query.projectCategoryPlanItem.findMany({
    where: eq(projectCategoryPlanItem.projectId, projectId),
    with: { expenseCategory: true },
  });
  return rows.map((row) => ({ ...row, categoryCode: row.expenseCategory.code }));
}

export async function advanceProjectRapSetup(input: unknown): Promise<ActionResponse<Rap>> {
  const parsed = advanceProjectRapSetupSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Tahap RAP tidak valid.",
      },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const rap = await db.query.projectRap.findFirst({
      where: eq(projectRap.id, parsed.data.projectRapId),
      with: { items: true },
    });
    if (!rap) throw new Error("RAP_NOT_FOUND");
    if (rap.status !== "DRAFT") throw new Error("RAP harus DRAFT untuk melanjutkan setup.");
    assertRapSetupTransition(rap.setupStage as RapSetupStage, parsed.data.targetStage);
    await assertScoped(
      user,
      rap.projectId,
      rap.setupStage === "MATERIAL" ? "update:rap" : "update:budget",
    );
    if (rap.setupStage === "MATERIAL" && rap.items.length === 0)
      throw new Error("Tambahkan minimal satu material sebelum lanjut.");
    const packages = await getPackages(rap.projectId);
    if (rap.setupStage === "TUKANG")
      assertRapCategoryReady(packages, "TUKANG", rap.tukangScopeSkipped);
    if (rap.setupStage === "SUBCON")
      assertRapCategoryReady(packages, "SUBCON", rap.subconScopeSkipped);
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(projectRap)
        .set({
          setupStage: parsed.data.targetStage,
          setupUpdatedById: user.id,
          updatedAt: new Date(),
        })
        .where(eq(projectRap.id, rap.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "ADVANCE_RAP_SETUP",
        targetTable: "project_rap",
        targetId: rap.id,
        originalState: JSON.stringify(rap),
        newState: JSON.stringify(rows[0]),
      });
      return rows;
    });
    revalidatePath(`/projects/${rap.projectId}`);
    return { success: true, data: updated };
  } catch (error) {
    return failure(error, "Gagal melanjutkan setup RAP.");
  }
}

export async function setProjectRapScopeSkipped(input: unknown): Promise<ActionResponse<Rap>> {
  const parsed = setProjectRapScopeSkippedSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Keputusan scope tidak valid." },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const rap = await db.query.projectRap.findFirst({
      where: eq(projectRap.id, parsed.data.projectRapId),
    });
    if (!rap) throw new Error("RAP_NOT_FOUND");
    if (rap.status !== "DRAFT") throw new Error("RAP sudah terkunci.");
    await assertScoped(user, rap.projectId, "update:budget");
    const packages = await getPackages(rap.projectId);
    const relevant = packages.filter(
      (row) =>
        row.categoryCode === parsed.data.categoryCode && ["DRAFT", "ACTIVE"].includes(row.status),
    );
    if (parsed.data.skipped && relevant.length > 0)
      throw new Error("Hapus package yang masih aktif sebelum menandai scope Tidak Digunakan.");
    const changes =
      parsed.data.categoryCode === "TUKANG"
        ? { tukangScopeSkipped: parsed.data.skipped }
        : { subconScopeSkipped: parsed.data.skipped };
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(projectRap)
        .set({ ...changes, setupUpdatedById: user.id, updatedAt: new Date() })
        .where(eq(projectRap.id, rap.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: parsed.data.skipped ? "SKIP_RAP_SCOPE" : "RESTORE_RAP_SCOPE",
        targetTable: "project_rap",
        targetId: rap.id,
        originalState: JSON.stringify(rap),
        newState: JSON.stringify({ ...rows[0], categoryCode: parsed.data.categoryCode }),
      });
      return rows;
    });
    revalidatePath(`/projects/${rap.projectId}`);
    return { success: true, data: updated };
  } catch (error) {
    return failure(error, "Gagal memperbarui keputusan scope.");
  }
}

export async function markProjectCategoryPlanItemDraft(
  input: unknown,
): Promise<ActionResponse<Package>> {
  const parsed = markProjectCategoryPlanItemDraftSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Package tidak valid." } };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const item = await db.query.projectCategoryPlanItem.findFirst({
      where: eq(projectCategoryPlanItem.id, parsed.data.projectCategoryPlanItemId),
    });
    if (!item) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
    if (item.status !== "ACTIVE") throw new Error("Hanya package Siap yang dapat diedit lagi.");
    await assertScoped(user, item.projectId, "update:budget");
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(projectCategoryPlanItem)
        .set({ status: "DRAFT", updatedAt: new Date() })
        .where(eq(projectCategoryPlanItem.id, item.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "REOPEN_CATEGORY_PLAN_PACKAGE",
        targetTable: "project_category_plan_item",
        targetId: item.id,
        originalState: JSON.stringify(item),
        newState: JSON.stringify(rows[0]),
      });
      return rows;
    });
    revalidatePath(`/projects/${item.projectId}`);
    return { success: true, data: updated };
  } catch (error) {
    return failure(error, "Gagal membuka package untuk diedit.");
  }
}

export async function finalizeProjectInternalPlan(input: unknown): Promise<ActionResponse<Rap>> {
  const parsed = finalizeProjectInternalPlanSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "RAP tidak valid." } };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const rap = await tx.query.projectRap.findFirst({
        where: eq(projectRap.id, parsed.data.projectRapId),
        with: { items: true },
      });
      if (!rap) throw new Error("RAP_NOT_FOUND");
      if (rap.status !== "DRAFT" || rap.setupStage !== "REVIEW")
        throw new Error("RAP belum berada pada tahap Review.");
      /*
       * `lock:rap` sendiri sudah menjadi gerbangnya. Pemeriksaan nama peran di
       * bawahnya dulu menyaring himpunan yang persis sama, jadi ia tidak pernah
       * menolak siapa pun — yang ia lakukan hanya membuat izin ini berhenti
       * bekerja begitu diberikan kepada peran lain.
       */
      await assertScoped(user, rap.projectId, "lock:rap");
      if (rap.items.length === 0) throw new Error("Material RAP masih kosong.");
      const packages = await tx.query.projectCategoryPlanItem.findMany({
        where: eq(projectCategoryPlanItem.projectId, rap.projectId),
        with: { expenseCategory: true },
      });
      const enriched = packages.map((row) => ({ ...row, categoryCode: row.expenseCategory.code }));
      assertRapCategoryReady(enriched, "TUKANG", rap.tukangScopeSkipped);
      assertRapCategoryReady(enriched, "SUBCON", rap.subconScopeSkipped);
      const [updated] = await tx
        .update(projectRap)
        .set({
          status: "LOCKED",
          setupStage: "COMPLETE",
          setupUpdatedById: user.id,
          lockedById: user.id,
          lockedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectRap.id, rap.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "FINALIZE_PROJECT_INTERNAL_PLAN",
        targetTable: "project_rap",
        targetId: rap.id,
        originalState: JSON.stringify(rap),
        newState: JSON.stringify(updated),
      });
      return updated;
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return failure(error, "Gagal finalisasi internal plan.");
  }
}
