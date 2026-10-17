import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { cardNarrativeSchema } from "@atria/core/ai/answer-presentation";
import { getProjectBudgetOutputSchema } from "@atria/core/ai/tool-output";
import {
  isGroundedFactQuestion,
  renderGroundedFacts,
  type GroundedToolObservation,
} from "./grounded-facts";

const projectId = "00000000-0000-4000-8000-000000000001";
const accountA = "00000000-0000-4000-8000-000000000002";
const accountB = "00000000-0000-4000-8000-000000000003";
const locationId = "00000000-0000-4000-8000-000000000004";
const materialId = "00000000-0000-4000-8000-000000000005";
function outputRecord(value: GroundedToolObservation): Record<string, unknown> {
  return z.record(z.string(), z.unknown()).parse(value.output);
}
function observation(
  toolName: string,
  input: unknown,
  output: unknown,
  toolCallId = toolName,
): GroundedToolObservation {
  return { toolName, toolCallId, input, output };
}
function money(amount: number): { amount: number; formatted: string } {
  return { amount, formatted: "Rp 999.999.999 (model must not control formatting)" };
}
function bank(): GroundedToolObservation {
  return observation(
    "getBankBalances",
    {},
    {
      scope: "Seluruh rekening aktif perusahaan ini",
      accountCount: 2,
      totalAvailable: money(2000000.32),
      accounts: [
        {
          accountId: accountA,
          accountName: "Rekening QA Utama",
          bankName: "BCA",
          balance: money(1250000.25),
        },
        {
          accountId: accountB,
          accountName: "Rekening QA Kedua",
          bankName: "Mandiri",
          balance: money(750000.07),
        },
      ],
    },
  );
}
function budget(): GroundedToolObservation {
  return observation(
    "getProjectBudget",
    { projectId },
    {
      projectId,
      projectName: "Proyek QA",
      projectStatus: "ACTIVE",
      budgetStatus: "APPROVED",
      internalBudget: money(100000.5),
      contractValue: money(125000.75),
      projectProgressPercentage: 42.5,
      categories: [
        {
          categoryId: "material-category",
          categoryCode: "MATERIAL",
          categoryName: "Material",
          allocated: money(60000.23),
          actual: money(15000.11),
          paid: money(12500.07),
          pending: money(5000.02),
          remaining: money(45000.12),
          usedPercentage: 25,
          status: "SAFE",
        },
        {
          categoryId: "labor-category",
          categoryCode: "TUKANG",
          categoryName: "Tukang",
          allocated: money(10000.1),
          actual: money(1000.05),
          paid: money(500.03),
          pending: money(0),
          remaining: money(9000.05),
          usedPercentage: 10,
          status: "SAFE",
        },
      ],
    },
  );
}
function stock(physical = "6.00", reserved = "4.00"): GroundedToolObservation {
  return observation(
    "getWarehouseContext",
    { inventoryLocationId: locationId, materialQuery: "Panel QA" },
    {
      location: { id: locationId, name: "Gudang QA" },
      hasMore: false,
      inventory: [{ materialId, name: "Panel QA", unit: "lembar", physical, reserved }],
    },
  );
}
function rab(): GroundedToolObservation {
  return observation(
    "getRabWorkflowContext",
    { projectId },
    {
      projectId,
      projectName: "Proyek QA",
      rabsHasMore: false,
      rabs: [
        { id: "approved-rab", title: "Penawaran QA", status: "APPROVED", revision: 1 },
        { id: "draft-rab", title: "Revisi QA", status: "DRAFT", revision: 2 },
      ],
      rab: { id: "draft-rab", title: "Revisi QA", status: "DRAFT", revision: 2 },
    },
  );
}

describe("trusted current-run financial and stock facts", () => {
  test("project counts use the scoped server aggregate rather than a limited preview", (): void => {
    const read = observation(
      "listProjects",
      { limit: 1 },
      {
        matchedCount: 37,
        hasMore: true,
        appliedFilters: [],
        projects: [{ projectId, name: "Proyek QA", status: "DRAFT" }],
      },
    );
    const answer = renderGroundedFacts("Berapa jumlah seluruh proyek, termasuk draf?", [read]);
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("37 proyek");
    expect(answer?.coveredDomains).toContain("projects");
    expect(answer?.sources[0]?.entityIds).toEqual([projectId]);
  });
  test("mixed project counts and current cash require both actual read sources", (): void => {
    const question =
      "Cek jumlah seluruh proyek, termasuk draf, dan saldo total rekening yang tercatat saat ini. Hanya baca data; jangan membuat atau mengubah apa pun.";
    const read = observation(
      "listProjects",
      { limit: 10 },
      {
        matchedCount: 2,
        hasMore: false,
        appliedFilters: [],
        projects: [
          { projectId, name: "Proyek QA", status: "ACTIVE" },
          { projectId: accountA, name: "Proyek QA Draf", status: "DRAFT" },
        ],
      },
    );
    const answer = renderGroundedFacts(question, [read, bank()]);
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("2 proyek");
    expect(answer?.text).toContain("2.000.000,32");
    expect(answer?.coveredDomains).toContain("cash");
    expect(answer?.coveredDomains).toContain("projects");
    expect(renderGroundedFacts(question, [bank()])?.status).toBe("partial");
  });
  test("project count zero is valid, while legacy previews and unrelated filters are not totals", (): void => {
    const question = "Berapa jumlah seluruh proyek, termasuk draf?";
    const zero = observation("listProjects", {}, { matchedCount: 0, hasMore: false, projects: [] });
    expect(renderGroundedFacts(question, [zero])?.status).toBe("verified");
    expect(renderGroundedFacts(question, [zero])?.text).toContain("0 proyek");
    const preview = {
      projects: [{ projectId, name: "Proyek QA", status: "DRAFT" }],
      hasMore: true,
    };
    expect(renderGroundedFacts(question, [observation("listProjects", {}, preview)])?.status).toBe(
      "waiting",
    );
    expect(
      renderGroundedFacts(question, [
        observation("listProjects", { status: "ACTIVE" }, { ...preview, matchedCount: 1 }),
      ])?.status,
    ).toBe("waiting");
    expect(
      renderGroundedFacts(question, [
        observation("listProjects", { query: "proyek" }, { ...preview, matchedCount: 1 }),
      ])?.status,
    ).toBe("waiting");
  });
  test.each([
    "Berapa saldo rekening saat ini?",
    "Berapa saldo total rekening yang tercatat saat ini?",
  ])(
    "natural current-balance qualifiers retain the complete authorized total: %s",
    (question): void => {
      const answer = renderGroundedFacts(question, [bank()]);
      expect(answer?.status).toBe("verified");
      expect(answer?.text).toContain("2.000.000,32");
      expect(answer?.sources[0]?.entityIds).toEqual([accountA, accountB]);
    },
  );
  test.each([
    "Cek saldo rekening Tidak Ada saat ini",
    "Cek saldo rekening ini",
    'Cek saldo rekening "Yang Tercatat Saat Ini"',
  ])(
    "current-balance wording does not broaden an unknown or ambiguous account: %s",
    (question): void => {
      const answer = renderGroundedFacts(question, [bank()]);
      expect(answer?.status).toBe("waiting");
      expect(answer?.sources).toEqual([]);
    },
  );
  test("terkini denotes a current balance request while named account binding stays explicit", (): void => {
    const answer = renderGroundedFacts(
      "Periksa saldo rekening terkini dan tampilkan daftar rekeningnya. Jangan ubah data.",
      [bank()],
    );
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("2.000.000,32");
    expect(answer?.sources[0]?.entityIds).toEqual([accountA, accountB]);
    expect(renderGroundedFacts("Cek saldo rekening Tidak Ada terkini", [bank()])?.status).toBe(
      "waiting",
    );
    expect(
      renderGroundedFacts("Cek saldo Rekening QA Kedua terkini", [bank()])?.sources[0]?.entityIds,
    ).toEqual([accountB]);
  });
  test("classifier leaves proposals, mixed commands, advice, Settings and unrelated questions to their own workflow", () => {
    expect(
      isGroundedFactQuestion(
        "Cek saldo rekening, budget Proyek QA, dan stok Panel QA di Gudang QA",
      ),
    ).toBe(true);
    expect(isGroundedFactQuestion("Berapa saldo perusahaan? Jangan simpan data.")).toBe(true);
    expect(isGroundedFactQuestion("Cek budget lalu transfer Rp 100.000")).toBe(false);
    expect(isGroundedFactQuestion("Siapkan koreksi stok Panel QA")).toBe(false);
    expect(isGroundedFactQuestion("Bagaimana cara memperbaiki margin proyek?")).toBe(false);
    expect(isGroundedFactQuestion("Target margin default perusahaan?")).toBe(false);
    expect(isGroundedFactQuestion("Saldo kas kemarin dibandingkan hari ini?")).toBe(true);
    const history = renderGroundedFacts("Saldo kas kemarin dibandingkan hari ini?", [bank()]);
    expect(history?.status).not.toBe("verified");
    expect(history?.sources).toEqual([]);
    expect(history?.text).not.toContain("Rp 2.000.000,32");
    expect(isGroundedFactQuestion("Nama profil saya siapa?")).toBe(false);
    expect(renderGroundedFacts("Terima material Panel QA", [stock()])).toBeNull();
  });
  test("a constraint against substituting current values preserves an explicit historical error", () => {
    const question =
      "Berapa saldo Rekening Operasional QA pada akhir September 2026? Jangan gunakan saldo saat ini sebagai pengganti, dan jangan simpan perubahan.";
    expect(isGroundedFactQuestion(question)).toBe(true);
    const answer = renderGroundedFacts(question, [bank()]);
    expect(answer?.status).toBe("error");
    expect(answer?.text).toContain("snapshot terverifikasi");
    expect(answer?.text).not.toContain("Rp");
    expect(answer?.sources).toEqual([]);
    expect(isGroundedFactQuestion("Gunakan stok Panel QA untuk proyek")).toBe(false);
    const mixed = renderGroundedFacts(
      "Berapa saldo Rekening QA Kedua pada akhir September 2026 dan status pengeluaran Invoice QA saat ini?",
      [bank()],
    );
    expect(mixed?.status).toBe("error");
    expect(mixed?.text).not.toContain("Rp");
    expect(mixed?.sources).toEqual([]);
  });
  test("exact cents are formatted from numeric facts and provenance is retained without trusting formatted text", () => {
    const answer = renderGroundedFacts("Berapa saldo seluruh rekening perusahaan?", [bank()]);
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("Rp 2.000.000,32");
    expect(answer?.text).toContain("Rp 1.250.000,25");
    expect(answer?.text).not.toContain("999.999.999");
    expect(answer?.sources).toEqual([
      {
        toolName: "getBankBalances",
        toolCallId: "getBankBalances",
        entityIds: [accountA, accountB],
        query: {},
      },
    ]);
  });
  test("a requested account is bound to its actual ID and never the first account or combined total", () => {
    const answer = renderGroundedFacts("Berapa saldo Rekening QA Kedua?", [bank()]);
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("Rp 750.000,07");
    expect(answer?.text).not.toContain("Rp 1.250.000,25");
    expect(answer?.text).not.toContain("saldo gabungan");
    expect(answer?.sources[0]?.entityIds).toEqual([accountB]);
    expect(
      renderGroundedFacts("Berapa saldo rekening lain yang tidak ditemukan?", [bank()])?.status,
    ).toBe("waiting");
  });
  test("a named account takes precedence over bank names inside other entity names", () => {
    const read = observation(
      "getBankBalances",
      {},
      {
        accountCount: 3,
        scope: "Seluruh rekening aktif perusahaan ini",
        totalAvailable: money(1000000),
        accounts: [
          {
            accountId: accountA,
            accountName: "Rekening Operasional QA",
            bankName: "BCA",
            balance: money(1000000),
          },
          {
            accountId: accountB,
            accountName: "Rekening QA Lain",
            bankName: "QA",
            balance: money(0),
          },
          {
            accountId: "00000000-0000-4000-8000-000000000009",
            accountName: "Rekening QA Ketiga",
            bankName: "QA",
            balance: money(0),
          },
        ],
      },
    );
    const answer = renderGroundedFacts(
      "Cek saldo Rekening Operasional QA dan budget Proyek Operasional QA",
      [read],
    );
    expect(answer?.text).toContain("Rekening Operasional QA (BCA): Rp 1.000.000");
    expect(answer?.text).not.toContain("Rekening QA Lain");
    expect(answer?.text).not.toContain("Rekening QA Ketiga");
    expect(answer?.sources[0]?.entityIds).toEqual([accountA]);
    expect(renderGroundedFacts("Berapa saldo bank QA?", [read])?.sources[0]?.entityIds).toEqual([
      accountB,
      "00000000-0000-4000-8000-000000000009",
    ]);
    expect(renderGroundedFacts("Saldo BCA", [read])?.sources[0]?.entityIds).toEqual([accountA]);
  });
  test("a paginated account search is never a company cash total", () => {
    const read = observation(
      "getBankCashContext",
      { query: "Rekening QA Kedua" },
      {
        accounts: [
          {
            id: accountB,
            name: "Rekening QA Kedua",
            bankName: "Mandiri",
            balance: 750000.07,
            status: "Aktif",
          },
        ],
        needsDisambiguation: false,
        hasMore: true,
      },
    );
    const answer = renderGroundedFacts("Cek saldo Rekening QA Kedua", [read]);
    expect(answer?.status).toBe("partial");
    expect(answer?.text).toContain("bukan saldo gabungan perusahaan");
    expect(answer?.text).toContain("halaman berikutnya");
    expect(renderGroundedFacts("Cek saldo Rekening QA Utama", [read])?.status).toBe("waiting");
    const ambiguous = observation(
      "getBankCashContext",
      { query: "R" },
      { ...outputRecord(read), needsDisambiguation: true },
    );
    expect(renderGroundedFacts("Cek saldo rekening R", [ambiguous])?.status).toBe("waiting");
  });
  test("category actual, cash paid, cap and unallocated remainder are distinct even with decimal values", () => {
    const answer = renderGroundedFacts(
      "Cek alokasi Material, realisasi, kas dibayar, dan sisa budget Proyek QA",
      [budget()],
    );
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("plafon internal Rp 100.000,50");
    expect(answer?.text).toContain(
      "Material: alokasi Rp 60.000,23; realisasi Rp 15.000,11; kas dibayar Rp 12.500,07",
    );
    expect(answer?.text).toContain("sisa Rp 45.000,12");
    expect(answer?.text).toContain("sisa alokasi kategori Rp 54.000,17");
    expect(answer?.text).toContain(
      "Sisa plafon internal terhadap realisasi tercatat: Rp 84.000,34",
    );
    expect(answer?.text).toContain("Kas dibayar: Rp 13.000,10");
  });
  test("category names inside project and material identities do not become category filters", () => {
    const original = outputRecord(budget());
    const categories = z.array(z.record(z.string(), z.unknown())).parse(original.categories);
    const read = observation(
      "getProjectBudget",
      { projectId },
      {
        ...original,
        projectName: "Proyek Operasional QA",
        categories: categories.map((category, index) =>
          index === 1
            ? { ...category, categoryName: "Operasional", categoryCode: "OPERASIONAL" }
            : category,
        ),
      },
    );
    const material = observation(
      "getMaterials",
      { query: "Panel Operasional QA" },
      { materials: [{ materialId, name: "Panel Operasional QA", unit: "lembar" }] },
    );
    const answer = renderGroundedFacts(
      "Cek budget Material Proyek Operasional QA dan stok Panel Operasional QA",
      [read, material],
    );
    expect(answer?.text).toContain("- Material: alokasi");
    expect(answer?.text).not.toContain("- Operasional: alokasi");
    const both = renderGroundedFacts("Cek budget Material dan Operasional Proyek Operasional QA", [
      read,
    ]);
    expect(both?.text).toContain("- Material: alokasi");
    expect(both?.text).toContain("- Operasional: alokasi");
  });
  test("an unread denied bank account never narrows the project budget to its name's category", () => {
    const original = outputRecord(budget());
    const categories = z.array(z.record(z.string(), z.unknown())).parse(original.categories);
    const read = observation(
      "getProjectBudget",
      { projectId },
      {
        ...original,
        projectName: "Proyek Role QA A",
        categories: [
          ...categories,
          { ...categories[1], categoryCode: "OPERASIONAL", categoryName: "Operasional" },
        ],
      },
    );
    const question =
      "UAT final PM A: berapa budget Proyek Role QA A sekarang, nilai kontrak, plafon internal, dan sisa budget? Serta saldo Rekening Operasional QA. Jangan simpan perubahan.";
    const answer = renderGroundedFacts(question, [read], ["getProjectBudget"]);
    expect(answer?.text).toContain("- Material: alokasi");
    expect(answer?.text).toContain("- Tukang: alokasi");
    expect(answer?.text).toContain("- Operasional: alokasi");
    expect(answer?.text).toContain("Akses pembacaan saldo rekening lewat AI tidak tersedia");
    const selected = renderGroundedFacts(
      "Berapa budget Material dan Tukang Proyek Role QA A sekarang? Serta saldo Rekening Operasional QA.",
      [read],
      ["getProjectBudget"],
    );
    expect(selected?.text).toContain("- Material: alokasi");
    expect(selected?.text).toContain("- Tukang: alokasi");
    expect(selected?.text).not.toContain("- Operasional: alokasi");
    expect(
      renderGroundedFacts("Cek alokasi untuk Material Proyek Role QA A", [read])?.text,
    ).not.toContain("- Tukang: alokasi");
  });
  test("the exact final Owner question binds sentence-ending warehouse names before a no-save instruction", () => {
    const question =
      "UAT final hasil: baca saldo Rekening Operasional QA, budget Material Proyek Operasional QA, realisasi, kas dibayar, sisa, dan stok fisik, tercadang, tersedia Panel Operasional QA di Gudang Operasional QA. Jangan simpan perubahan.";
    const cash = observation(
      "getBankBalances",
      {},
      {
        scope: "Seluruh rekening aktif perusahaan ini",
        accountCount: 1,
        totalAvailable: money(1000000),
        accounts: [
          {
            accountId: accountA,
            accountName: "Rekening Operasional QA",
            bankName: "BCA",
            balance: money(1000000),
          },
        ],
      },
    );
    const project = observation(
      "getProjectBudget",
      { projectId },
      { ...outputRecord(budget()), projectName: "Proyek Operasional QA" },
    );
    const warehouse = observation(
      "getWarehouseContext",
      { inventoryLocationId: locationId, materialQuery: "Panel Operasional QA" },
      {
        location: { id: locationId, name: "Gudang Operasional QA" },
        hasMore: false,
        inventory: [
          {
            materialId,
            name: "Panel Operasional QA",
            unit: "lembar",
            physical: "6.00",
            reserved: "6.00",
          },
        ],
      },
    );
    const answer = renderGroundedFacts(question, [cash, project, warehouse]);
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("fisik 6, reservasi 6, tersedia 0");
    expect(answer?.sources).toHaveLength(3);
    expect(
      renderGroundedFacts("Cek budget Proyek QA Lain. Jangan simpan perubahan.", [budget()])
        ?.status,
    ).toBe("waiting");
  });
  test("budget target mismatch and ambiguous project discovery cannot be silently narrowed", () => {
    expect(renderGroundedFacts("Cek budget Proyek Lain", [budget()])?.status).toBe("waiting");
    const mismatched = { ...budget(), input: { projectId: "different-id" } };
    expect(renderGroundedFacts("Cek budget Proyek QA", [mismatched])?.status).toBe("waiting");
    const discovery = observation(
      "listProjects",
      { query: "QA" },
      {
        requiresProjectChoice: true,
        projects: [
          { projectId, name: "Proyek QA" },
          { projectId: "other", name: "Proyek QA Lain" },
        ],
      },
    );
    const answer = renderGroundedFacts("Cek budget QA", [discovery, budget()]);
    expect(answer?.status).toBe("waiting");
    expect(answer?.text).toContain("Pilih proyek");
    expect(answer?.text).not.toContain("100.000");
  });
  test("pronouns and all-category words are not a source identity proof", () => {
    expect(renderGroundedFacts("Cek saldo rekening itu", [bank()])?.status).toBe("waiting");
    expect(renderGroundedFacts("Cek saldo tadi", [bank()])?.status).toBe("waiting");
    expect(renderGroundedFacts("Cek budget proyek itu", [budget()])?.status).toBe("waiting");
    expect(renderGroundedFacts("Cek seluruh kategori budget proyek tadi", [budget()])?.status).toBe(
      "waiting",
    );
    expect(renderGroundedFacts("Cek stok material ini di gudang tadi", [stock()])?.status).toBe(
      "waiting",
    );
    expect(renderGroundedFacts("Cek budget Proyek QA Lain", [budget()])?.status).toBe("waiting");
    expect(renderGroundedFacts("Cek stok Panel QA Lain di Gudang QA", [stock()])?.status).toBe(
      "waiting",
    );
  });
  test("an earlier ambiguous discovery recovers only after a scoped read of the human's exact named candidate", () => {
    const discovery = observation(
      "listProjects",
      { query: "QA" },
      {
        requiresProjectChoice: true,
        projects: [
          { projectId, name: "Proyek QA" },
          { projectId: "another", name: "Proyek QA Lain" },
        ],
      },
    );
    expect(renderGroundedFacts("Cek budget Proyek QA", [discovery, budget()])?.status).toBe(
      "verified",
    );
    expect(renderGroundedFacts("Cek budget Proyek QA", [budget(), discovery])?.status).toBe(
      "waiting",
    );
    expect(renderGroundedFacts("Cek budget Proyek QA Lain", [discovery, budget()])?.status).toBe(
      "waiting",
    );
    const sameNames = observation(
      "listProjects",
      { query: "Proyek QA" },
      {
        requiresProjectChoice: true,
        projects: [
          { projectId, name: "Proyek QA" },
          { projectId: "duplicate-name", name: "Proyek QA" },
        ],
      },
    );
    expect(renderGroundedFacts("Cek budget Proyek QA", [sameNames, budget()])?.status).toBe(
      "waiting",
    );
  });
  test("historical proposal snapshots are not fresh read outputs", () => {
    const proposal = observation(
      "proposeProjectActions",
      {},
      { proposal: { summary: [{ label: "Saldo", value: 999999999 }] }, currentStock: 1000 },
    );
    const answer = renderGroundedFacts("Cek saldo dan stok terbaru", [proposal]);
    expect(answer?.status).toBe("waiting");
    expect(answer?.text).not.toContain("999");
    expect(answer?.sources).toEqual([]);
    // A subsequent invocation sees a changed backend snapshot, not prior text.
    expect(
      renderGroundedFacts("Cek stok Panel QA di Gudang QA", [stock("3.25", "1.10")])?.text,
    ).toContain("fisik 3,25, reservasi 1,1, tersedia 2,15");
  });
  test("warehouse quantities stay scoped and preserve physical/reserved/available, including a negative available balance", () => {
    const answer = renderGroundedFacts("Cek stok Panel QA di Gudang QA", [stock()]);
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("fisik 6, reservasi 4, tersedia 2 lembar");
    expect(answer?.sources[0]?.entityIds).toEqual([locationId, materialId]);
    expect(renderGroundedFacts("Cek stok Panel QA di Gudang Lain", [stock()])?.status).toBe(
      "waiting",
    );
    expect(renderGroundedFacts("Cek stok Panel Lain di Gudang QA", [stock()])?.status).toBe(
      "waiting",
    );
    expect(
      renderGroundedFacts("Cek stok Panel QA di Gudang QA", [stock("2", "3")])?.text,
    ).toContain("tersedia -1");
  });
  test("an inventory page stays partial and multiple material matches require a choice", () => {
    const partial = observation("getWarehouseContext", stock().input, {
      ...outputRecord(stock()),
      hasMore: true,
    });
    expect(renderGroundedFacts("Cek stok Panel QA di Gudang QA", [partial])?.status).toBe(
      "partial",
    );
    const ambiguous = observation("getWarehouseContext", stock().input, {
      location: { id: locationId, name: "Gudang QA" },
      hasMore: false,
      inventory: [
        { materialId, name: "Panel QA", unit: "lembar", physical: "6", reserved: "4" },
        {
          materialId: "other-material",
          name: "Panel QA 2",
          unit: "lembar",
          physical: "9999",
          reserved: "0",
        },
      ],
    });
    expect(renderGroundedFacts("Cek stok Panel QA di Gudang QA", [ambiguous])?.status).toBe(
      "waiting",
    );
  });
  test("project stock never mixes a requested warehouse with another location, and carries only visible provenance", () => {
    const current = observation(
      "getProjectStockContext",
      { projectId, materialQuery: "Panel QA" },
      {
        project: { id: projectId, name: "Proyek QA" },
        inventoriesHasMore: false,
        inventories: [
          {
            materialId,
            materialName: "Panel QA",
            unit: "lembar",
            inventoryLocationId: "other-location",
            locationName: "Gudang Lain",
            current: "9999",
            reserved: "0",
          },
          {
            materialId,
            materialName: "Panel QA",
            unit: "lembar",
            inventoryLocationId: locationId,
            locationName: "Gudang QA",
            current: "6",
            reserved: "4",
          },
        ],
      },
    );
    const answer = renderGroundedFacts("Cek stok Panel QA di Gudang QA untuk Proyek QA", [current]);
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("Gudang QA: fisik 6, reservasi 4, tersedia 2");
    expect(answer?.text).not.toContain("9.999");
    expect(answer?.text).not.toContain("Gudang Lain");
    expect(answer?.sources[0]?.entityIds).toEqual([projectId, locationId, materialId]);
  });
  test("stock correction inventory requires a location reference read in this same generation", () => {
    const inventory = observation(
      "getStockCorrectionContext",
      { resource: "inventory", inventoryLocationId: locationId, query: "Panel QA" },
      {
        items: [
          { materialId, name: "Panel QA", unit: "lembar", currentStock: "6", reservedStock: "4" },
        ],
        hasMore: false,
      },
    );
    const location = observation(
      "getInventoryLocations",
      {},
      { locations: [{ locationId, name: "Gudang QA" }] },
    );
    expect(renderGroundedFacts("Cek stok Panel QA di Gudang QA", [inventory])?.status).toBe(
      "waiting",
    );
    expect(
      renderGroundedFacts("Cek stok Panel QA di Gudang QA", [location, inventory])?.status,
    ).toBe("verified");
    const deduplicated = renderGroundedFacts("Cek stok Panel QA di Gudang QA", [
      location,
      inventory,
      stock(),
    ]);
    expect(deduplicated?.text.match(/fisik 6/g)?.length).toBe(1);
    expect(deduplicated?.sources.map((s) => s.toolName)).toEqual(["getWarehouseContext"]);
  });
  test("document revisions show their own statuses, never convert an existing draft into client approval", () => {
    const answer = renderGroundedFacts("Cek status RAB Proyek QA", [rab()]);
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("Penawaran QA · revisi 1: Disetujui");
    expect(answer?.text).toContain("Revisi QA · revisi 2: Draf");
    expect(answer?.text).not.toContain("APPROVED");
    expect(renderGroundedFacts("Cek status RAP dan RAB Proyek QA", [rab()])?.status).toBe(
      "partial",
    );
    expect(renderGroundedFacts("Cek status RAB Proyek Lain", [rab()])?.status).toBe("waiting");
    const rap = observation(
      "getRapLifecycleContext",
      { projectId },
      {
        project: { id: projectId, name: "Proyek QA" },
        rap: { id: "actual-rap", revision: 3, status: "LOCKED", materialCount: 12 },
        hasMore: true,
        packages: [],
        totalMatches: 75,
      },
    );
    expect(renderGroundedFacts("Cek status RAP dan RAB Proyek QA", [rap, rab()])?.status).toBe(
      "verified",
    );
    expect(renderGroundedFacts("Cek status RAP Proyek QA", [rap])?.text).toContain(
      "RAP · revisi 3: Terkunci",
    );
    expect(renderGroundedFacts("Cek status RAP Proyek QA", [rap])?.status).toBe("verified");
  });
  test("a verified expense cannot complete an unread RAB, RAP or vendor status in the same question", () => {
    // Shape and noncash lifecycle match an actual executed operational QA read.
    const actualProjectId = "33bf90c2-7897-4fa1-935a-eb1a3d99e665";
    const description =
      "Pemakaian stock existing untuk proyek: pemasangan empat panel untuk uji operasional sintetis";
    const expense = observation(
      "getRecentExpenses",
      { query: description },
      {
        offset: 0,
        limit: 20,
        hasMore: false,
        nextOffset: null,
        matchedCount: 1,
        requiresExpenseChoice: false,
        dateBasis: "expenseDate",
        timeZone: "Asia/Jakarta",
        expenses: [
          {
            id: "2791b70e-9f18-46bf-ae67-24b45fc8c7d7",
            projectCostId: null,
            description,
            projectId: actualProjectId,
            projectName: "Proyek Operasional QA",
            categoryName: "Material",
            amount: money(400000),
            exactAmount: "400000.00",
            status: "APPROVED",
            paymentStatus: "NON_CASH",
            expenseDate: "2026-10-13",
            sourceType: "STOCK_USAGE",
            isCashImpact: false,
          },
        ],
      },
    );
    const expenseOnly = `Cek status pengeluaran "${description}" pada Proyek Operasional QA sekarang.`;
    expect(renderGroundedFacts(expenseOnly, [expense])?.status).toBe("verified");
    for (const kind of ["RAB", "RAP", "tagihan vendor"]) {
      const answer = renderGroundedFacts(
        `Cek status ${kind} dan pengeluaran "${description}" pada Proyek Operasional QA sekarang.`,
        [expense],
      );
      expect(answer?.status).toBe("partial");
      expect(answer?.missingDomains).toContain("documents");
      expect(answer?.text).toContain("Rp 400.000");
      expect(answer?.text).toContain("status dokumen belum terverifikasi lengkap");
    }
    const actualRab = observation(
      "getRabWorkflowContext",
      { projectId: actualProjectId },
      {
        projectId: actualProjectId,
        projectName: "Proyek Operasional QA",
        rabsHasMore: false,
        rabs: [
          { id: "rab-actual", title: "Penawaran Operasional QA", status: "APPROVED", revision: 1 },
        ],
      },
    );
    const both = renderGroundedFacts(
      `Cek status RAB dan pengeluaran "${description}" pada Proyek Operasional QA sekarang.`,
      [expense, actualRab],
    );
    expect(both?.status).toBe("verified");
    expect(both?.text).toContain("Penawaran Operasional QA · revisi 1: Disetujui");
    expect(both?.sources.map((source) => source.toolName)).toEqual([
      "getRecentExpenses",
      "getRabWorkflowContext",
    ]);
    const scopedExpense = observation(
      "getRecentExpenses",
      {
        query: "Pemakaian stock existing",
        projectId: actualProjectId,
        limit: 10,
        offset: 0,
      },
      { ...outputRecord(expense), project: { id: actualProjectId, name: "Proyek Operasional QA" } },
    );
    const actualUserQuestion = `Apa status saat ini pengeluaran "${description}" di "Proyek Operasional QA"? Jelaskan status pembayaran dan nominal aktual, tanpa menyimpan perubahan.`;
    const quoted = renderGroundedFacts(actualUserQuestion, [scopedExpense]);
    expect(quoted?.status).toBe("verified");
    expect(quoted?.text).toContain("Rp 400.000; Pencatatan nonkas");
    expect(quoted?.sources.map((source) => source.toolName)).toEqual(["getRecentExpenses"]);
    const similarlyNamed = renderGroundedFacts(
      actualUserQuestion.replace('"Proyek Operasional QA"?', '"Proyek Operasional QA Lain"?'),
      [scopedExpense],
    );
    expect(similarlyNamed?.status).toBe("waiting");
    expect(similarlyNamed?.sources).toEqual([]);
  });
  test("actual RAP readiness DTO verifies its status and stage without inventing a revision or a project status row", () => {
    const setup = observation(
      "getRapSetupContext",
      { projectId },
      {
        project: { id: projectId, name: "Proyek QA" },
        projectRapId: "dbd7d9a0-6654-4f1b-86a2-56bfc2e72314",
        status: "LOCKED",
        stage: "COMPLETE",
        materialCount: 12,
        scopes: { tukangSkipped: true, subconSkipped: true },
        packages: [],
        packagesTotal: 75,
        hasMore: true,
      },
    );
    const answer = renderGroundedFacts(
      "Berapa status RAP dan status RAB Proyek QA sekarang?",
      [budget(), setup, rab()],
      ["getProjectBudget", "getRapSetupContext", "getRabWorkflowContext"],
    );
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("RAP: Terkunci · tahap Selesai");
    expect(answer?.text).not.toContain("RAP · revisi");
    expect(answer?.text).not.toContain("Status Proyek QA: Aktif");
    expect(answer?.sources.map((s) => s.toolName)).toEqual([
      "getRapSetupContext",
      "getRabWorkflowContext",
    ]);
    expect(renderGroundedFacts("Cek status Proyek QA", [budget()])?.text).toContain(
      "Status Proyek QA: Aktif",
    );
  });
  test("permission denials remain clear alongside successful scoped domains and unavailable readers do not suggest retry", () => {
    const answer = renderGroundedFacts("Cek saldo dan stok Panel QA di Gudang QA", [
      observation("getBankBalances", {}, { error: "Akses rekening tidak tersedia." }),
      stock(),
    ]);
    expect(answer?.status).toBe("partial");
    expect(answer?.text).toContain("Akses rekening tidak tersedia");
    expect(answer?.text).toContain("fisik 6");
    const unavailable = renderGroundedFacts("Cek saldo perusahaan", [], ["getWarehouseContext"]);
    expect(unavailable?.status).toBe("error");
    expect(unavailable?.text).toContain(
      "Akses pembacaan saldo rekening lewat AI tidak tersedia untuk izin Anda",
    );
    expect(unavailable?.sources).toEqual([]);
    const deniedLocation = renderGroundedFacts("Cek stok Panel QA di Gudang QA", [
      observation("getInventoryLocations", {}, { error: "Akses lokasi gudang ditolak" }),
    ]);
    expect(deniedLocation?.status).toBe("error");
    expect(deniedLocation?.text).toContain("Akses lokasi gudang ditolak");
    const deniedProject = renderGroundedFacts("Cek budget Proyek QA", [
      observation("listProjects", { query: "Proyek QA" }, { error: "Proyek di luar akses Anda" }),
    ]);
    expect(deniedProject?.status).toBe("error");
    expect(deniedProject?.text).toContain("Proyek di luar akses Anda");
  });
  test("retry recovery supersedes only the same lookup, leaving other unresolved errors visible", () => {
    const failed = observation("getBankBalances", {}, { error: "Koneksi putus" }, "failed-read");
    expect(renderGroundedFacts("Cek saldo perusahaan", [failed, bank()])?.status).toBe("verified");
    expect(renderGroundedFacts("Cek saldo perusahaan", [failed, bank()])?.text).not.toContain(
      "Koneksi putus",
    );
    const denied = observation(
      "getBankCashContext",
      { bankAccountId: "different-account" },
      { error: "Rekening tidak dapat diakses" },
    );
    expect(renderGroundedFacts("Cek saldo perusahaan", [denied, bank()])?.status).toBe("partial");
  });
  test("missing cash-paid and approved RAB values are not inferred from actual spend or contract", () => {
    const raw = outputRecord(budget());
    const categories = z.array(z.record(z.string(), z.unknown())).parse(raw.categories);
    const withoutPaid = observation("getProjectBudget", budget().input, {
      ...raw,
      categories: categories.map(({ paid: _paid, ...category }) => category),
    });
    const answer = renderGroundedFacts(
      "Cek budget, kas dibayar, nilai RAB disetujui dan margin Proyek QA",
      [withoutPaid],
    );
    expect(answer?.status).toBe("partial");
    expect(answer?.text).toContain("Kas yang sudah dibayar belum terverifikasi");
    expect(answer?.text).toContain("Nilai RAB disetujui belum terverifikasi");
    expect(answer?.text).toContain("belum merupakan margin akhir");
  });
  test("malformed and inconsistent money outputs fail closed, without exposing unsupported claimed totals", () => {
    const malformed = observation(
      "getBankBalances",
      {},
      {
        totalAvailable: money(999),
        accounts: [],
        accountCount: 0,
        scope: "Seluruh rekening aktif perusahaan ini",
      },
    );
    expect(renderGroundedFacts("Cek saldo perusahaan", [malformed])?.status).toBe("waiting");
    const huge = observation(
      "getBankBalances",
      {},
      {
        totalAvailable: money(Number.MAX_SAFE_INTEGER),
        accounts: [
          {
            accountId: accountA,
            accountName: "Bank QA",
            bankName: "BCA",
            balance: money(Number.MAX_SAFE_INTEGER),
          },
        ],
        accountCount: 1,
        scope: "Seluruh rekening aktif perusahaan ini",
      },
    );
    expect(renderGroundedFacts("Cek saldo perusahaan", [huge])?.status).toBe("error");
  });
});

describe("card-aware factual presentation alternatives", () => {
  test("company balances keep complete canonical facts and supply one nonnumeric card conclusion", () => {
    const answer = renderGroundedFacts("Tampilkan ringkasan saldo kas bank perusahaan saat ini", [
      bank(),
    ]);
    expect(answer?.status).toBe("verified");
    expect(answer?.text).toContain("Rp 2.000.000,32");
    expect(answer?.text).toContain("Rekening QA Utama");
    expect(answer?.text).toContain("Rekening QA Kedua");
    expect(answer?.cardNarratives).toHaveLength(1);
    const narrative = cardNarrativeSchema.parse(answer?.cardNarratives?.[0]);
    expect(narrative.toolName).toBe("getBankBalances");
    expect(narrative.toolCallId).toBe("getBankBalances");
    expect(answer?.text).toContain(narrative.fullText);
    expect(narrative.cardText).toContain("Saldo rekening");
    expect(narrative.cardText).not.toContain("Rp");
    expect(narrative.cardText).not.toContain("Rekening QA");
    expect(narrative.cardText).not.toContain("- ");
    expect(answer?.sources[0]?.entityIds).toEqual([accountA, accountB]);
  });

  test("named account direct answers retain its exact balance and identity only", () => {
    const answer = renderGroundedFacts("Berapa saldo Rekening QA Kedua?", [bank()]);
    const narrative = cardNarrativeSchema.parse(answer?.cardNarratives?.[0]);
    expect(narrative.cardText).toContain("Rekening QA Kedua");
    expect(narrative.cardText).toContain("Rp 750.000,07");
    expect(narrative.cardText).not.toContain("Rekening QA Utama");
    expect(narrative.cardText).not.toContain("Rp 2.000.000,32");
    expect(answer?.sources[0]?.entityIds).toEqual([accountB]);
  });

  test("a named bank covering several accounts keeps a scoped exact conclusion rather than a list", () => {
    const cash = outputRecord(bank());
    const read = observation(
      "getBankBalances",
      {},
      {
        ...cash,
        accountCount: 3,
        totalAvailable: money(2250000.32),
        accounts: [
          {
            accountId: accountA,
            accountName: "BCA Operasional",
            bankName: "BCA",
            balance: money(1250000.25),
          },
          {
            accountId: accountB,
            accountName: "BCA Giro",
            bankName: "BCA",
            balance: money(750000.07),
          },
          {
            accountId: "00000000-0000-4000-8000-000000000009",
            accountName: "Mandiri Operasional",
            bankName: "Mandiri",
            balance: money(250000),
          },
        ],
      },
    );
    const answer = renderGroundedFacts("Berapa saldo bank BCA?", [read]);
    const narrative = cardNarrativeSchema.parse(answer?.cardNarratives?.[0]);
    expect(narrative.cardText).toContain("2 rekening BCA");
    expect(narrative.cardText).toContain("Rp 2.000.000,32");
    expect(narrative.cardText).not.toContain("BCA Operasional");
    expect(narrative.cardText).not.toContain("BCA Giro");
    expect(narrative.cardText).not.toContain("Mandiri");
    expect(answer?.sources[0]?.entityIds).toEqual([accountA, accountB]);
  });

  test("empty or invalid balance payloads never replace their necessary answer with a card reference", () => {
    const empty = renderGroundedFacts("Cek saldo perusahaan", [
      observation(
        "getBankBalances",
        {},
        {
          scope: "Seluruh rekening aktif perusahaan ini",
          accountCount: 0,
          totalAvailable: money(0),
          accounts: [],
        },
      ),
    ]);
    expect(empty?.status).toBe("verified");
    expect(empty?.text).toContain("Saldo gabungan 0 rekening aktif");
    expect(empty?.cardNarratives).toBeUndefined();
    const invalid = renderGroundedFacts("Cek saldo perusahaan", [
      observation("getBankBalances", {}, { ...outputRecord(bank()), accountCount: 3 }),
    ]);
    expect(invalid?.status).toBe("waiting");
    expect(invalid?.cardNarratives).toBeUndefined();
  });

  test("mixed missing facts and permission errors remain beside the successful card-backed section", () => {
    const answer = renderGroundedFacts("Cek saldo dan stok Panel QA di Gudang QA", [
      bank(),
      observation("getWarehouseContext", {}, { error: "Akses gudang ditolak." }),
    ]);
    expect(answer?.status).toBe("partial");
    expect(answer?.text).toContain("Akses gudang ditolak");
    expect(answer?.cardNarratives).toHaveLength(1);
    expect(answer?.cardNarratives?.[0]?.toolName).toBe("getBankBalances");
    expect(answer?.missingDomains).toContain("stock");
    expect(
      renderGroundedFacts("Cek stok Panel QA di Gudang QA", [stock()])?.cardNarratives,
    ).toBeUndefined();
    expect(
      renderGroundedFacts("Cek status RAB Proyek QA", [rab()])?.cardNarratives,
    ).toBeUndefined();
  });

  test("budget overview complements card rows with aggregate payment and pending-review facts", () => {
    const answer = renderGroundedFacts("Cek budget Proyek QA", [budget()]);
    const narrative = cardNarrativeSchema.parse(answer?.cardNarratives?.[0]);
    expect(narrative.toolName).toBe("getProjectBudget");
    expect(answer?.text).toContain(narrative.fullText);
    expect(narrative.fullText).toContain("Material: alokasi Rp 60.000,23; realisasi Rp 15.000,11");
    expect(narrative.cardText).not.toContain("Material: alokasi");
    expect(narrative.cardText).not.toContain("Tukang: alokasi");
    expect(narrative.cardText).not.toContain("Material:");
    expect(narrative.cardText).not.toContain("Tukang:");
    expect(narrative.cardText).toContain("Menunggu review: Rp 5.000,02");
    expect(narrative.cardText).toContain("Kas dibayar: Rp 13.000,10");
    expect(narrative.cardText).toContain("Nilai kontrak Rp 125.000,75");
    expect(answer?.sources[0]?.entityIds).toEqual([projectId]);
  });

  test("a named visible category keeps payment and pending-review facts without repeating its card fields", () => {
    const answer = renderGroundedFacts("Cek budget Material Proyek QA", [budget()]);
    const narrative = cardNarrativeSchema.parse(answer?.cardNarratives?.[0]);
    expect(narrative.cardText).toContain(
      "Material: kas dibayar Rp 12.500,07; menunggu review Rp 5.000,02",
    );
    expect(narrative.cardText).not.toContain("Material: alokasi");
    expect(narrative.cardText).not.toContain("Tukang:");
    expect(narrative.cardText).toContain("Kas dibayar: Rp 13.000,10");
    expect(answer?.text).toContain(narrative.fullText);
  });

  test("requested budget qualifications absent from the card are never lost", () => {
    const read = observation(
      "getProjectBudget",
      { projectId },
      {
        ...outputRecord(budget()),
        approvedRabValue: money(120000.33),
      },
    );
    const answer = renderGroundedFacts(
      "Cek budget Proyek QA, kas dibayar, RAB disetujui, margin dan progres",
      [read],
    );
    const narrative = cardNarrativeSchema.parse(answer?.cardNarratives?.[0]);
    expect(narrative.cardText).toContain("Kas dibayar: Rp 13.000,10");
    expect(narrative.cardText).toContain("Nilai RAB disetujui: Rp 120.000,33");
    expect(narrative.cardText).toContain("Ini belum merupakan margin akhir proyek");
    expect(narrative.cardText).toContain("Progres proyek: 42,5%");
    expect(answer?.text).toContain(narrative.fullText);
  });

  test("explicitly requested safe categories hidden by the card retain their complete answer", () => {
    const base = getProjectBudgetOutputSchema.parse(outputRecord(budget()));
    const read = observation(
      "getProjectBudget",
      { projectId },
      {
        ...outputRecord(budget()),
        categories: [
          ...base.categories,
          {
            categoryCode: "OPERASIONAL",
            categoryName: "Operasional",
            allocated: money(30000.17),
            actual: money(0),
            pending: money(0),
            remaining: money(30000.17),
            usedPercentage: 0,
            status: "SAFE",
          },
        ],
      },
    );
    const answer = renderGroundedFacts("Cek budget Operasional Proyek QA", [read]);
    const narrative = cardNarrativeSchema.parse(answer?.cardNarratives?.[0]);
    expect(narrative.cardText).toContain("Operasional: alokasi Rp 30.000,17; realisasi Rp 0");
    expect(narrative.cardText).toContain("sisa Rp 30.000,17");
    expect(narrative.cardText).not.toContain("Material: alokasi");
    expect(answer?.text).toContain(narrative.fullText);
    const overview = renderGroundedFacts("Cek budget Proyek QA", [read]);
    const overviewNarrative = cardNarrativeSchema.parse(overview?.cardNarratives?.[0]);
    expect(overviewNarrative.cardText).not.toContain("Operasional:");
    expect(overviewNarrative.cardText).not.toContain("Material:");
    expect(overviewNarrative.cardText).not.toContain("Tukang:");
    expect(overviewNarrative.cardText).toContain("Menunggu review: Rp 5.000,02");
    expect(overview?.text).toContain("Operasional: alokasi Rp 30.000,17; realisasi Rp 0");
    for (const question of [
      "Cek budget semua kategori Proyek QA",
      "Cek budget per kategori Proyek QA",
      "Tampilkan rincian budget Proyek QA",
    ]) {
      const detailed = renderGroundedFacts(question, [read]);
      const detailNarrative = cardNarrativeSchema.parse(detailed?.cardNarratives?.[0]);
      expect(detailNarrative.cardText).toContain(
        "Operasional: alokasi Rp 30.000,17; realisasi Rp 0",
      );
      expect(detailNarrative.cardText).toContain("sisa Rp 30.000,17");
      expect(detailed?.text).toContain(detailNarrative.fullText);
    }
  });
});
