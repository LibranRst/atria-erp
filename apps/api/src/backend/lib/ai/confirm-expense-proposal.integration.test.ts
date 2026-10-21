import { withTestRequest } from "@backend/lib/testing/request";
import { afterAll, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";

import { db } from "@backend/db";
import { projectCost } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { confirmAiExpenseProposal } from "@backend/app/actions/ai/confirm-expense-proposal";
import { createConversation } from "@backend/lib/ai/conversation-store";
import { describeIntegration } from "@backend/lib/testing/integration-db";

/**
 * Bagian 12A.2 dan baris terakhir tabel bagian 13
 * `docs/guide/seeded_demo_walkthrough.md`: satu kartu usulan hanya boleh
 * menghasilkan satu pengajuan.
 *
 * Penekanan berurutan selalu aman — yang kedua membaca catatan konfirmasi milik
 * yang pertama. Yang tidak aman adalah dua permintaan yang berlomba, dan itulah
 * bentuk klik ganda yang sesungguhnya: keduanya lolos pemeriksaan "sudah pernah
 * dikonfirmasi?" sebelum salah satunya sempat menulis. Dahulu itu menghasilkan
 * dua pengajuan biaya dengan id berbeda; sekarang seluruh urutan diserialkan
 * oleh kunci baris percakapan.
 */

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

const SITI = {
  id: "33333333-3333-3333-3333-333333333332",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "siti@dekoria.com",
  name: "Siti Aminah",
};
const BUDI = {
  id: "33333333-3333-3333-3333-333333333331",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "budi@dekoria.com",
  name: "Budi Santoso",
};

function actAs(user: typeof SITI): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
    session: {
      id: "mock-session-id",
      userId: user.id,
      expiresAt: new Date(Date.now() + 3_600_000),
      token: "mock-token",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: { ...user, emailVerified: true, isActive: true },
  });
}

// Sudirman adalah proyek PM Siti, jadi lingkup proyeknya sah.
const SUDIRMAN = "77777777-7777-7777-7777-777777777772";
const MATERIAL_CATEGORY = "32323232-3232-3232-3232-323232323202";

function proposalFor(
  toolCallId: string,
  conversationId: string,
  description: string,
): Record<string, unknown> {
  return {
    toolCallId,
    conversationId,
    projectId: SUDIRMAN,
    projectBudgetCategoryId: MATERIAL_CATEGORY,
    description,
    quantity: 1,
    unitPrice: 750_000,
    amount: 750_000,
  };
}

async function documentsNamed(description: string): Promise<number> {
  const rows = await db
    .select({ id: projectCost.id })
    .from(projectCost)
    .where(and(eq(projectCost.projectId, SUDIRMAN), eq(projectCost.description, description)));
  return rows.length;
}

describeIntegration("konfirmasi usulan pengeluaran AI", () => {
  afterAll(
    withTestRequest(() => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
    }),
  );

  it(
    "records one document when the card is confirmed twice in sequence",
    withTestRequest(async () => {
      actAs(SITI);
      const description = `Beli cat tembok berurutan ${Date.now()}`;
      const conversation = await createConversation(SITI.id, "Catat pengeluaran material");
      const proposal = proposalFor(`call-seq-${Date.now()}`, conversation.id, description);

      const first = await confirmAiExpenseProposal(proposal);
      const second = await confirmAiExpenseProposal(proposal);

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      if (!first.success || !second.success) throw new Error("unreachable");
      expect(first.data.alreadyConfirmed).toBe(false);
      expect(second.data.alreadyConfirmed).toBe(true);
      expect(second.data.expenseId).toBe(first.data.expenseId);
      expect(await documentsNamed(description)).toBe(1);
    }),
  );

  it(
    "records one document when two confirmations race",
    withTestRequest(async () => {
      actAs(SITI);
      const description = `Beli cat tembok berlomba ${Date.now()}`;
      const conversation = await createConversation(SITI.id, "Catat pengeluaran material");
      const proposal = proposalFor(`call-race-${Date.now()}`, conversation.id, description);

      const [a, b] = await Promise.all([
        confirmAiExpenseProposal(proposal),
        confirmAiExpenseProposal(proposal),
      ]);

      expect(a.success).toBe(true);
      expect(b.success).toBe(true);
      if (!a.success || !b.success) throw new Error("unreachable");
      expect(a.data.expenseId).toBe(b.data.expenseId);
      // Tepat satu pemanggilan yang membuat, satunya melaporkan sudah ada.
      expect([a.data.alreadyConfirmed, b.data.alreadyConfirmed].filter(Boolean).length).toBe(1);
      expect(await documentsNamed(description)).toBe(1);
    }),
  );

  it(
    "refuses a proposal that points at somebody else's conversation",
    withTestRequest(async () => {
      actAs(SITI);
      const conversation = await createConversation(SITI.id, "Catat pengeluaran material");

      actAs(BUDI);
      const description = `Beli cat tembok titipan ${Date.now()}`;
      const result = await confirmAiExpenseProposal(
        proposalFor(`call-foreign-${Date.now()}`, conversation.id, description),
      );

      expect(result.success).toBe(false);
      if (result.success) throw new Error("unreachable");
      expect(result.error.code).toBe("NOT_FOUND");
      expect(await documentsNamed(description)).toBe(0);
    }),
  );
});
