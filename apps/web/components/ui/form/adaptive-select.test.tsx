import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AdaptiveSelect } from "./select-form-controls";

function options(count: number): Array<{ value: string; label: string }> {
  return Array.from({ length: count }, (_, index) => ({
    value: String(index),
    label: `Pilihan ${index + 1}`,
  }));
}

function renderSelect(
  optionList: ReadonlyArray<{
    value: string;
    label: string;
    description?: string;
  }>,
  presentation?: "auto" | "menu" | "dialog" | "sheet",
): string {
  return renderToStaticMarkup(
    <AdaptiveSelect
      label="Status"
      value="0"
      options={optionList}
      onChange={() => undefined}
      presentation={presentation}
    />,
  );
}

describe("AdaptiveSelect", () => {
  test("renders a listbox trigger for up to six simple options", () => {
    expect(renderSelect(options(6))).toContain('aria-haspopup="listbox"');
  });

  test("renders a dialog trigger only when search is needed", () => {
    expect(renderSelect(options(7))).toContain('aria-haspopup="dialog"');
    expect(
      renderSelect([{ value: "0", label: "Aktif", description: "Proyek sedang berjalan" }]),
    ).toContain('aria-haspopup="listbox"');
  });

  test("honors explicit presentation overrides", () => {
    expect(renderSelect(options(8), "menu")).toContain('aria-haspopup="listbox"');
    expect(renderSelect(options(2), "dialog")).toContain('aria-haspopup="dialog"');
    expect(renderSelect(options(2), "sheet")).toContain('aria-haspopup="dialog"');
  });

  test("isolates floating focus guards from FormField sibling spacing", () => {
    const html = renderSelect(options(3));

    expect(html).toContain('<div class="min-w-0"><button');
  });

  test("generates a label and message association when no ID is supplied", () => {
    const html = renderToStaticMarkup(
      <AdaptiveSelect
        label="Status"
        helper="Pilih status proyek."
        value="0"
        options={options(2)}
        onChange={() => undefined}
      />,
    );
    const controlId = /<button[^>]*id="([^"]+)"/.exec(html)?.[1] ?? "";
    const labelFor = /<label[^>]*for="([^"]+)"/.exec(html)?.[1] ?? "";
    const messageId = /aria-describedby="([^"]+)"/.exec(html)?.[1] ?? "";

    expect(controlId.length).toBeGreaterThan(0);
    expect(labelFor).toBe(controlId);
    expect(html).toContain(`id="${messageId}"`);
    expect(html).toContain('aria-label="Status: Pilihan 1"');
  });
});
