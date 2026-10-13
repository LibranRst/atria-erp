import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { chatFailureMessage, unansweredTurn, restorePendingMessages } from "./chat-recovery";
import {
  emptyChatDraft,
  emptyWorkspaceSession,
  saveWorkspaceDraft,
  workspaceSessionSchema,
} from "./workspace-session";

test("network failure is actionable while server blockers remain explicit", (): void => {
  expect(chatFailureMessage(new Error("Failed to fetch"), false)).toContain("Koneksi terputus");
  expect(chatFailureMessage(new Error("Proyek di luar akses Anda."), false)).toBe(
    "Proyek di luar akses Anda.",
  );
  expect(chatFailureMessage(new Error('{"error":"Peran Anda belum memiliki akses."}'), false)).toBe(
    "Peran Anda belum memiliki akses.",
  );
});
test("refresh restores a pending question identity and private attachment references", (): void => {
  const pending = {
    id: crypto.randomUUID(),
    text: "Cek stok",
    attachments: [
      { url: "/api/media/attachments/qa", fileName: "qa.csv", mimeType: "text/csv", size: 10 },
    ],
  };
  const session = saveWorkspaceDraft(emptyWorkspaceSession(), "draft:qa", {
    ...emptyChatDraft(),
    pending,
  });
  expect(
    workspaceSessionSchema.parse(JSON.parse(JSON.stringify(session))).drafts["draft:qa"].pending,
  ).toEqual(pending);
  const question: UIMessage = {
    id: pending.id,
    role: "user",
    parts: [{ type: "text", text: pending.text }],
  };
  expect(unansweredTurn([question, { id: "empty", role: "assistant", parts: [] }])).toBe(question);
  expect(restorePendingMessages([], pending)[0].id).toBe(pending.id);
  expect(restorePendingMessages([question], pending)).toHaveLength(1);
  expect(
    unansweredTurn([
      question,
      { id: "answer", role: "assistant", parts: [{ type: "text", text: "Stok 6" }] },
    ]),
  ).toBeNull();
});
