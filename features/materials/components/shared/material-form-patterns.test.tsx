import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { StockImpactRow } from "@/features/materials/components/shared/stock-impact-row";

describe("material operation form patterns", () => {
  test("renders a zero stock delta as unchanged without a negative zero", () => {
    const markup = renderToStaticMarkup(
      <StockImpactRow
        label="Stok fisik"
        before={65}
        delta={-0}
        after={65}
        reserved={20}
        unit="lembar"
      />,
    );

    expect(markup).toContain("Tidak berubah");
    expect(markup).not.toContain("-0 lembar");
    expect(markup).toContain("Sebelum");
    expect(markup).toContain("Sesudah");
  });
});
