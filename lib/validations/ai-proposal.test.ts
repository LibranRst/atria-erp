import { aiExpenseProposalSchema } from "@/lib/validations/ai-proposal";
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
    // Data seed dan demo memakai id seperti ini; validasi ketat akan menolak
    // baris yang benar-benar ada di database.
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
    // Jalur AI tidak boleh memicu efek samping stok.
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
