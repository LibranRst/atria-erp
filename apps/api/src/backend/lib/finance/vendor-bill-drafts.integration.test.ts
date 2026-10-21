import { withTestRequest } from "@backend/lib/testing/request";
import { afterAll, expect, it } from "bun:test";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { inArray } from "drizzle-orm";

import {
  getVendorBillDraft,
  saveVendorBillDraft,
  submitVendorBillDraft,
} from "@backend/app/actions/finance/vendor-bill-drafts";
import { db } from "@backend/db";
import { auditLog, formDraft, projectExpenses, vendorBill } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { syncProjectBudgetCategory } from "@backend/lib/budget/budget-sync";
import type { VendorBillDraftPayload } from "@atria/core/validations/vendor-bill-draft";

const OWNER = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};
const PROJECT_ID = "77777777-7777-7777-7777-777777777771";
const CATEGORY_ID = "32323232-3232-3232-3232-323232323103";
const VENDOR_ID = "55555555-5555-5555-5555-555555555551";
const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;
const draftIds: string[] = [];
const billIds: string[] = [];

function mockOwner(): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
    session: {
      id: "vendor-draft-test",
      userId: OWNER.id,
      expiresAt: new Date(Date.now() + 3_600_000),
      token: "mock",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      ...OWNER,
      emailVerified: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

function payload(suffix: string): VendorBillDraftPayload {
  return {
    vendorId: VENDOR_ID,
    projectId: PROJECT_ID,
    projectBudgetCategoryId: CATEGORY_ID,
    projectBudgetItemId: "",
    projectCategoryPlanItemId: "",
    billNumber: `TEST-VBD-${suffix}`,
    amount: 12_345,
    dueDate: "2026-07-30",
    notes: "Integration test vendor draft",
  };
}

describeIntegration("vendor bill draft actions", () => {
  afterAll(
    withTestRequest(async () => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
      if (billIds.length > 0) {
        await db.delete(auditLog).where(inArray(auditLog.targetId, billIds));
        await db.delete(projectExpenses).where(inArray(projectExpenses.vendorBillId, billIds));
        await db.delete(vendorBill).where(inArray(vendorBill.id, billIds));
        await db.transaction((tx) =>
          syncProjectBudgetCategory({ tx, projectBudgetCategoryId: CATEGORY_ID }),
        );
      }
      if (draftIds.length > 0) await db.delete(formDraft).where(inArray(formDraft.id, draftIds));
    }),
  );

  it(
    "detects stale revisions while keeping the active draft",
    withTestRequest(async () => {
      mockOwner();
      const created = await saveVendorBillDraft({ payload: payload(`CONFLICT-${Date.now()}`) });
      if (!created.success) throw new Error(created.error.message);
      draftIds.push(created.data.id);
      const updated = await saveVendorBillDraft({
        draftId: created.data.id,
        expectedRevision: created.data.revision,
        payload: { ...created.data.payload, notes: "updated" },
      });
      expect(updated.success).toBe(true);
      const stale = await saveVendorBillDraft({
        draftId: created.data.id,
        expectedRevision: created.data.revision,
        payload: { ...created.data.payload, notes: "stale" },
      });
      expect(stale.success).toBe(false);
      if (!stale.success) expect(stale.error.code).toBe("CONFLICT");
      expect((await getVendorBillDraft({ draftId: created.data.id })).success).toBe(true);
    }),
  );

  it(
    "submits atomically and returns the same bill on retry",
    withTestRequest(async () => {
      mockOwner();
      const created = await saveVendorBillDraft({ payload: payload(`SUBMIT-${Date.now()}`) });
      if (!created.success) throw new Error(created.error.message);
      draftIds.push(created.data.id);
      const submitted = await submitVendorBillDraft({
        draftId: created.data.id,
        expectedRevision: created.data.revision,
      });
      expect(submitted.success).toBe(true);
      if (!submitted.success) return;
      billIds.push(submitted.data.vendorBillId);
      const retry = await submitVendorBillDraft({
        draftId: created.data.id,
        expectedRevision: created.data.revision,
      });
      expect(retry.success).toBe(true);
      if (retry.success) {
        expect(retry.data.idempotent).toBe(true);
        expect(retry.data.vendorBillId).toBe(submitted.data.vendorBillId);
      }
    }),
  );
});
