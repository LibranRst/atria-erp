import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { FormField, Textarea, TextInput } from "./basic-form-controls";
import { FormSection, FormSheetPresentationBoundary } from "./guided-form";
import { FormPresentationProvider } from "./form-presentation-context";
import { ValuePreviewStrip } from "./form-support";
import { SheetSelect } from "./select-form-controls";

describe("iOS grouped form presentation", () => {
  test("renders one white grouped panel with borderless field rows", () => {
    const html = renderToStaticMarkup(
      <FormSection title="Identitas">
        <FormField label="Nama" required>
          <TextInput value="Atria" onChange={() => undefined} />
        </FormField>
        <SheetSelect
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

  test("keeps standalone inputs as white capsules", () => {
    const html = renderToStaticMarkup(<TextInput value="Atria" onChange={() => undefined} />);

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

  test("lets a single value preview occupy the full available row", () => {
    const html = renderToStaticMarkup(
      <ValuePreviewStrip items={[{ label: "Subtotal komponen", amount: 12000000 }]} />,
    );

    expect(html).toContain("grid-cols-1");
    expect(html).not.toContain("grid-cols-2");
  });
});
