import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MorphedInputComposer } from "./morphed-input-composer";
import { requestUserInputSchema } from "@atria/core/ai/input-request";
import { normalizeInputRequestPayload } from "@atria/core/ai/input-request-flow";
import { buildSubmissionMessage, isFieldValid } from "../utils/input-request-fields";

const payload = requestUserInputSchema.parse({
  actionTitle: "Buat Proyek",
  fields: [
    { key: "projectName", label: "Nama Proyek", type: "text" },
    { key: "contractValue", label: "Nilai Kontrak", type: "currency" },
    {
      key: "clientId",
      label: "Klien",
      type: "select",
      options: [
        { value: "existing", label: "Klien terdaftar" },
        { value: "new", label: "+ Klien Baru (tulis di bawah)" },
      ],
    },
    { key: "newClientName", label: "Nama Klien Baru", type: "text", required: false },
  ],
});
test("new client selection exposes the name input underneath the client choice", () => {
  const html = renderToStaticMarkup(
    <MorphedInputComposer
      payload={payload}
      progress={{ currentStep: 2, furthestStep: 2, values: { clientId: "new" } }}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />,
  );
  expect(html).toContain("Nama Klien Baru");
  expect(html).toContain('type="text"');
});
test("registered client hides its stale new-client name and omits it from submission", () => {
  const normalized = normalizeInputRequestPayload(payload);
  const values = { clientId: "existing", newClientName: "Do not create this client" };
  const html = renderToStaticMarkup(
    <MorphedInputComposer
      payload={normalized}
      progress={{ currentStep: 2, furthestStep: 3, values }}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />,
  );
  expect(html).not.toContain("Nama Klien Baru");
  expect(buildSubmissionMessage(normalized, values)).not.toContain("Do not create this client");
});
test("empty new-client name blocks progression while a filled name can be submitted", () => {
  const normalized = normalizeInputRequestPayload(payload);
  const name = normalized.fields.find((field) => field.key === "newClientName");
  if (!name) throw new Error("Missing new-client name");
  expect(isFieldValid(name, "")).toBe(false);
  expect(isFieldValid(name, "Klien UI")).toBe(true);
  expect(
    buildSubmissionMessage(normalized, { clientId: "new", newClientName: "Klien UI" }),
  ).toContain("Nama Klien Baru: Klien UI");
});
