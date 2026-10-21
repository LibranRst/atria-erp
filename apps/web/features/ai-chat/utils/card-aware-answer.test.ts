import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import type { CardNarrative } from "@atria/core/ai/answer-presentation";
import {
  canRenderGroundedReadCard,
  projectCardAwareAnswerText,
  type RenderedReadCard,
} from "./card-aware-answer";

type Part = UIMessage["parts"][number];
const cashFull =
  "Saldo rekening terbaru:\n- BCA Operasional Rp 100.000,25\n- Mandiri Rp 200.000,50\nTotal kas tersedia Rp 300.000,75.";
const cashCompact = "Kas tersedia Rp 300.000,75. Rincian rekening ada di kartu saldo.";
const budgetFull =
  "Budget Proyek QA:\nMaterial: alokasi Rp 100.000,25; terpakai Rp 50.000,10; sisa Rp 50.000,15.\nTukang: alokasi Rp 100.000,25; belum terpakai.";
const budgetCompact =
  "Material masih dalam alokasi. Realisasi dibayar Rp 40.000,10 dan Rp 10.000 menunggu pembayaran. Tukang belum terpakai.";
const cash: RenderedReadCard = { toolName: "getBankBalances", toolCallId: "cash-read" };
const budget: RenderedReadCard = { toolName: "getProjectBudget", toolCallId: "budget-read" };
const cashNarrative: CardNarrative = {
  ...cash,
  toolName: "getBankBalances",
  fullText: cashFull,
  cardText: cashCompact,
};
const budgetNarrative: CardNarrative = {
  ...budget,
  toolName: "getProjectBudget",
  fullText: budgetFull,
  cardText: budgetCompact,
};
const cashOutput = {
  totalAvailable: { amount: 300000.75, formatted: "Rp 300.000,75" },
  accounts: [
    {
      accountName: "BCA Operasional",
      bankName: "BCA",
      balance: { amount: 100000.25, formatted: "Rp 100.000,25" },
    },
    {
      accountName: "Mandiri",
      bankName: "Mandiri",
      balance: { amount: 200000.5, formatted: "Rp 200.000,50" },
    },
  ],
};
const budgetOutput = {
  projectId: "qa-project",
  projectName: "Proyek QA",
  budgetStatus: "DRAFT",
  internalBudget: { amount: 200000.5, formatted: "Rp 200.000,50" },
  contractValue: { amount: 250000.75, formatted: "Rp 250.000,75" },
  projectProgressPercentage: 0,
  categories: [
    {
      categoryName: "Material",
      categoryCode: "MATERIAL",
      allocated: { amount: 100000.25, formatted: "Rp 100.000,25" },
      actual: { amount: 50000.1, formatted: "Rp 50.000,10" },
      pending: { amount: 0, formatted: "Rp 0" },
      remaining: { amount: 50000.15, formatted: "Rp 50.000,15" },
      usedPercentage: 50,
      status: "SAFE",
    },
  ],
};
function tool(card: RenderedReadCard, output: unknown): Part {
  return {
    type: `tool-${card.toolName}`,
    toolCallId: card.toolCallId,
    state: "output-available",
    input: {},
    output,
  };
}
function source(card: RenderedReadCard): {
  toolName: string;
  toolCallId: string;
  entityIds: string[];
  query: Record<string, unknown>;
} {
  return { ...card, entityIds: ["qa-entity"], query: {} };
}
function metadata(
  narratives: readonly CardNarrative[] = [cashNarrative],
  status: string = "verified",
): Part {
  return {
    type: "data-grounded-facts",
    data: { status, sources: narratives.map(source), cardNarratives: narratives },
  };
}
function message(parts: Part[] = [tool(cash, cashOutput), metadata()]): UIMessage {
  return { id: "qa-answer", role: "assistant", parts };
}

test("company cash uses only the source-authored complement while canonical text and cents stay intact", (): void => {
  const original = message();
  const snapshot = JSON.stringify(original);
  expect(projectCardAwareAnswerText(original, cashFull, [cash])).toBe(cashCompact);
  expect(JSON.stringify(original)).toBe(snapshot);
  expect(cashOutput.totalAvailable.amount).toBe(300000.75);
  expect(cashFull).toContain("BCA Operasional Rp 100.000,25");
});

test("streaming, hidden, missing and mismatched selected cards retain the complete answer", (): void => {
  for (const cards of [
    [],
    [{ ...cash, toolCallId: "different-call" }],
    [{ ...cash, toolName: "getProjectBudget" }],
    [budget],
  ]) {
    expect(projectCardAwareAnswerText(message(), cashFull, cards)).toBe(cashFull);
  }
});

test("missing, pending, failed, malformed, empty and error-envelope tool outputs cannot authorize projection", (): void => {
  const parts: Part[][] = [
    [metadata()],
    [tool({ ...cash, toolCallId: "different-call" }, cashOutput), metadata()],
    [
      {
        type: "tool-getBankBalances",
        toolCallId: cash.toolCallId,
        state: "input-available",
        input: {},
      },
      metadata(),
    ],
    [
      {
        type: "tool-getBankBalances",
        toolCallId: cash.toolCallId,
        state: "output-error",
        input: {},
        errorText: "Tidak diizinkan.",
      },
      metadata(),
    ],
    [tool(cash, {}), metadata()],
    [tool(cash, { ...cashOutput, accounts: [] }), metadata()],
    [tool(cash, { ...cashOutput, error: "Akses ditolak." }), metadata()],
    [tool(cash, { ...cashOutput, accounts: [null] }), metadata()],
    [tool(cash, cashOutput), tool(cash, cashOutput), metadata()],
  ];
  for (const candidate of parts)
    expect(projectCardAwareAnswerText(message(candidate), cashFull, [cash])).toBe(cashFull);
});

test("the latest grounding envelope must have verified provenance for the exact source call", (): void => {
  const data = { status: "verified", sources: [source(cash)], cardNarratives: [cashNarrative] };
  for (const invalid of [
    { ...data, status: "error" },
    { ...data, status: "waiting" },
    { ...data, status: "unknown" },
    { ...data, sources: [] },
    { ...data, sources: [source(budget)] },
    { ...data, sources: [{ ...source(cash), toolCallId: "different-call" }] },
    { ...data, sources: [{ ...source(cash), toolName: "getProjectBudget" }] },
    { ...data, sources: [{ toolName: cash.toolName, toolCallId: cash.toolCallId }] },
    { ...data, cardNarratives: [{ ...cashNarrative, cardText: " " }] },
    { ...data, cardNarratives: [{ ...cashNarrative, toolName: "getMaterialCatalog" }] },
  ]) {
    expect(
      projectCardAwareAnswerText(
        message([tool(cash, cashOutput), { type: "data-grounded-facts", data: invalid }]),
        cashFull,
        [cash],
      ),
    ).toBe(cashFull);
    expect(
      projectCardAwareAnswerText(
        message([
          tool(cash, cashOutput),
          metadata(),
          { type: "data-grounded-facts", data: invalid },
        ]),
        cashFull,
        [cash],
      ),
    ).toBe(cashFull);
  }
});

test("legacy model text without explicit metadata and user content are never heuristically shortened", (): void => {
  expect(
    projectCardAwareAnswerText(
      message([tool(cash, cashOutput), { type: "text", text: cashFull }]),
      cashFull,
      [cash],
    ),
  ).toBe(cashFull);
  expect(
    projectCardAwareAnswerText(
      message([
        tool(cash, cashOutput),
        { type: "data-grounded-facts", data: { status: "verified", sources: [source(cash)] } },
      ]),
      cashFull,
      [cash],
    ),
  ).toBe(cashFull);
  expect(projectCardAwareAnswerText({ ...message(), role: "user" }, cashFull, [cash])).toBe(
    cashFull,
  );
});

test("exact section anchors reject repeats, embedded substrings and overlapping narratives", (): void => {
  for (const text of [
    cashFull + "\n\n" + cashFull,
    "Quoted content: " + cashFull,
    cashFull + " extra text",
  ])
    expect(projectCardAwareAnswerText(message(), text, [cash])).toBe(text);
  const duplicated = message([tool(cash, cashOutput), metadata([cashNarrative, cashNarrative])]);
  expect(projectCardAwareAnswerText(duplicated, cashFull, [cash])).toBe(cashFull);
  const text = cashFull + "\n\n" + budgetFull;
  const overlaps = message([
    tool(cash, cashOutput),
    tool(budget, budgetOutput),
    metadata([{ ...cashNarrative, fullText: text }, budgetNarrative]),
  ]);
  expect(projectCardAwareAnswerText(overlaps, text, [cash, budget])).toBe(text);
});

test("multiple validated sections can complement cards without erasing a partial failure or unsupported facts", (): void => {
  const error =
    "Stok belum dapat dibaca: akses material ditolak. Coba lagi setelah akses tersedia.";
  const text = cashFull + "\n\n" + budgetFull + "\n\n" + error;
  const original = message([
    tool(cash, cashOutput),
    tool(budget, budgetOutput),
    metadata([cashNarrative, budgetNarrative], "partial"),
  ]);
  expect(projectCardAwareAnswerText(original, text, [cash, budget])).toBe(
    cashCompact + "\n\n" + budgetCompact + "\n\n" + error,
  );
  expect(projectCardAwareAnswerText(original, text, [cash])).toBe(
    cashCompact + "\n\n" + budgetFull + "\n\n" + error,
  );
});

test("named account scope keeps the requested conclusion despite the company-wide card", (): void => {
  const fullText =
    "Saldo BCA Operasional Rp 100.000,25. Total seluruh rekening Rp 300.000,75.\nRincian: BCA Rp 100.000,25; Mandiri Rp 200.000,50.";
  const cardText = "Saldo BCA Operasional Rp 100.000,25. Total seluruh rekening Rp 300.000,75.";
  const data = {
    status: "verified",
    sources: [{ ...source(cash), query: { bankName: "BCA" } }],
    cardNarratives: [{ ...cashNarrative, fullText, cardText }],
  };
  expect(
    projectCardAwareAnswerText(
      message([tool(cash, cashOutput), { type: "data-grounded-facts", data }]),
      fullText,
      [cash],
    ),
  ).toBe(cardText);
});

test("budget outputs must pass their own schema and have displayed categories", (): void => {
  for (const output of [
    {},
    { ...budgetOutput, categories: [] },
    { ...budgetOutput, error: "Proyek di luar akses." },
  ])
    expect(
      projectCardAwareAnswerText(
        message([tool(budget, output), metadata([budgetNarrative])]),
        budgetFull,
        [budget],
      ),
    ).toBe(budgetFull);
  expect(
    projectCardAwareAnswerText(
      message([tool(budget, budgetOutput), metadata([budgetNarrative])]),
      budgetFull,
      [budget],
    ),
  ).toBe(budgetCompact);
});

test("latest valid metadata updates replace once and preserved history projects identically without touching the introduction", (): void => {
  const intro: Part = {
    type: "data-assistant-introduction",
    id: "intro",
    data: { text: "Aku cek saldo terbarunya dulu." },
  };
  const newer = { ...cashNarrative, cardText: "Ringkasan terbaru untuk kartu saldo." };
  const original = message([
    intro,
    tool(cash, cashOutput),
    metadata(),
    metadata([newer]),
    { type: "text", text: cashFull },
  ]);
  const snapshot = JSON.stringify(original);
  const restored: UIMessage = JSON.parse(snapshot);
  expect(projectCardAwareAnswerText(original, cashFull, [cash])).toBe(newer.cardText);
  expect(projectCardAwareAnswerText(restored, cashFull, [cash])).toBe(newer.cardText);
  expect(JSON.stringify(original)).toBe(snapshot);
  expect(original.parts[0]).toEqual(intro);
});

test("projection makes no model, fetch or business request", (): void => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  const rejectCall = (): never => {
    calls++;
    throw new Error("Projection must remain local.");
  };
  const blockedFetch: typeof fetch = Object.assign(async (): Promise<Response> => rejectCall(), {
    preconnect: rejectCall,
  });
  globalThis.fetch = blockedFetch;
  try {
    expect(projectCardAwareAnswerText(message(), cashFull, [cash])).toBe(cashCompact);
    expect(calls).toBe(0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("factual card scope uses the latest exact source while legacy cards retain compatibility", (): void => {
  const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
  const output = {
    ...cashOutput,
    accounts: cashOutput.accounts.map((account, index) => ({ ...account, accountId: ids[index] })),
  };
  const proof: Part = {
    type: "data-grounded-facts",
    data: { status: "partial", sources: [{ ...cash, entityIds: ids }], missingDomains: ["budget"] },
  };
  const current = message([tool(cash, output), proof]);
  const snapshot = JSON.stringify(current);
  expect(canRenderGroundedReadCard(current, cash, output)).toBe(true);
  expect(canRenderGroundedReadCard(current, { ...cash, toolCallId: "another-call" }, output)).toBe(
    false,
  );
  expect(canRenderGroundedReadCard(current, cash, cashOutput)).toBe(false);
  expect(canRenderGroundedReadCard(message([tool(cash, output)]), cash, output)).toBe(true);
  for (const data of [
    { status: "partial", sources: [{ ...cash, entityIds: [ids[0]] }] },
    { status: "waiting", sources: [] },
    { status: "error", sources: [] },
    { status: "verified" },
  ])
    expect(
      canRenderGroundedReadCard(
        message([proof, { type: "data-grounded-facts", data }]),
        cash,
        output,
      ),
    ).toBe(false);
  expect(JSON.stringify(current)).toBe(snapshot);
});
