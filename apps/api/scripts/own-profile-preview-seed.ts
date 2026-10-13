import { eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import { user, role, aiConversation, aiMessage } from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import type { Actor } from "../src/backend/server/actor";
import { prepareOwnProfile } from "../src/backend/server/usecases/ai/own-profile-context";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable Browser database only");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId) throw new Error("Synthetic actor required");
const r = await db.query.role.findFirst({ where: eq(role.id, qa.roleId) });
if (!r || r.isSystem || !r.name.startsWith("QA Rekonsiliasi "))
  throw new Error("Synthetic role only");
const access = await getRoleAccess(r.id);
if (!access) throw new Error("Access");
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
const [c] = await db
  .insert(aiConversation)
  .values({ userId: qa.id, title: "QA profil sendiri · data sintetis" })
  .returning();
const proposal = await prepareOwnProfile(actor, {
    name: "QA Libran · profil",
    photo: { action: "KEEP" },
  }),
  toolCallId = crypto.randomUUID();
await db.insert(aiMessage).values({
  conversationId: c.id,
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Data sintetis QA: preview nama akun sendiri. Foto tidak diubah sebelum Anda memilih lampiran dan menekan Simpan.",
    },
    {
      type: "tool-proposeOwnProfile",
      toolCallId,
      state: "output-available",
      input: proposal.input,
      output: { proposal },
    },
  ],
});
console.log(
  JSON.stringify({ conversationId: c.id, userId: qa.id, roleId: r.id, nameToolCallId: toolCallId }),
);
await pool.end();
