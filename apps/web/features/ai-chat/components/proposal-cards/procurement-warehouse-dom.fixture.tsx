import { FixtureFooterActions } from "./proposal-footer.fixture";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import type {
  ProcurementWarehouseProposal,
  ProcurementWarehouseView,
  ProcurementWarehouseReceipt,
} from "@atria/core/ai/procurement-warehouse";
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
let proposal: ProcurementWarehouseProposal = {
  kind: "PROCUREMENT_WAREHOUSE",
  action: "VENDOR_BILL_SAVE",
  projectId: id,
  title: "Draft tagihan vendor",
  entityName: "Proyek uji tagihan",
  meta: "Vendor QA · INV-QA",
  contextHash: "a".repeat(64),
  input: {
    action: "VENDOR_BILL_SAVE",
    payload: {
      vendorId: id,
      projectId: id,
      projectBudgetCategoryId: id,
      projectCategoryPlanItemId: null,
      materialId: null,
      projectRapItemId: null,
      billNumber: "INV-QA",
      amount: 70,
      dueDate: "2026-10-20",
      notes: "Invoice manusia",
      invoice: {
        urls: [],
        lines: ids.map((_, i) => ({
          name: `Panel ${i + 1}`,
          quantity: 1,
          unit: "lembar",
          amount: 10,
          source: "Percakapan",
        })),
      },
    },
  },
  effect: "Draft tersimpan; stok dan kas tetap.",
  rows: ids.map((rowId, i) => ({
    id: rowId,
    title: `Panel ${i + 1}`,
    meta: "1 lembar · invoice QA",
    amount: 10,
    comparisons: [],
    details: [{ label: "Sumber", value: "Percakapan", money: false }],
  })),
  summary: [{ label: "Nominal tagihan", value: 70, money: true }],
  budget: [{ label: "Alokasi kategori", value: 987654321, money: true }],
};
let viewStatus: ProcurementWarehouseView["status"] = "READY",
  desktop = true,
  budgetAllowed = true,
  readError: string | null = null;
const calls: unknown[] = [];
let resolveSave: ((result: ActionResponse<ProcurementWarehouseReceipt>) => void) | null = null;
mock.module("@/app/actions/ai/procurement-warehouse", () => ({
  getAiProcurementWarehouseProposal: async (): Promise<ActionResponse<ProcurementWarehouseView>> =>
    readError
      ? { success: false, error: { code: "FORBIDDEN", message: readError } }
      : { success: true, data: { proposal, status: viewStatus, resultId: null } },
  confirmAiProcurementWarehouseProposal: (
    input: unknown,
  ): Promise<ActionResponse<ProcurementWarehouseReceipt>> => {
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
      permission !== "view:budget" || budgetAllowed,
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
  { ProcurementWarehouseProposalCard } = await import("./procurement-warehouse-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function render(key = "stock", streaming = false): Promise<void> {
  await act(async () =>
    root.render(
      <ProcurementWarehouseProposalCard
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
assert.ok(button("Simpan draft tagihan").disabled);
await render();
assert.equal(host.querySelectorAll("li").length, 5);
await act(async () => button("Berikutnya").click());
assert.ok(host.textContent?.includes("Panel 6"));
desktop = false;
await render();
assert.equal(host.querySelectorAll("li").length, 2);
assert.ok(host.textContent?.includes("Panel 6"));
await act(async () => {
  button("Simpan draft tagihan").click();
  button("Simpan draft tagihan").click();
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
assert.ok(host.querySelector('a[href="/expenses?new-vendor-bill=true"]'));
viewStatus = "STALE";
await render("stale");
await act(async () => button("Buka review").click());
assert.ok(button("Simpan draft tagihan").disabled);
assert.ok(button("Minta preview terbaru"));
viewStatus = "READY";
budgetAllowed = false;
await render("privacy");
await act(async () => button("Buka review").click());
assert.equal(host.querySelector('[data-money="987654321"]'), null);
readError = "Proyek di luar akses Anda.";
await render("error");
await act(async () => button("Buka review").click());
assert.ok(host.querySelector("[data-review-content] [data-proposal-review-feedback]"));
assert.equal(host.querySelector('[data-review-actions] [role="alert"]'), null);
assert.ok(button("Simpan draft tagihan").disabled);
assert.ok(button("Periksa lagi"));
readError = null;
for (const [action, label] of [
  ["RECEIPT_REVERSAL_REQUEST", "Ajukan pembatalan"],
  ["RECEIPT_REVERSAL_APPROVE", "Setujui pembatalan"],
  ["RECEIPT_REVERSAL_REJECT", "Tolak pembatalan"],
] as const) {
  const input =
    action === "RECEIPT_REVERSAL_APPROVE"
      ? { action, goodsReceiptId: id }
      : { action, goodsReceiptId: id, reason: "Barang salah diterima" };
  proposal = { ...proposal, action, input, rows: proposal.rows.slice(0, 1) };
  await render(action);
  assert.equal(host.querySelector("[data-sheet]"), null);
  const beforeCalls: number = calls.length;
  assert.equal(button(label).disabled, false, host.textContent ?? "No content");
  await act(async () => button(label).click());
  if (action === "RECEIPT_REVERSAL_APPROVE") {
    assert.ok(host.querySelector('[role="alertdialog"]'), host.textContent ?? "No content");
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
  action: "VENDOR_BILL_CORRECT",
  title: "Koreksi tagihan vendor",
  input: {
    action: "VENDOR_BILL_CORRECT",
    vendorBillId: id,
    patch: { dueDate: "2026-10-27", notes: "Catatan baru" },
    reason: "Sesuai invoice revisi pemasok",
  },
  rows: [
    {
      id: "date",
      title: "Jatuh tempo",
      meta: "Koreksi dokumen",
      amount: null,
      comparisons: [],
      details: [
        { label: "Jatuh tempo · sebelumnya", value: "20 Okt 2026", money: false },
        { label: "Jatuh tempo · sesudah", value: "27 Okt 2026", money: false },
      ],
    },
    {
      id: "notes",
      title: "Catatan",
      meta: "Koreksi dokumen",
      amount: null,
      comparisons: [],
      details: [
        { label: "Catatan · sebelumnya", value: "Catatan lama", money: false },
        { label: "Catatan · sesudah", value: "Catatan baru", money: false },
      ],
    },
  ],
  summary: [],
  budget: null,
};
await render("correction-documentary");
assert.equal(host.querySelector("[data-sheet]"), null);
assert.ok(host.textContent?.includes("20 Okt 2026"));
assert.ok(host.textContent?.includes("27 Okt 2026"));
assert.ok(host.textContent?.includes("Catatan lama"));
assert.ok(host.textContent?.includes("Catatan baru"));
assert.ok(host.textContent?.includes("Alasan koreksi"));
proposal = {
  ...proposal,
  input: {
    action: "VENDOR_BILL_CORRECT",
    vendorBillId: id,
    patch: { amount: 120 },
    reason: "Koreksi nominal invoice pemasok",
  },
  rows: [
    {
      id: "amount",
      title: "Nominal",
      meta: "Material",
      amount: 120,
      comparisons: [{ label: "Nominal", before: 100, after: 120, money: true }],
      details: [],
    },
  ],
  summary: [
    { label: "Nominal sebelumnya", value: 100, money: true },
    { label: "Nominal setelah koreksi", value: 120, money: true },
  ],
};
await render("correction-money");
const correctionCalls = calls.length;
await act(async () => button("Simpan koreksi tagihan").click());
assert.ok(host.querySelector('[role="alertdialog"]'));
assert.equal(calls.length, correctionCalls);
assert.ok(host.textContent?.includes("Koreksi nominal invoice pemasok"));
await act(async () => button("Kembali").click());
assert.equal(calls.length, correctionCalls);
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("Procurement warehouse DOM passed");
