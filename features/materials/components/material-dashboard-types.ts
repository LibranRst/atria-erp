export type MaterialOperationDecision = {
  readonly type:
    | "COUNT_APPROVE"
    | "COUNT_REJECT"
    | "RECEIPT_APPROVE"
    | "RECEIPT_REJECT"
    | "RECEIPT_REQUEST";
  readonly id: string;
};

export type MaterialLocation = {
  readonly id: string;
  readonly name: string;
};
