import { db } from "@/db";
import { aiRun } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { geminiClient, GEMINI_OCR_MODEL } from "@/lib/ai/gemini";
import { processReceipt } from "@/app/actions/ai/process-receipt";
import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { describeIntegration } from "@/lib/testing/integration-db";

// Mock next/headers
mock.module("next/headers", () => {
  return {
    cookies: () => {
      return {
        toString: () => "mocked-cookies",
      };
    },
  };
});

// Simpan method original
const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;
const originalGenerateContent = geminiClient.models.generateContent;
const originalFetch = global.fetch;

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

type GeminiMockArgs = {
  model: string;
  contents: unknown;
};

async function mockGenerateContent(args: unknown): Promise<{
  text: string;
  usageMetadata: {
    totalTokenCount: number;
  };
}> {
  const { model, contents } = args as GeminiMockArgs;
  if (model === GEMINI_OCR_MODEL) {
    const isOCR =
      Array.isArray(contents) &&
      contents.some((contentPart: unknown) => {
        return (
          typeof contentPart === "object" && contentPart !== null && "inlineData" in contentPart
        );
      });
    if (isOCR) {
      return {
        text: JSON.stringify({
          vendorName: "TB Sinar Maju",
          transactionDate: "2026-06-10T00:00:00.000Z",
          subtotal: 750000.0,
          tax: 0.0,
          totalAmount: 750000.0,
          items: [
            {
              itemName: "Semen Tiga Roda 50kg",
              quantity: 10,
              unitPrice: 72000.0,
              totalPrice: 720000.0,
            },
            {
              itemName: "Paku Kayu 3 Inch",
              quantity: 2,
              unitPrice: 15000.0,
              totalPrice: 30000.0,
            },
          ],
        }),
        usageMetadata: {
          totalTokenCount: 150,
        },
      };
    }

    throw new Error(`Unexpected non-OCR Gemini call: ${String(contents)}`);
  }

  throw new Error(`Model ${model} tidak dikenali dalam test mock.`);
}

describeIntegration("Atria ERP AI Layer Integration - TSK-009", () => {
  beforeAll(() => {
    // Mock global fetch
    global.fetch = (async (url: string) => {
      if (url === "https://example.com/receipt.jpg") {
        return {
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(8),
          headers: {
            get: (name: string) => (name.toLowerCase() === "content-type" ? "image/jpeg" : null),
          },
        } as unknown as Response;
      }
      return originalFetch(url);
    }) as unknown as typeof fetch;

    // Mock Gemini API generateContent
    (geminiClient.models as unknown as { generateContent: unknown }).generateContent =
      mockGenerateContent;
  });

  afterAll(() => {
    restoreUserSession();
    geminiClient.models.generateContent = originalGenerateContent;
    global.fetch = originalFetch;
  });

  describe("OCR Receipt Parser Action", () => {
    it("harus mengekstrak struk belanja secara asinkron menggunakan Gemini 3 Flash Preview dan menyimpan log di tabel ai_run", async () => {
      mockUserSession(PM_BUDI_USER);

      const res = await processReceipt("https://example.com/receipt.jpg");

      expect(res.success).toBe(true);
      if (!res.success) return;

      const data = res.data;
      expect(data.vendorName).toBe("TB Sinar Maju");
      expect(data.totalAmount).toBe(750000.0);
      expect(data.items.length).toBe(2);
      expect(data.items[0].itemName).toBe("Semen Tiga Roda 50kg");

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
    });

    it("harus menolak permintaan OCR jika sesi pengguna tidak valid", async () => {
      mockUserSession(null);

      const res = await processReceipt("https://example.com/receipt.jpg");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("harus menolak hasil OCR yang tidak sesuai schema Zod dan menyimpan status FAILED", async () => {
      mockUserSession(PM_BUDI_USER);

      (geminiClient.models as unknown as { generateContent: unknown }).generateContent =
        async () => {
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
        const res = await processReceipt("https://example.com/receipt.jpg");
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
        (geminiClient.models as unknown as { generateContent: unknown }).generateContent =
          mockGenerateContent;
      }
    });
  });
});
