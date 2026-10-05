import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act, startTransition, useState } from "react";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import {
  summarizeApprovals,
  type ApprovalQueueSummary,
} from "@atria/core/finance/approval-summary";
import type { BankAccount } from "../types/bank-account-types";

const browserWindow = new Window({ url: "https://atria.test/ledger" });
// Happy DOM's partial WAAPI rejects canceled animations differently from a browser.
// Exercise Framer Motion's supported JS fallback for these behavior tests.
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
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

const { createRoot } = await import("react-dom/client");
const { useDashboardApprovalQueue, removeRecordedApproval } =
  await import("./use-dashboard-approval-queue");
const { useBankAccountSnapshot } = await import("./use-bank-account-snapshot");
const { useSheetPresenceValue } = await import("@/components/ui/overlay/use-sheet-presence-value");
const { PermissionsProvider, usePermissions, useCan } =
  await import("@/components/auth/permissions-provider");
const { getRapPermissions } = await import("@/features/projects/detail/utils/rap-manager-utils");
const { getRabManagerDerivedValues, emptyManualQuotationLine } =
  await import("@/features/projects/detail/utils/rab-manager-utils");
const { CustomColorPicker } = await import("@/components/ui/form/color-picker");
const { FormField } = await import("@/components/ui/form/basic-form-controls");
const { PilotBalanceNotice } = await import("../components/shared/pilot-balance-notice");

const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const now = new Date("2026-10-04T12:00:00+07:00");

function approval(id: string, amount: number): ApprovalDetail {
  return {
    id,
    type: "project_cost",
    referenceId: id,
    createdAt: new Date("2026-10-01T08:00:00+07:00"),
    dueDate: null,
    notes: null,
    amount,
    description: "Pengeluaran proyek",
    receiptImageUrl: null,
    projectName: "Menteng",
    budgetItemName: "Tukang",
    allocatedAmount: 100,
    actualSpent: 90,
    requestedBy: "Budi",
    priority: "CRITICAL",
    priorityReason: "Perlu keputusan",
    budgetOverrun: true,
    consumesBudgetActual: true,
  };
}

function account(balance: number, name = "BCA"): BankAccount {
  return {
    id: "bank-1",
    name,
    bankName: "BCA",
    accountNumber: "12345",
    holderName: "Dekoria",
    balance,
    cardColorFrom: "#181817",
    cardColorTo: "#636366",
    cardTextColor: "light",
    isActive: true,
    recentTransactions: [],
  };
}

function click(selector: string): void {
  const control = host.querySelector(selector);
  assert.ok(control, `Control missing: ${selector}`);
  control.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

try {
  delete process.env.NEXT_PUBLIC_ATRIA_PILOT_MODE;
  await act(async (): Promise<void> => {
    root.render(<PilotBalanceNotice />);
  });
  assert.equal(host.textContent, "", "Pilot notice is absent by default");
  process.env.NEXT_PUBLIC_ATRIA_PILOT_MODE = "true";
  await act(async (): Promise<void> => {
    root.render(<PilotBalanceNotice />);
  });
  assert.ok(
    host.textContent?.includes("Saldo pilot: snapshot awal + transaksi pilot"),
    "Opt-in pilot notice explains the bank snapshot boundary",
  );
  await act(async (): Promise<void> => {
    root.render(<PilotBalanceNotice inverse />);
  });
  assert.ok(
    host.querySelector(".text-on-primary.bg-on-primary\\/10"),
    "Inverse notice uses the semantic light foreground on a dark inset",
  );
  assert.equal(
    host.querySelector(".text-on-surface-variant"),
    null,
    "Dark context does not retain the low contrast neutral foreground",
  );
  delete process.env.NEXT_PUBLIC_ATRIA_PILOT_MODE;
  let finishDecision: () => void = (): void => {
    throw new Error("Decision has not started");
  };
  const decisionGate = new Promise<void>((resolve) => {
    finishDecision = resolve;
  });
  function Queue({
    approvals,
    summary,
  }: {
    readonly approvals: readonly ApprovalDetail[];
    readonly summary: ApprovalQueueSummary;
  }): React.JSX.Element {
    const [queue, recordDecision] = useDashboardApprovalQueue(approvals, summary);
    return (
      <>
        <output>
          {queue.approvals.map((item) => item.id).join(",")}|{queue.summary.totalCount}|
          {queue.summary.totalAmount}
        </output>
        <button
          onClick={() =>
            startTransition(async (): Promise<void> => {
              recordDecision({ approvalId: "a", decidedAt: now });
              await decisionGate;
            })
          }
        >
          Decide
        </button>
      </>
    );
  }
  const initial = [approval("a", 30)];
  await act(async (): Promise<void> => {
    root.render(<Queue approvals={initial} summary={summarizeApprovals(initial, now)} />);
  });
  await act(async (): Promise<void> => {
    click("button");
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "|0|0",
    "Recorded decision removes both row and totals",
  );
  const refreshed = [...initial, approval("b", 50)];
  await act(async (): Promise<void> => {
    root.render(<Queue approvals={refreshed} summary={summarizeApprovals(refreshed, now)} />);
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "b|1|50",
    "Refresh adds new approvals while retaining pending removal",
  );
  const committed = [refreshed[1]!];
  await act(async (): Promise<void> => {
    root.render(<Queue approvals={committed} summary={summarizeApprovals(committed, now)} />);
    finishDecision();
    await decisionGate;
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "b|1|50",
    "Committed server queue is authoritative after transition",
  );
  const queue = { approvals: committed, summary: summarizeApprovals(committed, now) };
  assert.equal(
    removeRecordedApproval(queue, { approvalId: "a", decidedAt: now }),
    queue,
    "Already removed approval cannot decrement summary twice",
  );

  let finishBankUpdate: () => void = (): void => {
    throw new Error("Bank update has not started");
  };
  const bankGate = new Promise<void>((resolve) => {
    finishBankUpdate = resolve;
  });
  function Accounts({
    accounts,
  }: {
    readonly accounts: readonly BankAccount[];
  }): React.JSX.Element {
    const snapshot = useBankAccountSnapshot(accounts);
    return (
      <>
        <output>
          {snapshot.items.reduce((sum, item) => sum + item.balance, 0)}|
          {snapshot.selected?.name ?? "none"}|{snapshot.selected?.balance ?? "none"}
        </output>
        <button data-select onClick={() => snapshot.selectAccount("bank-1")}>
          Select
        </button>
        <button
          data-update
          onClick={() =>
            startTransition(async (): Promise<void> => {
              snapshot.setItems((items) => items.map((item) => ({ ...item, balance: 80 })));
              await bankGate;
            })
          }
        >
          Update
        </button>
      </>
    );
  }
  await act(async (): Promise<void> => {
    root.render(<Accounts accounts={[account(100)]} />);
  });
  await act(async (): Promise<void> => {
    click("[data-select]");
  });
  await act(async (): Promise<void> => {
    root.render(<Accounts accounts={[account(90, "BCA terbaru")]} />);
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "90|BCA terbaru|90",
    "Selected details and total follow refreshed server data",
  );
  await act(async (): Promise<void> => {
    click("[data-update]");
  });
  await act(async (): Promise<void> => {
    root.render(<Accounts accounts={[account(75, "BCA tersinkron")]} />);
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "80|BCA tersinkron|80",
    "Pending account update retains latest server metadata",
  );
  await act(async (): Promise<void> => {
    finishBankUpdate();
    await bankGate;
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "75|BCA tersinkron|75",
    "Final balance is the server balance, not repeated local arithmetic",
  );
  await act(async (): Promise<void> => {
    root.render(<Accounts accounts={[]} />);
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "0|none|none",
    "Removed account clears stale selected detail",
  );

  function PresentedAccount({ value }: { readonly value: BankAccount | null }): React.JSX.Element {
    const presence = useSheetPresenceValue(value, value?.id);
    return (
      <>
        <output>{presence.presentedValue?.balance ?? "none"}</output>
        <button onClick={presence.handleExitComplete}>Exit</button>
      </>
    );
  }
  await act(async (): Promise<void> => {
    root.render(<PresentedAccount value={account(100)} />);
  });
  await act(async (): Promise<void> => {
    root.render(<PresentedAccount value={account(75)} />);
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "75",
    "Same-ID open sheet displays the latest account snapshot",
  );
  await act(async (): Promise<void> => {
    root.render(<PresentedAccount value={null} />);
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "75",
    "Exit retains the most recent visible snapshot",
  );
  await act(async (): Promise<void> => {
    click("button");
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "none",
    "Exit completion clears retained content",
  );

  function Capabilities(): React.JSX.Element {
    const permissions = usePermissions();
    const can = useCan();
    const rap = getRapPermissions(permissions);
    const rab = getRabManagerDerivedValues({
      permissions,
      rabEstimate: null,
      revisionHistory: [],
      selectedRapQuotationIds: [],
      selectedCategoryQuotationIds: [],
      manualQuotationLine: emptyManualQuotationLine,
    });
    return (
      <output>
        {String(can("create:bank_account"))}|{String(rap.canEditRap)}|{String(rap.canFinalizeRap)}|
        {String(rab.canApproveRab)}
      </output>
    );
  }
  await act(async (): Promise<void> => {
    root.render(
      <PermissionsProvider
        permissions={["create:bank_account", "create:rap", "lock:rap", "approve:rab"]}
      >
        <Capabilities />
      </PermissionsProvider>,
    );
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "true|true|true|true",
    "Custom grants work without a seed role name",
  );
  await act(async (): Promise<void> => {
    root.render(
      <PermissionsProvider permissions={["view:rap"]}>
        <Capabilities />
      </PermissionsProvider>,
    );
  });
  assert.equal(
    host.querySelector("output")?.textContent,
    "false|false|false|false",
    "Revoked and view-only permissions remove mutation capabilities",
  );

  function Color(): React.JSX.Element {
    const [value, setValue] = useState("#97371F");
    return (
      <FormField label="Aksen RAB" helper="Warna dokumen" error="Periksa warna">
        <CustomColorPicker value={value} onChange={setValue} ariaLabel="Aksen RAB" />
      </FormField>
    );
  }
  await act(async (): Promise<void> => {
    root.render(<Color />);
  });
  const input = host.querySelector("input");
  const label = host.querySelector("label");
  assert.ok(input && label);
  assert.equal(label.htmlFor, input.id, "Visible field label targets the HEX control");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.ok(
    document.getElementById(input.getAttribute("aria-describedby") ?? ""),
    "Error message is associated",
  );
  await act(async (): Promise<void> => {
    click('button[aria-label="Sesuaikan warna di palet visual"]');
  });
  const hue = host.querySelector('[aria-label="Spektrum warna hue"]');
  const saturation = host.querySelector('[aria-label="Saturasi dan kecerahan warna"]');
  assert.ok(hue && saturation);
  assert.equal(hue.getAttribute("tabindex"), "0");
  const previousHex = input.value;
  await act(async (): Promise<void> => {
    hue.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
    );
  });
  assert.notEqual(input.value, previousHex, "Keyboard hue changes the actual color");
  await act(async (): Promise<void> => {
    saturation.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }),
    );
  });
  assert.equal(input.value, "#000000", "Keyboard brightness clamps to its lower bound");
  await act(async (): Promise<void> => {
    saturation.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
  });
  assert.equal(input.value, "#000000", "Keyboard cannot move below the lower bound");
  console.log(
    "DOM regressions passed: refreshed queue, pending decisions, live bank details, dynamic grants, keyboard colors and labels.",
  );
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browserWindow.happyDOM.close();
}
