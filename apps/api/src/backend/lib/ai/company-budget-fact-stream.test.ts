import { describe, expect, it } from "bun:test";
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import type { CompanyBudgetPolicy } from "@atria/core/ai/company-budget-policy";
import type { AiToolContext } from "./tools/context";
import {
  companyBudgetFactStream,
  isCompanyBudgetDefaultsQuestion,
} from "./company-budget-fact-stream";

const currentPolicy: CompanyBudgetPolicy = {
  status: "configured",
  companyName: "Company QA",
  source: {
    label: "Pengaturan Budget",
    href: "/settings/budget",
    settingId: "actual-setting-id",
    settingName: "Budget * QA",
  },
  budgetCapRatio: 0.912345,
  targetGrossMarginPercentage: 8.7655,
  categories: [
    { code: "MATERIAL", name: "Material", ratioPercentage: 0.333333 },
    { code: "LAIN_LAIN", name: "LAIN_LAIN", ratioPercentage: 0.123456 },
  ],
};
const allowed: AiToolContext["permissions"] = ["use:ai_chat", "view:settings"];

function textOf(message: UIMessage | undefined): string {
  return (
    message?.parts
      .flatMap((part): string[] => (part.type === "text" ? [part.text] : []))
      .join("\n") ?? ""
  );
}

async function consume(input: {
  readonly policy?: CompanyBudgetPolicy;
  readonly question?: string;
  readonly permissions?: AiToolContext["permissions"];
}): Promise<{
  readonly saved: readonly UIMessage[];
  readonly client: UIMessage | undefined;
  readonly chunks: readonly UIMessageChunk[];
}> {
  const question = input.question ?? "Berapa plafon standar perusahaan dan target gross margin?";
  const saved: UIMessage[] = [],
    chunks: UIMessageChunk[] = [];
  const stream = companyBudgetFactStream({
    question,
    policy: input.policy ?? currentPolicy,
    permissions: input.permissions ?? allowed,
    conversationId: "owned-conversation-id",
    messages: [{ id: "user-turn-id", role: "user", parts: [{ type: "text", text: question }] }],
    save: async (message): Promise<void> => {
      saved.push(message);
    },
  });
  const [raw, clientStream] = stream.tee();
  const rawTask = (async (): Promise<void> => {
    const reader = raw.getReader();
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      chunks.push(result.value);
    }
  })();
  let client: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream: clientStream })) client = message;
  await rawTask;
  return { saved, client, chunks };
}

describe("narrow current company budget questions", () => {
  for (const question of [
    "Berapa plafon internal standar perusahaan dan target gross margin?",
    "Apa target gross margin perusahaan saat ini?",
    "Tolong lihat pembagian kategori budget dari Pengaturan ERP.",
    "Bagaimana alokasi budget standar tiap kategori?",
    "Berapa plafon default dari nilai kontrak? Jangan ubah data.",
  ])
    it(`accepts the exact defaults request: ${question}`, (): void => {
      expect(isCompanyBudgetDefaultsQuestion(question)).toBe(true);
    });

  for (const question of [
    "Berapa gross margin perusahaan?",
    "Berapa budget perusahaan?",
    "Berapa plafon standar perusahaan untuk proyek Menteng?",
    "Cek kategori budget default dan saldo rekening.",
    "Berapa plafon standar dan stok material?",
    "Apa target margin perusahaan tahun2025?",
    "Bandingkan plafon standar sekarang vs tahun lalu.",
    "Bagaimana cara mengubah plafon standar perusahaan?",
    "Tolong siapkan usulan default budget yang baru.",
    "Berapa plafon RAP perusahaan yang standar?",
    "Berapa nominal total alokasi budget standar perusahaan?",
    "Berapa default plafon untuk kontrak Menteng?",
    "Kenapa plafon standar perusahaan terlalu rendah?",
    "Apa plafon standar perusahaan dan tagihan vendor?",
    "Apa target gross margin standar Menteng Villa?",
    "Show default budget cap and prepare a new project.",
    "Berapa target margin standar perusahaan? Jangan ubah plafon, tapi ganti kategori.",
    "Apa target margin standar perusahaan lebih besar dari15%?",
  ])
    it(`leaves contextual or ambiguous work to the normal path: ${question}`, (): void => {
      expect(isCompanyBudgetDefaultsQuestion(question)).toBe(false);
    });
});

describe("actual SDK fact stream and persistence", () => {
  it("uses current canonical precision and persists the same client answer once", async (): Promise<void> => {
    const result = await consume({});
    if (!result.client) throw new Error("The actual SDK stream did not publish a response.");
    expect(result.saved).toHaveLength(1);
    expect(textOf(result.client)).toBe(textOf(result.saved[0]));
    expect(textOf(result.client)).toContain("**91,2345% dari nilai kontrak**");
    expect(textOf(result.client)).toContain("**8,7655%**");
    expect(textOf(result.client)).toContain("Sumber: Pengaturan Budget");
    expect(JSON.stringify(result.client.parts)).toContain('"href":"/settings/budget"');
    expect(textOf(result.client)).toContain("Budget \\* QA");
    expect(textOf(result.client)).not.toContain("Company QA");
    expect(
      result.saved[0]?.parts.some((part) => part.type === "tool-getCompanyBudgetDefaults"),
    ).toBe(true);
    expect(result.chunks.find((chunk) => chunk.type === "data-conversation")).toEqual({
      type: "data-conversation",
      transient: true,
      data: { conversationId: "owned-conversation-id" },
    });
    const metadata = result.chunks.find((chunk) => chunk.type === "data-grounded-facts");
    expect(metadata).toMatchObject({
      type: "data-grounded-facts",
      data: {
        status: "verified",
        coveredDomains: ["budget"],
        missingDomains: [],
        sources: [
          { toolName: "getCompanyBudgetDefaults", entityIds: ["actual-setting-id"], query: {} },
        ],
      },
    });
  });

  it("labels category ratios against the internal cap without rounding away configured precision", async (): Promise<void> => {
    const result = await consume({
      question: "Tampilkan pembagian kategori budget standar perusahaan.",
    });
    expect(textOf(result.client)).toContain("dari **plafon budget internal**");
    expect(textOf(result.client)).toContain("Material: **33,3333%**");
    expect(textOf(result.client)).toContain("Lain\\-lain: **12,3456%**");
    expect(textOf(result.client)).not.toContain("LAIN_LAIN");
    expect(textOf(result.client)).not.toContain("nilai kontrak");
  });

  for (const permissions of [
    [],
    ["use:ai_chat"],
    ["view:settings"],
  ] satisfies readonly AiToolContext["permissions"][])
    it(`does not leak configured values when effective grants are incomplete: ${permissions.join(",") || "none"}`, async (): Promise<void> => {
      const result = await consume({ permissions });
      expect(textOf(result.client)).toContain("tidak memiliki akses");
      expect(JSON.stringify(result.chunks)).not.toContain("91,2345");
      expect(JSON.stringify(result.chunks)).not.toContain("actual-setting-id");
      expect(JSON.stringify(result.chunks)).not.toContain("0.912345");
      expect(result.chunks).toContainEqual({
        type: "data-grounded-facts",
        data: { status: "error", sources: [], coveredDomains: [], missingDomains: ["budget"] },
      });
    });

  for (const status of ["unconfigured", "unavailable", "forbidden"] satisfies readonly Exclude<
    CompanyBudgetPolicy["status"],
    "configured"
  >[])
    it(`shows the actual ${status} blocker without fallback values`, async (): Promise<void> => {
      const result = await consume({
        policy: { status, message: "Pengaturan belum tersedia untuk sesi ini." },
      });
      expect(textOf(result.client)).toBe("Pengaturan belum tersedia untuk sesi ini.");
      expect(textOf(result.client)).not.toContain("%");
      expect(
        result.chunks.some(
          (chunk) =>
            chunk.type === "tool-output-available" &&
            typeof chunk.output === "object" &&
            chunk.output !== null &&
            "error" in chunk.output,
        ),
      ).toBe(true);
    });

  it("refuses inconsistent or malformed snapshots rather than deriving a guessed answer", async (): Promise<void> => {
    if (currentPolicy.status !== "configured") throw new Error("Configured fixture required");
    const inconsistent = await consume({
      policy: { ...currentPolicy, targetGrossMarginPercentage: 15 },
    });
    expect(textOf(inconsistent.client)).toContain("belum konsisten");
    expect(textOf(inconsistent.client)).not.toContain("%");
    const malformed = await consume({ policy: { ...currentPolicy, budgetCapRatio: Number.NaN } });
    expect(textOf(malformed.client)).toContain("belum dapat diverifikasi");
    expect(textOf(malformed.client)).not.toContain("%");
  });

  it("explicitly reports missing categories", async (): Promise<void> => {
    if (currentPolicy.status !== "configured") throw new Error("Configured fixture required");
    const result = await consume({
      question: "Cek pembagian kategori budget default perusahaan.",
      policy: { ...currentPolicy, categories: [] },
    });
    expect(textOf(result.client)).toContain("Pembagian kategori belum tersedia");
    expect(result.chunks).toContainEqual({
      type: "data-grounded-facts",
      data: {
        status: "partial",
        sources: expect.any(Array),
        coveredDomains: [],
        missingDomains: ["budget"],
      },
    });
  });

  it("does not persist an aborted request", async (): Promise<void> => {
    const controller = new AbortController();
    controller.abort();
    const saved: UIMessage[] = [];
    const stream = companyBudgetFactStream({
      question: "Berapa plafon budget standar perusahaan?",
      policy: currentPolicy,
      permissions: allowed,
      conversationId: "owned-conversation-id",
      messages: [],
      signal: controller.signal,
      save: async (message): Promise<void> => {
        saved.push(message);
      },
    });
    const reader = stream.getReader();
    while (!(await reader.read()).done) {
      /* Consume the SDK's cancellation/error output. */
    }
    expect(saved).toHaveLength(0);
  });
});
