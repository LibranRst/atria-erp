import { readFileSync } from "node:fs";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import { user, role, attachment, aiConversation, aiMessage } from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import type { Actor } from "../src/backend/server/actor";
import { prepareOwnProfile } from "../src/backend/server/usecases/ai/own-profile-context";
import type { OwnProfileInput } from "@atria/core/ai/own-profile";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable Browser database only");
const f = z
  .object({ conversationId: z.string().guid(), userId: z.string().guid() })
  .parse(JSON.parse(readFileSync("/tmp/atria-own-profile-preview-fixture.json", "utf8")));
const qa = await db.query.user.findFirst({
  where: and(eq(user.id, f.userId), eq(user.email, "reconciliation-qa@fixture.invalid")),
});
if (!qa) throw new Error("Synthetic actor");
const r = await db.query.role.findFirst({ where: eq(role.id, qa.roleId) });
if (!r || r.isSystem || !r.name.startsWith("QA Rekonsiliasi ")) throw new Error("Synthetic role");
const access = await getRoleAccess(r.id);
if (!access) throw new Error("access");
const actor: Actor = {
  userId: qa.id,
  roleId: r.id,
  roleName: access.roleName,
  permissions: access.permissions,
  dataScope: access.dataScope,
  name: qa.name,
  email: qa.email,
  isActive: true,
  mustChangePassword: false,
  sessionId: "fixture",
  developerActorUserId: null,
};
const conversation = await db.query.aiConversation.findFirst({
  where: and(eq(aiConversation.id, f.conversationId), eq(aiConversation.userId, qa.id)),
});
if (conversation?.title !== "QA profil sendiri · data sintetis") throw new Error("QA conversation");
const action = z
  .enum(["PHOTO", "REPLACE", "REMOVE", "STALE", "NOOP", "EXPIRED"])
  .parse(process.argv[2]);
let input: OwnProfileInput, text: string;
if (action === "PHOTO" || action === "REPLACE") {
  const rows = await db.query.attachment.findMany({
    where: and(
      eq(attachment.uploadedById, qa.id),
      eq(attachment.referenceType, "private_ai_chat"),
      eq(
        attachment.fileName,
        action === "REPLACE"
          ? "atria-own-profile-qa-avatar-replacement.png"
          : "atria-own-profile-qa-avatar.png",
      ),
    ),
    orderBy: [desc(attachment.createdAt)],
    limit: 1,
  });
  if (!rows[0]) throw new Error("Upload the named synthetic PNG through Browser first");
  input = { photo: { action: "REPLACE", attachmentId: rows[0].id } };
  text =
    action === "PHOTO"
      ? "Data sintetis QA: gunakan gambar yang dipilih di composer sebagai foto profil. Preview belum menyimpan profil."
      : "Data sintetis QA: ganti foto profil memakai lampiran terpilih. Periksa potongan foto lalu Simpan.";
} else if (action === "REMOVE") {
  input = { photo: { action: "REMOVE" } };
  text = "Data sintetis QA: hapus foto dari profil dan kembali ke inisial. Foto chat tetap privat.";
} else if (action === "NOOP") {
  input = { name: qa.name, photo: { action: "KEEP" } };
  text = "Data sintetis QA: nama/foto sudah sesuai, sehingga tidak perlu tindakan Simpan.";
} else {
  input = { name: "QA contoh perlu diperiksa", photo: { action: "KEEP" } };
  text =
    action === "STALE"
      ? "Data sintetis QA: sumber sengaja berubah setelah preview; Simpan harus diblokir."
      : "Data sintetis QA: preview kedaluwarsa; minta usulan terbaru.";
}
const proposal = await prepareOwnProfile(actor, input),
  toolCallId = crypto.randomUUID();
if (action === "STALE") proposal.expectedContext = "0".repeat(64);
await db.insert(aiMessage).values({
  conversationId: conversation.id,
  role: "assistant",
  createdAt: action === "EXPIRED" ? new Date(Date.now() - 31 * 86400000) : new Date(),
  parts: [
    { type: "text", text },
    {
      type: "tool-proposeOwnProfile",
      toolCallId,
      state: "output-available",
      input: proposal.input,
      output: { proposal },
    },
  ],
});
await db
  .update(aiConversation)
  .set({ updatedAt: new Date() })
  .where(eq(aiConversation.id, conversation.id));
console.log(JSON.stringify({ action, toolCallId }));
await pool.end();
