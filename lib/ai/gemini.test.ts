import { db } from "@/db";
import { aiRun, user, bankAccount, clientInvoice, vendorBill } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { ai } from "@/lib/ai/gemini";
import { processReceipt } from "@/app/actions/ai/process-receipt";
import { POST as dailyBriefingCron } from "@/app/api/cron/daily-briefing/route";
import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { NextRequest } from "next/server";

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
const originalGenerateContent = ai.models.generateContent;
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
const OWNER_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};

const PM_BUDI_USER = {
  id: "33333333-3333-3333-3333-333333333331",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "budi@dekoria.com",
  name: "Budi Santoso",
};

describe("Atria ERP AI Layer Integration - TSK-009", () => {
  beforeAll(() => {
    // Mock global fetch
    global.fetch = (async (url: string) => {
      if (url === "https://example.com/receipt.jpg") {
        return {
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(8),
          headers: {
            get: (name: string) => name.toLowerCase() === "content-type" ? "image/jpeg" : null,
          },
        } as unknown as Response;
      }
      return originalFetch(url);
    }) as unknown as typeof fetch;

    // Mock Gemini API generateContent
    (ai.models as unknown as { generateContent: unknown }).generateContent = async (args: unknown) => {
      const model = (args as { model: string }).model;
      if (model === "gemini-3-flash-preview") {
        const contents = (args as { contents: any }).contents;
        const isOCR = Array.isArray(contents) && contents.some((c: any) => typeof c === 'object' && c.inlineData);
        if (isOCR) {
          // Mock OCR output
          return {
            text: JSON.stringify({
              vendorName: "TB Sinar Maju",
              transactionDate: "2026-06-10T00:00:00.000Z",
              subtotal: 750000.00,
              tax: 0.00,
              totalAmount: 750000.00,
              items: [
                {
                  itemName: "Semen Tiga Roda 50kg",
                  quantity: 10,
                  unitPrice: 72000.00,
                  totalPrice: 720000.00,
                },
                {
                  itemName: "Paku Kayu 3 Inch",
                  quantity: 2,
                  unitPrice: 15000.00,
                  totalPrice: 30000.00,
                },
              ],
            }),
            usageMetadata: {
              totalTokenCount: 150,
            },
          };
        } else {
          // Mock CFO briefing output
          return {
            text: JSON.stringify({
              briefingDate: "2026-06-11",
              summary: "Laporan CFO harian: Likuiditas kas aman terkendali dengan total kas di bank...",
              metrics: {
                cashBalance: 1250000000.00,
                receivablesOverdue: 150000000.00,
                payablesDueSevenDays: 45000000.00,
              },
              alerts: [
                {
                  projectId: "77777777-7777-7777-7777-777777777771",
                  projectName: "Apartemen Sudirman Suite",
                  severity: "WARNING",
                  message: "Penggunaan budget material mencapai 92%.",
                },
              ],
              pendingActions: [
                {
                  actionType: "APPROVE_COST_CLAIM",
                  referenceId: "88888888-8888-8888-8888-888888888881",
                  description: "Reimbursement PM Lapangan Rp 6.200.000",
                },
              ],
            }),
            usageMetadata: {
              totalTokenCount: 350,
            },
          };
        }
      }
      throw new Error(`Model ${model} tidak dikenali dalam test mock.`);
    };
  });

  afterAll(() => {
    restoreUserSession();
    ai.models.generateContent = originalGenerateContent;
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
      expect(data.totalAmount).toBe(750000.00);
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
  });

  describe("Daily CFO Briefing Cron Job", () => {
    it("harus menolak request cron jika authorization token tidak valid", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/daily-briefing", {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      const res = await dailyBriefingCron(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Unauthorized");
    });

    it("harus menghasilkan CFO briefing harian, menyimpan log di ai_run, dan mengembalikan data analisis", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/daily-briefing", {
        method: "POST",
        headers: {
          Authorization: "Bearer local-cron-token",
        },
      });

      const res = await dailyBriefingCron(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.briefingDate).toBe("2026-06-11");
      expect(json.metrics.cashBalance).toBe(1250000000.00);
      expect(json.alerts[0].projectName).toBe("Apartemen Sudirman Suite");

      // Verifikasi log disimpan ke database
      const runLog = await db.query.aiRun.findFirst({
        where: eq(aiRun.runType, "FINANCIAL_BRIEFING"),
        orderBy: (run, { desc }) => [desc(run.createdAt)],
      });

      expect(runLog).toBeDefined();
      expect(runLog!.status).toBe("COMPLETED");
      expect(runLog!.runById).toBe(OWNER_USER.id);
      expect(runLog!.tokensUsed).toBe(350);
    });
  });
});
