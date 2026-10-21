import { db } from "@backend/db";
import { aiUserPreference } from "@backend/db/schema";
import {
  aiPreferenceInputSchema,
  DEFAULT_AI_PREFERENCE,
  type AiPreferenceInput,
} from "@atria/core/validations/ai-preference";
import { eq } from "drizzle-orm";

export async function loadAiPreference(userId: string): Promise<AiPreferenceInput> {
  const row = await db.query.aiUserPreference.findFirst({
    where: eq(aiUserPreference.userId, userId),
  });
  if (!row) return DEFAULT_AI_PREFERENCE;
  const parsed = aiPreferenceInputSchema.safeParse(row);
  return parsed.success ? parsed.data : DEFAULT_AI_PREFERENCE;
}

export async function upsertAiPreference(
  userId: string,
  input: AiPreferenceInput,
): Promise<AiPreferenceInput> {
  const parsed = aiPreferenceInputSchema.parse(input);
  await db
    .insert(aiUserPreference)
    .values({ userId, ...parsed, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: aiUserPreference.userId,
      set: { ...parsed, updatedAt: new Date() },
    });
  return parsed;
}

export async function deleteAiPreference(userId: string): Promise<void> {
  await db.delete(aiUserPreference).where(eq(aiUserPreference.userId, userId));
}
