import { withTestRequest } from "@backend/lib/testing/request";
import { db } from "@backend/db";
import { aiRun, attachment, project } from "@backend/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@backend/lib/auth";
import {
  documentModel,
  type DocumentContentRequest,
  type DocumentContentResponse,
} from "@backend/lib/ai/document-model";
import { processReceipt } from "@backend/app/actions/ai/process-receipt";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { describeIntegration } from "@backend/lib/testing/integration-db";

// Simpan method original
const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;
const originalGenerateContent = documentModel.models.generateContent;
const originalFetch = global.fetch;
const originalDocumentEnvironment: Readonly<Record<string, string | undefined>> = {
  IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
  IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,
  NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
  ATRIA_PILOT_REAL_DATA: process.env.ATRIA_PILOT_REAL_DATA,
  AI_CHAT_PROVIDERS: process.env.AI_CHAT_PROVIDERS,
  AI_APPROVED_PROVIDERS: process.env.AI_APPROVED_PROVIDERS,
  NINEROUTER_API_KEY: process.env.NINEROUTER_API_KEY,
  NINEROUTER_BASE_URL: process.env.NINEROUTER_BASE_URL,
};
let receiptUrl = "";
let attachmentId = "";
let fetched = 0;

// Helper untuk mock sesi pengguna
function mockUserSession(user: { id: string; roleId: string; email: string; name: string } | null) {
  const mockFn = async (): Promise<unknown> => {
    if (!user) return null;
    return {
      session: {
        id: "mock-session-id",
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        token: "mock-token",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: {
        id: user.id,
        roleId: user.roleId,
        email: user.email,
        name: user.name,
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  };
  (auth.api as unknown as { getSession: unknown }).getSession = mockFn;
}

function restoreUserSession() {
  (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
}

// Seed data constants
const PM_BUDI_USER = {
  id: "33333333-3333-3333-3333-333333333331",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "budi@dekoria.com",
  name: "Budi Santoso",
};

let lastDocumentRequest: DocumentContentRequest | undefined;

async function mockGenerateContent(args: DocumentContentRequest): Promise<DocumentContentResponse> {
  lastDocumentRequest = args;
  const hasImage = args.contents.some((part) => typeof part !== "string");
  if (!hasImage) throw new Error("Unexpected non-image document extraction call.");
  return {
    text: JSON.stringify({
      vendorName: "TB Sinar Maju",
      transactionDate: "2026-06-10T00:00:00.000Z",
      subtotal: 750000,
      tax: 0,
      totalAmount: 750000,
      items: [
        { itemName: "Semen Tiga Roda 50kg", quantity: 10, unitPrice: 72000, totalPrice: 720000 },
        { itemName: "Paku Kayu 3 Inch", quantity: 2, unitPrice: 15000, totalPrice: 30000 },
      ],
    }),
    usageMetadata: { totalTokenCount: 150 },
    modelVersion: "synthetic-configured-document-model",
  };
}

describeIntegration("Atria ERP AI Layer Integration - TSK-009", () => {
  beforeAll(
    withTestRequest(async (): Promise<void> => {
      const assigned = await db.query.project.findFirst({
        where: eq(project.projectManagerId, PM_BUDI_USER.id),
        columns: { id: true },
      });
      if (!assigned) throw new Error("Synthetic PM project is missing.");
      process.env.IMAGEKIT_PRIVATE_KEY = "synthetic-private-storage-key";
      process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/atria-audit";
      process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/atria-audit";
      process.env.ATRIA_PILOT_REAL_DATA = "true";
      process.env.AI_CHAT_PROVIDERS = "NINEROUTER";
      process.env.AI_APPROVED_PROVIDERS = "NINEROUTER";
      process.env.NINEROUTER_API_KEY = "synthetic-no-network-gateway-key";
      process.env.NINEROUTER_BASE_URL = "https://gateway.invalid/v1";
      const [stored] = await db
        .insert(attachment)
        .values({
          fileName: "receipt.jpg",
          fileUrl: "https://ik.imagekit.io/atria-audit/receipt.jpg",
          storageFileId: "synthetic-imagekit-file",
          fileSize: 8,
          mimeType: "image/jpeg",
          uploadedById: PM_BUDI_USER.id,
          referenceType: "private_expense",
          referenceId: assigned.id,
        })
        .returning();
      if (!stored) throw new Error("Synthetic private receipt is missing.");
      attachmentId = stored.id;
      receiptUrl = new URL(
        `/api/media/attachments/${stored.id}`,
        process.env.WEB_ORIGIN ?? "http://localhost:3000",
      ).href;
      global.fetch = Object.assign(
        async (input: RequestInfo | URL): Promise<Response> => {
          const url = new URL(input instanceof Request ? input.url : String(input));
          if (
            url.origin === "https://ik.imagekit.io" &&
            url.pathname === "/atria-audit/receipt.jpg"
          ) {
            fetched++;
            return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), {
              headers: { "content-type": "image/jpeg" },
            });
          }
          throw new Error("Unexpected network request in isolated OCR test.");
        },
        { preconnect: originalFetch.preconnect },
      );

      documentModel.models.generateContent = mockGenerateContent;
    }),
  );

  afterAll(
    withTestRequest(async (): Promise<void> => {
      await db
        .delete(aiRun)
        .where(eq(aiRun.payload, JSON.stringify({ receiptImageUrl: receiptUrl })));
      await db.delete(attachment).where(eq(attachment.id, attachmentId));
      for (const [key, value] of Object.entries(originalDocumentEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      restoreUserSession();
      documentModel.models.generateContent = originalGenerateContent;
      global.fetch = originalFetch;
    }),
  );

  describe("OCR Receipt Parser Action", () => {
    it(
      "rejects an unapproved configured provider before private bytes or AI runs",
      withTestRequest(async (): Promise<void> => {
        mockUserSession(PM_BUDI_USER);
        const before = fetched;
        const runs = await db.query.aiRun.findMany({ columns: { id: true } });
        process.env.AI_APPROVED_PROVIDERS = "";
        try {
          const response = await processReceipt(receiptUrl);
          expect(response.success).toBe(false);
          expect(fetched).toBe(before);
          expect((await db.query.aiRun.findMany({ columns: { id: true } })).length).toBe(
            runs.length,
          );
        } finally {
          process.env.AI_APPROVED_PROVIDERS = "NINEROUTER";
        }
      }),
    );
    it(
      "rejects arbitrary URLs before any fetch or AI run",
      withTestRequest(async (): Promise<void> => {
        mockUserSession(PM_BUDI_USER);
        const before = fetched;
        const runs = await db.query.aiRun.findMany({ columns: { id: true } });
        const response = await processReceipt("http://169.254.169.254/latest/meta-data/");
        expect(response.success).toBe(false);
        expect(fetched).toBe(before);
        expect((await db.query.aiRun.findMany({ columns: { id: true } })).length).toBe(runs.length);
      }),
    );
    it(
      "extracts a private receipt through the configured document boundary and persists ai_run",
      withTestRequest(async () => {
        mockUserSession(PM_BUDI_USER);

        const res = await processReceipt(receiptUrl);

        expect(res.success).toBe(true);
        if (!res.success) return;

        const data = res.data;
        expect(data.vendorName).toBe("TB Sinar Maju");
        expect(data.totalAmount).toBe(750000.0);
        expect(data.items.length).toBe(2);
        expect(data.items[0].itemName).toBe("Semen Tiga Roda 50kg");
        expect(lastDocumentRequest).toBeDefined();
        expect(lastDocumentRequest?.contents[0]).toMatchObject({
          inlineData: {
            mimeType: "image/jpeg",
            data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString("base64"),
          },
        });
        expect(lastDocumentRequest?.config?.responseJsonSchema).toMatchObject({ type: "object" });
        expect(lastDocumentRequest?.config?.abortSignal).toBeInstanceOf(AbortSignal);
        expect(lastDocumentRequest && "model" in lastDocumentRequest).toBe(false);

        // Verifikasi log disimpan ke database
        const runLog = await db.query.aiRun.findFirst({
          where: eq(aiRun.runType, "OCR_RECEIPT"),
          orderBy: (run, { desc }) => [desc(run.createdAt)],
        });

        expect(runLog).toBeDefined();
        expect(runLog!.status).toBe("COMPLETED");
        expect(runLog!.runById).toBe(PM_BUDI_USER.id);
        expect(runLog!.result).toContain("TB Sinar Maju");
        expect(runLog!.tokensUsed).toBe(150);
      }),
    );

    it(
      "harus menolak permintaan OCR jika sesi pengguna tidak valid",
      withTestRequest(async () => {
        mockUserSession(null);

        const res = await processReceipt(receiptUrl);
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("UNAUTHORIZED");
        }
      }),
    );

    it(
      "harus menolak hasil OCR yang tidak sesuai schema Zod dan menyimpan status FAILED",
      withTestRequest(async () => {
        mockUserSession(PM_BUDI_USER);

        documentModel.models.generateContent = async (): Promise<DocumentContentResponse> => {
          return {
            text: JSON.stringify({
              vendorName: "",
              transactionDate: "bukan-tanggal-iso",
              totalAmount: -1,
              items: [],
            }),
            usageMetadata: {
              totalTokenCount: 42,
            },
          };
        };

        try {
          const res = await processReceipt(receiptUrl);
          expect(res.success).toBe(false);
          if (!res.success) {
            expect(res.error.code).toBe("VALIDATION_ERROR");
          }

          const runLog = await db.query.aiRun.findFirst({
            where: eq(aiRun.runType, "OCR_RECEIPT"),
            orderBy: (run, { desc }) => [desc(run.createdAt)],
          });

          expect(runLog).toBeDefined();
          expect(runLog!.status).toBe("FAILED");
        } finally {
          documentModel.models.generateContent = mockGenerateContent;
        }
      }),
    );
    it(
      "rejects malformed model JSON and records FAILED without returning raw content",
      withTestRequest(async (): Promise<void> => {
        mockUserSession(PM_BUDI_USER);
        documentModel.models.generateContent = async (): Promise<DocumentContentResponse> => ({
          text: "{synthetic-invalid-json",
        });
        try {
          const result = await processReceipt(receiptUrl);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.code).toBe("VALIDATION_ERROR");
            expect(result.error.message).not.toContain("synthetic-invalid-json");
            expect(result.error.message).not.toContain("Gemini");
          }
          const run = await db.query.aiRun.findFirst({
            where: eq(aiRun.runType, "OCR_RECEIPT"),
            orderBy: (row, { desc }) => [desc(row.createdAt)],
          });
          expect(run?.status).toBe("FAILED");
        } finally {
          documentModel.models.generateContent = mockGenerateContent;
        }
      }),
    );
  });
});
