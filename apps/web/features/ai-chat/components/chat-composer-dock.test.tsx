import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatComposerDock } from "./chat-composer-dock";
import { requestUserInputSchema } from "@atria/core/ai/input-request";
const props = {
  conversationId: "c-1",
  value: "Draft pesan",
  onChange: () => undefined,
  onSubmit: () => undefined,
  onStop: () => undefined,
  onWizardSubmit: () => undefined,
  onWizardCancel: () => undefined,
  isBusy: false,
};
const request = {
  toolCallId: "r-1",
  payload: requestUserInputSchema.parse({
    actionTitle: "Buat Proyek",
    fields: [{ key: "name", label: "Nama", type: "text" }],
  }),
};
test("structured requests automatically enter the composer wizard", () => {
  const html = renderToStaticMarkup(<ChatComposerDock {...props} request={request} />);
  expect(html).toContain("data-composer-wizard");
  expect(html).toContain("Buat Proyek");
  expect(html).toContain("Tulis pesan tanpa membatalkan isian");
});
test("active replies retain the ordinary Stop composer", () => {
  const html = renderToStaticMarkup(<ChatComposerDock {...props} isBusy request={request} />);
  expect(html).toContain("Hentikan jawaban");
  expect(html).not.toContain("data-composer-wizard");
});
test("controlled wizard state survives a fresh dock mount", () => {
  const html = renderToStaticMarkup(
    <ChatComposerDock
      {...props}
      request={request}
      wizardState={{
        progresses: {
          "r-1": { values: { name: "Draft tetap ada" }, currentStep: 0, furthestStep: 0 },
        },
        paused: [],
      }}
    />,
  );
  expect(html).toContain("Draft tetap ada");
  expect(html).toContain("data-composer-wizard");
});
test("paused controlled wizard returns to ordinary entry with its resume action", () => {
  const html = renderToStaticMarkup(
    <ChatComposerDock
      {...props}
      request={request}
      wizardState={{
        progresses: { "r-1": { values: { name: "Draft" }, currentStep: 0, furthestStep: 0 } },
        paused: ["r-1"],
      }}
    />,
  );
  expect(html).toContain("Lanjutkan isian");
  expect(html).not.toContain("data-composer-wizard");
});
