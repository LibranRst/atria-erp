import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CashFlowTrendChart } from "./cash-flow-trend-chart";
test("monthly cash comparison exposes both series and exact accessible data without canvas", () => {
  const html = renderToStaticMarkup(
    <CashFlowTrendChart
      buckets={[
        { monthKey: "2026-10", cashIn: 123.25, cashOut: 25.5, net: 97.75, isPartial: true },
      ]}
    />,
  );
  expect(html).toContain("Kas masuk");
  expect(html).toContain("Kas keluar");
  expect(html).toContain("Arus bersih");
  expect(html).toContain("Bulan berjalan belum lengkap");
  expect(html).toContain('tabindex="0"');
  expect(html).toContain("2026-10");
  expect(html).not.toContain("<canvas");
});
