import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormSection } from "./guided-form";
import { FormField, TextInput } from "./basic-form-controls";
test("embedded sections retain grouped associations without creating another owning surface", () => {
  const html = renderToStaticMarkup(
    <FormSection presentation="embedded">
      <FormField label="Nama">
        <TextInput value="Panel" onChange={() => undefined} />
      </FormField>
    </FormSection>,
  );
  expect(html).toContain('data-grouped="true"');
  expect(html).toContain("Nama");
  expect(html).not.toContain("shadow-surface");
  expect(html).not.toContain("rounded-3xl");
});
