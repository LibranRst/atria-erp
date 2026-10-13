import { FixtureFooterActions } from "./proposal-footer.fixture";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import type {
  CatalogSettingsProposal,
  CatalogSettingsView,
  CatalogSettingsReceipt,
} from "@atria/core/ai/catalog-settings";
import type { ActionResponse } from "@atria/core/types/action-response";
const browserWindow = new Window({ url: "https://atria.test/ai", width: 1280 });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
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
const id = "10000000-0000-4000-8000-000000000001";
const ids = Array.from(
  { length: 7 },
  (_, i) => `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
let proposal: CatalogSettingsProposal = {
  kind: "CATALOG_SETTINGS",
  action: "PRICING_TEMPLATE_SAVE",
  projectId: null,
  budget: null,
  title: "Template harga",
  entityName: "Template uji",
  meta: "Material · lembar",
  contextHash: "a".repeat(64),
  input: {
    action: "PRICING_TEMPLATE_SAVE",
    payload: {
      expenseCategoryId: id,
      itemType: "CLIENT_LINE",
      itemCategory: "Finishing",
      name: "Template uji",
      unit: "ls",
      pricingMode: "FIXED_CLIENT_PRICE",
      targetGrossPercentage: 0.2,
      fixedClientPrice: 70,
      priceSourceType: "VENDOR_QUOTE",
      sourceNote: "Penawaran manusia",
      effectiveFrom: "2026-10-10T00:00:00.000Z",
      components: ids.map((_, i) => ({
        label: `Panel ${i + 1}`,
        componentType: "MATERIAL",
        quantity: 1,
        unit: "lembar",
        unitCost: 10,
      })),
    },
  },
  effect: "Template sumber untuk input berikutnya; kas tetap.",
  rows: ids.map((id, i) => ({
    id,
    title: `Panel ${i + 1}`,
    meta: "1 lembar",
    amount: 10,
    comparisons: [],
    details: [{ label: "Sumber", value: "Penawaran manusia", money: false }],
  })),
  summary: [{ label: "Harga jual", value: 70, money: true }],
};
let viewStatus: CatalogSettingsView["status"] = "READY",
  desktop = true,
  permissionAllowed = true,
  readError: string | null = null;
const calls: unknown[] = [];
let resolveSave: ((result: ActionResponse<CatalogSettingsReceipt>) => void) | null = null;
mock.module("@/app/actions/ai/catalog-settings", () => ({
  getAiCatalogSettingsProposal: async (): Promise<ActionResponse<CatalogSettingsView>> =>
    readError
      ? { success: false, error: { code: "FORBIDDEN", message: readError } }
      : { success: true, data: { proposal, status: viewStatus, resultId: null } },
  confirmAiCatalogSettingsProposal: (
    input: unknown,
  ): Promise<ActionResponse<CatalogSettingsReceipt>> => {
    calls.push(input);
    return new Promise((resolve) => {
      resolveSave = resolve;
    });
  },
}));
mock.module("@/components/auth/permissions-provider", () => ({
  useCan:
    () =>
    (permission: string): boolean =>
      permission !== "manage:item_library" || permissionAllowed,
}));
mock.module("@/lib/navigation/workspace-presentation", () => ({
  useWorkspacePresentation: (): "desktop" | "mobile" => (desktop ? "desktop" : "mobile"),
}));
type Children = { readonly children?: ReactNode };
function Button({
  children,
  onClick,
  disabled,
  pending,
}: Children & {
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly pending?: boolean;
}): React.JSX.Element {
  return (
    <button disabled={disabled || pending} onClick={onClick}>
      {children}
    </button>
  );
}
mock.module("@/components/ui", () => ({
  SheetFooterActions: FixtureFooterActions,
  Button,
  ButtonLink: ({ children, href }: Children & { readonly href: string }): React.JSX.Element => (
    <a href={href}>{children}</a>
  ),
  AppIcon: (): null => null,
  MoneyValue: ({ amount }: { readonly amount: number }): React.JSX.Element => (
    <span data-money={amount}>{amount}</span>
  ),
  InlineStateRow: ({
    title,
    description,
    action,
  }: {
    readonly title: string;
    readonly description: string;
    readonly action?: React.ReactNode;
  }): React.JSX.Element => (
    <div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  ),
  GroupedSurface: ({ children }: Children): React.JSX.Element => <section>{children}</section>,
  FactRow: ({
    label,
    value,
  }: {
    readonly label: string;
    readonly value: ReactNode;
  }): React.JSX.Element => (
    <p>
      {label}:{value}
    </p>
  ),
  ReviewCollection: ({ children }: Children): React.JSX.Element => <ul>{children}</ul>,
  ReviewItem: ({
    title,
    children,
    summary,
    primaryValue,
  }: Children & {
    readonly title: ReactNode;
    readonly summary?: ReactNode;
    readonly primaryValue?: ReactNode;
  }): React.JSX.Element => (
    <li>
      {title}
      {summary}
      {primaryValue}
      {children}
    </li>
  ),
  FormDisclosure: ({
    title,
    children,
  }: Children & { readonly title: string }): React.JSX.Element => (
    <details>
      <summary>{title}</summary>
      {children}
    </details>
  ),
  FormSheet: ({
    open,
    children,
    footer,
    desktopAsideSummary,
  }: Children & {
    readonly open: boolean;
    readonly footer: ReactNode;
    readonly desktopAsideSummary?: ReactNode;
  }): React.JSX.Element | null =>
    open ? (
      <section data-sheet>
        <div data-review-content>{children}</div>
        {desktop && desktopAsideSummary}
        <div data-review-actions>{footer}</div>
      </section>
    ) : null,
  ConfirmationDialog: ({
    open,
    title,
    children,
    onConfirm,
    onClose,
    confirmLabel,
    pending,
  }: Children & {
    readonly open: boolean;
    readonly title: string;
    readonly onConfirm: () => void;
    readonly onClose: () => void;
    readonly confirmLabel: string;
    readonly pending?: boolean;
  }): React.JSX.Element | null =>
    open ? (
      <section role="alertdialog" aria-label={title}>
        {children}
        <Button disabled={pending} onClick={onClose}>
          Kembali
        </Button>
        <Button disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </section>
    ) : null,
}));
mock.module("./proposal-card-shell", () => ({
  ProposalCardShell: ({
    children,
    footer,
  }: Children & { readonly footer: ReactNode }): React.JSX.Element => (
    <article>
      {children}
      {footer}
    </article>
  ),
  ProposalDiffRow: ({
    label,
    before,
    after,
  }: {
    readonly label: string;
    readonly before: ReactNode;
    readonly after: ReactNode;
  }): React.JSX.Element => (
    <p>
      {label}:{before}→{after}
    </p>
  ),
}));
const { createRoot } = await import("react-dom/client"),
  { CatalogSettingsProposalCard } = await import("./catalog-settings-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function render(key = "stock", streaming = false): Promise<void> {
  await act(async () =>
    root.render(
      <CatalogSettingsProposalCard
        key={key}
        proposal={proposal}
        conversationId={id}
        toolCallId={key}
        isStreaming={streaming}
        isBusy={false}
        alreadyConfirmed={false}
        onFollowUp={() => undefined}
      />,
    ),
  );
}
function button(text: string, scope: Element = host): HTMLButtonElement {
  const value = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  assert.ok(value, `Missing ${text}`);
  return value;
}
await render("stock", true);
await act(async () => button("Buka review").click());
assert.ok(button("Simpan template").disabled);
await render();
assert.equal(host.querySelectorAll("li").length, 5);
await act(async () => button("Berikutnya").click());
assert.ok(host.textContent?.includes("Panel 6"));
desktop = false;
await render();
assert.equal(host.querySelectorAll("li").length, 2);
assert.ok(host.textContent?.includes("Panel 6"));
await act(async () => {
  button("Simpan template").click();
  button("Simpan template").click();
});
assert.equal(
  host.querySelector('[role="alertdialog"]'),
  null,
  "Non-sensitive reviewed draft commits without another dialog",
);
assert.equal(calls.length, 1);
assert.deepEqual(calls[0], { conversationId: id, toolCallId: "stock" });
assert.ok(resolveSave);
await act(async () =>
  resolveSave?.({ success: true, data: { resultId: id, alreadyConfirmed: false } }),
);
assert.ok(host.querySelector('a[href="/settings"]'));
viewStatus = "STALE";
await render("stale");
await act(async () => button("Buka review").click());
assert.ok(button("Simpan template").disabled);
assert.ok(button("Minta preview terbaru"));
viewStatus = "READY";
permissionAllowed = false;
await render("permission");
await act(async () => button("Buka review").click());
assert.ok(button("Simpan template").disabled);
permissionAllowed = true;
readError = "Proyek di luar akses Anda.";
await render("error");
await act(async () => button("Buka review").click());
assert.ok(host.querySelector("[data-review-content] [data-proposal-review-feedback]"));
assert.equal(host.querySelector('[data-review-actions] [role="alert"]'), null);
assert.ok(button("Simpan template").disabled);
assert.ok(button("Periksa lagi"));
readError = null;
for (const [action, label] of [
  ["INVENTORY_DEFAULTS", "Simpan default"],
  ["INVENTORY_VALUATION", "Konfirmasi valuasi"],
  ["VENDOR_STATUS", "Nonaktifkan vendor"],
] as const) {
  const input =
    action === "INVENTORY_DEFAULTS"
      ? { action, materialInventoryId: id, minimumStock: 2, lastPurchasePrice: 10 }
      : action === "INVENTORY_VALUATION"
        ? { action, materialInventoryId: id, averageCost: 20, reason: "Koreksi biaya dengan bukti" }
        : { action, vendorId: id, isActive: false };
  proposal = {
    ...proposal,
    action,
    input,
    rows: [
      {
        id,
        title: "Contoh",
        meta: "Gudang utama",
        amount: null,
        comparisons: [],
        details:
          action === "VENDOR_STATUS"
            ? [
                { label: "Status · sebelumnya", value: "Aktif", money: false },
                { label: "Status · sesudah", value: "Nonaktif", money: false },
              ]
            : [{ label: "Alasan valuasi", value: "Koreksi biaya dengan bukti", money: false }],
      },
    ],
  };
  await render(action);
  assert.equal(host.querySelector("[data-sheet]"), null);
  const beforeCalls: number = calls.length;
  await act(async () => button(label).click());
  if (action === "INVENTORY_VALUATION") {
    assert.ok(host.querySelector('[role="alertdialog"]'));
    assert.equal(calls.length, beforeCalls);
    await act(async () => button("Kembali").click());
  } else {
    assert.equal(host.querySelector('[role="alertdialog"]'), null);
    assert.equal(calls.length, beforeCalls + 1);
    await act(async () =>
      resolveSave?.({ success: true, data: { resultId: id, alreadyConfirmed: false } }),
    );
  }
}
proposal = {
  ...proposal,
  action: "VENDOR_EDIT",
  input: { action: "VENDOR_EDIT", vendorId: id, patch: { bankAccountNumber: "54321" } },
  rows: [
    {
      id,
      title: "Vendor QA",
      meta: "Data vendor",
      amount: null,
      comparisons: [],
      details: [
        { label: "Nomor rekening · sebelumnya", value: "12345", money: false },
        { label: "Nomor rekening · sesudah", value: "54321", money: false },
      ],
    },
  ],
};
await render("bank");
assert.equal(host.querySelector("[data-sheet]"), null);
assert.ok(host.textContent?.includes("12345"));
assert.ok(host.textContent?.includes("54321"));
const bankCalls = calls.length;
await act(async () => button("Simpan koreksi vendor").click());
assert.ok(host.querySelector('[role="alertdialog"]'));
assert.equal(calls.length, bankCalls);
await act(async () => button("Kembali").click());
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("Catalog settings DOM passed");
