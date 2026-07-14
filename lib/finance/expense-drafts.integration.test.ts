import { afterAll, describe, expect, it, mock } from "bun:test";
import { inArray } from "drizzle-orm";

import {
  discardExpenseDraft,
  getExpenseDraft,
  listExpenseDrafts,
  saveExpenseDraft,
  submitExpenseDraft,
} from "@/app/actions/finance/expense-drafts";
import { db } from "@/db";
import {
  approval,
  auditLog,
  formDraft,
  projectCost,
  projectExpenses,
} from "@/db/schema";
import { createBlankExpenseDraft, createBlankExpenseLine } from "@/features/expenses/components/expense-form-utils";
import type { ExpenseDraftPayload } from "@/features/expenses/components/expense-form-types";
import { auth } from "@/lib/auth";
import { syncProjectBudgetCategory } from "@/lib/budget/budget-sync";

mock.module("next/headers", () => ({
  cookies: () => ({ toString: () => "mocked-cookies" }),
}));

mock.module("next/cache", () => ({
  revalidatePath: () => undefined,
}));

const OWNER = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};
const PM_BUDI = {
  id: "33333333-3333-3333-3333-333333333331",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "budi@dekoria.com",
  name: "Budi Santoso",
};
const MENTENG_PROJECT_ID = "77777777-7777-7777-7777-777777777771";
const SUDIRMAN_PROJECT_ID = "77777777-7777-7777-7777-777777777772";
const OPERASIONAL_CATEGORY_ID = "32323232-3232-3232-3232-323232323103";

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;
const createdDraftIds: string[] = [];
const createdCostIds: string[] = [];

function mockSession(user: typeof OWNER | null): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> =>
    user
      ? {
          session: {
            id: "expense-draft-test-session",
            userId: user.id,
            expiresAt: new Date(Date.now() + 3_600_000),
            token: "mock-token",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          user: {
            ...user,
            emailVerified: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }
      : null;
}

function validPayload(description: string): ExpenseDraftPayload {
  return {
    ...createBlankExpenseDraft(MENTENG_PROJECT_ID),
    lines: [
      {
        ...createBlankExpenseLine(),
        projectBudgetCategoryId: OPERASIONAL_CATEGORY_ID,
        quantity: 1,
        unitPrice: 12_345,
        amount: 12_345,
        description,
      },
    ],
  };
}

describe("expense draft actions", () => {
  afterAll(async () => {
    (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
    if (createdCostIds.length > 0) {
      await db.delete(approval).where(inArray(approval.referenceId, createdCostIds));
      await db.delete(auditLog).where(inArray(auditLog.targetId, createdCostIds));
      await db.delete(projectExpenses).where(inArray(projectExpenses.legacyProjectCostId, createdCostIds));
      await db.delete(projectCost).where(inArray(projectCost.id, createdCostIds));
      await db.transaction(async (tx) => {
        await syncProjectBudgetCategory({
          tx,
          projectBudgetCategoryId: OPERASIONAL_CATEGORY_ID,
        });
      });
    }
    if (createdDraftIds.length > 0) {
      await db.delete(formDraft).where(inArray(formDraft.id, createdDraftIds));
    }
  });

  it("allows multiple drafts and detects a stale optimistic revision", async () => {
    mockSession(OWNER);
    const first = await saveExpenseDraft({ payload: validPayload("Draft conflict test") });
    const second = await saveExpenseDraft({ payload: validPayload("Draft kedua aktif") });
    if (!first.success) throw new Error(JSON.stringify(first.error));
    if (!second.success) throw new Error(JSON.stringify(second.error));
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    createdDraftIds.push(first.data.id, second.data.id);

    const updated = await saveExpenseDraft({
      draftId: first.data.id,
      expectedRevision: first.data.revision,
      payload: validPayload("Draft conflict diperbarui"),
    });
    expect(updated.success).toBe(true);

    const stale = await saveExpenseDraft({
      draftId: first.data.id,
      expectedRevision: first.data.revision,
      payload: validPayload("Versi stale ditolak"),
    });
    expect(stale.success).toBe(false);
    if (!stale.success) expect(stale.error.code).toBe("CONFLICT");

    const listed = await listExpenseDrafts();
    expect(listed.success).toBe(true);
    if (listed.success) {
      expect(listed.data.filter((draft) => [first.data.id, second.data.id].includes(draft.id))).toHaveLength(2);
    }

    const discarded = await discardExpenseDraft({ draftId: second.data.id });
    expect(discarded.success).toBe(true);
  });

  it("enforces ownership and PM project scoping", async () => {
    mockSession(OWNER);
    const saved = await saveExpenseDraft({ payload: validPayload("Ownership test") });
    if (!saved.success) throw new Error(`${saved.error.code}: ${saved.error.message}`);
    expect(saved.success).toBe(true);
    if (!saved.success) return;
    createdDraftIds.push(saved.data.id);

    mockSession(PM_BUDI);
    const otherOwnerRead = await getExpenseDraft({ draftId: saved.data.id });
    expect(otherOwnerRead.success).toBe(false);
    if (!otherOwnerRead.success) expect(otherOwnerRead.error.code).toBe("NOT_FOUND");

    mockSession(PM_BUDI);
    const foreignProject = validPayload("Scope proyek ditolak");
    foreignProject.projectId = SUDIRMAN_PROJECT_ID;
    const scoped = await saveExpenseDraft({ payload: foreignProject });
    expect(scoped.success).toBe(false);
    if (!scoped.success) expect(scoped.error.code).toBe("FORBIDDEN");
  });

  it("rolls back a failed submit and keeps the draft active", async () => {
    mockSession(OWNER);
    const description = `Atomic rollback ${Date.now()}`;
    const payload = validPayload(description);
    payload.lines[0].stockHandling = "STOCK_IN";
    const saved = await saveExpenseDraft({ payload });
    if (!saved.success) throw new Error(`${saved.error.code}: ${saved.error.message}`);
    expect(saved.success).toBe(true);
    if (!saved.success) return;
    createdDraftIds.push(saved.data.id);

    const submitted = await submitExpenseDraft({
      draftId: saved.data.id,
      expectedRevision: saved.data.revision,
    });
    expect(submitted.success).toBe(false);

    const recovered = await getExpenseDraft({ draftId: saved.data.id });
    expect(recovered.success).toBe(true);
    const leakedCost = await db.query.projectCost.findFirst({
      where: (table, { eq }) => eq(table.description, description),
    });
    expect(leakedCost).toBeUndefined();
  });

  it("submits atomically, writes audit, and is idempotent on retry", async () => {
    mockSession(OWNER);
    const saved = await saveExpenseDraft({ payload: validPayload(`Atomic submit ${Date.now()}`) });
    if (!saved.success) throw new Error(`${saved.error.code}: ${saved.error.message}`);
    expect(saved.success).toBe(true);
    if (!saved.success) return;
    createdDraftIds.push(saved.data.id);

    const submitted = await submitExpenseDraft({
      draftId: saved.data.id,
      expectedRevision: saved.data.revision,
    });
    expect(submitted.success).toBe(true);
    if (!submitted.success) return;
    createdCostIds.push(...submitted.data.projectCostIds);
    expect(submitted.data.itemCount).toBe(1);

    const audit = await db.query.auditLog.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.action, "SUBMIT_EXPENSE_DRAFT"),
          eq(table.targetId, submitted.data.projectCostIds[0]),
        ),
    });
    expect(audit).toBeDefined();

    const retry = await submitExpenseDraft({
      draftId: saved.data.id,
      expectedRevision: saved.data.revision,
    });
    expect(retry.success).toBe(true);
    if (retry.success) {
      expect(retry.data.idempotent).toBe(true);
      expect(retry.data.projectCostIds).toEqual(submitted.data.projectCostIds);
    }
  });
});
