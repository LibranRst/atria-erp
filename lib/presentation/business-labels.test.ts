import { describe, expect, test } from "bun:test";

import { formatBusinessLabel, hasRawBusinessSeparator } from "./business-labels";

describe("business labels", () => {
  test("translates canonical finance, inventory, status, and role values", () => {
    expect(formatBusinessLabel("opening_balance")).toBe("Saldo awal");
    expect(formatBusinessLabel("opening_balance", "FINANCE")).toBe("Saldo awal rekening");
    expect(formatBusinessLabel("opening_balance", "INVENTORY")).toBe("Saldo awal stok");
    expect(formatBusinessLabel("vendor_payment")).toBe("Pembayaran vendor");
    expect(formatBusinessLabel("GOODS_RECEIPT_REVERSAL")).toBe("Pembatalan penerimaan barang");
    expect(formatBusinessLabel("PENDING_APPROVAL")).toBe("Menunggu persetujuan");
    expect(formatBusinessLabel("FINANCE_ADMIN")).toBe("Finance Admin");
  });

  test("uses a readable fallback without leaking separators", () => {
    const label = formatBusinessLabel("future_workflow_state");
    expect(label).toBe("Future workflow state");
    expect(hasRawBusinessSeparator(label)).toBe(false);
  });

  test("returns a neutral dash for empty values", () => {
    expect(formatBusinessLabel(null)).toBe("—");
    expect(formatBusinessLabel("  ")).toBe("—");
  });
});
