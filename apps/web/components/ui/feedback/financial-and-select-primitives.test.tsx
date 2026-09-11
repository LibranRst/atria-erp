import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MoneyValue } from "./page-primitives";
import { MoneyImpactRow } from "./money-impact-row";
import { SearchInput, AdaptiveSelect } from "../form/select-form-controls";

describe("financial and select primitives", () => {
  test("keeps large full financial values on one dynamic line", () => {
    const full = renderToStaticMarkup(
      <MoneyValue amount={-1_017_050_000} variant="fullDynamic" size="hero" tone="danger" />,
    );
    const compact = renderToStaticMarkup(
      <MoneyValue amount={-1_017_050_000} variant="compactWithFull" size="sm" tone="danger" />,
    );

    expect(full).toContain("money-value-dynamic__text");
    expect(full).toContain("Rp -1.017.050.000");
    expect(compact).toContain("money-value-compact");
    expect(compact).toContain("money-value-exact");
    expect(compact).not.toContain("wrap-break-word");
  });

  test("compact variant omits the secondary exact-value line but exposes full value via aria-label and tooltip trigger", () => {
    const html = renderToStaticMarkup(
      <MoneyValue amount={-1_017_050_000} variant="compact" size="sm" tone="danger" />,
    );

    expect(html).toContain("money-value-compact");
    expect(html).not.toContain("money-value-exact");
    expect(html).toContain('aria-label="Rp -1.017.050.000"');
    expect(html).toContain("touch-manipulation");
    expect(html).toContain("cursor-default");

    const disabledTooltipHtml = renderToStaticMarkup(
      <MoneyValue amount={-1_017_050_000} variant="compact" size="sm" tone="danger" showTooltip={false} />,
    );
    expect(disabledTooltipHtml).not.toContain("touch-manipulation");
  });

  test("centers a focal financial value when requested", () => {
    const html = renderToStaticMarkup(
      <MoneyValue amount={12_500_000} variant="fullDynamic" align="center" size="hero" />,
    );

    expect(html).toContain("text-center");
    expect(html).not.toContain("text-right");
  });

  test("uses explicit compact spacing for selected option context", () => {
    const html = renderToStaticMarkup(
      <AdaptiveSelect
        label="Status proyek"
        value="ACTIVE"
        onChange={() => undefined}
        options={[
          {
            value: "ACTIVE",
            label: "Aktif",
            description: "Proyek sedang berjalan.",
          },
        ]}
      />,
    );

    expect(html).toContain("text-sm leading-4 font-bold");
    expect(html).toContain("mt-0.5 block truncate text-meta");
  });

  test("keeps picker search visible against the neutral dialog canvas", () => {
    const html = renderToStaticMarkup(
      <SearchInput value="" onChange={() => undefined} placeholder="Cari tagihan" />,
    );

    expect(html).toContain("bg-surface-container-lowest");
    expect(html).toContain("ring-ring-control");
    expect(html).toContain("focus-within:ring-focus-ring");
  });

  test("renders MoneyImpactRow with elevated white surface and state transition", () => {
    const html = renderToStaticMarkup(
      <MoneyImpactRow
        label="Rekening Operasional"
        sublabel="BCA · 1234567890"
        before={100_000_000}
        delta={25_000_000}
        after={125_000_000}
        note="Catatan mutasi kas"
      />,
    );

    expect(html).toContain("bg-surface-container-lowest");
    expect(html).toContain("shadow-surface");
    expect(html).toContain("rounded-[22px]");
    expect(html).toContain("Rekening Operasional");
    expect(html).toContain("BCA · 1234567890");
    expect(html).toContain("+Rp 25.000.000");
    expect(html).toContain("Rp 100.000.000");
    expect(html).toContain("Rp 125.000.000");
    expect(html).toContain("Catatan mutasi kas");
  });
});
