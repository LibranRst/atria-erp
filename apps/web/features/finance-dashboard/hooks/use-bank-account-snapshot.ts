"use client";

import { useOptimistic, useState, type Dispatch, type SetStateAction } from "react";
import type { BankAccount } from "../types/bank-account-types";

export type BankAccountSnapshot = {
  readonly items: readonly BankAccount[];
  readonly selected: BankAccount | null;
  readonly setItems: Dispatch<SetStateAction<readonly BankAccount[]>>;
  readonly selectAccount: (id: string | null) => void;
};

export function useBankAccountSnapshot(accounts: readonly BankAccount[]): BankAccountSnapshot {
  const [items, setItems] = useOptimistic(accounts);
  const [selectedId, selectAccount] = useState<string | null>(null);
  return {
    items,
    selected: items.find((account) => account.id === selectedId) ?? null,
    setItems,
    selectAccount,
  };
}
