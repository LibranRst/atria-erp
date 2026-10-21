import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import {
  generationMessages,
  initialActiveTools,
  stepActiveTools,
  requiredFreshRead,
  requiredFreshReads,
  freshReadActiveTools,
  successfulReadOutput,
} from "./chat-context";
import { AI_CAPABILITIES, availableAiCapabilities } from "./tools/capability-catalog";
import { aiToolContextForRole } from "../testing/ai-tool-context";

const available = Object.keys(AI_CAPABILITIES);
function user(text: string): UIMessage {
  return { id: "u", role: "user", parts: [{ type: "text", text }] };
}
describe("bounded model context without lost business history", () => {
  test("fresh stages keep authorized read peers and discovery without proposal execution", (): void => {
    expect(
      freshReadActiveTools(
        [
          "getBankBalances",
          "getStockCorrectionContext",
          "getMaterialCatalog",
          "proposeStockCorrection",
        ],
        [
          "getBankBalances",
          "getStockCorrectionContext",
          "getMaterialCatalog",
          "proposeStockCorrection",
          "getAvailableActions",
        ],
      ),
    ).toEqual([
      "getBankBalances",
      "getStockCorrectionContext",
      "getMaterialCatalog",
      "getAvailableActions",
    ]);
    expect(freshReadActiveTools(available, ["getAvailableActions"])).toEqual([
      "getAvailableActions",
    ]);
    expect(successfulReadOutput({ error: "Current read failed" })).toBe(false);
    expect(successfulReadOutput({ success: false, data: [] })).toBe(false);
    expect(successfulReadOutput(null)).toBe(false);
    expect(successfulReadOutput({ accounts: [] })).toBe(true);
  });
  test("own-profile recovery requires a fresh authorized read, without redirecting other tasks", (): void => {
    expect(
      requiredFreshRead(
        [user("Siapkan nama profil saya menjadi QA Recovery")],
        ["getOwnProfileContext"],
      ),
    ).toBe("getOwnProfileContext");
    expect(requiredFreshRead([user("Periksa profil aktual saya")], ["getOwnProfileContext"])).toBe(
      "getOwnProfileContext",
    );
    expect(requiredFreshRead([user("Siapkan profil saya")], [])).toBeUndefined();
    expect(requiredFreshRead([user("Cek profil proyek")], available)).toBeUndefined();
    expect(
      requiredFreshReads(
        [user("Cek saldo rekening dan stok fisik terbaru")],
        ["getBankBalances", "getInventoryLocations"],
      ),
    ).toEqual(["getBankBalances", "getInventoryLocations"]);
    expect(requiredFreshReads([user("Cek saldo rekening dan stok fisik terbaru")], [])).toEqual([]);
  });
  test("native provider reasoning and signed metadata retain their original sequence", () => {
    const messages: UIMessage[] = [
      {
        id: "a",
        role: "assistant",
        parts: [
          {
            type: "reasoning",
            text: "signature-bound thought",
            providerMetadata: { google: { thoughtSignature: "opaque" } },
          },
          { type: "text", text: "Jawaban" },
        ],
      },
    ];
    expect(generationMessages(messages, "GEMINI")).toEqual(messages);
    expect(generationMessages(messages, "DEEPSEEK")).toEqual(messages);
    expect(generationMessages(messages, "OPENROUTER")).toEqual(messages);
    expect(generationMessages(messages, "NINEROUTER")).toEqual(messages);
  });
  test("read-only bank question exposes a small relevant catalog and discovery", () => {
    const selected = initialActiveTools(
      [user("Berapa saldo Rekening Operasional QA sekarang?")],
      available,
    );
    expect(selected).toContain("getBankBalances");
    expect(selected).toContain("getBankCashContext");
    expect(selected).toContain("getAvailableActions");
    expect(selected).not.toContain("proposeCreateUser");
    expect(selected.length).toBeLessThan(20);
  });
  test("mixed project, budget and warehouse question retains all relevant fresh reads", () => {
    const selected = initialActiveTools(
      [user("Cek nilai kontrak proyek QA, saldo rekening, budget Material dan stok gudang.")],
      available,
    );
    for (const name of [
      "listProjects",
      "getProjectBudget",
      "getBankBalances",
      "getProjectStockContext",
      "getMaterialCatalog",
    ])
      expect(selected).toContain(name);
    expect(selected.length).toBeLessThan(35);
  });
  test("action requests retain proposals and their verified-source dependencies", () => {
    const selected = initialActiveTools(
      [user("Siapkan pembayaran tagihan vendor QA dari rekening QA")],
      available,
    );
    expect(selected).toContain("proposeVendorBillPayment");
    for (const name of selected)
      for (const dependency of AI_CAPABILITIES[name]?.dependencies ?? [])
        if (available.includes(dependency)) expect(selected).toContain(dependency);
  });
  test("reference follow-up carries the immediately relevant tool family", () => {
    const selected = initialActiveTools(
      [
        user("Siapkan koreksi stok gudang"),
        {
          id: "a",
          role: "assistant",
          parts: [
            {
              type: "tool-proposeStockCorrection",
              toolCallId: "c",
              state: "output-available",
              input: {},
              output: { proposal: { kind: "PROCUREMENT_WAREHOUSE" } },
            },
          ],
        },
        user("ubah yang tadi menjadi 4 lembar"),
      ],
      available,
    );
    expect(selected).toContain("proposeStockCorrection");
    expect(selected).toContain("getStockCorrectionContext");
  });
  test("unknown intent and explicit discovery can reach the complete authorized catalog", () => {
    expect(
      initialActiveTools([user("Bantu proses kode X-42 yang belum jelas")], available),
    ).toEqual(available);
    expect(stepActiveTools(["getAvailableActions"], available, ["getAvailableActions"])).toEqual(
      available,
    );
  });
  test("selection never adds a tool absent from current permission-filtered registry", () => {
    const granted = availableAiCapabilities(aiToolContextForRole("PROJECT_MANAGER")).map(
      (c) => c.tool,
    );
    const selected = initialActiveTools([user("Bayar tagihan vendor dan lihat rekening")], granted);
    expect(selected.every((name) => granted.includes(name))).toBe(true);
    expect(selected).not.toContain("proposeBankCash");
  });
  test("an Owner label with NONE scope never gains project or bank tools", () => {
    const granted = availableAiCapabilities({
      userId: "fixture",
      roleId: "custom",
      roleName: "Owner",
      permissions: ["use:ai_chat"],
      dataScope: "NONE",
    }).map((c) => c.tool);
    const selected = initialActiveTools(
      [user("Cek proyek, saldo rekening dan stok gudang")],
      granted,
    );
    expect(selected).not.toContain("getProjectBudget");
    expect(selected).not.toContain("getBankBalances");
    expect(stepActiveTools(selected, granted, ["getAvailableActions"])).toEqual(granted);
  });
  test("generation drops historical reasoning while preserving exact text, files, tools and confirmed receipts", () => {
    const messages: UIMessage[] = [
      user("Kontrak Rp125.000.000,25 untuk Proyek Lama QA"),
      {
        id: "a",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "private old reasoning" },
          { type: "step-start" },
          { type: "text", text: "Ini proyek yang dipilih." },
          {
            type: "tool-proposeCreateProject",
            toolCallId: "proof",
            state: "output-available",
            input: { name: "Proyek Lama QA", totalContractValue: 125000000.25 },
            output: { isConfirmedByUser: true, confirmation: { documentId: "saved-project-id" } },
          },
        ],
      },
      {
        id: "file",
        role: "user",
        parts: [{ type: "file", mediaType: "image/png", url: "data:image/png;base64,aGVsbG8=" }],
      },
    ];
    const before = JSON.stringify(messages),
      result = generationMessages(messages);
    expect(JSON.stringify(messages)).toBe(before);
    expect(result[0]).toEqual(messages[0]);
    expect(result[2]).toEqual(messages[2]);
    expect(result[1].parts).toEqual(messages[1].parts.slice(2));
  });
});
