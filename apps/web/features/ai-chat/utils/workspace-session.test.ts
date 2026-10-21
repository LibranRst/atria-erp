import { expect, test } from "bun:test";
import {
  emptyChatDraft,
  emptyWorkspaceSession,
  hasChatDraft,
  saveWorkspaceDraft,
  workspaceSessionSchema,
} from "./workspace-session";

test("conversation drafts retain independent text, attachment references and wizard progress", () => {
  const first = {
    ...emptyChatDraft(),
    text: "Catatan proyek A",
    attachments: [
      {
        url: "/api/media/a",
        fileName: "material.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 100,
      },
    ],
    wizard: {
      progresses: { toolA: { values: { name: "Proyek A" }, currentStep: 2, furthestStep: 3 } },
      paused: ["toolA"],
    },
  };
  const session = saveWorkspaceDraft(saveWorkspaceDraft(emptyWorkspaceSession(), "a", first), "b", {
    ...emptyChatDraft(),
    text: "Catatan B",
  });
  const restored = workspaceSessionSchema.parse(JSON.parse(JSON.stringify(session)));
  expect(restored.lastKey).toBe("b");
  expect(restored.drafts.a).toEqual(first);
  expect(restored.drafts.b.text).toBe("Catatan B");
});
test("cache bounds preserve the current draft even when update timestamps tie", () => {
  let session = emptyWorkspaceSession();
  for (let index = 0; index < 30; index++)
    session = saveWorkspaceDraft(session, String(index), {
      ...emptyChatDraft(),
      text: String(index),
      updatedAt: 1,
    });
  expect(Object.keys(session.drafts)).toHaveLength(20);
  expect(session.drafts["29"].text).toBe("29");
  expect(session.lastKey).toBe("29");
});
test("empty new chat is distinct from unsent text, attachments or wizard fields", () => {
  expect(hasChatDraft(emptyChatDraft())).toBe(false);
  expect(hasChatDraft({ ...emptyChatDraft(), text: "Draft" })).toBe(true);
  expect(
    hasChatDraft({
      ...emptyChatDraft(),
      wizard: {
        progresses: { tool: { values: { name: "Nama" }, currentStep: 0, furthestStep: 0 } },
        paused: [],
      },
    }),
  ).toBe(true);
  expect(workspaceSessionSchema.safeParse({ version: 99, drafts: {} }).success).toBe(false);
});
