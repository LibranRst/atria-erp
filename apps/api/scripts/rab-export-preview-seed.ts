import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  role,
  rolePermission,
  client,
  project,
  rabEstimate,
  rabEstimateBundle,
  rabEstimateItem,
  aiConversation,
  aiMessage,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import type { Actor } from "../src/backend/server/actor";
import { prepareRabExport } from "../src/backend/server/usecases/ai/rab-export-context";
import type { RabExportProposal } from "@atria/core/ai/rab-export";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable Browser database only.");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId) throw new Error("Synthetic actor required.");
const qaRole = await db.query.role.findFirst({ where: eq(role.id, qa.roleId) });
if (!qaRole || qaRole.isSystem || !qaRole.name.startsWith("QA Rekonsiliasi "))
  throw new Error("Synthetic role only.");
await db
  .insert(rolePermission)
  .values(
    (["use:ai_chat", "view:project", "view:rab"] as const).map((permissionKey) => ({
      roleId: qa.roleId,
      permissionKey,
    })),
  )
  .onConflictDoNothing();
const access = await getRoleAccess(qa.roleId);
if (!access) throw new Error("Access");
const actor: Actor = {
  userId: qa.id,
  roleId: qa.roleId,
  roleName: access.roleName,
  permissions: access.permissions,
  dataScope: access.dataScope,
  isActive: true,
  mustChangePassword: false,
  name: qa.name,
  email: qa.email,
  sessionId: "fixture",
  developerActorUserId: null,
};
const [c] = await db
  .insert(client)
  .values({
    name: "Klien QA dokumen",
    email: `${randomUUID()}@fixture.invalid`,
    phone: "000",
    address: "Alamat contoh QA",
  })
  .returning();
const [p] = await db
  .insert(project)
  .values({
    name: "Proyek QA · ekspor RAB",
    clientId: c.id,
    location: "Lokasi contoh QA",
    projectManagerId: qa.id,
    totalContractValue: "1000000",
    status: "DRAFT",
  })
  .returning();
async function make(
  revision: number,
  title: string,
  status = "DRAFT",
  n = 3,
): Promise<{ rabId: string; firstId: string }> {
  const [r] = await db
    .insert(rabEstimate)
    .values({
      projectId: p.id,
      revision,
      title,
      status,
      clientNotes:
        "Data sintetis untuk pemeriksaan dokumen. Termin hanya mengikuti ketentuan yang ditinjau.",
    })
    .returning();
  const [b] = await db
    .insert(rabEstimateBundle)
    .values({
      rabEstimateId: r.id,
      clientLabel: "Paket kabinet dapur QA",
      description: "Kabinet bawah dan atas mengikuti gambar yang ditinjau.",
      quantity: "1",
      unit: "paket",
      unitPrice: "500000.50",
      lineTotal: "500000.50",
      displayOrder: 0,
    })
    .returning();
  const rows = Array.from({ length: n }, (_, i) => ({
    rabEstimateId: r.id,
    clientLabel: `Panel finishing QA ${i + 1}`,
    description:
      i === 2
        ? "Finishing dengan uraian panjang untuk memeriksa baris dokumen: material, warna dan pemasangan mengikuti spesifikasi yang telah ditinjau bersama klien."
        : "Spesifikasi penawaran untuk klien",
    quantity: "2.00",
    unit: "lembar",
    unitPrice: "125000.25",
    lineTotal: "250000.50",
    sourceType: "MANUAL",
    displayOrder: i + 1,
  }));
  const created = await db.insert(rabEstimateItem).values(rows).returning();
  await db.insert(rabEstimateItem).values([
    {
      rabEstimateId: r.id,
      bundleId: b.id,
      clientLabel: "Komponen kabinet QA",
      description: "Rincian cakupan termasuk paket",
      quantity: "1",
      unit: "set",
      unitPrice: "987654.32",
      lineTotal: "987654.32",
      displayOrder: 0,
    },
    {
      rabEstimateId: r.id,
      clientLabel: "HIDDEN_ROW_DO_NOT_EXPORT",
      description: "PRIVATE_NOTE_SENTINEL",
      quantity: "1",
      unit: "ls",
      unitPrice: "999999.99",
      lineTotal: "999999.99",
      isHidden: true,
    },
    {
      rabEstimateId: r.id,
      clientLabel: "Jasa desain QA",
      quantity: "1",
      unit: "ls",
      unitPrice: "100000.25",
      lineTotal: "100000.25",
      itemNature: "SERVICE_FEE",
      displayOrder: n + 1,
    },
  ]);
  await db
    .update(rabEstimate)
    .set({ approvedValue: (500000.5 + n * 250000.5 + 100000.25).toFixed(2) })
    .where(eq(rabEstimate.id, r.id));
  return { rabId: r.id, firstId: created[0].id };
}
const draft = await make(2, "Penawaran dapur · Draft QA", "DRAFT", 27),
  approved = await make(1, "Penawaran disetujui · QA", "APPROVED", 4),
  stale = await make(3, "Contoh data berubah · QA"),
  expired = await make(4, "Contoh kedaluwarsa · QA"),
  voided = await make(5, "Contoh dibatalkan · QA");
const proposals: RabExportProposal[] = [];
for (const [record, format] of [
  [draft, "PDF"],
  [approved, "EXCEL"],
  [stale, "PNG"],
  [expired, "PDF"],
  [voided, "PDF"],
] as const)
  proposals.push(
    await prepareRabExport(actor, { projectId: p.id, rabEstimateId: record.rabId, format }),
  );
const [conversation] = await db
  .insert(aiConversation)
  .values({ userId: qa.id, title: "QA ekspor RAB · database disposable" })
  .returning();
await db.insert(aiMessage).values({
  conversationId: conversation.id,
  role: "user",
  parts: [
    {
      type: "text",
      text: "Siapkan ekspor RAB untuk pemeriksaan PDF, Excel dan gambar. Ini data sintetis.",
    },
  ],
});
for (const [i, proposal] of proposals.entries())
  await db.insert(aiMessage).values({
    conversationId: conversation.id,
    role: "assistant",
    createdAt: i === 3 ? new Date(Date.now() - 31 * 86400000) : new Date(),
    parts: [
      {
        type: "text",
        text:
          i === 0
            ? "Preview ekspor memakai revisi tersimpan dan data sintetis. Pilih format di dalam preview; unduhan tidak menyetujui RAB."
            : "Contoh status dokumen QA.",
      },
      {
        type: "tool-prepareRabExport",
        state: "output-available",
        toolCallId: `export-qa-${i}-${randomUUID()}`,
        output: { proposal },
      },
    ],
  });
await db
  .update(rabEstimateItem)
  .set({ lineTotal: "270000.50", unitPrice: "135000.25" })
  .where(eq(rabEstimateItem.id, stale.firstId));
await db.update(rabEstimate).set({ status: "VOID" }).where(eq(rabEstimate.id, voided.rabId));
console.log(
  JSON.stringify({
    conversationId: conversation.id,
    projectId: p.id,
    draftId: draft.rabId,
    approvedId: approved.rabId,
  }),
);
await pool.end();
