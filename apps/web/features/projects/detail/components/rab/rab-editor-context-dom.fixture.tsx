import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { RapRabFixtureData } from "../../../../../.storybook/rap-rab-data.fixture";
import type { refreshRabLinkedSources } from "@/app/actions/project/revision-change-order";
import { rabExportTotal, rabPrintableSchema } from "@atria/core/ai/rab-export";

const browser = new Window({
  url: "https://atria.test/projects/rab-context?tab=rab&keep=1#client",
  width: 1024,
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
const navigation = await import("next/navigation");
mock.module("next/navigation", (): typeof navigation => ({
  ...navigation,
  usePathname: (): string => "/projects/rab-context",
  useSearchParams: (): ReturnType<typeof navigation.useSearchParams> =>
    new navigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof navigation.useRouter> => ({
    bfcacheId: "rab-context",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
type RefreshResult = Awaited<ReturnType<typeof refreshRabLinkedSources>>;
let refreshCalls = 0;
let finishRefresh: ((result: RefreshResult) => void) | undefined;
const revisions = await import("@/app/actions/project/revision-change-order");
mock.module("@/app/actions/project/revision-change-order", () => ({
  ...revisions,
  refreshRabLinkedSources: (): Promise<RefreshResult> => {
    refreshCalls += 1;
    return new Promise((resolve) => {
      finishRefresh = resolve;
    });
  },
}));
let writes = 0;
function blockedWrite(): Promise<never> {
  writes += 1;
  return Promise.reject(new Error("RAB context audit must not save or approve business data"));
}
const mutations = await import("@/app/actions/project/rap-rab");
mock.module("@/app/actions/project/rap-rab", () => ({
  ...mutations,
  addRabManualItem: blockedWrite,
  approveRabEstimate: blockedWrite,
  createRabBundle: blockedWrite,
  deleteRabBundle: blockedWrite,
  generateRabFromSelectedSources: blockedWrite,
  updateRabBundle: blockedWrite,
  updateRabEstimateItem: blockedWrite,
}));
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { DesktopUIProvider } = await import("@/components/ui");
const { RapRabManager } = await import("../shared/rap-rab-manager");
const { rapRabFixtureData, rapRabFixturePermissions } =
  await import("../../../../../.storybook/rap-rab-data.fixture");
const { buildRabExcelRows } = await import("../../utils/rab-export-utils");
const ownerPermissions = rapRabFixturePermissions("owner");
const base = rapRabFixtureData("rab-draft");
assert(base.rabEstimate);
const seed = base.rabEstimate;
const visibleBundleSource = seed.bundles[0];
const hiddenBundleSource = seed.bundles[1];
const memberSource = seed.items[0];
const hiddenMemberSource = seed.items[3];
const plainSource = seed.items[5];
const otherSource = seed.items[6];
assert(
  visibleBundleSource &&
    hiddenBundleSource &&
    memberSource &&
    hiddenMemberSource &&
    plainSource &&
    otherSource,
);
const visibleBundle = {
  ...visibleBundleSource,
  clientLabel: "Paket kitchen klien",
  quantity: "1.25",
  unitPrice: "100.25",
  lineTotal: "125.31",
  displayOrder: 1,
  itemIds: [memberSource.id],
};
const hiddenBundle = {
  ...hiddenBundleSource,
  clientLabel: "Alternatif paket tersembunyi",
  quantity: "1.00",
  unitPrice: "19.75",
  lineTotal: "19.75",
  displayOrder: 3,
  isHidden: true,
  itemIds: [hiddenMemberSource.id],
};
const member = {
  ...memberSource,
  clientLabel: "Anggota paket kitchen",
  quantity: "1.25",
  unitPrice: "10.25",
  lineTotal: "12.81",
  displayOrder: 2,
  bundleId: visibleBundle.id,
  isHidden: false,
};
const hiddenMember = {
  ...hiddenMemberSource,
  clientLabel: "Anggota alternatif paket",
  quantity: "2.00",
  unitPrice: "21.61",
  lineTotal: "43.21",
  displayOrder: 4,
  bundleId: hiddenBundle.id,
  isHidden: false,
};
const plain = {
  ...plainSource,
  clientLabel: "Panel ruang keluarga",
  quantity: "2.50",
  unitPrice: "20.25",
  lineTotal: "50.63",
  displayOrder: 5,
  bundleId: null,
  isHidden: false,
};
const other = {
  ...otherSource,
  clientLabel: "Aksesori tambahan klien",
  quantity: "1.00",
  unitPrice: "2.25",
  lineTotal: "2.25",
  displayOrder: 6,
  bundleId: null,
  isHidden: false,
};
const data: RapRabFixtureData = {
  ...base,
  rabEstimate: {
    ...seed,
    items: [other, member, plain, hiddenMember],
    bundles: [hiddenBundle, visibleBundle],
  },
  staleSourceLabels: [plain.clientLabel],
};
const documentBefore = JSON.stringify(data.rabEstimate);
const estimate = data.rabEstimate;
assert(estimate);
const exportedBefore = buildRabExcelRows(estimate, data.exportMetadata);
const visibility = document.createElement("style");
visibility.textContent =
  ".hidden{display:none}@media(min-width:1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
document.head.append(visibility);
function Owner({
  source,
  permissions,
}: {
  readonly source: RapRabFixtureData;
  readonly permissions: readonly PermissionKey[];
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider permissions={permissions}>
          <RapRabManager {...source} userRole="OWNER" mode="rab" />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 45));
  });
}
async function render(
  source: RapRabFixtureData,
  key: string,
  permissions = ownerPermissions,
): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Owner key={key} source={source} permissions={permissions} />);
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
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert") ||
      getComputedStyle(current).display === "none"
    )
      return false;
  return true;
}
function table(): HTMLTableElement {
  const found = [
    ...host.querySelectorAll<HTMLTableElement>('table[aria-label="Item dan paket RAB klien"]'),
  ].find(visible);
  assert(found);
  return found;
}
function row(label: string): HTMLElement {
  const found = [...table().querySelectorAll<HTMLElement>("tbody tr")].find((element) =>
    element.textContent?.includes(label),
  );
  assert(found, `Client row ${label} exists`);
  return found;
}
function findButton(label: string, owner: ParentNode = document): HTMLButtonElement | undefined {
  return [...owner.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => visible(element) && element.textContent?.trim() === label,
  );
}
function button(label: string, owner: ParentNode = document): HTMLButtonElement {
  const found = findButton(label, owner);
  assert(found, `Visible action ${label} exists`);
  return found;
}
async function click(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1 }),
    );
    element.focus();
  });
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 0,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }),
    );
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }),
    );
  });
  await settle();
}
async function keyboard(element: HTMLElement, key: "Enter" | " "): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  });
  await settle();
}
function dialog(title: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (element) => element.getAttribute("aria-label") === title,
  );
  assert(found, `Shared ${title} owner is open`);
  return found;
}
async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = performance.now() + 5_000;
  while (!condition() && performance.now() < deadline)
    await act(async (): Promise<void> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    });
}
async function closeClean(title: string, invoker: HTMLElement): Promise<void> {
  const close = dialog(title).querySelector<HTMLButtonElement>('button[aria-label="Tutup"]');
  assert(close);
  await click(close);
  await waitFor(
    () =>
      document.querySelectorAll('[role="dialog"]').length === 0 &&
      document.activeElement === invoker,
  );
  assert.equal(
    document.querySelectorAll('[role="dialog"]').length,
    0,
    "Clean close creates no discard overlay",
  );
  assert(
    Boolean(document.activeElement === invoker),
    "Clean close restores the exact existing opener",
  );
}
function field(title: string, label: string): HTMLInputElement {
  const target = [...dialog(title).querySelectorAll("label")].find(
    (element) => element.textContent?.trim() === label,
  );
  const id = target?.getAttribute("for");
  const input = id ? document.getElementById(id) : null;
  assert(input instanceof HTMLInputElement, `Existing ${label} input is associated`);
  return input;
}
async function type(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert(setter);
  await act(async (): Promise<void> => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function context(): HTMLElement {
  const found = host.querySelector<HTMLElement>('[aria-label="Rincian baris RAB"]');
  assert(found);
  return found;
}
try {
  await render(data, "line");
  assert.equal(findButton("Edit item"), undefined);
  assert.equal(findButton("Edit paket"), undefined);
  await keyboard(row(plain.clientLabel), "Enter");
  assert(Boolean(document.activeElement === button("Kembali ke daftar")));
  const editLine = button("Edit item");
  await click(editLine);
  assert.equal(field("Edit Item RAB", "Nama item").value, plain.clientLabel);
  assert.equal(field("Edit Item RAB", "Jumlah").value, plain.quantity);
  assert.equal(field("Edit Item RAB", "Harga satuan klien").value, plain.unitPrice);
  assert(
    dialog("Edit Item RAB").textContent?.includes("50,63"),
    "Fractional item preview retains cents",
  );
  await closeClean("Edit Item RAB", editLine);
  await click(editLine);
  await resize(390);
  const mobileClose = dialog("Edit Item RAB").querySelector<HTMLButtonElement>(
    'button[aria-label="Tutup"]',
  );
  assert(mobileClose);
  await click(mobileClose);
  await waitFor(
    () =>
      document.querySelectorAll('[role="dialog"]').length === 0 &&
      document.activeElement !== document.body &&
      Boolean(document.activeElement && visible(document.activeElement)),
  );
  const returnedFocus = document.activeElement;
  const mobileFocusValid =
    returnedFocus !== null && returnedFocus !== document.body && visible(returnedFocus);
  assert(
    mobileFocusValid,
    "Closing a desktop-opened editor while mobile returns focus to a visible owning context",
  );
  assert.equal(
    returnedFocus?.getAttribute("aria-label"),
    "RAB proyek",
    "When the original desktop opener is hidden, focus returns to the stable client workflow section",
  );
  await resize(1024);
  await click(button("Edit item"));
  const name = field("Edit Item RAB", "Nama item");
  await type(name, "Nama klien yang sedang diedit");
  await resize(390);
  await resize(1440);
  assert(Boolean(field("Edit Item RAB", "Nama item") === name));
  assert(Boolean(document.activeElement === name));
  await render(
    {
      ...data,
      rabEstimate: {
        ...estimate,
        status: "APPROVED",
        items: estimate.items.map((item) => ({
          ...item,
          clientLabel: "Incoming source replacement",
        })),
      },
    },
    "line",
  );
  assert.equal(
    name.value,
    "Nama klien yang sedang diedit",
    "Incoming revision cannot replace an open client edit draft",
  );
  assert(Boolean(field("Edit Item RAB", "Nama item") === name));
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);

  await resize(1024);
  await render(data, "bundle");
  await keyboard(row(visibleBundle.clientLabel), " ");
  const editBundle = button("Edit paket");
  await click(editBundle);
  assert.equal(field("Edit Paket RAB", "Nama paket").value, visibleBundle.clientLabel);
  assert.equal(field("Edit Paket RAB", "Harga paket untuk klien").value, visibleBundle.unitPrice);
  assert(
    dialog("Edit Paket RAB").textContent?.includes("125,31"),
    "Fractional bundle preview retains cents",
  );
  await closeClean("Edit Paket RAB", editBundle);
  const memberOpen = button("Rincian item", context());
  await click(memberOpen);
  assert.equal(field("Edit Item RAB", "Nama item").value, member.clientLabel);
  await closeClean("Edit Item RAB", memberOpen);

  await render(data, "hidden-parent-editor");
  await keyboard(row(hiddenBundle.clientLabel), "Enter");
  const hiddenMemberOpen = button("Rincian item", context());
  await click(hiddenMemberOpen);
  const hiddenEditor = dialog("Edit Item RAB");
  assert(hiddenEditor.textContent?.includes("Tidak, paket disembunyikan"));
  assert(hiddenEditor.textContent?.includes("Visibilitas item"));
  assert(hiddenEditor.textContent?.includes("Ditampilkan"));
  assert.equal(hiddenMember.isHidden, false);
  await closeClean("Edit Item RAB", hiddenMemberOpen);

  await render(data, "readonly", rapRabFixturePermissions("read-only"));
  await keyboard(row(hiddenBundle.clientLabel), "Enter");
  assert.equal(findButton("Edit paket"), undefined);
  const readonlyMember = button("Rincian item", context());
  await click(readonlyMember);
  const readonly = dialog("Detail Item RAB");
  assert(readonly.textContent?.includes(hiddenMember.clientLabel));
  assert(readonly.textContent?.includes("Tidak, paket disembunyikan"));
  assert(readonly.textContent?.includes("21,61"));
  assert(
    readonly.textContent?.includes("43,21"),
    "Read-only subtotal uses the stored source amount, without recomputing it",
  );
  assert.equal(readonly.querySelectorAll("input,textarea").length, 0);
  await closeClean("Detail Item RAB", readonlyMember);
  assert.equal(
    hiddenMember.isHidden,
    false,
    "Effective visibility must not rewrite the member's own flag",
  );
  await resize(390);
  const readonlyBundle = [...host.querySelectorAll<HTMLButtonElement>("#rab-items button")].find(
    (element) => visible(element) && element.textContent?.includes(visibleBundle.clientLabel),
  );
  assert(
    readonlyBundle,
    "Existing mobile handoff can inspect a draft bundle with read-only rights",
  );
  await click(readonlyBundle);
  const readonlyBundleDetail = dialog("Detail Paket RAB");
  assert.equal(
    readonlyBundleDetail.querySelectorAll("input,textarea").length,
    0,
    "A read-only custom role cannot enter the draft bundle editor",
  );
  assert.equal(findButton("Simpan"), undefined);
  assert.equal(findButton("Bongkar Paket"), undefined);
  const exactBundleFacts = [...readonlyBundleDetail.querySelectorAll("[title],[aria-label]")].map(
    (element) =>
      `${element.getAttribute("title") ?? ""} ${element.getAttribute("aria-label") ?? ""}`,
  );
  assert(
    exactBundleFacts.some((value) => value.includes("100,25")),
    "Compact bundle price retains exact cents for inspection",
  );
  assert(
    exactBundleFacts.some((value) => value.includes("125,31")),
    "Compact bundle subtotal retains its stored exact cents",
  );
  await closeClean("Detail Paket RAB", readonlyBundle);
  await resize(1024);

  await render({ ...data, rabEstimate: { ...estimate, status: "APPROVED" } }, "approved");
  await keyboard(row(visibleBundle.clientLabel), "Enter");
  assert.equal(findButton("Edit paket"), undefined);
  const approvedMember = button("Rincian item", context());
  await click(approvedMember);
  assert(dialog("Detail Item RAB"));
  assert.equal(findButton("Simpan"), undefined);
  await closeClean("Detail Item RAB", approvedMember);

  await render(data, "pending");
  await keyboard(row(visibleBundle.clientLabel), "Enter");
  const pendingEdit = button("Edit paket");
  const pendingMember = button("Rincian item", context());
  await click(button("Perbarui sumber"));
  assert.equal(refreshCalls, 1);
  assert(pendingEdit.disabled);
  assert(pendingMember.disabled, "Source-refresh pending blocks the member editor handoff too");
  await click(pendingMember);
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 0);
  assert(finishRefresh);
  await act(async (): Promise<void> => {
    finishRefresh?.({
      success: false,
      error: { code: "CONFLICT", message: "Safe refresh fixture complete" },
    });
  });
  await settle();
  assert(!pendingMember.disabled);

  await render(data, "order");
  const beforeRows = [...table().querySelectorAll("tbody tr")].map((item) => item.textContent);
  const heading = [...table().querySelectorAll<HTMLElement>('[role="columnheader"]')].find((item) =>
    item.textContent?.includes("Subtotal"),
  );
  assert(heading);
  await click(heading);
  const afterRows = [...table().querySelectorAll("tbody tr")].map((item) => item.textContent);
  assert.notDeepEqual(afterRows, beforeRows, "Table sorting changes only the browsing order");
  assert.equal(JSON.stringify(estimate), documentBefore);
  assert.deepEqual(buildRabExcelRows(estimate, data.exportMetadata), exportedBefore);
  assert.equal(
    rabExportTotal(estimate),
    "178.19",
    "Visible document totals include each bundle once and exclude hidden parents/members",
  );
  const printable = rabPrintableSchema.parse(estimate);
  const printJSON = JSON.stringify(printable);
  assert(!printJSON.includes("sourceProjectRapItemId"));
  assert(!printJSON.includes("sourceProjectCategoryPlanItemId"));
  assert(!printJSON.includes("sourceRevision"));
  assert(!printJSON.includes("estimatedUnitCost"));
  assert.equal(writes, 0);
  assert.equal(window.location.hash, "#client");
  assert.equal(new URLSearchParams(window.location.search).get("keep"), "1");
  console.log(
    "Actual RAB context handoffs preserve client draft, focus, effective visibility and document truth",
  );
} finally {
  if (finishRefresh)
    await act(async (): Promise<void> => {
      finishRefresh?.({ success: false, error: { code: "CONFLICT", message: "Fixture cleanup" } });
    });
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browser.happyDOM.close();
}
