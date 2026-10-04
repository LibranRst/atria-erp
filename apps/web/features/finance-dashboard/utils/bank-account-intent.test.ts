import { describe, expect, test } from "bun:test";

import {
  consumeBankAccountIntentHref,
  resolveBankAccountIntent,
  type BankAccountIntentAccess,
} from "./bank-account-intent";

const accounts = [
  { id: "operasional", isActive: true },
  { id: "cadangan", isActive: true },
  { id: "lama", isActive: false },
];
const access: BankAccountIntentAccess = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canMove: true,
};
const editableActions: readonly ("edit" | "movement" | "transfer")[] = [
  "edit",
  "movement",
  "transfer",
];

describe("bank account browser intent", () => {
  test("restores the requested sheet without treating a URL as a mutation", () => {
    expect(
      resolveBankAccountIntent({ accountId: null, action: "create", accounts, access }),
    ).toEqual({ action: "create" });
    expect(resolveBankAccountIntent({ accountId: "lama", action: null, accounts, access })).toEqual(
      { action: "detail", accountId: "lama" },
    );
    for (const action of editableActions) {
      expect(
        resolveBankAccountIntent({ accountId: "operasional", action, accounts, access }),
      ).toEqual({ action, accountId: "operasional" });
    }
  });

  test("untrusted account/action values cannot select another operation", () => {
    expect(
      resolveBankAccountIntent({ accountId: "operasional", action: "archive", accounts, access }),
    ).toBeNull();
    expect(
      resolveBankAccountIntent({ accountId: "operasional", action: "submit", accounts, access }),
    ).toBeNull();
    expect(
      resolveBankAccountIntent({ accountId: "missing", action: "edit", accounts, access }),
    ).toBeNull();
    expect(
      resolveBankAccountIntent({ accountId: "missing", action: "create", accounts, access }),
    ).toBeNull();
  });

  test("read-only account access does not grant editing or money movement", () => {
    const readOnly: BankAccountIntentAccess = {
      canView: true,
      canCreate: false,
      canEdit: false,
      canMove: false,
    };
    expect(
      resolveBankAccountIntent({
        accountId: "operasional",
        action: null,
        accounts,
        access: readOnly,
      }),
    ).toEqual({ action: "detail", accountId: "operasional" });
    expect(
      resolveBankAccountIntent({ accountId: null, action: "create", accounts, access: readOnly }),
    ).toBeNull();
    for (const action of editableActions) {
      expect(
        resolveBankAccountIntent({ accountId: "operasional", action, accounts, access: readOnly }),
      ).toBeNull();
    }
    expect(
      resolveBankAccountIntent({
        accountId: "operasional",
        action: null,
        accounts,
        access: { ...access, canView: false },
      }),
    ).toBeNull();
  });

  test("archived accounts remain readable/editable but cannot start movement or transfer", () => {
    expect(
      resolveBankAccountIntent({ accountId: "lama", action: "edit", accounts, access }),
    ).toEqual({ action: "edit", accountId: "lama" });
    expect(
      resolveBankAccountIntent({ accountId: "lama", action: "movement", accounts, access }),
    ).toBeNull();
    expect(
      resolveBankAccountIntent({ accountId: "lama", action: "transfer", accounts, access }),
    ).toBeNull();
  });

  test("transfer requires a second active account", () => {
    expect(
      resolveBankAccountIntent({
        accountId: "operasional",
        action: "transfer",
        accounts: accounts.filter((account) => account.id !== "cadangan"),
        access,
      }),
    ).toBeNull();
  });

  test("consuming the intent preserves tab, workspace presentation, other context and fragment", () => {
    const href = consumeBankAccountIntentHref(
      "https://atria.test/ledger?tab=accounts&surface=mobile&account=operasional&bank-action=edit&filter=active#recent",
    );
    expect(href).toBe("/ledger?tab=accounts&surface=mobile&filter=active#recent");
    expect(consumeBankAccountIntentHref(href)).toBe(href);
    expect(consumeBankAccountIntentHref("/admin/ledger?tab=accounts&account=lama")).toBe(
      "/admin/ledger?tab=accounts",
    );
  });
});
