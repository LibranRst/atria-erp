import { expect, mock } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream, type UIMessage } from "ai";
import type {
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import type { BudgetAllocationSnapshot } from "@backend/lib/budget/allocation-defaults";
import type { AiToolContext } from "../tools/context";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { getAllCatalogPermissionKeys } from "@atria/core/auth/permission-catalog";
import { z } from "zod";

const userId = "10000000-0000-4000-8000-000000000001",
  roleId = "20000000-0000-4000-8000-000000000002",
  conversationId = "30000000-0000-4000-8000-000000000003";
let permissions: AiToolContext["permissions"] = ["use:ai_chat", "view:settings"],
  authenticated = true,
  missingSetting = false,
  allocationReads = 0,
  modelCalls = 0,
  documentCalls = 0,
  documentComplete = true,
  documentText = "Vendor: Supplier QA\nJumlah:1.5\nHarga:125000.50\nSubtotal:187500.75",
  fileEpoch = 0;
const privateUrl =
    "https://fixture.invalid/api/media/attachments/40000000-0000-4000-8000-000000000004",
  historicalPrivateUrl =
    "https://fixture.invalid/api/media/attachments/50000000-0000-4000-8000-000000000005";
interface FixtureFile {
  readonly row: { readonly fileName: string; readonly mimeType: string };
  readonly bytes: Buffer;
}
const files = new Map<string, FixtureFile>(),
  privateDenied = new Set<string>(),
  privateReads: string[] = [];
const saved: { readonly role: string; readonly parts: UIMessage["parts"] }[] = [];
const persistedActors: string[] = [],
  permissionChecks: string[] = [],
  timingJson: string[] = [],
  modelPackets: string[] = [];
const originalInfo = console.info;
console.info = (label: unknown, value?: unknown): void => {
  if (label === "[ai-timing]" && typeof value === "string") timingJson.push(value);
};
const originalFetch = globalThis.fetch;
const blockedFetch = async (): Promise<never> => {
  throw new Error("No network is permitted in this route fixture.");
};
globalThis.fetch = Object.assign(blockedFetch, { preconnect: originalFetch.preconnect });

mock.module("@backend/db", (): Record<string, unknown> => ({
  db: {
    query: {
      role: {
        findFirst: async (): Promise<{ readonly name: string }> => ({ name: "ACTUAL_ROLE" }),
      },
    },
    transaction: async (): Promise<never> => {
      throw new Error("Unexpected database transaction in defaults route fixture.");
    },
  },
}));
mock.module("@backend/lib/server/session", (): Record<string, unknown> => ({
  getServerSession: async (): Promise<object | null> =>
    authenticated
      ? {
          user: {
            id: userId,
            name: "Actual fixture user",
            roleId,
            isActive: true,
            mustChangePassword: false,
          },
          session: {},
        }
      : null,
}));
mock.module("@backend/server/actor", (): Record<string, unknown> => ({
  resolveActor: async (): Promise<object> => ({ userId, roleId, permissions, dataScope: "GLOBAL" }),
}));
mock.module("@backend/server/usecases/media/private-attachments", (): Record<string, unknown> => ({
  authorizedPrivateAttachment: async (
    actor: { readonly userId: string },
    url: string,
  ): Promise<FixtureFile["row"]> => {
    expect(actor.userId).toBe(userId);
    const file = files.get(url);
    if (!file || privateDenied.has(url))
      throw new Error("Actual private attachment access denied.");
    return file.row;
  },
  readPrivateAttachment: async (
    actor: { readonly userId: string },
    url: string,
    purpose: string,
  ): Promise<FixtureFile> => {
    expect(actor.userId).toBe(userId);
    expect(purpose).toBe("ai_chat");
    privateReads.push(url);
    const file = files.get(url);
    if (!file || privateDenied.has(url))
      throw new Error("Actual private attachment access denied.");
    return file;
  },
}));
mock.module("@backend/lib/auth/role-access", (): Record<string, unknown> => ({
  getRoleDataScopeByName: async (): Promise<string> => "GLOBAL",
  getRoleDataScopeFromDb: async (): Promise<string> => "GLOBAL",
  getAllPermissionKeys: getAllCatalogPermissionKeys,
  roleHasPermission: async (_id: string, permission: PermissionKey): Promise<boolean> =>
    permissions.includes(permission),
  roleNameHasPermission: async (name: string, permission: PermissionKey): Promise<boolean> => {
    expect(name).toBe("ACTUAL_ROLE");
    permissionChecks.push(permission);
    return permissions.includes(permission);
  },
  getRolePermissions: async (): Promise<AiToolContext["permissions"]> => permissions,
  getRoleAccess: async (id: string): Promise<object> => {
    expect(id).toBe(roleId);
    return { permissions, dataScope: "GLOBAL", roleId, roleName: "ACTUAL_ROLE" };
  },
}));
mock.module("@backend/lib/ai/rate-limit", (): Record<string, unknown> => ({
  checkRateLimit: (id: string): object => {
    expect(id).toBe(userId);
    return { allowed: true };
  },
}));
const history: UIMessage[] = [
  {
    id: "old-assistant-answer",
    role: "assistant",
    parts: [{ type: "text", text: "Target gross margin perusahaan adalah15%, plafon85%." }],
  },
];
mock.module("@backend/lib/ai/conversation-store", (): Record<string, unknown> => ({
  findOwnedConversation: async (id: string, ownerId: string): Promise<object> => {
    expect(id).toBe(conversationId);
    expect(ownerId).toBe(userId);
    return { id: conversationId };
  },
  loadConversationMessages: async (id: string): Promise<UIMessage[]> => {
    expect(id).toBe(conversationId);
    return history;
  },
  appendMessage: async (message: {
    readonly conversationId: string;
    readonly role: string;
    readonly parts: UIMessage["parts"];
  }): Promise<void> => {
    expect(message.conversationId).toBe(conversationId);
    saved.push(message);
  },
}));
mock.module("@backend/lib/ai/user-turn", (): Record<string, unknown> => ({
  ChatTurnConflict: class extends Error {},
  findUserTurnConversation: async (): Promise<null> => null,
  historyBeforeTurn: (messages: UIMessage[]): UIMessage[] => messages,
  persistUserTurn: async (input: {
    readonly userId: string;
    readonly conversationId?: string | null;
    readonly parts: UIMessage["parts"];
  }): Promise<object> => {
    expect(input.conversationId).toBe(conversationId);
    persistedActors.push(input.userId);
    saved.push({ role: "user", parts: input.parts });
    return { id: conversationId };
  },
}));
mock.module("@backend/lib/ai/user-preference", (): Record<string, unknown> => ({
  loadAiPreference: async (id: string): Promise<object> => {
    expect(id).toBe(userId);
    return { responseStyle: "VERY_CONCISE", primaryFocus: "AUTO" };
  },
}));
mock.module("@backend/lib/company/identity", (): Record<string, unknown> => ({
  getCompanyIdentity: async (): Promise<{ readonly name: string }> => ({
    name: "Actual fixture company",
  }),
}));
mock.module("@backend/lib/budget/allocation-defaults", (): Record<string, unknown> => ({
  readBudgetAllocationSnapshot: async (): Promise<BudgetAllocationSnapshot> => {
    allocationReads += 1;
    return {
      settingId: missingSetting ? null : "actual-budget-setting",
      settingName: missingSetting ? null : "Actual current Settings",
      budgetCapRatio: 0.9,
      categories: [
        {
          expenseCategoryId: "actual-category-id",
          code: "MATERIAL",
          name: "Material",
          ratioPercentage: 0.35,
          sortOrder: 0,
        },
      ],
    };
  },
}));
const model = new MockLanguageModelV4({
  doGenerate: async (): Promise<LanguageModelV4GenerateResult> => {
    documentCalls += 1;
    return {
      content: [{ type: "text", text: documentText }],
      finishReason: {
        unified: documentComplete ? "stop" : "length",
        raw: documentComplete ? "stop" : "length",
      },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    };
  },
  doStream: async (
    options: LanguageModelV4CallOptions,
  ): Promise<{ readonly stream: ReadableStream<LanguageModelV4StreamPart> }> => {
    modelCalls += 1;
    modelPackets.push(JSON.stringify(options.prompt));
    const chunks: LanguageModelV4StreamPart[] = [
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "fixture-text" },
      {
        type: "text-delta",
        id: "fixture-text",
        delta: permissions.includes("view:settings")
          ? "Normal model orchestration fixture"
          : "Peran Anda tidak memiliki akses ke Pengaturan Budget perusahaan.",
      },
      { type: "text-end", id: "fixture-text" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
      },
    ];
    return {
      stream: simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null }),
    };
  },
});
mock.module("@backend/lib/ai/providers", (): Record<string, unknown> => ({
  resolveProviderChain: (): readonly string[] => ["NINEROUTER"],
  resolveChatModel: (): MockLanguageModelV4 => model,
  isFallbackWorthyError: (): boolean => false,
}));

const { POST } = await import("../../../app/api/ai/chat/route");
const question =
  "Berapa plafon internal standar perusahaan dan target gross margin? Jawab singkat.";
function reset(): void {
  permissions = ["use:ai_chat", "view:settings"];
  authenticated = true;
  missingSetting = false;
  allocationReads = 0;
  modelCalls = 0;
  documentCalls = 0;
  documentComplete = true;
  documentText = "Vendor: Supplier QA\nJumlah:1.5\nHarga:125000.50\nSubtotal:187500.75";
  fileEpoch += 1;
  files.clear();
  files.set(privateUrl, {
    row: { fileName: "Owned current invoice.png", mimeType: "image/png" },
    bytes: Buffer.from(`synthetic-current-image-${fileEpoch}`),
  });
  files.set(historicalPrivateUrl, {
    row: { fileName: "Owned historical invoice.png", mimeType: "image/png" },
    bytes: Buffer.from(`synthetic-history-image-${fileEpoch}`),
  });
  privateDenied.clear();
  privateReads.length = 0;
  history.splice(1);
  saved.length = 0;
  persistedActors.length = 0;
  permissionChecks.length = 0;
  timingJson.length = 0;
  modelPackets.length = 0;
}
async function post(
  text: string = question,
  extras: Readonly<Record<string, unknown>> = {},
  signal?: AbortSignal,
): Promise<{ readonly response: Response; readonly body: string }> {
  const response = await POST(
    new Request("https://fixture.invalid/api/ai/chat", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId,
        userMessageId: crypto.randomUUID(),
        text,
        attachments: [],
        ...extras,
      }),
    }),
  );
  return { response, body: await response.text() };
}
function currentAttachments(urls: readonly string[] = [privateUrl]): readonly object[] {
  return urls.map((url): object => ({
    url,
    fileName: "forged-client-name.png",
    mimeType: "image/png",
    size: 25,
  }));
}
function streamedText(body: string): string {
  const textSchema = z.object({ type: z.literal("text-delta"), delta: z.string() });
  return body
    .split("\n")
    .flatMap((line): string[] => {
      if (!line.startsWith("data: ") || line === "data: [DONE]") return [];
      const result = textSchema.safeParse(JSON.parse(line.slice(6)));
      return result.success ? [result.data.delta] : [];
    })
    .join("");
}

try {
  reset();
  const current = await post();
  expect(current.response.status).toBe(200);
  expect(current.response.headers.get("x-conversation-id")).toBe(conversationId);
  expect(allocationReads).toBe(1);
  expect(modelCalls).toBe(0);
  expect(streamedText(current.body)).toContain("**90% dari nilai kontrak**");
  expect(streamedText(current.body)).toContain("**10%**");
  expect(streamedText(current.body)).not.toContain("15%");
  expect(saved.filter((message) => message.role === "assistant")).toHaveLength(1);
  const assistant = saved.find((message) => message.role === "assistant");
  expect(
    assistant?.parts
      .flatMap((part): string[] => (part.type === "text" ? [part.text] : []))
      .join(""),
  ).toBe(streamedText(current.body));
  expect(assistant?.parts.some((part) => part.type === "tool-getCompanyBudgetDefaults")).toBe(true);
  expect(persistedActors).toEqual([userId]);
  const timingSchema = z.object({
    outcome: z.literal("complete"),
    totalMs: z.number().nonnegative(),
    stages: z.object({
      authorized: z.number(),
      context: z.number(),
      "first-answer": z.number(),
      "assistant-persisted": z.number(),
    }),
    modelCalls: z.array(z.unknown()).length(0),
    toolCalls: z.array(z.unknown()),
  });
  expect(timingJson).toHaveLength(1);
  timingSchema.parse(JSON.parse(timingJson[0] ?? "null"));
  expect(timingJson.join("")).not.toContain(userId);
  expect(timingJson.join("")).not.toContain(conversationId);
  expect(timingJson.join("")).not.toContain(question);

  reset();
  missingSetting = true;
  const missing = await post();
  expect(modelCalls).toBe(0);
  expect(streamedText(missing.body)).toContain("Pengaturan Budget aktif belum lengkap");
  expect(streamedText(missing.body)).not.toContain("%");

  reset();
  permissions = ["use:ai_chat"];
  const denied = await post(question, {
    userId: "forged-owner",
    roleId: "forged-role",
    permissions: ["use:ai_chat", "view:settings"],
    toolContext: { permissions: ["view:settings"], dataScope: "GLOBAL" },
  });
  expect(denied.response.status).toBe(200);
  expect(allocationReads).toBe(0);
  expect(modelCalls).toBeGreaterThan(0);
  expect(streamedText(denied.body)).toContain("tidak memiliki akses");
  expect(denied.body).not.toContain("actual-budget-setting");
  expect(denied.body).not.toContain("90%");
  expect(persistedActors).toEqual([userId]);
  expect(permissionChecks).toEqual(["use:ai_chat"]);
  expect(modelPackets.join("\n")).toContain("ACTUAL_ROLE");
  expect(modelPackets.join("\n")).not.toContain("forged-owner");
  expect(modelPackets.join("\n")).not.toContain("forged-role");

  for (const text of [
    "Berapa plafon standar perusahaan dan saldo rekening?",
    "Siapkan usulan perubahan default plafon perusahaan.",
    "Berapa plafon standar perusahaan untuk proyek Menteng?",
  ]) {
    reset();
    const normal = await post(text);
    expect(normal.response.status).toBe(200);
    expect(modelCalls).toBeGreaterThan(0);
    expect(normal.body).not.toContain("actual-budget-setting");
  }

  reset();
  permissions = [];
  const noChat = await post(question, { permissions: ["use:ai_chat", "view:settings"] });
  expect(noChat.response.status).toBe(403);
  expect(allocationReads).toBe(0);
  expect(modelCalls).toBe(0);
  expect(saved).toHaveLength(0);

  reset();
  authenticated = false;
  const anonymous = await post();
  expect(anonymous.response.status).toBe(401);
  expect(allocationReads).toBe(0);
  expect(modelCalls).toBe(0);
  expect(saved).toHaveLength(0);

  reset();
  const invalid = await post(question, { text: { userId: "forged-owner" } });
  expect(invalid.response.status).toBe(400);
  expect(allocationReads).toBe(0);
  expect(modelCalls).toBe(0);
  expect(saved).toHaveLength(0);

  // Full completed OCR is returned directly, including data outside the chat preview.
  reset();
  documentText = [
    documentText,
    ...Array.from(
      { length: 410 },
      (_, index): string =>
        `Baris sumber ${index + 1}: nilai asli tetap tersedia di seluruh dokumen.`,
    ),
    "TAIL-LAST:1.5 /125000.50 /187500.75",
  ].join("\n");
  const docQuestion =
    "Baca invoice ini. Sebutkan vendor, jumlah, harga dan subtotal. Jangan buat usulan.";
  const read = await post(docQuestion, { attachments: currentAttachments() });
  expect(read.response.status).toBe(200);
  expect(documentCalls).toBe(1);
  expect(modelCalls).toBe(0);
  expect(privateReads).toEqual([privateUrl]);
  expect(streamedText(read.body)).toContain("TAIL-LAST:1.5 /125000.50 /187500.75");
  expect(streamedText(read.body).includes("Baris sumber 410:")).toBe(true);
  expect(read.body).toContain('"semanticVerification":false');
  expect(read.body).toContain('"fileName":"Owned current invoice.png"');
  expect(read.body).not.toContain("forged-client-name");
  expect(read.body).not.toContain('"toolName":');
  expect(saved.filter((message) => message.role === "assistant")).toHaveLength(1);
  const readAssistant = saved.find((message) => message.role === "assistant");
  expect(
    readAssistant?.parts
      .flatMap((part): string[] => (part.type === "text" ? [part.text] : []))
      .join(""),
  ).toBe(streamedText(read.body));

  // A warmed OCR cache does not bypass the current file's fresh authorization.
  privateDenied.add(privateUrl);
  saved.length = 0;
  modelCalls = 0;
  documentCalls = 0;
  privateReads.length = 0;
  const revoked = await post(docQuestion, { attachments: currentAttachments() });
  expect(revoked.response.status).toBe(403);
  expect(documentCalls).toBe(0);
  expect(modelCalls).toBe(0);
  expect(saved).toHaveLength(0);
  expect(revoked.body).not.toContain("TAIL-LAST");

  reset();
  privateDenied.add(historicalPrivateUrl);
  history.push({
    id: "historical-private-turn",
    role: "user",
    parts: [
      {
        type: "file",
        mediaType: "image/png",
        url: historicalPrivateUrl,
        filename: "Historical.png",
      },
    ],
  });
  const inaccessibleHistory = await post(docQuestion, { attachments: currentAttachments() });
  expect(inaccessibleHistory.response.status).toBe(403);
  expect(privateReads).toContain(historicalPrivateUrl);
  expect(modelCalls).toBe(0);
  expect(saved).toHaveLength(0);
  expect(inaccessibleHistory.body).not.toContain("125000.50");

  for (const status of ["incomplete", "uncertain", "action", "multiple"]) {
    reset();
    if (status === "incomplete") documentComplete = false;
    if (status === "uncertain") documentText = "Total:187500.75\nJumlah belum terbaca";
    const normal = await post(
      status === "action" ? "Baca invoice ini lalu buat usulan tagihan vendor." : docQuestion,
      {
        attachments: currentAttachments(
          status === "multiple" ? [privateUrl, historicalPrivateUrl] : [privateUrl],
        ),
      },
    );
    expect(normal.response.status).toBe(200);
    expect(modelCalls).toBeGreaterThan(0);
    expect(normal.body).not.toContain('"type":"data-document-read"');
  }

  reset();
  const controller = new AbortController();
  const cancellation = await POST(
    new Request("https://fixture.invalid/api/ai/chat", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId,
        userMessageId: crypto.randomUUID(),
        text: docQuestion,
        attachments: currentAttachments(),
      }),
    }),
  );
  controller.abort();
  await cancellation.text();
  expect(documentCalls).toBe(1);
  expect(modelCalls).toBe(0);
  expect(saved.filter((message) => message.role === "assistant")).toHaveLength(0);
} finally {
  console.info = originalInfo;
  globalThis.fetch = originalFetch;
}
console.log("company budget route fixture passed");
