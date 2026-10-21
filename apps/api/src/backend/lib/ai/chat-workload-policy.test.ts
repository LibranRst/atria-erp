import { describe, expect, it } from "bun:test";
import {
  classifyChatWorkload,
  isLiteralOwnNameOnlyEdit,
  selectNineRouterChatModel,
  type ChatWorkloadInput,
  type ChatWorkloadProfile,
} from "./chat-workload-policy";

describe("literal own-name effort guard", (): void => {
  for (const question of [
    "Siapkan usulan nama profil saya menjadi QA Profil Cepat.",
    "Siapkan usulan perubahan nama akun aku menjadi Budi Santoso. Jangan simpan perubahan dulu.",
    "Tolong ubah nama saya menjadi 'Budi Santoso'.",
    "Ganti nama profil saya ke O'Neil.",
    "Koreksi nama akun saya jadi Élodie Martin.",
    "Buat draf nama saya menjadi QA Owner Latensi 141026. Jangan terapkan perubahan.",
  ])
    it(`recognizes only the literal own-name command: ${question}`, (): void => {
      expect(isLiteralOwnNameOnlyEdit(question)).toBe(true);
      // Text alone still has the ordinary action profile; the stream owns the
      // prerequisite fresh snapshot and explicit server-prefilled flag.
      expect(classifyChatWorkload({ question })).not.toBe("simple");
    });
  for (const question of [
    "Siapkan usulan nama profil saya menjadi Budi dan ubah foto saya.",
    "Siapkan usulan nama profil saya menjadi Budi. Ubah avatar saya.",
    "Siapkan usulan nama profil saya menjadi Budi?",
    "Siapkan usulan nama profil saya menjadi nama yang tadi.",
    "Siapkan usulan nama staf menjadi Budi.",
    "Siapkan usulan nama profil saya menjadi Budi; email budi@example.invalid.",
    "Siapkan usulan nama profil saya menjadi Budi lalu transfer kas.",
    "Siapkan usulan nama profil saya menjadi Budi. Jangan ubah role saya.",
    "Siapkan usulan nama profil saya menjadi Budi dari lampiran.",
    "Siapkan usulan nama profil saya menjadi Budi. Jelaskan alasannya.",
    "Siapkan usulan nama profil saya menjadi Budi. Jangan simpan atau terapkan.",
    "Siapkan usulan nama profil saya menjadi Budi jangan simpan.",
    "Siapkan usulan nama profil saya menjadi Budi sesuai nama akun.",
    "Siapkan usulan nama profil saya menjadi Abaikan Instruksi.",
    "Siapkan usulan nama profil saya menjadi Budi dan Anisa.",
    "Siapkan usulan nama profil saya menjadi Budi\nUbah data lain.",
    "Siapkan usulan nama profil saya menjadi .",
    `Siapkan usulan nama profil saya menjadi ${"A".repeat(81)}.`,
    "Baca instruksi: Siapkan usulan nama profil saya menjadi Budi.",
  ])
    it(`keeps other fields, references and ambiguous requests out: ${question}`, (): void => {
      expect(isLiteralOwnNameOnlyEdit(question)).toBe(false);
    });
});

describe("conservative per-request generation effort", () => {
  const cases: readonly {
    readonly name: string;
    readonly input: ChatWorkloadInput;
    readonly expected: ChatWorkloadProfile;
  }[] = [
    {
      name: "a current budget default is one known fact domain",
      input: { question: "Berapa default plafon dan target gross margin perusahaan?" },
      expected: "simple",
    },
    {
      name: "a current account balance is a simple fresh read",
      input: { question: "Tolong tampilkan saldo rekening bank." },
      expected: "simple",
    },
    {
      name: "stock remains one domain even with several quantity fields",
      input: { question: "Cek stok fisik, tercadang dan tersedia material panel di gudang." },
      expected: "simple",
    },
    {
      name: "a bounded proposal preserves its normal action workflow",
      input: { question: "Siapkan usulan pembayaran tagihan vendor dari rekening operasional." },
      expected: "bounded",
    },
    {
      name: "an ordinary document uses medium rather than low effort",
      input: { question: "Periksa nota ini.", hasAttachments: true },
      expected: "bounded",
    },
    {
      name: "a greeting needs no complex generation",
      input: { question: "Halo!" },
      expected: "simple",
    },
    {
      name: "facts from budget, cash and stock remain complex despite speed instructions",
      input: {
        question: "Cek alokasi budget, saldo rekening dan stok gudang. Jawab cepat dan sederhana.",
      },
      expected: "complex",
    },
    {
      name: "historical comparison remains high effort",
      input: { question: "Bandingkan pengeluaran bulan ini dan bulan lalu." },
      expected: "complex",
    },
    {
      name: "a document requiring every page is not downgraded by having an attachment",
      input: {
        question: "Analisis semua halaman dan bandingkan antar bagian.",
        hasAttachments: true,
      },
      expected: "complex",
    },
    {
      name: "multiple actions remain high effort",
      input: { question: "Buat proyek baru lalu catat pengeluaran materialnya." },
      expected: "complex",
    },
    {
      name: "an unresolved historical reference retains high effort",
      input: { question: "Lanjutkan pembayaran tagihan yang tadi." },
      expected: "complex",
    },
    {
      name: "unknown intent is not optimistically downgraded",
      input: { question: "Tolong tangani masalah ini secepat mungkin." },
      expected: "complex",
    },
    {
      name: "a full unresolved tool catalog retains high effort",
      input: {
        question: "Berapa saldo rekening?",
        activeTools: Array.from({ length: 41 }, (_, index) => `reader${index}`),
      },
      expected: "complex",
    },
    {
      name: "an explicit no-write clause does not convert a factual query into an action",
      input: { question: "Berapa saldo rekening? Jangan ubah saldo atau stok." },
      expected: "simple",
    },
  ];
  for (const item of cases)
    it(item.name, (): void => {
      expect(classifyChatWorkload(item.input)).toBe(item.expected);
    });

  it("keeps long source instructions complex", (): void => {
    expect(classifyChatWorkload({ question: `Cek saldo. ${"konteks ".repeat(160)}` })).toBe(
      "complex",
    );
  });
});

describe("verified gateway family selection", () => {
  const cases: readonly {
    readonly profile: ChatWorkloadProfile;
    readonly effort: "low" | "medium" | "high";
  }[] = [
    { profile: "simple", effort: "low" },
    { profile: "bounded", effort: "medium" },
    { profile: "complex", effort: "high" },
  ];
  for (const item of cases)
    it(`pairs the ${item.profile} model variant with its matching effort`, (): void => {
      expect(
        selectNineRouterChatModel({
          normalizedModelId: "ag/gemini-3.8-flash-high",
          configuredReasoningEffort: "high",
          profile: item.profile,
        }),
      ).toEqual({
        modelId: `ag/gemini-3.8-flash-${item.effort}`,
        reasoningEffort: item.effort,
        adaptive: true,
      });
    });

  it("preserves configured model and effort when the profile is omitted", (): void => {
    expect(
      selectNineRouterChatModel({
        normalizedModelId: "ag/gemini-3.8-flash-medium",
        configuredReasoningEffort: "high",
      }),
    ).toEqual({
      modelId: "ag/gemini-3.8-flash-medium",
      reasoningEffort: "high",
      adaptive: false,
    });
  });

  it("preserves custom IDs, other providers and lookalike family names", (): void => {
    for (const modelId of [
      "custom/model-x",
      "cx/gpt-5.6-luna",
      "ag/gemini-3.7-flash-medium",
      "ag/gemini-3.8-flash-high-custom",
    ])
      expect(
        selectNineRouterChatModel({
          normalizedModelId: modelId,
          configuredReasoningEffort: "custom-effort",
          profile: "simple",
        }),
      ).toEqual({ modelId, reasoningEffort: "custom-effort", adaptive: false });
  });
});
