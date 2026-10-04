import { describe, expect, test } from "bun:test";
import {
  attachmentMime,
  assertAttachmentBytes,
  boundedAttachmentBody,
  imagekitSource,
  privateAttachmentId,
} from "./private-attachment-policy";
import { signUploadTicket, verifyUploadTicket } from "./upload-ticket";
import { approvedChatProviders, assertApprovedAiProvider } from "../ai/provider-policy";
import { PRIVATE_ATTACHMENT_MAX_BYTES } from "@atria/core/media/private-attachment";

const id = "12345678-1234-4234-8234-123456789012";
const origin = "https://atria.example";
const endpoint = "https://ik.imagekit.io/company";
const secret = "isolated-ticket-test-secret-no-real-provider";

describe("private attachment network boundary", () => {
  test("only canonical protected UUID references can reach storage", () => {
    expect(privateAttachmentId(`${origin}/api/media/attachments/${id}`, [origin])).toBe(id);
    for (const url of [
      "http://127.0.0.1/admin",
      "http://169.254.169.254/latest/meta-data",
      `${origin}.evil/api/media/attachments/${id}`,
      `${origin}/api/media/attachments/${id}?url=http://localhost`,
      `${origin}/api/media/attachments/not-an-id`,
      `https://user:pass@atria.example/api/media/attachments/${id}`,
    ]) {
      expect(() => privateAttachmentId(url, [origin])).toThrow();
    }
  });
  test("storage identity must be HTTPS and within the configured account path", () => {
    expect(imagekitSource(`${endpoint}/atria-private/a.jpg`, endpoint)).toBe(
      "/atria-private/a.jpg",
    );
    for (const url of [
      "https://ik.imagekit.io/other/a.jpg",
      "https://ik.imagekit.io/company-evil/a.jpg",
      "http://ik.imagekit.io/company/a.jpg",
      `${endpoint}/a.jpg?redirect=http://localhost`,
      "https://ik.imagekit.io.evil/company/a.jpg",
    ])
      expect(() => imagekitSource(url, endpoint)).toThrow();
    expect(() => imagekitSource("https://localhost/a.jpg", "https://localhost")).toThrow();
  });
  test("filename, byte signature and declared size are checked", () => {
    expect(attachmentMime("statement.PDF", 20)).toBe("application/pdf");
    expect(() => attachmentMime("active.svg", 20)).toThrow();
    expect(() => attachmentMime("statement.pdf", PRIVATE_ATTACHMENT_MAX_BYTES + 1)).toThrow();
    expect(() =>
      assertAttachmentBytes(new TextEncoder().encode("<script>alert(1)</script>"), "image/jpeg"),
    ).toThrow();
    expect(() =>
      assertAttachmentBytes(new TextEncoder().encode("%PDF-1.7\n"), "application/pdf"),
    ).not.toThrow();
  });
  test("stream limit works without Content-Length and cancels the source", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller): void {
          controller.enqueue(new Uint8Array(PRIVATE_ATTACHMENT_MAX_BYTES));
          controller.enqueue(new Uint8Array(1));
        },
        cancel(): void {
          cancelled = true;
        },
      }),
    );
    await expect(boundedAttachmentBody(response)).rejects.toThrow("10 MB");
    expect(cancelled).toBe(true);
    await expect(
      boundedAttachmentBody(
        new Response("small", {
          headers: { "content-length": String(PRIVATE_ATTACHMENT_MAX_BYTES + 1) },
        }),
      ),
    ).rejects.toThrow();
    expect((await boundedAttachmentBody(new Response("data"))).toString()).toBe("data");
  });
});

describe("short-lived upload tickets", () => {
  const metadata = {
    purpose: "expense" as const,
    projectId: id,
    fileName: "receipt.jpg",
    size: 1024,
  };
  const identity = { userId: id, sessionId: "server-verified-session" };
  test("binds session, user, project, name and size; expires after two minutes", () => {
    const value = signUploadTicket(metadata, identity, secret, 1000);
    expect(verifyUploadTicket(value, secret, 1001)).toMatchObject({
      ...metadata,
      ...identity,
      expiresAt: 121000,
    });
    expect(() => verifyUploadTicket(value, secret, 121000)).toThrow();
    expect(() => verifyUploadTicket(value, "wrong-secret", 1001)).toThrow();
    const [encoded, signature] = value.split(".");
    const payload: unknown = JSON.parse(Buffer.from(encoded!, "base64url").toString());
    const tampered = Buffer.from(
      JSON.stringify({ ...identity, ...metadata, size: 1, original: payload }),
    ).toString("base64url");
    expect(() => verifyUploadTicket(`${tampered}.${signature}`, secret, 1001)).toThrow();
  });
  test("rejects unknown scope, malformed tickets and excessive sizes", () => {
    expect(() => verifyUploadTicket("x.y.z", secret)).toThrow();
    expect(() =>
      signUploadTicket({ ...metadata, projectId: undefined }, identity, secret),
    ).toThrow();
    expect(() =>
      signUploadTicket({ ...metadata, size: PRIVATE_ATTACHMENT_MAX_BYTES + 1 }, identity, secret),
    ).toThrow();
  });
});

describe("real-data AI provider policy", () => {
  test("disables unapproved fallbacks and keeps configured order", () => {
    const environment = {
      ATRIA_PILOT_REAL_DATA: "true",
      AI_CHAT_PROVIDERS: "NINEROUTER,GEMINI,DEEPSEEK",
      AI_APPROVED_PROVIDERS: "NINEROUTER",
    };
    expect(approvedChatProviders(environment)).toEqual(["NINEROUTER"]);
    expect(() => assertApprovedAiProvider("GEMINI", environment)).toThrow();
    expect(
      approvedChatProviders({
        ...environment,
        AI_APPROVED_PROVIDERS: "NINEROUTER,GEMINI",
        GEMINI_PAID_DATA_POLICY_CONFIRMED: "true",
      }),
    ).toEqual(["NINEROUTER", "GEMINI"]);
  });
  test("real data fails closed without approval; synthetic development remains compatible", () => {
    expect(approvedChatProviders({ ATRIA_PILOT_REAL_DATA: "true" })).toEqual([]);
    expect(approvedChatProviders({ NODE_ENV: "production" })).toEqual([]);
    expect(approvedChatProviders({ AI_CHAT_PROVIDERS: "DEEPSEEK,NINEROUTER" })).toEqual([
      "DEEPSEEK",
      "NINEROUTER",
    ]);
    expect(() => approvedChatProviders({ AI_CHAT_PROVIDERS: "UNKNOWN" })).toThrow();
  });
});
