import { z } from "zod";

const progressSchema = z.object({
  values: z.record(z.string(), z.string()),
  currentStep: z.number().int().nonnegative(),
  furthestStep: z.number().int().nonnegative(),
});
export const composerWizardStateSchema = z.object({
  progresses: z.record(z.string(), progressSchema),
  paused: z.array(z.string()),
});
export type ComposerWizardState = z.infer<typeof composerWizardStateSchema>;
export const chatDraftSchema = z.object({
  text: z.string().max(2000),
  attachments: z
    .array(
      z.object({
        url: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        size: z.number().nonnegative(),
      }),
    )
    .max(4),
  wizard: composerWizardStateSchema,
  dismissed: z.array(z.string()),
  updatedAt: z.number(),
  pending: z
    .object({
      id: z.string().uuid(),
      text: z.string().max(2000),
      attachments: z
        .array(
          z.object({
            url: z.string(),
            fileName: z.string(),
            mimeType: z.string(),
            size: z.number().nonnegative(),
          }),
        )
        .max(4),
    })
    .nullable()
    .optional(),
});
export type ChatDraft = z.infer<typeof chatDraftSchema>;
export const workspaceSessionSchema = z.object({
  version: z.literal(1),
  lastKey: z.string().nullable(),
  drafts: z.record(z.string(), chatDraftSchema),
});
export type WorkspaceSession = z.infer<typeof workspaceSessionSchema>;
export function emptyChatDraft(): ChatDraft {
  return {
    text: "",
    attachments: [],
    wizard: { progresses: {}, paused: [] },
    dismissed: [],
    updatedAt: Date.now(),
  };
}
export function newDraftKey(): string {
  return "draft:" + crypto.randomUUID();
}
export function emptyWorkspaceSession(): WorkspaceSession {
  return { version: 1, lastKey: null, drafts: {} };
}
export function hasChatDraft(draft: ChatDraft): boolean {
  return Boolean(
    draft.text.trim() ||
    draft.pending ||
    draft.attachments.length ||
    Object.values(draft.wizard.progresses).some((item) =>
      Object.values(item.values).some((value) => value.trim()),
    ),
  );
}
export function saveWorkspaceDraft(
  session: WorkspaceSession,
  key: string,
  draft: ChatDraft,
): WorkspaceSession {
  const entries: [string, ChatDraft][] = [
    [key, draft],
    ...Object.entries(session.drafts)
      .filter(([id]) => id !== key)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, 19),
  ];
  const drafts = Object.fromEntries(entries);
  return { version: 1, lastKey: key, drafts };
}
export function readWorkspaceSession(userId: string): WorkspaceSession {
  if (typeof window === "undefined") return emptyWorkspaceSession();
  try {
    const raw = sessionStorage.getItem("atria:ai-workspace:" + userId);
    const parsed = raw ? workspaceSessionSchema.safeParse(JSON.parse(raw)) : null;
    return parsed?.success ? parsed.data : emptyWorkspaceSession();
  } catch {
    return emptyWorkspaceSession();
  }
}
export function writeWorkspaceSession(userId: string, session: WorkspaceSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("atria:ai-workspace:" + userId, JSON.stringify(session));
  } catch {
    /* Private browsing/quota keeps the in-memory draft usable. */
  }
}
