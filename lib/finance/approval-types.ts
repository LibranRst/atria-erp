export type ApprovalDetailType = "project_cost" | "vendor_payment";

export type ApprovalDetail = {
  readonly id: string;
  readonly createdAt: Date;
  readonly notes: string | null;
  readonly type: ApprovalDetailType;
  readonly referenceId: string;
  readonly amount: number;
  readonly description: string;
  readonly receiptImageUrl: string | null;
  readonly projectName: string;
  readonly budgetItemName: string;
  readonly allocatedAmount: number;
  readonly actualSpent: number;
  readonly requestedBy: string;
  readonly budgetOverrun: boolean;
};
