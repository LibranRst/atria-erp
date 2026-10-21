import { and, asc, desc, eq, like } from "drizzle-orm";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { db, pool } from "../src/backend/db";
import {
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  user,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { updateOwnProfileUseCase } from "../src/backend/server/usecases/profile/update-own-profile";
import type { Actor } from "../src/backend/server/actor";

const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable failure QA database only");
const owner = await db.query.user.findFirst({
  where: eq(user.email, "ai-role-owner@fixture.invalid"),
});
if (
  !owner ||
  !["QA Role OWNER", "QA Owner Manual Recovery", "QA Owner Recovery"].includes(owner.name)
)
  throw new Error("Actual synthetic Owner required");
const access = await getRoleAccess(owner.roleId);
if (!access || access.roleName !== "OWNER") throw new Error("Actual Owner role required");
const mode = z
  .enum(["inspect", "expire", "restore-expiry", "change-profile", "restore-profile"])
  .parse(process.argv[2]);
const dir = "../../output/ai-chat-qa/failure-recovery";
mkdirSync(dir, { recursive: true });
if (mode === "inspect") {
  const conversations = await db.query.aiConversation.findMany({
    where: and(
      eq(aiConversation.userId, owner.id),
      like(aiConversation.title, "Uji pemulihan QA%"),
    ),
    orderBy: [desc(aiConversation.createdAt)],
  });
  const result = {
    profile: { name: owner.name, image: owner.image },
    conversations: await Promise.all(
      conversations.map(async (c) => ({
        ...c,
        messages: await db.query.aiMessage.findMany({
          where: eq(aiMessage.conversationId, c.id),
          orderBy: [asc(aiMessage.createdAt)],
        }),
        receipts: await db.query.aiProposalConfirmation.findMany({
          where: eq(aiProposalConfirmation.conversationId, c.id),
        }),
      })),
    ),
    audits: await db.query.auditLog.findMany({
      where: and(eq(auditLog.userId, owner.id), eq(auditLog.action, "UPDATE_OWN_PROFILE")),
      orderBy: [desc(auditLog.createdAt)],
      limit: 10,
    }),
  };
  writeFileSync(`${dir}/observation.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      profile: result.profile,
      conversations: result.conversations.map((c) => ({
        id: c.id,
        messages: c.messages.map((m) => ({
          id: m.id,
          role: m.role,
          createdAt: m.createdAt,
          tools: Array.isArray(m.parts)
            ? m.parts
                .filter((p: { type: string }) => p.type.startsWith("tool-"))
                .map((p: { type: string; toolCallId: string }) => ({
                  type: p.type,
                  toolCallId: p.toolCallId,
                }))
            : [],
        })),
        receipts: c.receipts.length,
      })),
    }),
  );
} else if (mode === "expire" || mode === "restore-expiry") {
  const id = z.string().uuid().parse(process.argv[3]);
  const m = await db.query.aiMessage.findFirst({ where: eq(aiMessage.id, id) });
  const c =
    m &&
    (await db.query.aiConversation.findFirst({
      where: and(
        eq(aiConversation.id, m.conversationId),
        eq(aiConversation.userId, owner.id),
        like(aiConversation.title, "Uji pemulihan QA%"),
      ),
    }));
  if (!m || !c || m.role !== "assistant") throw new Error("Owned live recovery proposal required");
  const proof = z.array(z.object({ type: z.string() }).passthrough()).parse(m.parts);
  if (!proof.some((p) => p.type === "tool-proposeOwnProfile"))
    throw new Error("Owned profile proposal required");
  const backup = `${dir}/expiry-${id}.json`;
  if (mode === "expire")
    writeFileSync(backup, JSON.stringify({ createdAt: m.createdAt.toISOString() }));
  const date =
    mode === "expire"
      ? new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      : new Date(
          z
            .object({ createdAt: z.string().datetime() })
            .parse(JSON.parse(readFileSync(backup, "utf8"))).createdAt,
        );
  await db.update(aiMessage).set({ createdAt: date }).where(eq(aiMessage.id, id));
  console.log(mode, id, date.toISOString());
} else {
  const actor: Actor = {
    userId: owner.id,
    roleId: owner.roleId,
    roleName: access.roleName,
    permissions: access.permissions,
    dataScope: access.dataScope,
    name: owner.name,
    email: owner.email,
    image: owner.image,
    isActive: owner.isActive,
    mustChangePassword: owner.mustChangePassword,
    sessionId: "QA operator",
    developerActorUserId: null,
  };
  const result = await updateOwnProfileUseCase(actor, {
    name: mode === "change-profile" ? "QA Owner Manual Recovery" : "QA Role OWNER",
  });
  if (!result.success) throw new Error(result.error.message);
  console.log(mode, result.data);
}
await pool.end();
