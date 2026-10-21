import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { FormField, MoneyInput, QuantityStepper, Textarea, TextInput } from "./basic-form-controls";

function association(html: string): { readonly controlId: string; readonly labelFor: string } {
  return {
    controlId: /<(?:input|textarea)[^>]*id="([^"]+)"/.exec(html)?.[1] ?? "",
    labelFor: /<label[^>]*for="([^"]+)"/.exec(html)?.[1] ?? "",
  };
}

describe("FormField association", () => {
  test("generates one stable label-control relationship", () => {
    const html = renderToStaticMarkup(
      <FormField label="Nama proyek" required>
        <TextInput value="" onChange={() => undefined} />
      </FormField>,
    );
    const result = association(html);

    expect(result.controlId.length).toBeGreaterThan(0);
    expect(result.labelFor).toBe(result.controlId);
    expect(html).toContain('required=""');
  });

  test("keeps explicit IDs authoritative", () => {
    const html = renderToStaticMarkup(
      <FormField label="Nama proyek" htmlFor="project-name">
        <TextInput id="project-name" value="Paduna" onChange={() => undefined} />
      </FormField>,
    );

    expect(association(html)).toEqual({ controlId: "project-name", labelFor: "project-name" });
  });

  test("links helper and error copy and marks invalid controls", () => {
    const helper = renderToStaticMarkup(
      <FormField label="Catatan" helper="Minimal 10 karakter.">
        <Textarea value="" onChange={() => undefined} />
      </FormField>,
    );
    const error = renderToStaticMarkup(
      <FormField label="Nominal" error="Nominal wajib diisi.">
        <MoneyInput value="" onChange={() => undefined} />
      </FormField>,
    );

    const helperId = /aria-describedby="([^"]+)"/.exec(helper)?.[1] ?? "";
    const errorId = /aria-describedby="([^"]+)"/.exec(error)?.[1] ?? "";
    expect(helper).toContain(`id="${helperId}"`);
    expect(error).toContain(`id="${errorId}"`);
    expect(error).toContain('aria-invalid="true"');
  });

  test("merges explicit and generated descriptions without duplication", () => {
    const html = renderToStaticMarkup(
      <FormField label="Nama" helper="Nama lengkap.">
        <TextInput
          value=""
          onChange={() => undefined}
          aria-describedby="external-note external-note"
        />
      </FormField>,
    );
    const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1] ?? "";

    expect(describedBy.split(" ").filter((id) => id === "external-note")).toHaveLength(1);
    expect(describedBy.split(" ")).toHaveLength(2);
  });

  test("associates QuantityStepper and labels both icon buttons", () => {
    const html = renderToStaticMarkup(
      <FormField label="Jumlah" required>
        <QuantityStepper value="1" onChange={() => undefined} />
      </FormField>,
    );

    expect(association(html).labelFor).toBe(association(html).controlId);
    expect(html).toContain('aria-label="Kurangi jumlah"');
    expect(html).toContain('aria-label="Tambah jumlah"');
  });

  test("does not collide generated IDs across sibling fields", () => {
    const html = renderToStaticMarkup(
      <>
        <FormField label="Nama">
          <TextInput value="" onChange={() => undefined} />
        </FormField>
        <FormField label="Catatan">
          <Textarea value="" onChange={() => undefined} />
        </FormField>
      </>,
    );
    const ids = [...html.matchAll(/<(?:input|textarea)[^>]*id="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
