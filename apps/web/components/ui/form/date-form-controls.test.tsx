import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { fileURLToPath } from "node:url";

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

test("date and quantity controls retain their nested keyboard and resize behavior", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./date-quantity-controls-dom.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn(["bun", "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain(
    "date and quantity controls preserve nested keyboard, values and resize ownership",
  );
}, 30000);
