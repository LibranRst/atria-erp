import { expect, mock } from "bun:test";
import type { UIMessage, UIMessageChunk } from "ai";
import { inspect } from "node:util";
import * as XLSX from "xlsx";
import type { ChatStreamInput } from "../chat-stream";
import type {
  documentModel,
  requireDocumentProvider,
  DocumentContentRequest,
  DocumentContentResponse,
} from "../document-model";

interface FixtureFile {
  readonly row: { readonly fileName: string; readonly mimeType: string };
  readonly bytes: Buffer;
}
interface PostOptions {
  readonly conversationId?: string;
  readonly includeAttachments?: boolean;
  readonly text?: string;
}

const conversationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const privateUrl =
  "https://fixture.invalid/api/media/attachments/cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let activeFile: FixtureFile | null = null;
let selectedProvider: "NINEROUTER" | "GEMINI" = "NINEROUTER";
let ownedConversation = false;
let history: UIMessage[] = [];
const filesByUrl = new Map<string, FixtureFile>();
let authenticated = true;
let privateDenied = false;
let policyDenied = false;
let documentError = false;
let documentText = "Synthetic document result";
let abortOnDocument: (() => void) | undefined;
let privateReads = 0;
let conversationCreates = 0;
let policyChecks = 0;
let directGeminiCalls = 0;
let networkCalls = 0;
let activeDocuments = 0;
let maxActiveDocuments = 0;
const appended: Array<{ readonly role: string; readonly parts: UIMessage["parts"] }> = [];
const documentCalls: DocumentContentRequest[] = [];
const streamInputs: ChatStreamInput[] = [];
const events: string[] = [];
const logs: unknown[][] = [];
const deadlines: number[] = [];

const originalTimeout = AbortSignal.timeout;
AbortSignal.timeout = (milliseconds: number): AbortSignal => {
  deadlines.push(milliseconds);
  return originalTimeout(milliseconds);
};
console.error = (...values: unknown[]): void => {
  logs.push(values);
};
globalThis.fetch = Object.assign(
  async (): Promise<Response> => {
    networkCalls += 1;
    throw new Error("Network is forbidden in this isolated fixture.");
  },
  {
    preconnect: (): void => {
      networkCalls += 1;
      throw new Error("Network is forbidden in this isolated fixture.");
    },
  },
);

const fixtureDocumentProvider: typeof requireDocumentProvider = (): "NINEROUTER" | "GEMINI" => {
  policyChecks += 1;
  events.push("policy");
  if (policyDenied) throw new Error("synthetic-provider-secret");
  return selectedProvider;
};
const fixtureDocumentModel: typeof documentModel = {
  models: {
    generateContent: async (input: DocumentContentRequest): Promise<DocumentContentResponse> => {
      documentCalls.push(input);
      events.push("document");
      activeDocuments += 1;
      maxActiveDocuments = Math.max(maxActiveDocuments, activeDocuments);
      try {
        await Promise.resolve();
        abortOnDocument?.();
        input.config?.abortSignal?.throwIfAborted();
        if (documentError)
          throw new Error("synthetic-provider-secret", { cause: "synthetic-private-prompt" });
        return { text: documentText };
      } finally {
        activeDocuments -= 1;
      }
    },
  },
};
mock.module("@backend/lib/ai/document-model", (): Record<string, unknown> => ({
  requireDocumentProvider: fixtureDocumentProvider,
  documentModel: fixtureDocumentModel,
}));
mock.module("@backend/lib/ai/providers", (): Record<string, unknown> => ({
  resolveProviderChain: (): readonly ("NINEROUTER" | "GEMINI")[] => [selectedProvider],
  // The route now includes the effective model ID in its immutable OCR cache key.
  // No generation goes through this identity-only provider mock.
  resolveChatModel: (): { readonly modelId: string } => ({ modelId: "synthetic-document-model" }),
}));
mock.module("@backend/lib/ai/gemini", (): Record<string, unknown> => ({
  GEMINI_OCR_MODEL: "forbidden-direct-provider",
  geminiClient: {
    models: {
      generateContent: async (): Promise<never> => {
        directGeminiCalls += 1;
        throw new Error("Direct Gemini calls are forbidden in this fixture.");
      },
    },
  },
}));
mock.module("@backend/server/usecases/media/private-attachments", (): Record<string, unknown> => ({
  readPrivateAttachment: async (
    actor: { readonly id: string },
    url: string,
    purpose: string,
  ): Promise<FixtureFile> => {
    expect(actor.id).toBe(userId);
    expect(purpose).toBe("ai_chat");
    privateReads += 1;
    const file = filesByUrl.get(url);
    if (privateDenied || !file) throw new Error("Synthetic private attachment denied.");
    return file;
  },
}));
mock.module("@backend/server/actor", (): Record<string, unknown> => ({
  resolveActor: async (): Promise<{ id: string; userId: string }> => ({ id: userId, userId }),
}));
mock.module("@backend/lib/server/session", (): Record<string, unknown> => ({
  getServerSession: async (): Promise<object | null> =>
    authenticated
      ? { user: { id: userId, name: "Synthetic user", roleId: "owner" }, session: {} }
      : null,
}));
mock.module("@backend/lib/server/session-access", (): Record<string, unknown> => ({
  sessionAccessFailure: (): null => null,
}));
mock.module("@backend/lib/auth/permissions", (): Record<string, unknown> => ({
  resolveRoleName: async (): Promise<string> => "OWNER",
  assertPermission: async (): Promise<void> => undefined,
}));
mock.module("@backend/lib/auth/role-access", (): Record<string, unknown> => ({
  getRoleAccess: async (): Promise<object> => ({ permissions: ["use:ai_chat"], dataScope: "ALL" }),
}));
mock.module("@backend/lib/ai/rate-limit", (): Record<string, unknown> => ({
  checkRateLimit: (): object => ({ allowed: true }),
}));
mock.module("@backend/lib/ai/conversation-store", (): Record<string, unknown> => ({
  appendMessage: async (message: {
    readonly role: string;
    readonly parts: UIMessage["parts"];
  }): Promise<void> => {
    appended.push(message);
  },
  createConversation: async (): Promise<{ id: string }> => {
    conversationCreates += 1;
    return { id: conversationId };
  },
  findOwnedConversation: async (id: string, ownerId: string): Promise<{ id: string } | null> => {
    expect(id).toBe(conversationId);
    expect(ownerId).toBe(userId);
    return ownedConversation ? { id: conversationId } : null;
  },
  loadConversationMessages: async (): Promise<UIMessage[]> => history,
  setConversationTitleIfEmpty: async (): Promise<void> => undefined,
}));
mock.module("@backend/lib/ai/user-turn", (): Record<string, unknown> => ({
  ChatTurnConflict: class extends Error {},
  findUserTurnConversation: async (): Promise<null> => null,
  historyBeforeTurn: (messages: UIMessage[]): UIMessage[] => messages,
  persistUserTurn: async (input: {
    readonly conversationId?: string | null;
    readonly parts: UIMessage["parts"];
  }): Promise<{ id: string }> => {
    if (!input.conversationId) conversationCreates += 1;
    appended.push({ role: "user", parts: input.parts });
    return { id: conversationId };
  },
}));
mock.module("@backend/lib/ai/user-preference", (): Record<string, unknown> => ({
  loadAiPreference: async (): Promise<object> => ({}),
}));
mock.module("@backend/server/usecases/ai/own-profile-context", (): Record<string, unknown> => ({
  readOwnProfileTx: async (): Promise<never> => {
    throw new Error("Unexpected profile read in attachment fixture");
  },
  ownProfileSnapshot: (): never => {
    throw new Error("Unexpected profile snapshot in attachment fixture");
  },
}));
mock.module("@backend/lib/company/identity", (): Record<string, unknown> => ({
  getCompanyIdentity: async (): Promise<{ name: string }> => ({ name: "Synthetic company" }),
}));
mock.module("@backend/lib/ai/chat-stream", (): Record<string, unknown> => ({
  runChatStream: (input: ChatStreamInput): { stream: ReadableStream<UIMessageChunk> } => {
    streamInputs.push(input);
    return {
      stream: new ReadableStream<UIMessageChunk>({
        start(controller: ReadableStreamDefaultController<UIMessageChunk>): void {
          controller.close();
        },
      }),
    };
  },
}));
const { POST } = await import("../../../app/api/ai/chat/route");

function reset(file: FixtureFile): void {
  activeFile = file;
  selectedProvider = "NINEROUTER";
  ownedConversation = false;
  history = [];
  filesByUrl.clear();
  filesByUrl.set(privateUrl, file);
  authenticated = true;
  privateDenied = false;
  policyDenied = false;
  documentError = false;
  documentText = "Synthetic document result";
  abortOnDocument = undefined;
  privateReads = 0;
  conversationCreates = 0;
  policyChecks = 0;
  documentCalls.length = 0;
  streamInputs.length = 0;
  events.length = 0;
  logs.length = 0;
  deadlines.length = 0;
  appended.length = 0;
  activeDocuments = 0;
  maxActiveDocuments = 0;
}

async function post(signal?: AbortSignal, options: PostOptions = {}): Promise<Response> {
  if (!activeFile) throw new Error("Fixture file missing.");
  return POST(
    new Request("https://fixture.invalid/api/ai/chat", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: options.text ?? "Read the synthetic fixture",
        conversationId: options.conversationId,
        attachments:
          options.includeAttachments === false
            ? []
            : [
                {
                  url: privateUrl,
                  fileName: activeFile.row.fileName,
                  mimeType: activeFile.row.mimeType,
                  size: activeFile.bytes.length,
                },
              ],
      }),
    }),
  );
}

function prompt(): string {
  return (
    streamInputs[0]?.messages
      .at(-1)
      ?.parts.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n") ?? ""
  );
}

function pdfHistory(url: string = privateUrl, id: string = "historical-pdf"): UIMessage {
  return {
    id,
    role: "user",
    parts: [
      { type: "text", text: "Read the earlier PDF" },
      { type: "file", mediaType: "application/pdf", filename: "synthetic.pdf", url },
    ],
  };
}

function modelMessages(): string {
  return JSON.stringify(streamInputs[0]?.messages ?? []);
}

for (const mimeType of ["image/png", "application/pdf"]) {
  const bytes = Buffer.from(mimeType === "image/png" ? "synthetic image bytes" : "%PDF-synthetic");
  reset({ row: { fileName: "synthetic", mimeType }, bytes });
  const response = await post();
  expect(response.status).toBe(200);
  expect(privateReads).toBe(1);
  expect(policyChecks).toBe(1);
  expect(events).toEqual(["policy", "document"]);
  expect(documentCalls).toHaveLength(1);
  expect(documentCalls[0].contents[0]).toEqual({
    inlineData: { data: bytes.toString("base64"), mimeType },
  });
  expect("model" in documentCalls[0]).toBe(false);
  expect(documentCalls[0].config?.abortSignal).toBeInstanceOf(AbortSignal);
  expect(deadlines).toContain(20_000);
  expect(prompt()).toContain("Synthetic document result");
  if (mimeType === "application/pdf") expect(prompt()).toContain("Data Ekstraksi Dokumen PDF");
  await response.text();
}

for (const mimeType of ["text/plain", "text/csv"]) {
  reset({
    row: { fileName: "synthetic.txt", mimeType },
    bytes: Buffer.from("synthetic,2\nlocal,3"),
  });
  expect((await post()).status).toBe(200);
  expect(prompt()).toContain("synthetic,2\nlocal,3");
  expect(policyChecks).toBe(0);
  expect(documentCalls).toHaveLength(0);
}
reset({
  row: { fileName: "rekening.csv", mimeType: "text/csv" },
  bytes: Buffer.from("Tanggal,Keterangan,Nominal\n2026-10-13,Transfer bank,25000000"),
});
const humanFactQuestion = "Cek saldo Rekening QA sekarang. Jangan menyimpan perubahan.";
expect((await post(undefined, { text: humanFactQuestion })).status).toBe(200);
expect(streamInputs[0].userQuestion).toBe(humanFactQuestion);
expect(prompt()).toContain("Transfer bank");
expect(prompt()).toContain("25000000");
expect(appended[0]?.parts.filter((part) => part.type === "text").map((part) => part.text)).toEqual([
  humanFactQuestion,
]);
expect(documentCalls).toHaveLength(0);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["synthetic", 2]]), "Fixture");
reset({
  row: {
    fileName: "synthetic.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  bytes: Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })),
});
expect((await post()).status).toBe(200);
expect(prompt()).toContain("synthetic,2");
expect(policyChecks).toBe(0);
expect(documentCalls).toHaveLength(0);

const image: FixtureFile = {
  row: { fileName: "synthetic.png", mimeType: "image/png" },
  bytes: Buffer.from("synthetic image bytes"),
};
reset(image);
privateDenied = true;
expect((await post()).status).toBe(403);
expect(policyChecks).toBe(0);
expect(documentCalls).toHaveLength(0);
expect(streamInputs).toHaveLength(0);
expect(conversationCreates).toBe(0);

reset(image);
authenticated = false;
expect((await post()).status).toBe(401);
expect(privateReads).toBe(0);
expect(policyChecks).toBe(0);
expect(documentCalls).toHaveLength(0);
expect(conversationCreates).toBe(0);

for (const failure of ["policy", "document"]) {
  reset(image);
  policyDenied = failure === "policy";
  documentError = failure === "document";
  expect((await post()).status).toBe(200);
  expect(policyChecks).toBe(1);
  expect(documentCalls).toHaveLength(failure === "policy" ? 0 : 1);
  expect(prompt()).not.toContain("Synthetic document result");
  expect(JSON.stringify(logs)).not.toContain("synthetic-provider-secret");
  expect(logs).toEqual([["Gagal mengekstrak lampiran berkas."]]);
}

const pdf: FixtureFile = {
  row: { fileName: "synthetic.pdf", mimeType: "application/pdf" },
  bytes: Buffer.from("%PDF-synthetic"),
};
for (const failure of ["policy", "document", "empty", "abort"]) {
  reset(pdf);
  policyDenied = failure === "policy";
  documentError = failure === "document";
  if (failure === "empty") documentText = "  ";
  const pdfController = new AbortController();
  if (failure === "abort")
    abortOnDocument = (): void =>
      pdfController.abort(new Error("synthetic-provider-secret: synthetic-private-prompt"));
  const response = await post(pdfController.signal);
  expect(response.status).toBe(422);
  const body: unknown = await response.json();
  expect(body).toEqual({
    error: "PDF belum berhasil dibaca. Coba lagi atau unggah gambar dokumen yang diperlukan.",
  });
  expect(conversationCreates).toBe(0);
  expect(streamInputs).toHaveLength(0);
  expect(appended).toHaveLength(0);
  for (const sensitiveValue of ["synthetic-provider-secret", "synthetic-private-prompt"]) {
    expect(JSON.stringify(body)).not.toContain(sensitiveValue);
    expect(JSON.stringify(logs)).not.toContain(sensitiveValue);
  }
  expect(logs.every((entry) => entry.length === 1 && typeof entry[0] === "string")).toBe(true);
}

reset(pdf);
ownedConversation = true;
history = [pdfHistory()];
expect((await post(undefined, { conversationId, includeAttachments: false })).status).toBe(200);
expect(documentCalls).toHaveLength(1);
expect(privateReads).toBe(1);
expect(modelMessages()).toContain("Synthetic document result");
expect(modelMessages()).not.toContain("application/pdf");
expect(conversationCreates).toBe(0);
expect(JSON.stringify(appended)).not.toContain("Synthetic document result");
expect(history[0].parts.find((part) => part.type === "file")?.url).toBe(privateUrl);

reset(pdf);
ownedConversation = true;
history = [pdfHistory()];
expect((await post(undefined, { conversationId })).status).toBe(200);
expect(documentCalls).toHaveLength(1);
expect(privateReads).toBe(1);
expect(modelMessages().split("Synthetic document result").length - 1).toBe(1);
expect(JSON.stringify(appended)).toContain(privateUrl);
expect(JSON.stringify(appended)).not.toContain("Synthetic document result");
expect(JSON.stringify(appended)).not.toContain("data:application/pdf");

reset(pdf);
ownedConversation = true;
history = [pdfHistory()];
privateDenied = true;
expect((await post(undefined, { conversationId, includeAttachments: false })).status).toBe(403);
expect(documentCalls).toHaveLength(0);
expect(streamInputs).toHaveLength(0);
expect(appended).toHaveLength(0);
expect(logs).toEqual([["Lampiran percakapan belum berhasil diproses."]]);

for (const failure of ["policy", "document"]) {
  reset(pdf);
  ownedConversation = true;
  history = [pdfHistory()];
  policyDenied = failure === "policy";
  documentError = failure === "document";
  const response = await post(undefined, { conversationId, includeAttachments: false });
  expect(response.status).toBe(422);
  expect(streamInputs).toHaveLength(0);
  expect(appended).toHaveLength(0);
  for (const sensitiveValue of ["synthetic-provider-secret", "synthetic-private-prompt"]) {
    expect(await response.clone().text()).not.toContain(sensitiveValue);
    expect(inspect(logs, { depth: 10 })).not.toContain(sensitiveValue);
  }
}

reset(pdf);
history = [pdfHistory()];
expect((await post(undefined, { conversationId, includeAttachments: false })).status).toBe(404);
expect(privateReads).toBe(0);
expect(documentCalls).toHaveLength(0);
expect(streamInputs).toHaveLength(0);
expect(appended).toHaveLength(0);

reset(pdf);
selectedProvider = "GEMINI";
ownedConversation = true;
history = [pdfHistory()];
expect((await post(undefined, { conversationId, includeAttachments: false })).status).toBe(200);
expect(documentCalls).toHaveLength(0);
expect(policyChecks).toBe(0);
expect(modelMessages()).toContain("data:application/pdf;base64,");

reset(pdf);
ownedConversation = true;
history = Array.from({ length: 5 }, (_, index: number): UIMessage => {
  const url = `https://fixture.invalid/api/media/attachments/dddddddd-dddd-4ddd-8ddd-${String(index).padStart(12, "0")}`;
  // The oldest reference is intentionally unavailable: only the latest four
  // may be read, and the single renderer must never receive overlapping jobs.
  if (index > 0) filesByUrl.set(url, pdf);
  return pdfHistory(url, `historical-${index}`);
});
expect((await post(undefined, { conversationId, includeAttachments: false })).status).toBe(200);
expect(documentCalls).toHaveLength(4);
expect(privateReads).toBe(4);
expect(maxActiveDocuments).toBe(1);
expect(modelMessages().split("Synthetic document result").length - 1).toBe(4);
expect(JSON.stringify(appended)).not.toContain("Synthetic document result");

reset(image);
const controller = new AbortController();
abortOnDocument = (): void => controller.abort(new Error("synthetic-sensitive-abort"));
await post(controller.signal);
expect(documentCalls[0].config?.abortSignal?.aborted).toBe(true);
expect(streamInputs[0].signal?.aborted).toBe(true);
expect(prompt()).not.toContain("Synthetic document result");
expect(JSON.stringify(logs)).not.toContain("synthetic-sensitive-abort");
expect(directGeminiCalls).toBe(0);
expect(networkCalls).toBe(0);
console.log("chat attachment fixture passed");
