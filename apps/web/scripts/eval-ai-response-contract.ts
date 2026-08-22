import "server-only";

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { buildSystemPrompt } from "../lib/ai/prompts";
import { shouldStopAfterFinalFollowUps } from "../lib/ai/chat-stop-conditions";
import { resolveChatModel, resolveProviderChain, type ChatProviderName } from "../lib/ai/providers";
import { buildSuggestionTools } from "../lib/ai/tools/suggestion-tools";
import type { AiToolContext } from "../lib/ai/tools/context";

type EvalScenario = {
  readonly id: string;
  readonly prompt: string;
  readonly fixture: Readonly<Record<string, unknown>>;
  readonly groundingTerms: readonly string[];
  readonly allowsLongAnswer?: boolean;
  readonly cardDetailMarkers?: readonly string[];
};

const scenarios: readonly EvalScenario[] = [
  {
    id: "simple-fact",
    prompt: "Berapa total saldo kas perusahaan saat ini? Gunakan data terverifikasi.",
    fixture: {
      totalBalance: "Rp125.000.000",
      accountCount: 3,
      status: "Likuid",
    },
    groundingTerms: [
      "saldo",
      "kas",
      "rekening",
      "tagihan",
      "vendor",
      "pembayaran",
      "operasional",
      "pengeluaran",
    ],
  },
  {
    id: "comparison",
    prompt: "Bandingkan dua proyek ini dan sebutkan mana yang perlu perhatian lebih dulu.",
    fixture: {
      projects: [
        { name: "Proyek Anggrek", budgetUsed: "78%", status: "Aman" },
        { name: "Proyek Kenanga", budgetUsed: "96%", status: "Perlu perhatian" },
      ],
    },
    groundingTerms: ["anggrek", "kenanga", "budget", "proyek"],
  },
  {
    id: "critical-risk",
    prompt: "Apa risiko paling mendesak dan tindakan yang harus dilakukan?",
    fixture: {
      project: "Proyek Melati",
      category: "Material",
      overBudget: "Rp8.500.000",
      pendingApproval: "Rp6.000.000",
      consequence: "Pembelian berikutnya perlu persetujuan Owner",
    },
    groundingTerms: ["melati", "material", "persetujuan", "budget"],
    allowsLongAnswer: true,
  },
  {
    id: "card-backed",
    prompt:
      "Ringkas kondisi tagihan vendor ini. Rincian lengkap sudah ditampilkan sebagai card di UI.",
    fixture: {
      cardDisplayed: true,
      totalOutstanding: "Rp42.000.000",
      nearestDueBill: "Vendor Kayu Sentosa — Rp12.000.000 — jatuh tempo besok",
      otherRows: [
        "Vendor Cat Prima — Rp8.000.000 — 5 hari lagi",
        "Vendor Lampu Jaya — Rp7.500.000 — 8 hari lagi",
        "Vendor Besi Makmur — Rp14.500.000 — 12 hari lagi",
      ],
    },
    groundingTerms: [
      "vendor",
      "tagihan",
      "jatuh tempo",
      "kayu sentosa",
      "saldo",
      "bank",
      "pembayaran",
    ],
    cardDetailMarkers: ["Cat Prima", "Lampu Jaya", "Besi Makmur"],
  },
  {
    id: "explicit-detail",
    prompt: "Jelaskan secara detail kondisi budget Proyek Dahlia dan alasannya.",
    fixture: {
      project: "Proyek Dahlia",
      internalBudget: "Rp300.000.000",
      categories: [
        { name: "Material", used: "91%", remaining: "Rp9.000.000" },
        { name: "Tukang", used: "72%", remaining: "Rp21.000.000" },
        { name: "Operasional", used: "84%", remaining: "Rp4.800.000" },
        { name: "Subcon", used: "63%", remaining: "Rp27.750.000" },
        { name: "Lain-lain", used: "35%", remaining: "Rp6.500.000" },
      ],
      marginProjection: "14%",
      targetMargin: "18%",
    },
    groundingTerms: ["dahlia", "material", "margin", "budget"],
    allowsLongAnswer: true,
  },
  {
    id: "tool-heavy",
    prompt:
      "Dari kondisi finansial, tagihan, dan material berikut, apa fokus operasional utama hari ini?",
    fixture: {
      cashAvailable: "Rp85.000.000",
      urgentBill: "Rp20.000.000 jatuh tempo hari ini",
      materialShortage: "12 lembar plywood untuk Proyek Mawar",
      budgetRisk: "Kategori Material Proyek Mawar sudah 94% terpakai",
      pendingApproval: "Pengeluaran Rp7.000.000 menunggu Owner",
    },
    groundingTerms: [
      "mawar",
      "material",
      "tagihan",
      "approval",
      "persetujuan",
      "pengeluaran",
      "owner",
      "pencairan",
    ],
    allowsLongAnswer: true,
  },
];

const context: AiToolContext = {
  userId: "00000000-0000-0000-0000-000000000099",
  roleName: "OWNER",
};

function wordCount(text: string): number {
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : normalized.split(/\s+/).length;
}

function bulletCount(text: string): number {
  return text.split("\n").filter((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line)).length;
}

function readQuestions(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null) return [];
  const questions = (value as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) return [];
  return questions.filter((question): question is string => typeof question === "string");
}

function evaluate(options: {
  readonly scenario: EvalScenario;
  readonly answer: string;
  readonly followUps: readonly string[];
}): readonly string[] {
  const { scenario, answer, followUps } = options;
  const issues: string[] = [];
  const words = wordCount(answer);
  const bullets = bulletCount(answer);

  if (words === 0) issues.push("empty-answer");
  if (!scenario.allowsLongAnswer && words > 100) issues.push("over-word-budget");
  if (!scenario.allowsLongAnswer && bullets > 3) issues.push("too-many-bullets");
  if (/\b(saya (?:akan |sedang )?(?:cek|cari|ambil)|sebentar,? saya)\b/i.test(answer)) {
    issues.push("tool-progress-narration");
  }
  if (/ada lagi yang bisa (?:saya )?bantu|jika ada pertanyaan lain/i.test(answer)) {
    issues.push("generic-closing");
  }
  if (followUps.length < 1 || followUps.length > 3) {
    issues.push("invalid-follow-up-count");
  }

  const normalizedFollowUps = followUps.map((question) => question.toLowerCase());
  if (new Set(normalizedFollowUps).size !== normalizedFollowUps.length) {
    issues.push("duplicate-follow-ups");
  }
  if (
    followUps.some(
      (question) =>
        !scenario.groundingTerms.some((term) =>
          question.toLowerCase().includes(term.toLowerCase()),
        ),
    )
  ) {
    issues.push("ungrounded-follow-up");
  }

  if (scenario.cardDetailMarkers) {
    const repeatedRows = scenario.cardDetailMarkers.filter((marker) =>
      answer.includes(marker),
    ).length;
    if (repeatedRows > 1) issues.push("card-detail-repetition");
  }

  return issues;
}

async function runScenario(provider: ChatProviderName, scenario: EvalScenario): Promise<void> {
  try {
    const evalDataTool = tool({
      description:
        "Return the verified synthetic Atria ERP data required for this evaluation. Call this before answering. Never mention this internal tool to the user.",
      inputSchema: z.object({}),
      execute: async () => scenario.fixture,
    });
    const dataToolName = scenario.cardDetailMarkers ? "getUpcomingBills" : "getEvalData";
    const dataTools = { [dataToolName]: evalDataTool };
    const result = await generateText({
      model: resolveChatModel(provider),
      system: buildSystemPrompt(provider, "Evaluator", context),
      prompt: scenario.prompt,
      tools: {
        ...dataTools,
        ...buildSuggestionTools(),
      },
      stopWhen: [stepCountIs(5), ({ steps }) => shouldStopAfterFinalFollowUps(steps)],
      maxRetries: 0,
    });

    const answer = result.steps
      .map((step) => step.text.trim())
      .filter((text) => text.length > 0)
      .join("\n");
    const followUps = result.toolResults.flatMap((toolResult) =>
      toolResult.toolName === "suggestFollowUps" ? readQuestions(toolResult.output) : [],
    );
    const issues = evaluate({ scenario, answer, followUps });
    const verdict = issues.length === 0 ? "PASS" : `REVIEW:${issues.join(",")}`;

    console.log(
      `${provider}\t${scenario.id}\t${verdict}\twords=${wordCount(answer)}\tfollowUps=${followUps.length}`,
    );
    if (issues.length > 0) {
      console.log(`ANSWER\t${answer.replace(/\s+/g, " ").trim()}`);
      console.log(`FOLLOWUPS\t${followUps.join(" | ")}`);
    }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.log(`${provider}\t${scenario.id}\tSKIP:provider-error:${errorName}`);
  }
}

const providerFilter = process.env.AI_EVAL_PROVIDER;
const scenarioFilter = process.env.AI_EVAL_SCENARIO;
const providers = resolveProviderChain().filter(
  (provider) => !providerFilter || provider === providerFilter,
);
const selectedScenarios = scenarios.filter(
  (scenario) => !scenarioFilter || scenario.id === scenarioFilter,
);
if (providers.length === 0) {
  console.log("SKIP\tno-provider-configured");
} else {
  for (const provider of providers) {
    for (const scenario of selectedScenarios) {
      await runScenario(provider, scenario);
    }
  }
}
