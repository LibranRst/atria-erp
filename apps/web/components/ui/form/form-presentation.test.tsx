import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { FormField, Textarea, TextInput } from "./basic-form-controls";
import {
  FieldContextLine,
  FormSection,
  FormSheetPresentationBoundary,
  SmartDefaultHint,
} from "./guided-form";
import { FormPresentationProvider } from "./form-presentation-context";
import { ValuePreviewStrip } from "./form-support";
import { AdaptiveSelect } from "./select-form-controls";

describe("iOS grouped form presentation", () => {
  test("renders one white grouped panel with borderless field rows", () => {
    const html = renderToStaticMarkup(
      <FormSection title="Identitas">
        <FormField label="Nama" required>
          <TextInput value="Paduna" onChange={() => undefined} />
        </FormField>
        <AdaptiveSelect
          label="Status"
          value="ACTIVE"
          onChange={() => undefined}
          options={[{ value: "ACTIVE", label: "Aktif" }]}
        />
      </FormSection>,
    );

    expect(html).toContain("divide-y");
    expect(html).toContain("bg-surface-container-lowest");
    expect(html).toContain("border-0 bg-transparent px-0");
    expect(html).not.toContain("bg-surface-container-low px-5");
  });

  test("supports a headerless grouped surface without rendering an empty heading", () => {
    const html = renderToStaticMarkup(
      <FormSection>
        <FormField label="Email">
          <TextInput value="" onChange={() => undefined} />
        </FormField>
      </FormSection>,
    );

    expect(html).toContain("divide-y");
    expect(html).not.toContain("<h3");
  });

  test("keeps standalone inputs as white capsules", () => {
    const html = renderToStaticMarkup(<TextInput value="Paduna" onChange={() => undefined} />);

    expect(html).toContain("min-h-12");
    expect(html).toContain("rounded-full");
    expect(html).toContain("bg-surface-container-lowest");
  });

  test("supports explicit inline rows and keeps helper copy inside the row", () => {
    const html = renderToStaticMarkup(
      <FormSection title="Preferensi">
        <FormField label="Aktif" helper="Tersedia untuk transaksi baru." layout="inline">
          <button type="button">Ya</button>
        </FormField>
      </FormSection>,
    );

    expect(html).toContain("flex min-h-8 min-w-0 items-center gap-4");
    expect(html).toContain("Tersedia untuk transaksi baru.");
  });

  test("lets a grouped textarea grow without adding a nested rounded surface", () => {
    const html = renderToStaticMarkup(
      <FormSection title="Catatan">
        <FormField label="Catatan" error="Catatan wajib diisi.">
          <Textarea value="" onChange={() => undefined} />
        </FormField>
      </FormSection>,
    );

    expect(html).toContain("min-h-20");
    expect(html).toContain("bg-error-container/10");
    expect(html).not.toContain("min-h-24 resize-none rounded-2xl");
  });

  test("plain sections preserve standalone control geometry", () => {
    const html = renderToStaticMarkup(
      <FormSection title="Pencarian khusus" presentation="plain">
        <FormField label="Referensi">
          <TextInput value="" onChange={() => undefined} />
        </FormField>
      </FormSection>,
    );

    expect(html).toContain("space-y-2.5");
    expect(html).toContain("items-end justify-between gap-3 px-1");
    expect(html).toContain("rounded-full");
  });

  test("nested workflow sheets reset inherited grouped presentation", () => {
    const html = renderToStaticMarkup(
      <FormPresentationProvider presentation="grouped">
        <FormSheetPresentationBoundary>
          <FormField label="Keterangan">
            <TextInput value="Material" onChange={() => undefined} />
          </FormField>
        </FormSheetPresentationBoundary>
      </FormPresentationProvider>,
    );

    expect(html).toContain("rounded-full");
    expect(html).toContain("border-outline-variant/35 bg-surface-container-lowest px-5");
    expect(html).not.toContain(
      "group/form min-w-0 space-y-1 bg-surface-container-lowest px-4 py-3",
    );
  });

  test("indents context lines that sit directly inside a grouped panel", () => {
    // Kartu grouped memakai `rounded-3xl overflow-hidden`, jadi baris tanpa
    // padding membuat huruf pertama/terakhir terpotong lengkung sudut.
    const html = renderToStaticMarkup(
      <FormSection title="Dampak invoice">
        <FieldContextLine>Terbayar sebelum: Rp 0</FieldContextLine>
      </FormSection>,
    );

    expect(html).toContain("px-5 py-2.5");
  });

  test("keeps a standalone context line flush with its own container", () => {
    const html = renderToStaticMarkup(
      <FieldContextLine>Invoice INV-001 · Sisa Rp 5.100.000</FieldContextLine>,
    );

    expect(html).not.toContain("px-5");
  });

  test("does not double-indent the hint that brings its own row padding", () => {
    const html = renderToStaticMarkup(
      <FormSection title="Tim proyek">
        <SmartDefaultHint>hanya ada satu opsi aktif.</SmartDefaultHint>
      </FormSection>,
    );

    expect(html.match(/px-5/g)).toHaveLength(1);
  });

  test("lets a single value preview occupy the full available row", () => {
    const html = renderToStaticMarkup(
      <ValuePreviewStrip items={[{ label: "Subtotal komponen", amount: 12000000 }]} />,
    );

    expect(html).toContain("grid-cols-1");
    expect(html).not.toContain("grid-cols-2");
  });

  test("value previews retain explicit source cents without changing incumbent rounding", () => {
    const precise = renderToStaticMarkup(
      <ValuePreviewStrip
        items={[{ label: "Subtotal klien", amount: 1234567.25, fractionDigits: 2 }]}
      />,
    );
    const incumbent = renderToStaticMarkup(
      <ValuePreviewStrip items={[{ label: "Subtotal klien", amount: 1234567.25 }]} />,
    );

    expect(precise).toContain("1.234.567,25");
    expect(incumbent).toContain("1.234.567");
    expect(incumbent).not.toContain("1.234.567,25");
  });
});
