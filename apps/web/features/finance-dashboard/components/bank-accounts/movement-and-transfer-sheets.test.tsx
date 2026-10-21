import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

type CapturedWorkflowFormSheetProps = {
  open: boolean;
  title: string;
  onExitComplete?: () => void;
  onClose: () => void;
  primaryLabel: string;
  secondaryLabel?: string;
  statusText?: string;
  statusTone?: string;
  danger?: boolean;
  onPrimary?: () => void;
  onSecondary?: () => void;
};

// Capture props passed to WorkflowFormSheet
let lastWorkflowFormSheetProps: CapturedWorkflowFormSheetProps | null = null;

function getWorkflowProps(): CapturedWorkflowFormSheetProps {
  if (!lastWorkflowFormSheetProps) {
    throw new Error("Expected WorkflowFormSheet to have been called");
  }
  return lastWorkflowFormSheetProps;
}

mock.module("@/components/ui/form/guided-form", () => ({
  WorkflowFormSheet: ({
    open,
    title,
    children,
    primaryLabel,
    secondaryLabel,
    statusText,
    statusTone,
    danger,
    onClose,
    onExitComplete,
    onPrimary,
    onSecondary,
  }: {
    readonly open: boolean;
    readonly title: string;
    readonly children: React.ReactNode;
    readonly primaryLabel: string;
    readonly secondaryLabel?: string;
    readonly statusText?: string;
    readonly statusTone?: string;
    readonly danger?: boolean;
    readonly onClose: () => void;
    readonly onExitComplete?: () => void;
    readonly onPrimary?: () => void;
    readonly onSecondary?: () => void;
    readonly [key: string]: unknown;
  }) => {
    lastWorkflowFormSheetProps = {
      open,
      title,
      onExitComplete,
      onClose,
      primaryLabel,
      secondaryLabel,
      statusText,
      statusTone,
      danger,
      onPrimary,
      onSecondary,
    };
    return (
      <div data-testid="workflow-form-sheet" data-open={open ? "true" : "false"}>
        <h2 data-testid="sheet-title">{title}</h2>
        <div data-testid="sheet-content">{children}</div>
      </div>
    );
  },
  FormSheet: () => null,
  OperationalFormSheet: () => null,
}));

import { MovementSheet } from "./movement-sheet";
import { TransferSheet } from "./transfer-sheet";
import type {
  BankAccount,
  MovementDraft,
  TransferDraft,
} from "@/features/finance-dashboard/types/bank-account-types";

const mockAccount: BankAccount = {
  id: "acc-1",
  name: "BCA Operasional",
  bankName: "BCA",
  accountNumber: "8820192831",
  holderName: "PT Dekoria Kreasi Pratama",
  balance: 154000000,
  cardColorFrom: "#0A3981",
  cardColorTo: "#1F509A",
  cardTextColor: "light",
  isActive: true,
  recentTransactions: [],
};

const mockTargetAccount: BankAccount = {
  id: "acc-2",
  name: "Mandiri Cadangan",
  bankName: "Bank Mandiri",
  accountNumber: "1234567890",
  holderName: "PT Dekoria Kreasi Pratama",
  balance: 50000000,
  cardColorFrom: "#123456",
  cardColorTo: "#654321",
  cardTextColor: "light",
  isActive: true,
  recentTransactions: [],
};

const mockMovementDraft: MovementDraft = {
  type: "INFLOW",
  amount: "50000000",
  category: "owner_capital",
  description: "Setoran modal baru",
  transactionDate: "2026-09-21",
  referenceNumber: "REF-001",
};

const mockTransferDraft: TransferDraft = {
  toBankAccountId: "acc-2",
  amount: "10000000",
  description: "Transfer operasional",
  transactionDate: "2026-09-21",
  referenceNumber: "TRF-001",
};

const controlPath = new URL("./bank-accounts-control.tsx", import.meta.url);
const movementSheetPath = new URL("./movement-sheet.tsx", import.meta.url);
const transferSheetPath = new URL("./transfer-sheet.tsx", import.meta.url);

describe("BankAccountsControl key stability contract", () => {
  test("does not assign sheet-dependent keys to MovementSheet or TransferSheet", async () => {
    const source = await Bun.file(controlPath).text();

    // Verify MovementSheet does not have changing key depending on control.sheet
    expect(source).not.toContain("key={`movement-${control.sheet");
    expect(source).not.toMatch(/<MovementSheet[^>]*\bkey=/);

    // Verify TransferSheet does not have changing key depending on control.sheet
    expect(source).not.toContain("key={`transfer-${control.sheet");
    expect(source).not.toMatch(/<TransferSheet[^>]*\bkey=/);

    // Verify both sheets maintain stable mounting
    expect(source).toContain("<MovementSheet");
    expect(source).toContain("<TransferSheet");
  });
});

describe("MovementSheet exit transition contract", () => {
  test("uses useSheetPresenceValue and binds onExitComplete to WorkflowFormSheet", async () => {
    const source = await Bun.file(movementSheetPath).text();

    expect(source).toContain("useSheetPresenceValue");
    expect(source).toContain("presentedValue: presentedAccount");
    expect(source).toContain("handleExitComplete");
    expect(source).toContain("onExitComplete={handleExitAnimationComplete}");
    expect(source).toContain("handleExitAnimationComplete");

    // Exit animation complete must reset both internal reviewing and confirmClose states
    expect(source).toContain("handleExitComplete()");
    expect(source).toContain("setReviewing(false)");
    expect(source).toContain("setConfirmClose(false)");

    // Synchronizes state when opening or switching account
    expect(source).toContain("setPrevOpen");
    expect(source).toContain("setPrevAccountId");

    // Uses presentedAccount instead of raw account for financial calculations and rendering
    expect(source).toContain("presentedAccount.balance + amount");
    expect(source).toContain("<BankAccountContextCard account={presentedAccount}");
    expect(source).toContain('label={presentedAccount?.name ?? "Rekening"}');
    expect(source).toContain("before={presentedAccount?.balance ?? 0}");
    expect(source).toContain("shortMoney(presentedAccount?.balance ?? 0)");
  });

  test("renders account details, title, and wires onExitComplete when open", () => {
    lastWorkflowFormSheetProps = null;

    const markup = renderToStaticMarkup(
      <MovementSheet
        open={true}
        account={mockAccount}
        draft={mockMovementDraft}
        setDraft={() => undefined}
        isDirty={false}
        pending={false}
        onClose={() => undefined}
        onDiscard={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(markup).toContain("Kas masuk");
    expect(markup).toContain("BCA Operasional");
    expect(markup).toContain("8820192831");
    expect(markup).toContain("Nominal mutasi");

    // Verify WorkflowFormSheet received onExitComplete handler
    const props = getWorkflowProps();
    expect(props.open).toBe(true);
    expect(props.title).toBe("Kas masuk");
    expect(typeof props.onExitComplete).toBe("function");

    // Invoking onExitComplete should execute cleanly without throwing
    expect(() => props.onExitComplete?.()).not.toThrow();
  });

  test("renders Kas keluar with danger tone when outflow causes negative balance", () => {
    lastWorkflowFormSheetProps = null;

    const outflowDraft: MovementDraft = {
      ...mockMovementDraft,
      type: "OUTFLOW",
      amount: "200000000", // exceeds balance of 154M
    };

    const markup = renderToStaticMarkup(
      <MovementSheet
        open={true}
        account={mockAccount}
        draft={outflowDraft}
        setDraft={() => undefined}
        isDirty={false}
        pending={false}
        onClose={() => undefined}
        onDiscard={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(markup).toContain("Kas keluar");
    expect(markup).toContain("Cegah saldo kas minus");
    const props = getWorkflowProps();
    expect(props.statusTone).toBe("danger");
    expect(props.statusText).toContain("Saldo sesudah mutasi tidak mencukupi");
  });

  test("maintains onExitComplete contract when closed", () => {
    lastWorkflowFormSheetProps = null;

    renderToStaticMarkup(
      <MovementSheet
        open={false}
        account={null}
        draft={mockMovementDraft}
        setDraft={() => undefined}
        isDirty={false}
        pending={false}
        onClose={() => undefined}
        onDiscard={() => undefined}
        onSave={() => undefined}
      />,
    );

    const props = getWorkflowProps();
    expect(props.open).toBe(false);
    expect(typeof props.onExitComplete).toBe("function");
    expect(() => props.onExitComplete?.()).not.toThrow();
  });

  test("wires primary review action and maintains clean onPrimary handler", () => {
    lastWorkflowFormSheetProps = null;

    let saved = false;
    renderToStaticMarkup(
      <MovementSheet
        open={true}
        account={mockAccount}
        draft={mockMovementDraft}
        setDraft={() => undefined}
        isDirty={false}
        pending={false}
        onClose={() => undefined}
        onDiscard={() => undefined}
        onSave={() => {
          saved = true;
        }}
      />,
    );

    const props = getWorkflowProps();
    expect(props.primaryLabel).toBe("Tinjau");
    expect(typeof props.onPrimary).toBe("function");
    expect(() => props.onPrimary?.()).not.toThrow();
    expect(saved).toBe(false);
  });
});

describe("TransferSheet exit transition contract", () => {
  test("uses useSheetPresenceValue and binds onExitComplete to WorkflowFormSheet", async () => {
    const source = await Bun.file(transferSheetPath).text();

    expect(source).toContain("useSheetPresenceValue");
    expect(source).toContain("presentedValue: presentedAccount");
    expect(source).toContain("handleExitComplete");
    expect(source).toContain("onExitComplete={handleExitAnimationComplete}");
    expect(source).toContain("handleExitAnimationComplete");

    // Exit animation complete must reset both internal reviewing and confirmClose states
    expect(source).toContain("handleExitComplete()");
    expect(source).toContain("setReviewing(false)");
    expect(source).toContain("setConfirmClose(false)");

    // Synchronizes state when opening or switching account
    expect(source).toContain("setPrevOpen");
    expect(source).toContain("setPrevAccountId");

    // Uses presentedAccount instead of raw account for financial calculations and rendering
    expect(source).toContain("presentedAccount ? presentedAccount.balance - amount : 0");
    expect(source).toContain("<BankAccountContextCard account={presentedAccount}");
    expect(source).toContain('label={`Sumber · ${presentedAccount?.name ?? "Rekening"}`}');
    expect(source).toContain("before={presentedAccount?.balance ?? 0}");
    expect(source).toContain("shortMoney(presentedAccount?.balance ?? 0)");
  });

  test("renders source account context card, target options, and wires onExitComplete when open", () => {
    lastWorkflowFormSheetProps = null;

    const options = [{ value: mockTargetAccount.id, label: mockTargetAccount.name }];

    const markup = renderToStaticMarkup(
      <TransferSheet
        open={true}
        account={mockAccount}
        accounts={[mockAccount, mockTargetAccount]}
        options={options}
        draft={mockTransferDraft}
        setDraft={() => undefined}
        isDirty={false}
        pending={false}
        onClose={() => undefined}
        onDiscard={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(markup).toContain("Transfer rekening");
    expect(markup).toContain("Rekening Sumber");
    expect(markup).toContain("BCA Operasional");
    expect(markup).toContain("Tujuan &amp; nominal");

    // Verify WorkflowFormSheet received onExitComplete handler
    const props = getWorkflowProps();
    expect(props.open).toBe(true);
    expect(props.title).toBe("Transfer rekening");
    expect(typeof props.onExitComplete).toBe("function");

    // Invoking onExitComplete should execute cleanly without throwing
    expect(() => props.onExitComplete?.()).not.toThrow();
  });

  test("disables transfer and shows danger tone when transfer amount exceeds source balance", () => {
    lastWorkflowFormSheetProps = null;

    const excessiveDraft: TransferDraft = {
      ...mockTransferDraft,
      amount: "200000000", // exceeds balance of 154M
    };
    const options = [{ value: mockTargetAccount.id, label: mockTargetAccount.name }];

    const markup = renderToStaticMarkup(
      <TransferSheet
        open={true}
        account={mockAccount}
        accounts={[mockAccount, mockTargetAccount]}
        options={options}
        draft={excessiveDraft}
        setDraft={() => undefined}
        isDirty={false}
        pending={false}
        onClose={() => undefined}
        onDiscard={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(markup).toContain("Cegah transfer salah rekening");
    const props = getWorkflowProps();
    expect(props.statusTone).toBe("danger");
    expect(props.statusText).toContain("Saldo rekening sumber tidak mencukupi");
  });

  test("maintains onExitComplete contract when closed", () => {
    lastWorkflowFormSheetProps = null;

    renderToStaticMarkup(
      <TransferSheet
        open={false}
        account={null}
        accounts={[mockAccount, mockTargetAccount]}
        options={[]}
        draft={mockTransferDraft}
        setDraft={() => undefined}
        isDirty={false}
        pending={false}
        onClose={() => undefined}
        onDiscard={() => undefined}
        onSave={() => undefined}
      />,
    );

    const props = getWorkflowProps();
    expect(props.open).toBe(false);
    expect(typeof props.onExitComplete).toBe("function");
    expect(() => props.onExitComplete?.()).not.toThrow();
  });

  test("wires primary review action and maintains clean onPrimary handler", () => {
    lastWorkflowFormSheetProps = null;

    let saved = false;
    renderToStaticMarkup(
      <TransferSheet
        open={true}
        account={mockAccount}
        accounts={[mockAccount, mockTargetAccount]}
        options={[{ value: mockTargetAccount.id, label: mockTargetAccount.name }]}
        draft={mockTransferDraft}
        setDraft={() => undefined}
        isDirty={false}
        pending={false}
        onClose={() => undefined}
        onDiscard={() => undefined}
        onSave={() => {
          saved = true;
        }}
      />,
    );

    const props = getWorkflowProps();
    expect(props.primaryLabel).toBe("Tinjau");
    expect(typeof props.onPrimary).toBe("function");
    expect(() => props.onPrimary?.()).not.toThrow();
    expect(saved).toBe(false);
  });
});
