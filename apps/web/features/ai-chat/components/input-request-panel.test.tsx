import { expect, test } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InputRequestPanel } from "./input-request-panel";
import { readActiveInputRequest } from "../utils/input-request-reader";
import { requestUserInputSchema } from "@atria/core/ai/input-request";

test("short clarification stays inline without replacing the message textarea", () => {
  const payload = requestUserInputSchema.parse({
    actionTitle: "Pilih kategori",
    fields: [
      {
        key: "category",
        label: "Kategori",
        type: "select",
        options: [
          { value: "a", label: "Kayu" },
          { value: "b", label: "Finishing" },
        ],
      },
    ],
  });
  const html = renderToStaticMarkup(
    <InputRequestPanel payload={payload} onSubmit={() => undefined} onCancel={() => undefined} />,
  );
  expect(html).toContain("Kayu");
  expect(html).toContain("Finishing");
  expect(html).toContain('role="radio"');
  expect(html).toContain('role="radiogroup" aria-label="Kategori"');
  expect(html).not.toContain('id="ai-chat-input"');
});
test("multiple fields offer a shared sheet and preserve message entry independently", () => {
  const payload = requestUserInputSchema.parse({
    actionTitle: "Lengkapi proyek",
    fields: [
      { key: "name", label: "Nama", type: "text" },
      { key: "value", label: "Nilai", type: "currency" },
    ],
  });
  const html = renderToStaticMarkup(
    <InputRequestPanel payload={payload} onSubmit={() => undefined} onCancel={() => undefined} />,
  );
  expect(html).toContain("2 isian diperlukan");
  expect(html).toContain("Isi data");
});
test("malformed model fields cannot crash clarification rendering", () => {
  expect(
    readActiveInputRequest(
      [
        {
          id: "a",
          role: "assistant",
          parts: [
            {
              type: "tool-requestUserInput",
              toolCallId: "x",
              state: "output-available",
              input: {},
              output: { fields: [null] },
            },
          ],
        },
      ],
      new Set(),
    ),
  ).toBeNull();
});
