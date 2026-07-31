import type { ExpenseDraftPayloadInput } from "@/lib/validations/expense-draft";

export type ExpenseDraftSummary = {
  readonly id: string;
  readonly revision: number;
  readonly projectId: string;
  readonly projectName: string;
  readonly itemCount: number;
  readonly totalAmount: number;
  readonly hasReceipt: boolean;
  readonly lastSavedAt: Date;
};

export type ExpenseDraftRecord = {
  readonly id: string;
  readonly revision: number;
  readonly payload: ExpenseDraftPayloadInput;
  readonly lastSavedAt: Date;
};

export type SubmittedExpenseDraft = {
  readonly draftId: string;
  readonly receiptGroupId: string;
  readonly projectCostIds: readonly string[];
  readonly itemCount: number;
  readonly totalAmount: number;
  readonly idempotent: boolean;
};
