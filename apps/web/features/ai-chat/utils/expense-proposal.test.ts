import { readExpenseProposal } from "@/features/ai-chat/utils/expense-proposal";
import { describe, expect, it } from "bun:test";

const money = (amount: number) => ({ amount, formatted: `Rp ${amount}` });

const validOutput = {
  proposal: {
    projectId: "77777777-7777-7777-7777-777777777772",
    projectName: "Sudirman Suites",
    projectBudgetCategoryId: "88888888-8888-8888-8888-888888888881",
    categoryCode: "MATERIAL",
    categoryName: "Material",
    description: "Beli cat tembok 5 kaleng",
    quantity: 5,
    unitPrice: money(150000),
    amount: money(750000),
    remainingBeforeSubmit: money(343000000),
    exceedsRemaining: false,
  },
};

describe("pembacaan usulan pengeluaran dari keluaran tool", () => {
  it("menerima usulan yang lengkap", () => {
    const proposal = readExpenseProposal(validOutput);
    expect(proposal?.projectName).toBe("Sudirman Suites");
    expect(proposal?.amount.amount).toBe(750000);
  });

  it("menolak keluaran penolakan akses, sehingga kartu tidak dirender", () => {
    expect(
      readExpenseProposal({ error: "Proyek tidak ditemukan atau di luar akses Anda." }),
    ).toBeNull();
  });

  it("menolak usulan tanpa id kategori budget", () => {
    const output = {
      proposal: { ...validOutput.proposal, projectBudgetCategoryId: "" },
    };
    expect(readExpenseProposal(output)).toBeNull();
  });

  it("menolak nominal nol atau negatif", () => {
    expect(
      readExpenseProposal({ proposal: { ...validOutput.proposal, amount: money(0) } }),
    ).toBeNull();
    expect(
      readExpenseProposal({ proposal: { ...validOutput.proposal, amount: money(-5000) } }),
    ).toBeNull();
  });

  it("menolak kuantitas nol", () => {
    expect(readExpenseProposal({ proposal: { ...validOutput.proposal, quantity: 0 } })).toBeNull();
  });

  it("menolak nilai uang yang bukan objek uang", () => {
    expect(
      readExpenseProposal({ proposal: { ...validOutput.proposal, unitPrice: 150000 } }),
    ).toBeNull();
  });

  it("menolak masukan yang bukan objek", () => {
    expect(readExpenseProposal(null)).toBeNull();
    expect(readExpenseProposal("proposal")).toBeNull();
    expect(readExpenseProposal(undefined)).toBeNull();
  });

  it("mempertahankan penanda pelampauan sisa budget", () => {
    const output = {
      proposal: { ...validOutput.proposal, exceedsRemaining: true },
    };
    expect(readExpenseProposal(output)?.exceedsRemaining).toBe(true);
  });
});
