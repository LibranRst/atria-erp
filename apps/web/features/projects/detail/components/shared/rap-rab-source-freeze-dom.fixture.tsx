import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ComponentProps } from "react";
import {
  rapRabFixtureData,
  rapRabFixturePermissions,
} from "../../../../../.storybook/rap-rab-data.fixture";

const browser = new Window({
  url: "https://atria.test/projects/fixture?tab=rab&keep=1#rincian",
  width: 1440,
  height: 976,
});
Reflect.set(browser.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "NodeList",
  "HTMLCollection",
  "NodeFilter",
  "Event",
  "CustomEvent",
  "FocusEvent",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "ResizeObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  const value: unknown = key === "window" ? browser : Reflect.get(browser, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" &&
      ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browser)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => "/projects/fixture",
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "rap-rab-source-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

type Failure = {
  readonly success: false;
  readonly error: { readonly code: "CONFLICT"; readonly message: string };
};
const failure: Failure = {
  success: false,
  error: {
    code: "CONFLICT",
    message: "Perubahan sumber terdeteksi; draft tetap dapat diperbaiki.",
  },
};
const calls: { operation: string; args: readonly unknown[] }[] = [];
let release: ((result: Failure) => void) | null = null;
mock.module("@/lib/api/backend", () => ({
  callBackendAction: async (operation: string, args: readonly unknown[]): Promise<Failure> => {
    calls.push({ operation, args });
    return new Promise<Failure>((resolve) => {
      release = resolve;
    });
  },
  callBackendQuery: async (): Promise<Failure> => failure,
}));

type DrawersProps = ComponentProps<
  typeof import("./rap-rab-workflow-drawers").RapRabWorkflowDrawers
>;
/** Geometry probe only: the real manager, hooks, drafts, action payloads and pending state remain in use. */
function WorkflowProbe({
  rap,
  rabEstimate,
  rapManager,
  rabManager,
}: DrawersProps): React.JSX.Element {
  const rapItem = rap?.items[0];
  const rabItem = rabEstimate?.items.find((item) => item.id === rabManager.rabItemEditorId);
  return (
    <section aria-label="Workflow probe">
      <output id="probe-sources">
        {rap?.id ?? "no-rap"}|{rabEstimate?.id ?? "no-rab"}
      </output>
      <output id="probe-pending">{String(rapManager.isPending || rabManager.isPending)}</output>
      <button
        onClick={() => {
          if (rapItem) rapManager.openEditRapForm(rapItem);
        }}
      >
        Probe open RAP
      </button>
      <div hidden={!rapManager.showRapForm}>
        <form onSubmit={rapManager.handleSubmitRapItem}>
          <input
            aria-label="Probe RAP name"
            value={rapManager.rapForm.name}
            disabled={rapManager.isPending}
            onChange={(event) =>
              rapManager.setRapForm((previous) => ({ ...previous, name: event.target.value }))
            }
          />
          <button type="submit" disabled={rapManager.isPending}>
            Probe save RAP
          </button>
        </form>
        <button disabled={rapManager.isPending} onClick={rapManager.closeRapForm}>
          Probe close RAP
        </button>
      </div>
      <button onClick={() => rabManager.setRabItemEditorId(rabEstimate?.items[0]?.id ?? null)}>
        Probe open RAB
      </button>
      <div hidden={!rabManager.rabItemEditorId}>
        <input
          aria-label="Probe RAB label"
          value={rabItem ? (rabManager.rabDraftEdits[rabItem.id] ?? rabItem).clientLabel : ""}
          disabled={rabManager.isPending}
          onChange={(event) => {
            if (rabItem)
              rabManager.handleRabEditChange(rabItem, { clientLabel: event.target.value });
          }}
        />
        <button
          disabled={rabManager.isPending}
          onClick={() => {
            if (rabItem) rabManager.handleSaveRabItem(rabItem);
          }}
        >
          Probe save RAB
        </button>
        <button disabled={rabManager.isPending} onClick={rabManager.closeRabItemEditor}>
          Probe close RAB
        </button>
      </div>
      <button onClick={() => rabManager.setSourcePickerOpen(true)}>Probe open sources</button>
      <div hidden={!rabManager.sourcePickerOpen}>
        <output id="probe-selection">{rabManager.selectedRapQuotationIds.join(",")}</output>
        <button
          onClick={() => rabManager.setSelectedRapQuotationIds((previous) => previous.slice(1))}
        >
          Probe deselect first
        </button>
        <button onClick={() => rabManager.setSourcePickerOpen(false)}>Probe close sources</button>
      </div>
    </section>
  );
}
mock.module("./rap-rab-workflow-drawers", () => ({ RapRabWorkflowDrawers: WorkflowProbe }));

const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { DesktopUIProvider } = await import("@/components/ui");
const { RapRabManager } = await import("./rap-rab-manager");
const base = rapRabFixtureData("rab-draft");
assert.ok(base.rap && base.rabEstimate);
const originalRap = { ...base.rap, status: "DRAFT" };
const originalRab = base.rabEstimate;
const revisedRap = {
  ...originalRap,
  id: `${originalRap.id}-new`,
  revision: 3,
  items: originalRap.items.map((item) => ({ ...item, id: `${item.id}-new` })),
};
const revisedRab = {
  ...originalRab,
  id: `${originalRab.id}-new`,
  revision: 4,
  title: "Penawaran baru",
  items: originalRab.items.map((item) => ({ ...item, id: `${item.id}-new` })),
};
let incoming: ComponentProps<typeof RapRabManager> = {
  ...base,
  rap: originalRap,
  rabEstimate: originalRab,
  userRole: "OWNER",
  mode: "rab",
};
let active = false;
const onActive = (next: boolean): void => {
  active = next;
};
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function Fixture(): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider permissions={rapRabFixturePermissions("owner")}>
          <RapRabManager {...incoming} onWorkflowActiveChange={onActive} />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
  });
}
async function render(): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Fixture />);
  });
  await settle();
}
function element<T extends HTMLElement>(selector: string): T {
  const found = host.querySelector<T>(selector);
  assert.ok(found, `Found ${selector}`);
  return found;
}
function button(label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  assert.ok(found, `Found ${label}`);
  return found;
}
async function press(label: string): Promise<void> {
  await act(async (): Promise<void> => {
    button(label).click();
  });
  await settle();
}
async function type(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert.ok(setter);
  await act(async (): Promise<void> => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
async function resize(width: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
async function rejectWrite(): Promise<void> {
  const finish = release;
  assert.ok(finish);
  await act(async (): Promise<void> => {
    finish(failure);
  });
  release = null;
  await settle();
}
function sources(): string {
  return element<HTMLOutputElement>("#probe-sources").textContent ?? "";
}

try {
  await render();
  await press("Probe open RAP");
  assert.equal(active, true);
  const rapInput = element<HTMLInputElement>('input[aria-label="Probe RAP name"]');
  await type(rapInput, "RAP draft tetap");
  incoming = { ...incoming, rap: revisedRap, rabEstimate: revisedRab };
  await render();
  await resize(390);
  await resize(1440);
  assert.equal(element('input[aria-label="Probe RAP name"]'), rapInput, "RAP input DOM retained");
  assert.equal(rapInput.value, "RAP draft tetap");
  assert.equal(
    sources(),
    `${originalRap.id}|${originalRab.id}`,
    "Open workflow retains reviewed source",
  );
  await press("Probe save RAP");
  assert.equal(element("#probe-pending").textContent, "true");
  assert.equal(button("Probe close RAP").disabled, true);
  assert.match(calls[0]?.operation ?? "", /updateProjectRapItem$/);
  const rapPayload = calls[0]?.args[0];
  assert.ok(rapPayload && typeof rapPayload === "object");
  assert.equal(Reflect.get(rapPayload, "projectRapId"), originalRap.id);
  assert.equal(Reflect.get(rapPayload, "projectRapItemId"), originalRap.items[0]!.id);
  assert.equal(Reflect.get(rapPayload, "name"), "RAP draft tetap");
  await render();
  assert.equal(sources(), `${originalRap.id}|${originalRab.id}`);
  await rejectWrite();
  assert.equal(rapInput.value, "RAP draft tetap", "Failed write retains draft");
  assert.equal(active, true);
  await press("Probe close RAP");
  assert.equal(
    sources(),
    `${revisedRap.id}|${revisedRab.id}`,
    "Closed workflow adopts new revision",
  );
  assert.equal(active, false);

  await press("Probe open sources");
  assert.deepEqual(
    element("#probe-selection").textContent?.split(","),
    revisedRap.items.map((item) => item.id),
    "New source picker starts with valid cloned revision IDs",
  );
  await press("Probe deselect first");
  const selection = element("#probe-selection").textContent;
  assert.ok(selection && !selection.split(",").includes(revisedRap.items[0]!.id));
  incoming = { ...incoming, rap: null, rabEstimate: null };
  await render();
  await resize(360);
  await resize(1280);
  assert.equal(
    element("#probe-selection").textContent,
    selection,
    "Source selection retained across null incoming snapshot and resize",
  );
  assert.equal(sources(), `${revisedRap.id}|${revisedRab.id}`);
  await press("Probe close sources");
  assert.equal(sources(), "no-rap|no-rab");

  incoming = { ...incoming, rap: originalRap, rabEstimate: originalRab };
  await render();
  await press("Probe open RAB");
  const rabInput = element<HTMLInputElement>('input[aria-label="Probe RAB label"]');
  await type(rabInput, "Label klien tetap");
  incoming = { ...incoming, rap: null, rabEstimate: null };
  await render();
  await resize(390);
  await resize(1440);
  assert.equal(element('input[aria-label="Probe RAB label"]'), rabInput, "RAB input DOM retained");
  assert.equal(rabInput.value, "Label klien tetap");
  assert.equal(sources(), `${originalRap.id}|${originalRab.id}`);
  await press("Probe save RAB");
  assert.equal(element("#probe-pending").textContent, "true");
  assert.equal(button("Probe close RAB").disabled, true);
  assert.match(calls[1]?.operation ?? "", /updateRabEstimateItem$/);
  const rabPayload = calls[1]?.args[0];
  assert.ok(rabPayload && typeof rabPayload === "object");
  assert.equal(Reflect.get(rabPayload, "rabEstimateItemId"), originalRab.items[0]!.id);
  assert.equal(Reflect.get(rabPayload, "clientLabel"), "Label klien tetap");
  await rejectWrite();
  assert.equal(rabInput.value, "Label klien tetap");
  assert.equal(active, true);
  await press("Probe close RAB");
  assert.equal(sources(), "no-rap|no-rab");
  assert.equal(active, false);
  console.log("RAP/RAB actual manager source-freeze regression passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  browser.happyDOM.abort();
}
