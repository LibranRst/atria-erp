import { expect, test } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { ProposalCardShell } from "./proposal-card-shell";

test("message-only proposal states do not expose a misleading save action", () => {
  const html = renderToString(
    <ProposalCardShell
      eyebrow="Material Master"
      title="Review material"
      status="idle"
      isAlreadyConfirmed={false}
      showConfirmAction={false}
      disabledReason="Analisis berjalan"
      onConfirm={async () => undefined}
    >
      Progres analisis
    </ProposalCardShell>,
  );
  expect(html).toContain("Analisis berjalan");
  expect(html).not.toContain("<button");
});
test("a completed proposal shows its result instead of another save", () => {
  const html = renderToString(
    <ProposalCardShell
      eyebrow="Material Master"
      title="Review material"
      status="submitted"
      isAlreadyConfirmed
      submittedMessage="8 material tersimpan"
      onConfirm={async () => undefined}
    >
      Hasil import
    </ProposalCardShell>,
  );
  expect(html).toContain("8 material tersimpan");
  expect(html).not.toContain("<button");
});
