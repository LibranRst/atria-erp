import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BankBalancesResult } from "./bank-balances-result";
import { ProjectBudgetResult, selectVisibleCategories } from "./project-budget-result";
import { UpcomingBillsResult } from "./upcoming-bills-result";
import {
  hasToolResultRenderer,
  registeredToolNames,
  resolveToolResultRenderer,
  selectVisibleCards,
} from "./index";
import { TOOLS_WITH_CARDS } from "@/lib/ai/tool-output";

const money = (amount: number) => ({ amount, formatted: `Rp ${amount.toLocaleString("id-ID")}` });

const budgetOutput = {
  projectId: "77777777-7777-7777-7777-777777777772",
  projectName: "Sudirman Suites",
  budgetStatus: "APPROVED",
  internalBudget: money(1_080_000_000),
  contractValue: money(1_200_000_000),
  projectProgressPercentage: 35,
  categories: [
    {
      categoryName: "Tukang",
      categoryCode: "TUKANG",
      allocated: money(194_400_000),
      actual: money(0),
      pending: money(0),
      remaining: money(194_400_000),
      usedPercentage: 0,
      status: "SAFE",
    },
    {
      categoryName: "Material",
      categoryCode: "MATERIAL",
      allocated: money(378_000_000),
      actual: money(511_000_000),
      pending: money(0),
      remaining: money(-133_000_000),
      usedPercentage: 135,
      status: "OVER_BUDGET",
    },
  ],
};

describe("kartu budget per kategori", () => {
  test("menaikkan kategori yang lewat budget ke baris pertama", () => {
    // Pertanyaan yang memunculkan kartu ini hampir selalu "mana yang bermasalah",
    // jadi jawabannya tidak boleh tersembunyi di bawah kategori yang aman.
    const html = renderToStaticMarkup(<ProjectBudgetResult output={budgetOutput} />);

    expect(html.indexOf("Material")).toBeLessThan(html.indexOf("Tukang"));
  });

  test("menerjemahkan status mentah menjadi label Indonesia", () => {
    const html = renderToStaticMarkup(<ProjectBudgetResult output={budgetOutput} />);

    expect(html).toContain("Lewat budget");
    expect(html).toContain("Aman");
    expect(html).not.toContain("OVER_BUDGET");
  });

  test("menautkan ke budget proyek ketika id tersedia", () => {
    const html = renderToStaticMarkup(<ProjectBudgetResult output={budgetOutput} />);

    expect(html).toContain("/projects/77777777-7777-7777-7777-777777777772?tab=budget");
  });

  test("tetap merender tanpa tautan untuk pesan lama yang belum menyimpan id", () => {
    const legacy: Partial<typeof budgetOutput> = { ...budgetOutput };
    delete legacy.projectId;
    const html = renderToStaticMarkup(<ProjectBudgetResult output={legacy} />);

    expect(html).toContain("Material");
    expect(html).not.toContain("Buka budget proyek");
  });

  test("tidak merender apa-apa untuk keluaran yang bentuknya tidak cocok", () => {
    expect(renderToStaticMarkup(<ProjectBudgetResult output={{ error: "ditolak" }} />)).toBe("");
    expect(renderToStaticMarkup(<ProjectBudgetResult output={null} />)).toBe("");
  });
});

describe("pemilihan kategori yang ditampilkan", () => {
  const category = (name: string, status: string, usedPercentage: number, actual = 1_000_000) => ({
    categoryName: name,
    categoryCode: name.toUpperCase(),
    allocated: money(100_000_000),
    actual: money(actual),
    pending: money(0),
    remaining: money(100_000_000 - actual),
    usedPercentage,
    status,
  });

  test("selalu menampilkan seluruh kategori bermasalah", () => {
    const { shown, hidden } = selectVisibleCategories([
      category("Material", "OVER_BUDGET", 135),
      category("Tukang", "CRITICAL", 98),
      category("Operasional", "WATCH", 82),
      category("Lain-lain", "SAFE", 5),
      category("Subcon", "SAFE", 0, 0),
    ]);

    expect(shown.map((row) => row.categoryName).slice(0, 3)).toEqual([
      "Material",
      "Tukang",
      "Operasional",
    ]);
    expect(hidden).toHaveLength(0);
  });

  test("menyembunyikan kategori aman melebihi dua baris konteks", () => {
    const { shown, hidden } = selectVisibleCategories([
      category("Material", "OVER_BUDGET", 135),
      category("Lain-lain", "SAFE", 76),
      category("Operasional", "SAFE", 15),
      category("Tukang", "SAFE", 0, 0),
      category("Subcon", "SAFE", 0, 0),
    ]);

    expect(shown.map((row) => row.categoryName)).toEqual(["Material", "Lain-lain", "Operasional"]);
    expect(hidden.map((row) => row.categoryName)).toEqual(["Tukang", "Subcon"]);
  });

  test("memperlakukan sisa negatif sebagai bermasalah walau statusnya belum menyusul", () => {
    const overspent = { ...category("Material", "SAFE", 120), remaining: money(-5_000_000) };
    const { shown } = selectVisibleCategories([
      category("Tukang", "SAFE", 10),
      overspent,
      category("Operasional", "SAFE", 5),
      category("Subcon", "SAFE", 0, 0),
    ]);

    expect(shown[0].categoryName).toBe("Material");
  });

  test("tetap memberi konteks ketika semua kategori aman", () => {
    const { shown, hidden } = selectVisibleCategories([
      category("Material", "SAFE", 40),
      category("Tukang", "SAFE", 20),
      category("Operasional", "SAFE", 5),
    ]);

    expect(shown.map((row) => row.categoryName)).toEqual(["Material", "Tukang"]);
    expect(hidden).toHaveLength(1);
  });
});

describe("kartu saldo rekening", () => {
  const output = {
    totalAvailable: money(1_048_650_000),
    accounts: [
      { accountName: "Operasional", bankName: "BCA", balance: money(800_000_000) },
      { accountName: "Payroll", bankName: "Mandiri", balance: money(248_650_000) },
    ],
  };

  test("menampilkan total dan setiap rekening", () => {
    const html = renderToStaticMarkup(<BankBalancesResult output={output} />);

    expect(html).toContain("Operasional");
    expect(html).toContain("Mandiri");
    expect(html).toContain("/ledger?tab=cash");
  });

  test("tidak merender kartu kosong ketika tidak ada rekening", () => {
    const html = renderToStaticMarkup(
      <BankBalancesResult output={{ totalAvailable: money(0), accounts: [] }} />,
    );

    expect(html).toBe("");
  });
});

describe("kartu tagihan jatuh tempo", () => {
  const output = {
    horizonDays: 30,
    totalOutstanding: money(61_000_000),
    bills: [
      {
        billNumber: "INV-2",
        vendorName: "Vendor Kayu",
        projectName: "Menteng Villa",
        amount: money(20_000_000),
        status: "UNPAID",
        dueInDays: 12,
        timing: "UPCOMING" as const,
      },
      {
        billNumber: "INV-1",
        vendorName: "Vendor Cat",
        projectName: "Sudirman Suites",
        amount: money(41_000_000),
        status: "OVERDUE",
        dueInDays: -5,
        timing: "OVERDUE" as const,
      },
    ],
  };

  test("menaikkan tagihan yang sudah telat ke atas", () => {
    const html = renderToStaticMarkup(<UpcomingBillsResult output={output} />);

    expect(html.indexOf("Vendor Cat")).toBeLessThan(html.indexOf("Vendor Kayu"));
  });

  test("menulis keterlambatan sebagai hari, bukan angka negatif", () => {
    const html = renderToStaticMarkup(<UpcomingBillsResult output={output} />);

    expect(html).toContain("Telat 5 hari");
    expect(html).not.toContain("-5 hari");
  });
});

describe("registry renderer", () => {
  test("mengenali tool yang punya kartu", () => {
    expect(hasToolResultRenderer("getProjectBudget")).toBe(true);
    expect(resolveToolResultRenderer("getBankBalances")).not.toBeNull();
  });

  test("mengembalikan null untuk tool tanpa kartu, sehingga chat tetap aman", () => {
    // proposeExpenseDraft punya kartunya sendiri yang dirender terpisah oleh
    // ChatMessage, karena ia butuh state konfirmasi yang tidak dimiliki renderer
    // biasa. Ia sengaja tidak ada di registry ini.
    expect(resolveToolResultRenderer("proposeExpenseDraft")).toBeNull();
    expect(resolveToolResultRenderer("toolYangBelumAda")).toBeNull();
  });

  test("daftar renderer sama persis dengan yang dijanjikan system prompt", () => {
    // System prompt menyebut nama tool ini kepada model dan memintanya tidak
    // menuliskan ulang isinya. Kalau daftarnya menyimpang, model akan diam soal
    // angka yang sebenarnya tidak pernah muncul sebagai kartu.
    expect([...registeredToolNames()].sort()).toEqual([...TOOLS_WITH_CARDS].sort());
  });
});

describe("pemulihan identitas kartu dari konteks balasan", () => {
  test("memakai nama proyek dari daftar proyek ketika keluaran tool tidak membawanya", () => {
    // Ini kasus pesan lama: getProjectBudget tersimpan tanpa projectName, tetapi
    // argumen tool dan keluaran listProjects di balasan yang sama masih ada.
    const legacy: Partial<typeof budgetOutput> = { ...budgetOutput };
    delete legacy.projectId;
    delete legacy.projectName;

    const html = renderToStaticMarkup(
      <ProjectBudgetResult
        output={legacy}
        context={{
          projectNames: { "77777777-7777-7777-7777-777777777772": "Menteng Villa" },
          projectId: "77777777-7777-7777-7777-777777777772",
        }}
      />,
    );

    expect(html).toContain("Menteng Villa");
    expect(html).not.toContain("Budget proyek");
    expect(html).toContain("/projects/77777777-7777-7777-7777-777777777772?tab=budget");
  });

  test("jatuh ke judul umum ketika namanya benar-benar tidak diketahui", () => {
    const legacy: Partial<typeof budgetOutput> = { ...budgetOutput };
    delete legacy.projectId;
    delete legacy.projectName;

    const html = renderToStaticMarkup(<ProjectBudgetResult output={legacy} />);

    expect(html).toContain("Budget proyek");
  });
});

describe("penyaringan kartu pencarian", () => {
  test("menyembunyikan daftar proyek ketika ada kartu yang lebih spesifik", () => {
    // Pertanyaan "sisa budget proyek Sudirman" memicu listProjects hanya untuk
    // mencari id-nya. Menampilkan tujuh proyek di atas jawaban mengubur jawabannya.
    const visible = selectVisibleCards([
      { toolName: "listProjects" },
      { toolName: "getProjectBudget" },
    ]);

    expect(visible.map((card) => card.toolName)).toEqual(["getProjectBudget"]);
  });

  test("menyembunyikan daftar kategori saat menyiapkan usulan pengeluaran", () => {
    const visible = selectVisibleCards([
      { toolName: "listProjects" },
      { toolName: "getExpenseCategories" },
      { toolName: "proposeExpenseDraft" },
    ]);

    expect(visible.map((card) => card.toolName)).toEqual(["proposeExpenseDraft"]);
  });

  test("tetap menampilkan daftar proyek ketika daftar itu memang jawabannya", () => {
    const visible = selectVisibleCards([{ toolName: "listProjects" }]);

    expect(visible.map((card) => card.toolName)).toEqual(["listProjects"]);
  });

  test("mempertahankan urutan kartu spesifik", () => {
    const visible = selectVisibleCards([
      { toolName: "listProjects" },
      { toolName: "getProjectHealth" },
      { toolName: "getMaterialShortage" },
    ]);

    expect(visible.map((card) => card.toolName)).toEqual([
      "getProjectHealth",
      "getMaterialShortage",
    ]);
  });

  test("mengembalikan daftar kosong untuk balasan tanpa kartu", () => {
    expect(selectVisibleCards([])).toEqual([]);
  });
});
