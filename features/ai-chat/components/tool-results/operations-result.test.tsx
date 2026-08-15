import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ExpenseCategoriesResult,
  MaterialShortageResult,
  PendingApprovalsResult,
  RecentExpensesResult,
} from "./operations-result";
import { ProjectHealthResult, ProjectsResult } from "./projects-result";

const money = (amount: number) => ({ amount, formatted: `Rp ${amount.toLocaleString("id-ID")}` });

describe("kartu daftar proyek", () => {
  const output = {
    projects: [
      {
        projectId: "p-sehat",
        name: "Senopati Office",
        clientName: "Budi Kencana",
        status: "ACTIVE",
        storedHealth: "HEALTHY",
        contractValue: money(500_000_000),
      },
      {
        projectId: "p-kritis",
        name: "Menteng Villa",
        clientName: "Adrian Hartanto",
        status: "ACTIVE",
        storedHealth: "CRITICAL",
        contractValue: money(700_000_000),
      },
    ],
  };

  test("menaikkan proyek bermasalah ke atas", () => {
    const html = renderToStaticMarkup(<ProjectsResult output={output} />);

    expect(html.indexOf("Menteng Villa")).toBeLessThan(html.indexOf("Senopati Office"));
  });

  test("menautkan tiap baris ke halaman proyeknya", () => {
    const html = renderToStaticMarkup(<ProjectsResult output={output} />);

    expect(html).toContain("/projects/p-kritis?tab=overview");
  });

  test("memberi label Indonesia pada kesehatan, bukan enum mentah", () => {
    const html = renderToStaticMarkup(<ProjectsResult output={output} />);

    expect(html).toContain("Kritis");
    expect(html).toContain("Sehat");
    expect(html).not.toContain("CRITICAL");
  });
});

describe("kartu kesehatan proyek", () => {
  test("menampilkan agregat dan alasan ketika budget tersusun", () => {
    const html = renderToStaticMarkup(
      <ProjectHealthResult
        output={{
          projectId: "p1",
          projectName: "Menteng Villa",
          health: "CRITICAL",
          reasons: ["Budget terlampaui", "Kategori kritis"],
          totalAllocated: money(252_000_000),
          totalActual: money(341_000_000),
          totalRemaining: money(-89_000_000),
          usedPercentage: 135,
        }}
      />,
    );

    expect(html).toContain("Budget terlampaui");
    expect(html).toContain("Alokasi");
    expect(html).toContain("/projects/p1?tab=overview");
  });

  test("tetap merender penilaian untuk proyek yang belum punya budget", () => {
    const html = renderToStaticMarkup(
      <ProjectHealthResult
        output={{
          projectName: "Brawijaya Residence",
          health: "HEALTHY",
          reasons: [],
          note: "Belum ada budget tersusun.",
        }}
      />,
    );

    expect(html).toContain("Belum ada budget tersusun.");
    expect(html).toContain("Sehat");
  });
});

describe("kartu antrean persetujuan", () => {
  const output = {
    totalWaiting: 3,
    approvals: [
      {
        projectName: "Senopati Office",
        description: "Pembelian kabel",
        amount: money(2_000_000),
        requestedBy: "Dimas",
        priority: "NORMAL" as const,
        priorityReason: "Nominal kecil",
        waitingDays: 1,
      },
      {
        projectName: "Menteng Villa",
        description: "Pembayaran subcon",
        amount: money(40_000_000),
        requestedBy: "Rina",
        priority: "CRITICAL" as const,
        priorityReason: "Melewati batas Owner",
        waitingDays: 5,
      },
    ],
  };

  test("menaikkan pengajuan kritis ke atas", () => {
    const html = renderToStaticMarkup(<PendingApprovalsResult output={output} />);

    expect(html.indexOf("Pembayaran subcon")).toBeLessThan(html.indexOf("Pembelian kabel"));
  });

  test("menulis lama menunggu dalam kalimat, bukan angka telanjang", () => {
    const html = renderToStaticMarkup(<PendingApprovalsResult output={output} />);

    expect(html).toContain("Menunggu 5 hari");
    expect(html).toContain("Menunggu 1 hari");
  });
});

describe("kartu kebutuhan material", () => {
  test("menyebut jumlah yang perlu dibeli beserta satuannya", () => {
    const html = renderToStaticMarkup(
      <MaterialShortageResult
        output={{
          projectId: "p1",
          rapStatus: "LOCKED",
          shortageCount: 1,
          estimatedTotalPurchaseCost: money(12_000_000),
          shortages: [
            {
              materialName: "Plywood 12mm",
              unit: "lembar",
              requiredQuantity: 40,
              securedQuantity: 10,
              needToBuyQuantity: 30,
              estimatedPurchaseCost: money(12_000_000),
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Plywood 12mm");
    expect(html).toContain("Perlu beli 30 lembar");
    expect(html).toContain("/materials");
  });

  test("tidak merender kartu ketika tidak ada kekurangan", () => {
    const html = renderToStaticMarkup(
      <MaterialShortageResult output={{ rapStatus: "LOCKED", shortages: [] }} />,
    );

    expect(html).toBe("");
  });
});

describe("kartu pengeluaran terakhir", () => {
  test("menerjemahkan status pengajuan ke label Indonesia", () => {
    const html = renderToStaticMarkup(
      <RecentExpensesResult
        output={{
          expenses: [
            {
              description: "Beli cat tembok",
              projectId: "p1",
              projectName: "Sudirman Suites",
              categoryName: "Material",
              amount: money(750_000),
              status: "SUBMITTED",
              paymentStatus: "UNPAID",
              expenseDate: "2026-08-14",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Beli cat tembok");
    expect(html).toContain("Diajukan");
    expect(html).not.toContain("SUBMITTED");
  });
});

describe("kartu kategori biaya", () => {
  test("menampilkan nama kategori sebagai chip", () => {
    const html = renderToStaticMarkup(
      <ExpenseCategoriesResult
        output={{
          categories: [
            { code: "MATERIAL", name: "Material", description: null },
            { code: "TUKANG", name: "Tukang", description: "Upah tukang" },
          ],
        }}
      />,
    );

    expect(html).toContain("Material");
    expect(html).toContain("Tukang");
  });
});
