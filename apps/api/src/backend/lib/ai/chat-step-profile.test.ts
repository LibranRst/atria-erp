import { expect, test } from "bun:test";
import { selectChatStepProfile } from "./chat-workload-policy";

const clear =
  "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA di Proyek Operasional QA. Jangan simpan perubahan.";
const base = {
  profile: "bounded" as const,
  stepNumber: 0,
  question: clear,
  activeTools: ["listProjects", "proposeExpenseDraft"],
};

test("only a clear first simple expense call is lighter; later steps retain the incumbent profile", (): void => {
  expect(selectChatStepProfile(base)).toBe("simple");
  expect(selectChatStepProfile({ ...base, stepNumber: 1 })).toBe("bounded");
  expect(selectChatStepProfile({ ...base, stepNumber: 2 })).toBe("bounded");
  expect(
    selectChatStepProfile({
      ...base,
      question:
        "Buat draf pengeluaran Lain-lain Rp20.000,50 untuk ongkir tambahan di proyek Rumah Pondok Indah.",
    }),
  ).toBe("simple");
});

test("references, batches, ambiguous targets, mixed workflows and malformed amounts stay incumbent", (): void => {
  for (const question of [
    "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA di Proyek QA.",
    "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA di proyek yang tadi.",
    "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA di proyek sama.",
    "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA. Pilih proyeknya.",
    "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA di Proyek Operasional QA lalu bayar tagihan.",
    "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi dan Rp20.000 untuk print di Proyek Operasional QA.",
    "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA di Proyek Operasional QA bulan lalu.",
    "Siapkan batch pengeluaran Operasional Rp15.000 untuk fotokopi QA di Proyek Operasional QA.",
    "Siapkan usulan pengeluaran Material Rp15.000 untuk panel QA di Proyek Operasional QA.",
    "Siapkan usulan pengeluaran Operasional Rp1.2.3 untuk fotokopi QA di Proyek Operasional QA.",
    "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA di Proyek Operasional QA?",
    "Siapkan usulan pengeluaran Operasional Rp15.000 untuk fotokopi QA\ndi Proyek Operasional QA.",
  ])
    expect(selectChatStepProfile({ ...base, question })).toBe("bounded");
});

test("complex, document, historical and other registries retain their existing profile", (): void => {
  expect(selectChatStepProfile({ ...base, profile: "complex" })).toBe("complex");
  expect(selectChatStepProfile({ ...base, profile: "simple" })).toBe("simple");
  expect(selectChatStepProfile({ ...base, hasAttachments: true })).toBe("bounded");
  expect(selectChatStepProfile({ ...base, historical: true })).toBe("bounded");
  expect(selectChatStepProfile({ ...base, activeTools: ["listProjects"] })).toBe("bounded");
  expect(selectChatStepProfile({ ...base, activeTools: ["proposeExpenseDraft"] })).toBe("bounded");
  expect(
    selectChatStepProfile({ ...base, activeTools: ["getBankBalances", "proposeBankCash"] }),
  ).toBe("bounded");
});
