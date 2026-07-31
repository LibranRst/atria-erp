import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MoneyValue } from "./page-primitives";
import { SearchInput, SheetSelect } from "../form/select-form-controls";

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

  test("centers a focal financial value when requested", () => {
    const html = renderToStaticMarkup(
      <MoneyValue amount={12_500_000} variant="fullDynamic" align="center" size="hero" />,
    );

    expect(html).toContain("text-center");
    expect(html).not.toContain("text-right");
  });

  test("uses explicit compact spacing for selected option context", () => {
    const html = renderToStaticMarkup(
      <SheetSelect
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
    expect(html).toContain("mt-0.5 block truncate text-[10px] leading-4");
  });

  test("keeps picker search visible against the gray sheet canvas", () => {
    const html = renderToStaticMarkup(
      <SearchInput value="" onChange={() => undefined} placeholder="Cari tagihan" />,
    );

    expect(html).toContain("bg-surface-container-lowest");
    expect(html).toContain("ring-ring-control");
    expect(html).toContain("focus-within:ring-focus-ring");
  });
});
