import { expect, test } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { CompactEditableItemRow } from "./guided-form";

test("saved review rows stay readable and have no edit action", () => {
  const html = renderToString(
    <CompactEditableItemRow
      grouped
      title="Panel MDF"
      meta="Papan · lembar"
      status="complete"
      statusLabel="Tersimpan"
    />,
  );
  expect(html).toContain("Tersimpan");
  expect(html).not.toContain("<button");
  expect(html).not.toContain("disabled=");
});
test("editable review rows expose the actual selection label", () => {
  const html = renderToString(
    <CompactEditableItemRow
      grouped
      title="Panel MDF"
      meta="Papan · lembar"
      status="neutral"
      statusLabel="Belum dipilih"
      onClick={() => undefined}
    />,
  );
  expect(html).toContain("<button");
  expect(html).toContain('aria-label="Panel MDF. Belum dipilih. Papan · lembar"');
});

test("selection and edit have independent accessible targets without nested buttons", () => {
  const html = renderToString(
    <CompactEditableItemRow
      grouped
      title="Panel MDF"
      meta="Papan · lembar"
      status="neutral"
      statusLabel="Dipilih"
      selection={{ checked: true, onChange: () => undefined }}
      onClick={() => undefined}
    />,
  );
  expect(html).toContain('role="checkbox"');
  expect(html).toContain('aria-checked="true"');
  expect(html).toContain('aria-label="Pilih Panel MDF"');
  expect(html).toContain('aria-label="Panel MDF. Dipilih. Papan · lembar"');
  expect(html.match(/<button\b/g)).toHaveLength(2);
  expect(html).not.toMatch(/<button\b[^>]*>(?:(?!<\/button>).)*<button\b/s);
});
