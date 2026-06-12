import { db } from "@/db";
import { bankAccount, clientInvoice, vendorBill, project, approval, aiRun, user } from "@/db/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { ai } from "@/lib/ai/gemini";
import { Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // 1. Otorisasi Token Cron Secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "local-cron-token";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Token otorisasi tidak valid." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Kumpulkan Konteks Finansial (Read-Only)
    // 2.1 Saldo Kas Total Rekening Bank
    const bankAccountsList = await db.query.bankAccount.findMany();
    const totalCashBalance = bankAccountsList.reduce((sum, acc) => sum + Number(acc.balance), 0);

    // 2.2 Piutang Aktif Klien
    const unpaidInvoicesList = await db.query.clientInvoice.findMany({
      where: inArray(clientInvoice.status, ["UNPAID", "PARTIALLY_PAID"]),
    });
    const totalReceivables = unpaidInvoicesList.reduce((sum, inv) => sum + Number(inv.amount), 0);

    // 2.3 Hutang Vendor jatuh tempo dalam 7 hari ke depan
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const upcomingVendorBillsList = await db.query.vendorBill.findMany({
      where: and(
        inArray(vendorBill.status, ["UNPAID", "PARTIALLY_PAID"]),
        lte(vendorBill.dueDate, sevenDaysFromNow)
      ),
    });
    const payablesDueSevenDays = upcomingVendorBillsList.reduce((sum, bill) => sum + Number(bill.amount), 0);

    // 2.4 Proyek Aktif
    const activeProjectsList = await db.query.project.findMany({
      where: eq(project.status, "ACTIVE"),
    });
    const activeProjectsCount = activeProjectsList.length;

    // 2.5 Persetujuan pending Owner
    const pendingApprovalsList = await db.query.approval.findMany({
      where: eq(approval.status, "PENDING"),
    });
    const pendingActionsCount = pendingApprovalsList.length;

    // 2.6 Kueri PM Field Claims pending
    const pendingCosts = await db.query.projectCost.findMany({
      where: inArray(projectCost.status, ["SUBMITTED", "VERIFIED"]),
    });

    // 2.7 Cari ID Owner untuk pencatatan di ai_run
    const ownerUser = await db.query.user.findFirst({
      where: eq(user.roleId, "00000000-0000-0000-0000-000000000001"), // OWNER role UUID
    });

    if (!ownerUser) {
      return new Response(
        JSON.stringify({ error: "Owner user not found in database." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const payloadObj = {
      totalCashBalance,
      totalReceivables,
      payablesDueSevenDays,
      activeProjectsCount,
      pendingActionsCount,
      pendingCostsCount: pendingCosts.length,
      timestamp: new Date().toISOString(),
    };

    // 3. Catat status awal RUNNING ke tabel ai_run
    const [runLog] = await db
      .insert(aiRun)
      .values({
        runType: "FINANCIAL_BRIEFING",
        runById: ownerUser.id,
        status: "PROCESSING",
        payload: JSON.stringify(payloadObj),
        createdAt: new Date(),
      })
      .returning();

    // 4. Panggil Gemini 3 Flash Preview untuk menganalisis dan menghasilkan narasi CFO briefing
    try {
      const prompt = `
Role: Senior CFO AI Assistant
Task: Buat daily briefing finansial ringkas, profesional, dan berorientasi tindakan dalam Bahasa Indonesia untuk Pemilik Perusahaan (Owner).

Konteks Finansial Perusahaan:
- Total Kas (Seluruh Rekening): Rp ${totalCashBalance.toLocaleString("id-ID")}
- Total Piutang Klien (Aktif): Rp ${totalReceivables.toLocaleString("id-ID")}
- Hutang Vendor Jatuh Tempo (7 Hari Ke Depan): Rp ${payablesDueSevenDays.toLocaleString("id-ID")}
- Jumlah Proyek Aktif: ${activeProjectsCount}
- Antrean Persetujuan (Pending Approvals): ${pendingActionsCount} pengajuan.
- Rincian Pengajuan Biaya Lapangan PM Lapangan: ${JSON.stringify(
        pendingCosts.map((c) => ({ id: c.id, amount: Number(c.amount), description: c.description }))
      )}

Rules:
- Selalu tampilkan angka moneter dalam format Rupiah (IDR) pada narasi ringkasan.
- Kelompokkan laporan menjadi tiga bagian pada ringkasan 'summary': (1) Status Kas & Likuiditas, (2) Pengingat Pembayaran Penting (Hutang/Piutang), dan (3) Tindakan Penting yang Membutuhkan Otorisasi Hari Ini.
- Hindari jargon teknis AI. Fokus pada metrik bisnis dan manajemen risiko.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: Type.OBJECT,
            properties: {
              briefingDate: { type: Type.STRING },
              summary: { type: Type.STRING, description: "Naratif lengkap analisis CFO briefing harian dalam Bahasa Indonesia." },
              metrics: {
                type: Type.OBJECT,
                properties: {
                  cashBalance: { type: Type.NUMBER },
                  receivablesOverdue: { type: Type.NUMBER },
                  payablesDueSevenDays: { type: Type.NUMBER },
                },
                required: ["cashBalance", "receivablesOverdue", "payablesDueSevenDays"],
              },
              alerts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    projectId: { type: Type.STRING },
                    projectName: { type: Type.STRING },
                    severity: { type: Type.STRING, description: "WARNING atau CRITICAL" },
                    message: { type: Type.STRING },
                  },
                  required: ["severity", "message"],
                },
              },
              pendingActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING },
                    referenceId: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                  required: ["actionType", "description"],
                },
              },
            },
            required: ["briefingDate", "summary", "metrics", "alerts", "pendingActions"],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error("Model Gemini Pro mengembalikan respons kosong.");
      }

      // 5. Simpan briefing hasil analisis ke tabel ai_run
      await db
        .update(aiRun)
        .set({
          status: "COMPLETED",
          result: rawText,
          tokensUsed: response.usageMetadata?.totalTokenCount || 0,
        })
        .where(eq(aiRun.id, runLog.id));

      return new Response(rawText, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (genError: any) {
      await db
        .update(aiRun)
        .set({
          status: "FAILED",
          errorMessage: genError.message || "Gagal memanggil API Gemini.",
        })
        .where(eq(aiRun.id, runLog.id));

      throw genError;
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Gagal menjalankan briefing finansial harian." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Import tambahan untuk skema query relations
import { projectCost } from "@/db/schema";
