export interface RabBundleForm {
  readonly clientLabel: string;
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
  readonly itemIds: string[];
}

export interface RabChangeOrderForm {
  readonly reason: string;
  readonly scopeSummary: string;
  readonly clientReference: string;
  readonly clientConfirmedAt: string;
}
