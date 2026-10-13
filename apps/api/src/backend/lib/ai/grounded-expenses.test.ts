import { describe, expect, test } from "bun:test";
import {
  isExpenseStatusQuestion,
  isSupportedCurrentExpenseStatusQuestion,
  renderGroundedExpenseSection,
  type ExpenseEntityBinder,
} from "./grounded-expenses";
import type { GroundedToolObservation } from "./grounded-facts";
import { parseFinancialHistoryRequest } from "@atria/core/ai/financial-history";

const binds: ExpenseEntityBinder = (question, name, id) =>
  question.includes(id) || question.includes(name);
const project = { id: "project-qa", name: "Proyek QA" };
function expense(
  id: string,
  status = "APPROVED",
  description = "Panel dapur",
): Record<string, unknown> {
  return {
    id,
    projectCostId: `cost-${id}`,
    description,
    projectId: project.id,
    projectName: project.name,
    categoryName: "Material",
    amount: { amount: 100000.25, formatted: "Rp 999 juta" },
    exactAmount: "100000.25",
    status,
    paymentStatus: status === "PAID" ? "PAID" : "UNPAID",
    expenseDate: "2026-10-13",
  };
}
function observation(
  rows: readonly unknown[],
  input: unknown = {},
  extras: Readonly<Record<string, unknown>> = {},
): GroundedToolObservation {
  return {
    toolName: "getRecentExpenses",
    toolCallId: "fresh-expenses",
    input,
    output: {
      expenses: rows,
      offset: 0,
      hasMore: false,
      matchedCount: rows.length,
      project,
      ...extras,
    },
  };
}
describe("grounded current expense statuses", () => {
  test("current state of dated records is distinct from unsupported historical approval state", () => {
    expect(isExpenseStatusQuestion("Status pengeluaran Panel dapur sekarang?")).toBe(true);
    expect(isExpenseStatusQuestion("Status saat ini pengeluaran kemarin pada Proyek QA?")).toBe(
      true,
    );
    expect(isExpenseStatusQuestion("Status pengeluaran tanggal 2026-10-12 pada Proyek QA?")).toBe(
      true,
    );
    expect(isExpenseStatusQuestion("Status pengeluaran kemarin pada Proyek QA?")).toBe(true);
    expect(
      isSupportedCurrentExpenseStatusQuestion("Status pengeluaran kemarin pada Proyek QA?"),
    ).toBe(false);
    expect(
      isSupportedCurrentExpenseStatusQuestion("Status per 2026-10-12 pengeluaran Panel dapur?"),
    ).toBe(false);
    expect(isExpenseStatusQuestion("Total pengeluaran bulan lalu pada Proyek QA?")).toBe(false);
  });
  test.each([
    ["SUBMITTED", "Diajukan"],
    ["VERIFIED", "Terverifikasi"],
    ["APPROVED", "Disetujui"],
    ["REJECTED", "Ditolak"],
    ["PAID", "Lunas"],
  ])("reads actual %s lifecycle without trusting formatted money", (status, label) => {
    const result = renderGroundedExpenseSection(
      "Status pengeluaran Panel dapur pada Proyek QA?",
      observation([expense("one", status)]),
      binds,
    );
    expect(result?.complete).toBe(true);
    expect(result?.text).toContain(label);
    expect(result?.text).toContain("Rp 100.000,25");
    expect(result?.text).not.toContain("999 juta");
    expect(result?.source.entityIds).toEqual([project.id, "one", "cost-one"]);
  });
  test("duplicate descriptions across projects require selection, not first row", () => {
    const second = { ...expense("two", "PAID"), projectId: "another", projectName: "Proyek Kedua" };
    const result = renderGroundedExpenseSection(
      "Status pengeluaran Panel dapur?",
      observation([expense("one"), second]),
      binds,
    );
    expect(result?.complete).toBe(false);
    expect(result?.needsChoice).toBe(true);
    expect(result?.text).toContain("Proyek Kedua");
    expect(result?.text).toContain("Pilih berdasarkan proyek");
    const withInstruction = renderGroundedExpenseSection(
      "Status pengeluaran Panel dapur? Kalau ada beberapa kandidat dan jangan pilih sendiri.",
      observation([expense("one"), second]),
      binds,
    );
    expect(withInstruction?.complete).toBe(false);
    expect(withInstruction?.needsChoice).toBe(true);
    expect(withInstruction?.text).toContain("Pilih berdasarkan proyek");
    expect(withInstruction?.text).not.toContain("Belum semua pengeluaran yang disebutkan");
  });
  test("an explicit expense ID identifies one duplicate", () => {
    const result = renderGroundedExpenseSection(
      "Status pengeluaran one?",
      observation([expense("one")], { expenseId: "one" }),
      binds,
    );
    expect(result?.complete).toBe(true);
  });
  test("a human-named reread accepts matching canonical/field IDs only with current uniqueness proof", () => {
    const row = { ...expense("one"), descriptionMatchesInScope: 1 };
    const question = "Status pengeluaran Panel dapur pada Proyek QA sekarang?";
    for (const expenseId of ["one", "cost-one"]) {
      expect(
        renderGroundedExpenseSection(
          question,
          observation([row], { expenseId, projectId: project.id }),
          binds,
        )?.complete,
      ).toBe(true);
    }
    expect(
      renderGroundedExpenseSection(question, observation([row], { expenseId: "wrong" }), binds),
    ).toBeNull();
    expect(
      renderGroundedExpenseSection(
        "Status pengeluaran Lampu meja pada Proyek QA?",
        observation([row], { expenseId: "one" }),
        binds,
      ),
    ).toBeNull();
    const ambiguous = renderGroundedExpenseSection(
      question,
      observation([{ ...row, descriptionMatchesInScope: 2 }], { expenseId: "one" }),
      binds,
    );
    expect(ambiguous?.complete).toBe(false);
    expect(ambiguous?.needsChoice).toBe(true);
    const old = renderGroundedExpenseSection(
      question,
      observation([expense("one")], { expenseId: "one" }),
      binds,
    );
    expect(old?.complete).toBe(false);
    expect(old?.text).toContain("belum terbukti unik");
    expect(
      renderGroundedExpenseSection(
        "Status pengeluaran one?",
        observation([{ ...row, descriptionMatchesInScope: 2 }], { expenseId: "one" }),
        binds,
      )?.complete,
    ).toBe(true);
  });
  test("one named expense cannot complete a request for two different named expenses", () => {
    const question = "Status pengeluaran Panel dapur dan Lampu meja pada Proyek QA?";
    const first = renderGroundedExpenseSection(question, observation([expense("one")]), binds);
    expect(first?.complete).toBe(false);
    expect(first?.text).toContain("Belum semua pengeluaran");
    const both = renderGroundedExpenseSection(
      question,
      observation([expense("one"), expense("two", "PAID", "Lampu meja")]),
      binds,
    );
    expect(both?.complete).toBe(true);
  });
  test("unbound model-selected project/query/status/date are refused", () => {
    for (const input of [
      { projectId: "another" },
      { query: "bensin" },
      { query: "P" },
      { status: "PAID" },
      { dateFrom: "2026-09-01" },
      { expenseId: "another" },
    ])
      expect(
        renderGroundedExpenseSection(
          "Status pengeluaran Panel dapur?",
          observation([expense("one")], input),
          binds,
        ),
      ).toBeNull();
    const other = { id: "another", name: "Proyek Kedua" };
    expect(
      renderGroundedExpenseSection(
        "Status pengeluaran Panel dapur?",
        observation(
          [{ ...expense("one"), projectId: other.id, projectName: other.name }],
          { projectId: other.id },
          { project: other },
        ),
        binds,
      ),
    ).toBeNull();
  });
  test("hasMore, nonzero offsets and count mismatch keep recent pages partial", () => {
    for (const extras of [{ hasMore: true }, { offset: 20 }, { matchedCount: 2 }]) {
      const result = renderGroundedExpenseSection(
        "Status pengeluaran Panel dapur?",
        observation([expense("one")], {}, extras),
        binds,
      );
      expect(result?.complete).toBe(false);
      expect(result?.text).toContain("bukan total pengeluaran proyek");
    }
  });
  test("legacy identity-free page and invalid lifecycle cannot be verified", () => {
    expect(
      renderGroundedExpenseSection(
        "Status pengeluaran Proyek QA?",
        {
          toolName: "getRecentExpenses",
          toolCallId: "old",
          input: {},
          output: { expenses: [expense("one")] },
        },
        binds,
      ),
    ).toBeNull();
    expect(
      renderGroundedExpenseSection(
        "Status pengeluaran Panel dapur?",
        observation([expense("one", "SECRET_ENUM")]),
        binds,
      ),
    ).toBeNull();
  });
  test("empty full scoped project and literal-description reads state absence within access", () => {
    const scoped = renderGroundedExpenseSection(
      "Status pengeluaran Proyek QA?",
      observation([], { projectId: project.id }),
      binds,
    );
    expect(scoped?.complete).toBe(true);
    expect(scoped?.text).toContain("dalam akses Anda");
    const absent = renderGroundedExpenseSection(
      "Status pengeluaran Panel dapur?",
      observation([], { query: "Panel dapur" }),
      binds,
    );
    expect(absent?.complete).toBe(true);
    expect(absent?.text).toContain("Tidak ditemukan");
  });
  test("recent pages cannot answer aggregates or prior approval state", () => {
    for (const question of [
      "Total pengeluaran Proyek QA?",
      "Status kemarin pengeluaran Panel dapur?",
      "Status pengeluaran saya?",
    ]) {
      expect(
        renderGroundedExpenseSection(question, observation([expense("one")]), binds),
      ).toBeNull();
    }
  });
  test("inventory asset purchase, noncash use and inconsistent payment remain distinct", () => {
    const purchase = {
      ...expense("purchase", "INVENTORY_ASSET"),
      paymentStatus: "PAID",
      sourceType: "INVENTORY_PURCHASE",
      isCashImpact: false,
    };
    const result = renderGroundedExpenseSection(
      "Status pengeluaran Panel dapur?",
      observation([purchase]),
      binds,
    );
    expect(result?.complete).toBe(true);
    expect(result?.text).toContain("Pembelian persediaan (aset)");
    expect(result?.text).toContain("belum menjadi biaya pemakaian Material");
    const usage = {
      ...expense("use"),
      paymentStatus: "NON_CASH",
      sourceType: "STOCK_USAGE",
      isCashImpact: false,
    };
    const used = renderGroundedExpenseSection(
      "Status pengeluaran Panel dapur?",
      observation([usage]),
      binds,
    );
    expect(used?.complete).toBe(true);
    expect(used?.text).toContain("tanpa pembayaran kas baru");
    const bad = renderGroundedExpenseSection(
      "Status pengeluaran Panel dapur?",
      observation([{ ...expense("bad", "PAID"), paymentStatus: "UNPAID" }]),
      binds,
    );
    expect(bad?.complete).toBe(false);
    expect(bad?.text).toContain("tidak selaras");
  });
  test("batch context uses actual scoped IDs and raw lifecycle, never localized arbitrary status", () => {
    const batch: GroundedToolObservation = {
      toolName: "getExpenseBatchContext",
      toolCallId: "batch",
      input: { projectId: project.id },
      output: {
        project,
        nextCostOffset: null,
        expenses: [
          {
            id: "cost-one",
            description: "Panel dapur",
            amount: 100000.25,
            exactAmount: "100000.25",
            statusCode: "VERIFIED",
            status: "Lunas",
          },
        ],
      },
    };
    const result = renderGroundedExpenseSection(
      "Status pengeluaran Panel dapur pada Proyek QA?",
      batch,
      binds,
    );
    expect(result?.complete).toBe(true);
    expect(result?.text).toContain("Terverifikasi");
    expect(result?.text).not.toContain("Lunas");
    expect(
      renderGroundedExpenseSection("Status pengeluaran Panel dapur?", batch, binds),
    ).toBeNull();
  });
  test("relative record periods verify actual server-resolved bounds and remain current status", () => {
    const question = "Status saat ini pengeluaran kemarin pada Proyek QA?";
    const asOf = "2026-10-14T03:00:00Z";
    const period = parseFinancialHistoryRequest(question, new Date(asOf)).periods[0];
    if (!period) throw new Error("Expected yesterday record period");
    const result = renderGroundedExpenseSection(
      question,
      observation(
        [expense("one")],
        { projectId: project.id, dateFrom: "2026-09-01" },
        { dateRange: { ...period, asOf } },
      ),
      binds,
    );
    expect(result?.complete).toBe(true);
    expect(result?.text).toContain("bukan status historis");
    expect(result?.source.query).toHaveProperty("resolvedDateRange");
    expect(renderGroundedExpenseSection(question, observation([expense("one")]), binds)).toBeNull();
    expect(
      renderGroundedExpenseSection(
        question,
        observation(
          [expense("one")],
          {},
          { dateRange: { ...period, asOf, start: "2026-09-01T17:00:00.000Z" } },
        ),
        binds,
      ),
    ).toBeNull();
  });
});
