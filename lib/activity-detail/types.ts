export const ACTIVITY_DETAIL_KINDS = [
  "STOCK_MOVEMENT",
  "GOODS_RECEIPT",
  "STOCK_TRANSFER",
  "STOCK_COUNT",
  "INVENTORY_OPENING",
  "PROJECT_COST",
  "VENDOR_BILL",
  "VENDOR_PAYMENT",
  "CASH_TRANSACTION",
  "CLIENT_INVOICE",
  "CLIENT_PAYMENT",
  "RAB_REVISION",
  "CHANGE_ORDER",
  "APPROVAL_DECISION",
] as const;

export type ActivityDetailKind = (typeof ACTIVITY_DETAIL_KINDS)[number];

export type ActivityDetailRequest = {
  readonly kind: ActivityDetailKind;
  readonly id: string;
};

export type ActivityStatusTone =
  | "NEUTRAL"
  | "PENDING"
  | "SUCCESS"
  | "WARNING"
  | "DANGER";

export type ActivityValue =
  | { readonly type: "TEXT"; readonly value: string }
  | { readonly type: "MONEY"; readonly value: number }
  | { readonly type: "QUANTITY"; readonly value: number; readonly unit?: string }
  | { readonly type: "DATE"; readonly value: string };

export type ActivityFact = {
  readonly label: string;
  readonly value: ActivityValue;
};

export type ActivityComparison = {
  readonly label: string;
  readonly before: ActivityValue;
  readonly after: ActivityValue;
};

export type ActivitySource = {
  readonly label: string;
  readonly href: string;
};

export type ActivityDetailView = {
  readonly kind: ActivityDetailKind;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly status: string;
  readonly statusTone: ActivityStatusTone;
  readonly occurredAt: string;
  readonly actorName: string;
  readonly facts: readonly ActivityFact[];
  readonly comparisons: readonly ActivityComparison[];
  readonly impacts: readonly ActivityFact[];
  readonly notes: readonly ActivityFact[];
  readonly source: ActivitySource | null;
  readonly evidenceIncomplete: boolean;
};

export function textValue(value: string): ActivityValue {
  return { type: "TEXT", value };
}

export function moneyValue(value: number): ActivityValue {
  return { type: "MONEY", value };
}

export function quantityValue(value: number, unit?: string): ActivityValue {
  return unit ? { type: "QUANTITY", value, unit } : { type: "QUANTITY", value };
}

export function dateValue(value: Date | string): ActivityValue {
  return { type: "DATE", value: value instanceof Date ? value.toISOString() : value };
}
