import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  MaterialUpdateProposal,
  MaterialUpdateView,
  MaterialUpdateReceipt,
} from "@atria/core/ai/material-update";

const browserWindow = new Window({ url: "https://atria.test/ai", width: 390 });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  const value: unknown = key === "window" ? browserWindow : Reflect.get(browserWindow, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" &&
      ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browserWindow)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const before = {
  categoryId: "00000000-0000-0000-0000-000000000001",
  categoryName: "Panel",
  defaultVendorId: null,
  vendorName: null,
  name: "Panel Uji",
  unit: "lembar",
  specification: null,
  brand: null,
  code: "P-1",
  color: "Putih",
  isActive: true,
};
const proposal: MaterialUpdateProposal = {
  kind: "MATERIAL_MASTER_UPDATE",
  materialId: "00000000-0000-0000-0000-000000000002",
  expectedUpdatedAt: "2026-10-07T00:00:00.000Z",
  before,
  after: { ...before, color: "Hitam" },
};
let readResponse: ActionResponse<MaterialUpdateView> = {
  success: true,
  data: { proposal, status: "READY", confirmedAt: null },
};
let resolveSave: ((response: ActionResponse<MaterialUpdateReceipt>) => void) | undefined;
const sent: unknown[] = [];
mock.module("@/app/actions/ai/material-update", () => ({
  getAiMaterialUpdateProposal: async (): Promise<ActionResponse<MaterialUpdateView>> =>
    readResponse,
  confirmAiMaterialUpdateProposal: (
    input: unknown,
  ): Promise<ActionResponse<MaterialUpdateReceipt>> => {
    sent.push(input);
    return new Promise((resolve): void => {
      resolveSave = resolve;
    });
  },
}));
const { createRoot } = await import("react-dom/client");
const { MaterialUpdateProposalCard } = await import("./material-update-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const corrections: string[] = [];
let root = createRoot(host);
async function render(): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(
      <MaterialUpdateProposalCard
        proposal={proposal}
        conversationId="00000000-0000-0000-0000-000000000003"
        toolCallId="call-edit-1"
        isStreaming={false}
        isBusy={false}
        alreadyConfirmed={false}
        onFollowUp={(text): void => {
          corrections.push(text);
        }}
      />,
    );
  });
}
function button(text: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === text,
  );
}
async function remount(): Promise<void> {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  root = createRoot(host);
  await render();
}
await render();
assert.ok(host.textContent?.includes("Sebelum") && host.textContent.includes("Sesudah"));
assert.ok(host.textContent?.includes("Putih") && host.textContent.includes("Hitam"));
const confirm = button("Simpan perubahan");
assert.ok(confirm && !confirm.disabled, "server-ready proposal is reviewable");
await act(async (): Promise<void> => {
  confirm.click();
  confirm.click();
});
assert.equal(sent.length, 1, "double click sends one confirmation");
assert.deepEqual(
  sent[0],
  { conversationId: "00000000-0000-0000-0000-000000000003", toolCallId: "call-edit-1" },
  "confirmation sends identity only, never replacement values",
);
await act(async (): Promise<void> => {
  resolveSave?.({
    success: true,
    data: { materialId: proposal.materialId, alreadyConfirmed: false },
  });
});
assert.equal(button("Simpan perubahan") !== undefined, false);
assert.ok(host.textContent?.includes("tersimpan dan tercatat di audit"));
readResponse = {
  success: true,
  data: { proposal, status: "CONFIRMED", confirmedAt: "2026-10-07T00:01:00.000Z" },
};
await remount();
assert.equal(button("Simpan perubahan") !== undefined, false, "reloaded receipt stays completed");
readResponse = { success: true, data: { proposal, status: "STALE", confirmedAt: null } };
await remount();
assert.equal(
  button("Simpan perubahan") !== undefined,
  false,
  "stale data does not invite another save",
);
const revise = button("Minta usulan terbaru");
assert.ok(revise);
await act(async (): Promise<void> => {
  revise.click();
});
assert.equal(corrections.length, 1);
assert.ok(corrections[0].includes("data terbaru"));
readResponse = { success: false, error: { code: "FORBIDDEN", message: "Akses material dicabut." } };
await remount();
assert.ok(button("Simpan perubahan")?.disabled, "revocation prevents confirmation");
assert.ok(host.textContent?.includes("Akses material dicabut"));
await act(async (): Promise<void> => {
  root.unmount();
});
await browserWindow.happyDOM.close();
console.log("material update proposal DOM passed");
