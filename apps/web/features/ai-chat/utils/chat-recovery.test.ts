import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { ownProfileProposalSchema } from "@atria/core/ai/own-profile";
import { requestUserInputSchema } from "@atria/core/ai/input-request";
import { chatFailureMessage, unansweredTurn, restorePendingMessages } from "./chat-recovery";
import { hasCompletedAssistantResult } from "./assistant-result";
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

const question: UIMessage = {
  id: "qa-user-recovery",
  role: "user",
  parts: [{ type: "text", text: "Cek kondisi terbaru lalu siapkan usulan." }],
};
const introduction: UIMessage["parts"][number] = {
  type: "data-assistant-introduction",
  id: "assistant-introduction",
  data: { text: "Aku cek konteks proyeknya dulu sebelum menyiapkan usulan." },
};

function assistant(parts: UIMessage["parts"]): UIMessage {
  return { id: "qa-assistant-recovery", role: "assistant", parts };
}

function completedTool(name: string, output: unknown): UIMessage["parts"][number] {
  return {
    type: `tool-${name}`,
    toolCallId: `qa-${name}`,
    state: "output-available",
    input: {},
    output,
  };
}

test("commentary, reasoning and successful background reads keep an interrupted question retryable", (): void => {
  for (const parts of [
    [introduction],
    [{ type: "reasoning" as const, text: "Private reasoning" }],
    [introduction, completedTool("getCompanyBudgetPolicy", { capRatio: 0.9 })],
    [introduction, completedTool("suggestFollowUps", { questions: ["Cek proyek lain?"] })],
    [
      introduction,
      completedTool("getBankBalances", {
        totalAvailable: { amount: 0, formatted: "Rp 0" },
        accounts: [],
      }),
    ],
    [introduction, completedTool("listProjects", { projects: [] })],
  ]) {
    const message = assistant(parts);
    const snapshot = JSON.stringify(message);
    expect(hasCompletedAssistantResult(message)).toBe(false);
    expect(unansweredTurn([question, message])).toBe(question);
    expect(unansweredTurn(JSON.parse(JSON.stringify([question, message])))).toEqual(question);
    expect(JSON.stringify(message)).toBe(snapshot);
  }
});

test("tool errors and invalid card payloads never replace a completed answer", (): void => {
  for (const output of [
    { error: "Proyek di luar akses Anda." },
    { accounts: [null] },
    { accounts: [] },
    null,
  ]) {
    expect(
      unansweredTurn([
        question,
        assistant([introduction, completedTool("getBankBalances", output)]),
      ]),
    ).toBe(question);
  }
  expect(
    unansweredTurn([
      question,
      assistant([
        {
          type: "tool-getBankBalances",
          toolCallId: "denied",
          state: "output-error",
          input: {},
          errorText: "Tidak diizinkan.",
        },
      ]),
    ]),
  ).toBe(question);
});

test("usable tool-only cards and the empty all-safe portfolio card preserve existing completion", (): void => {
  const bankOutput = {
    totalAvailable: { amount: 125000, formatted: "Rp 125.000" },
    accounts: [
      {
        accountName: "Rekening QA",
        bankName: "Bank QA",
        balance: { amount: 125000, formatted: "Rp 125.000" },
      },
    ],
  };
  const legacyMessage = assistant([completedTool("getBankBalances", bankOutput)]);
  expect(unansweredTurn([question, legacyMessage])).toBeNull();
  expect(
    unansweredTurn([
      question,
      assistant([introduction, completedTool("getBankBalances", bankOutput)]),
    ]),
  ).toBeNull();
  expect(
    unansweredTurn([
      question,
      assistant([completedTool("getProjectsAtRisk", { projects: [], assessedCount: 0 })]),
    ]),
  ).toBeNull();
  expect(
    unansweredTurn([
      question,
      assistant([
        completedTool("listClients", { clients: [{ clientId: "qa-client", name: "Klien QA" }] }),
      ]),
    ]),
  ).toBeNull();
});

test("unverified factual cards remain retryable while a verified answer is complete", (): void => {
  const message = assistant([
    introduction,
    { type: "data-grounded-facts", data: { status: "error", sources: [] } },
    completedTool("getProjectsAtRisk", { projects: [], assessedCount: 0 }),
  ]);
  expect(unansweredTurn([question, message])).toBe(question);
  expect(
    unansweredTurn([
      question,
      assistant([...message.parts, { type: "text", text: "Jawaban terverifikasi." }]),
    ]),
  ).toBeNull();
});

test("valid proposals and required user choices count as usable results without requiring answer text", (): void => {
  const proposal = ownProfileProposalSchema.parse({
    kind: "OWN_PROFILE",
    input: { name: "Nama QA baru", photo: { action: "KEEP" } },
    expectedContext: "0".repeat(64),
    before: { name: "Nama QA lama", imageUrl: null, hasPhoto: false },
    after: { name: "Nama QA baru", imageUrl: null, hasPhoto: false },
    photoSource: null,
    changedFields: ["name"],
  });
  const choice = requestUserInputSchema.parse({
    actionTitle: "Pilih proyek QA",
    fields: [
      {
        key: "projectId",
        label: "Proyek",
        type: "select",
        required: true,
        options: [{ value: "qa-project", label: "Proyek QA" }],
      },
    ],
  });
  expect(
    unansweredTurn([
      question,
      assistant([introduction, completedTool("proposeOwnProfile", { proposal })]),
    ]),
  ).toBeNull();
  expect(
    unansweredTurn([
      question,
      assistant([introduction, completedTool("requestUserInput", choice)]),
    ]),
  ).toBeNull();
  expect(
    unansweredTurn([
      question,
      assistant([
        introduction,
        completedTool("proposeOwnProfile", { proposal: { kind: "OWN_PROFILE" } }),
      ]),
    ]),
  ).toBe(question);
  expect(
    unansweredTurn([
      question,
      assistant([introduction, completedTool("requestUserInput", { fields: [] })]),
    ]),
  ).toBe(question);
});

test("recovery considers only assistant results after the latest request", (): void => {
  const next: UIMessage = {
    id: "next-qa",
    role: "user",
    parts: [{ type: "text", text: "Lanjutkan" }],
  };
  expect(
    unansweredTurn([
      question,
      assistant([{ type: "text", text: "Jawaban lama." }]),
      next,
      assistant([introduction]),
    ]),
  ).toBe(next);
  expect(hasCompletedAssistantResult(question)).toBe(false);
});
