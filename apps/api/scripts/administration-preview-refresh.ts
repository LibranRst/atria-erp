import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import { aiConversation, aiMessage, aiProposalConfirmation, user } from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { administrationProposalSchema } from "@atria/core/ai/administration";
import { prepareAdministrationProposal } from "../src/backend/server/usecases/ai/administration-context";
import type { Actor } from "../src/backend/server/actor";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable preview only.");
const id = z.string().guid().parse(process.argv[2]);
const c = await db.query.aiConversation.findFirst({ where: eq(aiConversation.id, id) });
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId || c?.userId !== qa.id || c.title !== "QA staf & role · database disposable")
  throw new Error("Owned synthetic fixture required.");
const access = await getRoleAccess(qa.roleId);
if (!access) throw new Error("Access");
const a: Actor = {
  userId: qa.id,
  roleId: qa.roleId,
  roleName: access.roleName,
  name: qa.name,
  email: qa.email,
  isActive: true,
  mustChangePassword: false,
  permissions: access.permissions,
  dataScope: access.dataScope,
  sessionId: "fixture",
  developerActorUserId: null,
};
const part = z
  .object({
    type: z.string(),
    toolCallId: z.string(),
    output: z.object({ proposal: administrationProposalSchema }).passthrough(),
  })
  .passthrough();
const messages = await db.query.aiMessage.findMany({ where: eq(aiMessage.conversationId, id) });
let n = 0,
  refreshed = 0;
for (const message of messages) {
  if (message.role !== "assistant") continue;
  const updated: unknown[] = [];
  for (const raw of z.array(z.unknown()).parse(message.parts)) {
    const checked = part.safeParse(raw);
    if (!checked.success) {
      updated.push(raw);
      continue;
    }
    if (n++ >= 6) {
      updated.push(raw);
      continue;
    }
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.conversationId, id),
        eq(aiProposalConfirmation.toolCallId, checked.data.toolCallId),
      ),
    });
    if (receipt) {
      updated.push(raw);
      continue;
    }
    const proposal = await prepareAdministrationProposal(a, checked.data.output.proposal.input);
    refreshed++;
    updated.push({ ...checked.data, output: { ...checked.data.output, proposal } });
  }
  await db.update(aiMessage).set({ parts: updated }).where(eq(aiMessage.id, message.id));
}
console.log(JSON.stringify({ refreshed, conversationId: id }));
await pool.end();
