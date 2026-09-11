import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DatePickerField } from "./date-form-controls";

describe("DatePickerField association", () => {
  test("generates a stable label, trigger, and helper relationship", () => {
    const html = renderToStaticMarkup(
      <DatePickerField
        label="Tanggal pembayaran"
        helper="Gunakan tanggal bukti transfer."
        value="2026-09-09"
        onChange={() => undefined}
        required
      />,
    );
    const controlId = /<button[^>]*id="([^"]+)"/.exec(html)?.[1] ?? "";
    const labelFor = /<label[^>]*for="([^"]+)"/.exec(html)?.[1] ?? "";
    const messageId = /aria-describedby="([^"]+)"/.exec(html)?.[1] ?? "";

    expect(controlId.length).toBeGreaterThan(0);
    expect(labelFor).toBe(controlId);
    expect(html).toContain(`id="${messageId}"`);
    expect(html).toContain('aria-label="Tanggal pembayaran: 09 Sep 2026"');
  });
});
