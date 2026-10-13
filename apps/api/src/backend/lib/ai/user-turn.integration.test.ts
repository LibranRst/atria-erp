import { beforeAll, afterAll, expect, it } from "bun:test";
import { db } from "@backend/db";
import { aiConversation, aiMessage, user } from "@backend/db/schema";
import { eq, inArray } from "drizzle-orm";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { persistUserTurn, historyBeforeTurn } from "./user-turn";

describeIntegration("retry user-turn identity", (): void => {
  const owned: string[] = [];
  const actor = crypto.randomUUID(),
    other = crypto.randomUUID();
  beforeAll(async (): Promise<void> => {
    const r = await db.query.role.findFirst();
    if (!r) throw new Error("Integration role fixture required");
    await db.insert(user).values(
      [actor, other].map((id) => ({
        id,
        name: "Retry QA",
        email: `${id}@fixture.invalid`,
        roleId: r.id,
        emailVerified: true,
      })),
    );
  });
  afterAll(async (): Promise<void> => {
    if (owned.length) await db.delete(aiConversation).where(inArray(aiConversation.id, owned));
    await db.delete(user).where(inArray(user.id, [actor, other]));
  });
  it("concurrent first-turn retries create one owned conversation and one question", async (): Promise<void> => {
    const input = {
      userId: actor,
      messageId: crypto.randomUUID(),
      text: "QA recovery",
      parts: [{ type: "text" as const, text: "QA recovery" }],
    };
    const results = await Promise.all([persistUserTurn(input), persistUserTurn(input)]);
    owned.push(results[0].id);
    expect(results[1].id).toBe(results[0].id);
    expect(
      await db.query.aiMessage.findMany({ where: eq(aiMessage.conversationId, results[0].id) }),
    ).toHaveLength(1);
    await expect(
      persistUserTurn({ ...input, text: "changed", parts: [{ type: "text", text: "changed" }] }),
    ).rejects.toThrow("Identitas");
    await expect(persistUserTurn({ ...input, userId: other })).rejects.toThrow("Identitas");
    const next = await persistUserTurn({
      ...input,
      messageId: crypto.randomUUID(),
      conversationId: results[0].id,
    });
    expect(next.id).toBe(results[0].id);
    const messages = await db.query.aiMessage.findMany({
      where: eq(aiMessage.conversationId, next.id),
    });
    expect(messages).toHaveLength(2); // Same text sent intentionally is a new question.
    const history = messages.map((m) => ({ id: m.id, role: "user" as const, parts: input.parts }));
    expect(historyBeforeTurn(history, input.messageId)).toHaveLength(0);
  });
});
