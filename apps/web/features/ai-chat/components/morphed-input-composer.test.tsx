import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { UIMessage } from "ai";

import {
  buildSubmissionMessage,
  fieldNoun,
  formatFieldValue,
  isFieldValid,
  MorphedInputComposer,
  nextStepAfter,
  validationMessageFor,
} from "./morphed-input-composer";
import { readActiveInputRequest } from "../utils/input-request-reader";
import type { InputField, RequestUserInputPayload } from "@/lib/ai/tools/input-request-tools";

const samplePayload: RequestUserInputPayload = {
  actionTitle: "Buat Proyek Baru",
  description: "Lengkapi data proyek berikut:",
  fields: [
    {
      key: "projectName",
      label: "Nama Proyek",
      type: "text",
      placeholder: "Contoh: Sudirman Suites",
      required: true,
    },
    {
      key: "contractValue",
      label: "Nilai Kontrak",
      type: "currency",
      placeholder: "Contoh: Rp 500.000.000",
      required: true,
    },
    {
      key: "category",
      label: "Kategori Utama",
      type: "select",
      options: [
        { label: "Interior", value: "INTERIOR" },
        { label: "Sipil / Build", value: "BUILD" },
      ],
      required: true,
    },
  ],
};

function field(overrides: Partial<InputField> & Pick<InputField, "key" | "label" | "type">) {
  return { required: true, ...overrides } as InputField;
}

describe("MorphedInputComposer panel", () => {
  test("renders the action title, first field and an escape to normal message entry", () => {
    const html = renderToStaticMarkup(
      <MorphedInputComposer
        payload={samplePayload}
        onPause={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    // Judul aksi dulu hanya diterima sebagai prop dan tidak pernah tampil.
    expect(html).toContain("Buat Proyek Baru");
    expect(html).toContain("1/3");
    expect(html).toContain("Nama Proyek");
    expect(html).toContain("Contoh: Sudirman Suites");
    // Batal dan kembali kini sama-sama tersedia sejak langkah pertama.
    expect(html).toContain("Tulis pesan tanpa membatalkan isian");
    expect(html).toContain("Opsi pengisian");
    expect(html).toContain("Kembali ke langkah sebelumnya");
  });

  test("keeps the next control enabled so a blocked step can say why", () => {
    const html = renderToStaticMarkup(
      <MorphedInputComposer payload={samplePayload} onSubmit={() => {}} onCancel={() => {}} />,
    );

    // Ambil tag tombolnya sendiri, bukan potongan sampai akhir dokumen, supaya
    // urutan atribut JSX tidak menentukan hasil test.
    const nextButtonTag = html.match(/<button[^>]*Lanjut ke langkah berikutnya[^>]*>/)?.[0];
    expect(nextButtonTag).toBeDefined();
    expect(nextButtonTag).not.toMatch(/\sdisabled(?:=|\s|>)/);

    // Sebagai pembanding: tombol kembali memang mati di langkah pertama, jadi
    // test ini benar-benar bisa membedakan keduanya.
    const backButtonTag = html.match(/<button[^>]*Kembali ke langkah sebelumnya[^>]*>/)?.[0];
    expect(backButtonTag).toMatch(/\sdisabled(?:=|\s|>)/);

    // Slot pesan sudah ada sejak awal supaya panel tidak melonjak saat terisi.
    expect(html).toContain('aria-live="polite"');
  });

  test("shows no chip while nothing has been filled in yet", () => {
    const html = renderToStaticMarkup(
      <MorphedInputComposer payload={samplePayload} onSubmit={() => {}} onCancel={() => {}} />,
    );

    const chipList = html.match(/<ul[^>]*Isian yang sudah diisi[^>]*>([\s\S]*?)<\/ul>/)?.[1];
    expect(chipList).toBeDefined();
    // Chip untuk langkah aktif yang masih kosong hanya mengulang label di
    // bawahnya, jadi barisnya dibiarkan kosong sampai ada isian sungguhan.
    expect(chipList?.trim()).toBe("");
  });

  test("shows a chip once a field carries a value", () => {
    const prefilled: RequestUserInputPayload = {
      ...samplePayload,
      fields: samplePayload.fields.map((entry) =>
        entry.key === "projectName" ? { ...entry, defaultValue: "Sudirman Suites" } : entry,
      ),
    };

    const html = renderToStaticMarkup(
      <MorphedInputComposer payload={prefilled} onSubmit={() => {}} onCancel={() => {}} />,
    );

    const chipList = html.match(/<ul[^>]*Isian yang sudah diisi[^>]*>([\s\S]*?)<\/ul>/)?.[1];
    expect(chipList).toContain("Sudirman Suites");
  });

  test("uses the shared selector for short options and retains an explicit next action", () => {
    const selectPayload: RequestUserInputPayload = {
      actionTitle: "Catat Pengeluaran",
      fields: [
        field({
          key: "projectId",
          label: "Pilih Proyek",
          type: "select",
          options: [
            { label: "Sudirman Suites", value: "proj-1" },
            { label: "Menteng Mansion", value: "proj-2" },
          ],
        }),
      ],
    };

    const html = renderToStaticMarkup(
      <MorphedInputComposer payload={selectPayload} onSubmit={() => {}} onCancel={() => {}} />,
    );

    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain("Pilih proyek…");
    expect(html).toContain("Kirim ke asisten AI");
  });

  test("large option sets remain owned by the shared adaptive selection control", () => {
    const manyOptions = Array.from({ length: 6 }, (_, index) => ({
      label: `Proyek ${index + 1}`,
      value: `proj-${index + 1}`,
    }));
    const selectPayload: RequestUserInputPayload = {
      actionTitle: "Catat Pengeluaran",
      fields: [
        field({ key: "projectId", label: "Pilih Proyek", type: "select", options: manyOptions }),
      ],
    };

    const html = renderToStaticMarkup(
      <MorphedInputComposer payload={selectPayload} onSubmit={() => {}} onCancel={() => {}} />,
    );

    expect(html).toContain("Pilih proyek…");
  });
});

describe("fieldNoun", () => {
  test("strips a verb the label already starts with", () => {
    // Label "Pilih Proyek" dulu menghasilkan "Pilih pilih proyek…".
    expect(fieldNoun("Pilih Proyek")).toBe("proyek");
    expect(fieldNoun("Masukkan Nominal")).toBe("nominal");
  });

  test("leaves an ordinary label alone apart from casing", () => {
    expect(fieldNoun("Nama Proyek")).toBe("nama proyek");
  });
});

describe("nextStepAfter", () => {
  test("advances one step when already at the furthest point", () => {
    expect(nextStepAfter(0, 0, 3)).toBe(1);
    expect(nextStepAfter(1, 1, 3)).toBe(2);
  });

  test("moves sequentially after editing an earlier field", () => {
    expect(nextStepAfter(1, 4, 6)).toBe(2);
  });

  test("submits only from the last step", () => {
    expect(nextStepAfter(2, 2, 3)).toBe("submit");
    expect(nextStepAfter(0, 0, 1)).toBe("submit");
  });
});

describe("isFieldValid", () => {
  test("rejects an empty or zero value on required fields", () => {
    expect(isFieldValid(field({ key: "a", label: "A", type: "text" }), "  ")).toBe(false);
    expect(isFieldValid(field({ key: "b", label: "B", type: "currency" }), "0")).toBe(false);
    expect(isFieldValid(field({ key: "c", label: "C", type: "number" }), "0")).toBe(false);
  });

  test("accepts a filled value", () => {
    expect(isFieldValid(field({ key: "a", label: "A", type: "text" }), "Halo")).toBe(true);
    expect(isFieldValid(field({ key: "b", label: "B", type: "currency" }), "500000")).toBe(true);
  });

  test("always accepts an optional field", () => {
    expect(isFieldValid(field({ key: "a", label: "A", type: "text", required: false }), "")).toBe(
      true,
    );
  });
});

describe("validationMessageFor", () => {
  test("states the action to take, not the verdict", () => {
    expect(validationMessageFor(field({ key: "a", label: "Nilai", type: "currency" }))).toBe(
      "Masukkan nominal lebih dari Rp 0.",
    );
    expect(validationMessageFor(field({ key: "b", label: "Nama Proyek", type: "text" }))).toBe(
      "Isi nama proyek terlebih dahulu.",
    );
  });

  test("does not double the verb on a label that already carries one", () => {
    expect(validationMessageFor(field({ key: "c", label: "Pilih Proyek", type: "select" }))).toBe(
      "Pilih proyek terlebih dahulu.",
    );
  });
});

describe("formatFieldValue", () => {
  test("formats currency and resolves a select to its label", () => {
    expect(formatFieldValue(field({ key: "a", label: "A", type: "currency" }), "500000")).toBe(
      "Rp 500.000",
    );
    expect(
      formatFieldValue(
        field({
          key: "b",
          label: "B",
          type: "select",
          options: [{ label: "Interior", value: "INTERIOR" }],
        }),
        "INTERIOR",
      ),
    ).toBe("Interior");
  });
});

describe("buildSubmissionMessage", () => {
  test("lists every field with its display value", () => {
    const message = buildSubmissionMessage(samplePayload, {
      projectName: "Sudirman Suites",
      contractValue: "500000000",
      category: "INTERIOR",
    });

    expect(message).toContain("Berikut data untuk Buat Proyek Baru:");
    expect(message).toContain("- Nama Proyek: Sudirman Suites");
    expect(message).toContain("- Nilai Kontrak: Rp 500.000.000");
    // Kode pilihan tidak boleh bocor ke AI sebagai ganti labelnya.
    expect(message).toContain("- Kategori Utama: Interior");
  });
});

describe("readActiveInputRequest Utility", () => {
  test("returns null when no tool-requestUserInput in messages", () => {
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Halo AI" }],
      },
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Halo, ada yang bisa dibantu?" }],
      },
    ];

    const result = readActiveInputRequest(messages, new Set());
    expect(result).toBeNull();
  });

  test("detects tool-requestUserInput from assistant message", () => {
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Buatkan proyek baru" }],
      },
      {
        id: "msg-2",
        role: "assistant",
        parts: [
          {
            type: "tool-requestUserInput" as `tool-${string}`,
            toolCallId: "call-123",
            output: samplePayload,
          } as unknown as UIMessage["parts"][number],
        ],
      },
    ];

    const result = readActiveInputRequest(messages, new Set());
    expect(result).not.toBeNull();
    expect(result?.toolCallId).toBe("call-123");
    expect(result?.payload.actionTitle).toBe("Buat Proyek Baru");
    expect(result?.payload.fields.length).toBe(3);
  });

  test("returns null if toolCallId is already dismissed", () => {
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-requestUserInput" as `tool-${string}`,
            toolCallId: "call-123",
            output: samplePayload,
          } as unknown as UIMessage["parts"][number],
        ],
      },
    ];

    const result = readActiveInputRequest(messages, new Set(["call-123"]));
    expect(result).toBeNull();
  });
});
