import { FixtureFooterActions } from "./proposal-footer.fixture";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import type {
  ProjectManagementProposal,
  ProjectManagementView,
  ProjectManagementReceipt,
} from "@atria/core/ai/project-management";
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
let proposal: ProjectManagementProposal = {
  kind: "PROJECT_MANAGEMENT",
  action: "EDIT_PROJECT",
  projectId: id,
  title: "Perubahan proyek",
  entityName: "Proyek Uji",
  meta: "Proyek dan budget",
  contextHash: "a".repeat(64),
  input: { action: "EDIT_PROJECT", projectId: id, patch: { name: "Nama baru" } },
  effect: "Informasi diperbarui; stok dan kas tetap.",
  rows: [
    {
      id,
      title: "Nama baru",
      meta: "Koreksi",
      amount: null,
      comparisons: [],
      details: [
        { label: "Nama · sebelumnya", value: "Lama", money: false },
        { label: "Nama · sesudah", value: "Nama baru", money: false },
      ],
    },
  ],
  summary: [],
  budget: null,
  blockers: [],
  warnings: [],
};
let viewStatus: ProjectManagementView["status"] = "READY",
  desktop = true,
  permissionAllowed = true,
  readError: string | null = null;
const calls: unknown[] = [];
let resolveSave: ((result: ActionResponse<ProjectManagementReceipt>) => void) | null = null;
mock.module("@/app/actions/ai/project-management", () => ({
  getAiProjectManagementProposal: async (): Promise<ActionResponse<ProjectManagementView>> =>
    readError
      ? { success: false, error: { code: "FORBIDDEN", message: readError } }
      : { success: true, data: { proposal, status: viewStatus, resultId: null } },
  confirmAiProjectManagementProposal: (
    input: unknown,
  ): Promise<ActionResponse<ProjectManagementReceipt>> => {
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
      permission !== "update:budget" || permissionAllowed,
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
  { ProjectManagementProposalCard } = await import("./project-management-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function render(key = "metadata", streaming = false): Promise<void> {
  await act(async () =>
    root.render(
      <ProjectManagementProposalCard
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
  const b = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  assert.ok(b, `Missing ${text}`);
  return b;
}
await render("metadata", true);
assert.ok(button("Simpan koreksi proyek").disabled);
await render();
assert.equal(host.querySelector("[data-sheet]"), null);
assert.ok(host.textContent?.includes("Lama→Nama baru"));
await act(async () => {
  button("Simpan koreksi proyek").click();
  button("Simpan koreksi proyek").click();
});
assert.equal(calls.length, 1);
assert.deepEqual(calls[0], { conversationId: id, toolCallId: "metadata" });
await act(async () =>
  resolveSave?.({ success: true, data: { resultId: id, alreadyConfirmed: false } }),
);
assert.ok(host.textContent?.includes("Informasi proyek diperbarui"));
assert.ok(host.querySelector(`a[href="/projects/${id}"]`));
proposal = {
  ...proposal,
  action: "ASSIGN_PM",
  title: "Penugasan Project Manager",
  input: { action: "ASSIGN_PM", projectId: id, projectManagerId: ids[0] },
  rows: [
    {
      ...proposal.rows[0],
      details: [
        { label: "Project Manager · sebelumnya", value: "PM Lama", money: false },
        { label: "Project Manager · sesudah", value: "PM Baru", money: false },
      ],
    },
  ],
};
await render("pm");
await act(async () => button("Tugaskan Project Manager").click());
assert.ok(host.querySelector('[role="alertdialog"]'));
assert.ok(host.textContent?.includes("PM Baru"));
assert.equal(calls.length, 1);
await act(async () => button("Kembali").click());
assert.equal(calls.length, 1);
proposal = {
  ...proposal,
  action: "ACTIVATE_PROJECT",
  title: "Aktivasi proyek",
  input: { action: "ACTIVATE_PROJECT", projectId: id },
  blockers: ["RAP terkait belum terkunci."],
  rows: [],
};
viewStatus = "BLOCKED";
await render("blocked");
assert.ok(host.textContent?.includes("RAP terkait belum terkunci"));
assert.ok(button("Aktifkan proyek").disabled);
proposal = {
  ...proposal,
  action: "REALLOCATE_BUDGET",
  title: "Realokasi budget",
  input: {
    action: "REALLOCATE_BUDGET",
    projectId: id,
    projectBudgetId: id,
    reason: "Penyesuaian kebutuhan terbaru",
    categories: ids.map((projectBudgetCategoryId) => ({
      projectBudgetCategoryId,
      allocatedAmount: 10,
    })),
  },
  summary: [{ label: "Alasan", value: "Penyesuaian kebutuhan terbaru", money: false }],
  blockers: [],
  warnings: ["Material: alokasi di bawah realisasi."],
  budget: [{ label: "Plafon internal", value: 100, money: true }],
  rows: ids.map((rowId, i) => ({
    id: rowId,
    title: `Kategori ${i + 1}`,
    meta: "Alokasi",
    amount: 10,
    comparisons: [{ label: "Alokasi", before: 12, after: 10, money: true }],
    details: [{ label: "Realisasi", value: 15, money: true }],
  })),
};
viewStatus = "READY";
await render("allocation");
await act(async () => button("Buka review").click());
assert.equal(host.querySelectorAll("li").length, 5);
assert.ok(host.textContent?.includes("Penyesuaian kebutuhan terbaru"));
assert.ok(host.textContent?.includes("di bawah realisasi"));
await act(async () => button("Berikutnya").click());
assert.ok(host.textContent?.includes("Kategori 6"));
desktop = false;
await render("allocation");
assert.equal(host.querySelectorAll("li").length, 2);
assert.ok(host.textContent?.includes("Kategori 6"));
await act(async () => button("Simpan alokasi budget").click());
assert.ok(host.querySelector('[role="alertdialog"]'));
await act(async () =>
  button("Simpan alokasi budget", host.querySelector('[role="alertdialog"]')!).click(),
);
assert.equal(calls.length, 2);
await act(async () =>
  resolveSave?.({
    success: false,
    error: { code: "CONFLICT", message: "Data proyek berubah. Minta preview terbaru." },
  }),
);
assert.ok(host.textContent?.includes("Data proyek berubah"));
assert.ok(button("Simpan alokasi budget").disabled);
permissionAllowed = false;
await render("allocation");
assert.equal(host.querySelectorAll("[data-money]").length, 0);
assert.ok(button("Simpan alokasi budget").disabled);
permissionAllowed = true;
readError = "Proyek di luar akses Anda.";
await render("foreign");
await act(async () => button("Buka review").click());
assert.ok(host.textContent?.includes("Proyek di luar akses"));
assert.ok(button("Simpan alokasi budget").disabled);
await act(async () => root.unmount());
console.log("Project management DOM passed");
process.exit(0);
