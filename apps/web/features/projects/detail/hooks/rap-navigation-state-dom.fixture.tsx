import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { RapView } from "../types/rap-rab-types";

const browserWindow = new Window({
  url: "https://atria.test/projects/alpha?tab=rap&keep=one#plan",
  width: 1440,
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "MutationObserver",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  const value: unknown = key === "window" ? browserWindow : Reflect.get(browserWindow, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" && ["requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browserWindow)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { updateBrowserUrl } = await import("@/lib/utils/use-url-search-param");
const { useRapManagerForms } = await import("./use-rap-manager-forms");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const base: RapView = {
  id: "rap-alpha",
  revision: 1,
  status: "DRAFT",
  setupStage: "REVIEW",
  notes: null,
  tukangScopeSkipped: false,
  subconScopeSkipped: false,
  setupUpdatedById: null,
  items: [],
};

function Owner({ rap }: { readonly rap: RapView }): React.JSX.Element {
  const state = useRapManagerForms({
    rap,
    materials: [],
    budgetCategories: [],
    pricingTemplates: [],
  });
  return (
    <>
      <output id="stage">{state.activeRapStage}</output>
      <output id="view">{state.rapOverviewFilter}</output>
      <button type="button" id="material" onClick={() => state.setActiveRapStage("MATERIAL")}>
        Material
      </button>
      <button type="button" id="tukang" onClick={() => state.setActiveRapStage("TUKANG")}>
        Tukang
      </button>
      <button type="button" id="view-subcon" onClick={() => state.setRapOverviewFilter("SUBCON")}>
        Subcon
      </button>
      <button type="button" id="view-tukang" onClick={() => state.setRapOverviewFilter("TUKANG")}>
        Tukang
      </button>
      <button
        type="button"
        id="draft"
        onClick={() => state.setRapForm((form) => ({ ...form, name: "Isian tetap" }))}
      >
        Isi draft
      </button>
      <input id="draft-name" value={state.rapForm.name} readOnly />
    </>
  );
}

async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });
}
async function render(
  rap: RapView = base,
  presentation: "desktop" | "mobile" = "desktop",
  open = true,
): Promise<void> {
  await act(async (): Promise<void> =>
    root.render(
      <React.StrictMode>
        <WorkspacePresentationProvider presentation={presentation}>
          {open && <Owner rap={rap} />}
        </WorkspacePresentationProvider>
      </React.StrictMode>,
    ),
  );
  await settle();
}
function value(id: string): string {
  return document.getElementById(id)?.textContent ?? "";
}
async function click(id: string): Promise<void> {
  const element = document.getElementById(id);
  assert.ok(element instanceof HTMLButtonElement);
  await act(async (): Promise<void> => element.click());
  await settle();
}
async function visit(query: string, project = "alpha"): Promise<void> {
  await act(async (): Promise<void> =>
    updateBrowserUrl(`/projects/${project}?tab=rap&keep=one&${query}#plan`, "replace"),
  );
  await settle();
}
async function remount(
  rap: RapView,
  presentation: "desktop" | "mobile" = "desktop",
): Promise<void> {
  await render(rap, presentation, false);
  await render(rap, presentation);
}
function params(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

await render();
assert.equal(value("stage"), "REVIEW");
await click("tukang");
await click("view-subcon");
assert.equal(params().get("rap-stage"), "TUKANG");
assert.equal(params().get("rap-view"), "SUBCON");
assert.equal(params().get("rap-context"), "rap-alpha:1");
assert.equal(params().get("keep"), "one");
assert.equal(window.location.hash, "#plan");
await remount(base);
assert.equal(value("stage"), "TUKANG");
assert.equal(value("view"), "SUBCON");

await visit("rap-context=rap-alpha%3A1&rap-stage=REVIEW&rap-view=TUKANG");
assert.equal(value("stage"), "REVIEW");
assert.equal(value("view"), "TUKANG");
const initial: RapView = { ...base, setupStage: "MATERIAL" };
await render(initial);
assert.equal(value("stage"), "MATERIAL");
await visit("rap-context=rap-alpha%3A1&rap-stage=NOPE&rap-view=NOPE");
assert.equal(value("stage"), "MATERIAL");
assert.equal(value("view"), "MATERIAL");
await visit("rap-context=foreign%3A1&rap-stage=SUBCON&rap-view=SUBCON");
assert.equal(value("stage"), "MATERIAL");
assert.equal(value("view"), "MATERIAL");

await visit("rap-context=rap-alpha%3A1&rap-stage=MATERIAL&rap-view=SUBCON");
await render({ ...initial, revision: 2 });
assert.equal(value("stage"), "MATERIAL");
assert.equal(value("view"), "MATERIAL");
await visit("rap-context=rap-alpha%3A1&rap-stage=REVIEW&rap-view=SUBCON", "beta");
await render({ ...initial, id: "rap-beta" });
assert.equal(value("stage"), "MATERIAL");
assert.equal(value("view"), "MATERIAL");

await visit("rap-context=rap-alpha%3A1&rap-stage=TUKANG&rap-view=SUBCON");
await remount(base, "mobile");
assert.equal(value("stage"), "REVIEW");
assert.equal(value("view"), "MATERIAL");
const mobileUrl = window.location.href;
await click("material");
await click("view-tukang");
await click("draft");
const draftInput = document.getElementById("draft-name");
assert.ok(draftInput instanceof HTMLInputElement);
draftInput.focus();
await render(base);
assert.equal(value("stage"), "MATERIAL");
assert.equal(value("view"), "TUKANG");
assert.ok(document.getElementById("draft-name") === draftInput);
assert.equal(draftInput.value, "Isian tetap");
assert.equal(window.location.href, mobileUrl);

await visit("rap-context=rap-alpha%3A1&rap-stage=MATERIAL&rap-view=MATERIAL");
await remount(initial);
await click("tukang"); // Same setter used only after the existing writer has succeeded.
assert.equal(value("stage"), "TUKANG");
assert.equal(params().get("rap-stage"), "TUKANG");
await render(initial);
assert.equal(value("stage"), "TUKANG");
await render({ ...initial, setupStage: "TUKANG" });
assert.equal(value("stage"), "TUKANG");
await visit("rap-context=rap-alpha%3A1&rap-stage=REVIEW&rap-view=SUBCON");
assert.equal(value("stage"), "TUKANG");
assert.equal(value("view"), "SUBCON");

await act(async (): Promise<void> => root.unmount());
await browserWindow.happyDOM.cancelAsync();
console.log("RAP navigation retains scoped desktop URL, resize and confirmed stage intent");
