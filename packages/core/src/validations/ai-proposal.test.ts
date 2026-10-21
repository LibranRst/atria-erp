import {
  aiCreateProjectProposalSchema,
  aiCreateUserBatchProposalSchema,
  aiCreateUserProposalSchema,
  aiExpenseProposalSchema,
  aiExpenseReviewProposalSchema,
  aiGoodsReceiptProposalSchema,
  aiPayVendorBillProposalSchema,
  aiRecordClientPaymentProposalSchema,
  aiSetupBudgetProposalSchema,
} from "./ai-proposal";
import { describe, expect, it } from "bun:test";

const base = {
  toolCallId: "call_abc123",
  conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  projectId: "77777777-7777-7777-7777-777777777772",
  projectBudgetCategoryId: "88888888-8888-8888-8888-888888888881",
  description: "Beli cat tembok 5 kaleng",
  quantity: 5,
  unitPrice: 150000,
  amount: 750000,
};

describe("validasi konfirmasi usulan pengeluaran AI", () => {
  it("menerima usulan yang lengkap dan wajar", () => {
    expect(aiExpenseProposalSchema.safeParse(base).success).toBe(true);
  });

  it("menerima uuid gaya seed yang bukan RFC 4122", () => {
    const result = aiExpenseProposalSchema.safeParse({
      ...base,
      projectId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("mewajibkan identitas kartu usulan sebagai kunci idempotensi", () => {
    expect(aiExpenseProposalSchema.safeParse({ ...base, toolCallId: "" }).success).toBe(false);
    const withoutToolCallId = { ...base } as Partial<typeof base>;
    delete withoutToolCallId.toolCallId;
    expect(aiExpenseProposalSchema.safeParse(withoutToolCallId).success).toBe(false);
  });

  it("mewajibkan id percakapan agar konfirmasi bisa diikat ke pemiliknya", () => {
    expect(
      aiExpenseProposalSchema.safeParse({ ...base, conversationId: "bukan-uuid" }).success,
    ).toBe(false);
  });

  it("menolak nominal nol atau negatif", () => {
    expect(aiExpenseProposalSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(aiExpenseProposalSchema.safeParse({ ...base, amount: -1000 }).success).toBe(false);
  });

  it("menolak kuantitas nol", () => {
    expect(aiExpenseProposalSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
  });

  it("menolak deskripsi yang terlalu pendek untuk jadi jejak audit", () => {
    expect(aiExpenseProposalSchema.safeParse({ ...base, description: "cat" }).success).toBe(false);
  });

  it("menolak id yang bukan uuid", () => {
    expect(
      aiExpenseProposalSchema.safeParse({ ...base, projectBudgetCategoryId: "kategori-material" })
        .success,
    ).toBe(false);
  });

  it("mengabaikan bidang tambahan yang diselundupkan, termasuk penanganan stok", () => {
    const result = aiExpenseProposalSchema.safeParse({
      ...base,
      stockHandling: "RESERVE_AND_USE",
      materialId: "99999999-9999-9999-9999-999999999999",
    });

    expect(result.success).toBe(true);
    expect(result.success && "stockHandling" in result.data).toBe(false);
    expect(result.success && "materialId" in result.data).toBe(false);
  });
});

describe("validasi konfirmasi usulan aksi ERP lainnya", () => {
  it("validasi review pengeluaran (approve/reject)", () => {
    const valid = {
      toolCallId: "call_rev1",
      conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      expenseId: "77777777-7777-7777-7777-777777777772",
      action: "APPROVE",
      notes: "Sesuai anggaran",
    };
    expect(aiExpenseReviewProposalSchema.safeParse(valid).success).toBe(true);
    expect(aiExpenseReviewProposalSchema.safeParse({ ...valid, action: "INVALID" }).success).toBe(
      false,
    );
  });

  it("validasi usulan pembuatan proyek baru", () => {
    const valid = {
      toolCallId: "call_proj1",
      conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Renovasi Apartemen Menteng",
      clientId: "66666666-6666-6666-6666-666666666661",
      projectManagerId: "22222222-2222-2222-2222-222222222222",
      totalContractValue: 250000000,
      location: "Jakarta Pusat",
    };
    expect(aiCreateProjectProposalSchema.safeParse(valid).success).toBe(true);
    expect(aiCreateProjectProposalSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("validasi usulan setup budget proyek", () => {
    const valid = {
      toolCallId: "call_bud1",
      conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      projectId: "77777777-7777-7777-7777-777777777772",
      contractValue: 250000000,
      budgetCapRatio: 0.85,
      categories: [
        {
          expenseCategoryId: "88888888-8888-8888-8888-888888888881",
          ratioPercentage: 0.45,
          sortOrder: 1,
        },
        {
          expenseCategoryId: "88888888-8888-8888-8888-888888888882",
          ratioPercentage: 0.35,
          sortOrder: 2,
        },
      ],
    };
    expect(aiSetupBudgetProposalSchema.safeParse(valid).success).toBe(true);
    expect(aiSetupBudgetProposalSchema.safeParse({ ...valid, categories: [] }).success).toBe(false);
  });

  it("validasi usulan pembayaran tagihan vendor", () => {
    const valid = {
      toolCallId: "call_pay1",
      conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      vendorPaymentId: "55555555-5555-5555-5555-555555555551",
      bankAccountId: "44444444-4444-4444-4444-444444444441",
      referenceNumber: "TRF-VEND-001",
      amountPaid: 15000000,
    };
    expect(aiPayVendorBillProposalSchema.safeParse(valid).success).toBe(true);
    expect(aiPayVendorBillProposalSchema.safeParse({ ...valid, amountPaid: 0 }).success).toBe(
      false,
    );
  });

  it("validasi usulan pencatatan pembayaran klien", () => {
    const valid = {
      toolCallId: "call_rec1",
      conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      clientInvoiceId: "33333333-3333-3333-3333-333333333331",
      bankAccountId: "44444444-4444-4444-4444-444444444441",
      amountPaid: 50000000,
      paymentDate: "2026-08-19",
      referenceNumber: "BCA-IN-9921",
    };
    expect(aiRecordClientPaymentProposalSchema.safeParse(valid).success).toBe(true);
    expect(
      aiRecordClientPaymentProposalSchema.safeParse({ ...valid, referenceNumber: "" }).success,
    ).toBe(false);
  });

  it("validasi usulan goods receipt", () => {
    const valid = {
      toolCallId: "call_gr1",
      conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      projectId: "77777777-7777-7777-7777-777777777772",
      inventoryLocationId: "99999999-9999-9999-9999-999999999991",
      receiptNumber: "GR-2026-08-001",
      receivedAt: "2026-08-19",
      items: [
        {
          materialId: "11111111-2222-3333-4444-555555555555",
          quantity: 20,
          unitCost: 85000,
        },
      ],
    };
    expect(aiGoodsReceiptProposalSchema.safeParse(valid).success).toBe(true);
    expect(aiGoodsReceiptProposalSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it("validasi usulan pembuatan pengguna baru (aiCreateUserProposalSchema)", () => {
    const valid = {
      toolCallId: "call_usr1",
      conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Budi Santoso",
      email: "budi@dekoria.com",
      roleId: "33333333-3333-3333-3333-333333333333",
      temporaryPassword: "Dekoria-2026-Xk9mQz",
    };
    expect(aiCreateUserProposalSchema.safeParse(valid).success).toBe(true);
    expect(aiCreateUserProposalSchema.safeParse({ ...valid, email: "bukan-email" }).success).toBe(
      false,
    );
    expect(aiCreateUserProposalSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
    expect(
      aiCreateUserProposalSchema.safeParse({ ...valid, temporaryPassword: "pendek" }).success,
    ).toBe(false);
    expect(aiCreateUserProposalSchema.safeParse({ ...valid, roleId: "bukan-uuid" }).success).toBe(
      false,
    );
    expect(aiCreateUserProposalSchema.safeParse({ ...valid, toolCallId: "" }).success).toBe(false);
  });

  it("validasi usulan pembuatan pengguna sekaligus (aiCreateUserBatchProposalSchema)", () => {
    const valid = {
      toolCallId: "call_batch1",
      conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      users: [
        {
          name: "Budi Santoso",
          email: "budi@dekoria.com",
          roleId: "33333333-3333-3333-3333-333333333333",
          temporaryPassword: "Dekoria-2026-Xk9mQz",
        },
        {
          name: "Siti Rahma",
          email: "siti@dekoria.com",
          roleId: "44444444-4444-4444-4444-444444444444",
          temporaryPassword: "Dekoria-2026-Ab12Cd",
        },
      ],
    };
    expect(aiCreateUserBatchProposalSchema.safeParse(valid).success).toBe(true);
    expect(aiCreateUserBatchProposalSchema.safeParse({ ...valid, users: [] }).success).toBe(false);
    expect(
      aiCreateUserBatchProposalSchema.safeParse({
        ...valid,
        users: [{ ...valid.users[0]!, email: "bukan-email" }],
      }).success,
    ).toBe(false);
  });
});
