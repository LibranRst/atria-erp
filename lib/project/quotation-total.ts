export interface QuotationItemAmount {
  readonly bundleId?: string | null;
  readonly isHidden: boolean;
  readonly lineTotal: string | number;
}

export interface QuotationBundleAmount {
  readonly id: string;
  readonly isHidden: boolean;
  readonly lineTotal: string | number;
}

export function calculateQuotationTotal(
  items: readonly QuotationItemAmount[],
  bundles: readonly QuotationBundleAmount[] = [],
): number {
  const standalone = items
    .filter((item) => !item.bundleId && !item.isHidden)
    .reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const bundled = bundles
    .filter((bundle) => !bundle.isHidden)
    .reduce((sum, bundle) => sum + Number(bundle.lineTotal), 0);
  return standalone + bundled;
}
