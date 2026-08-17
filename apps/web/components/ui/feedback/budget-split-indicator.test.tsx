import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BudgetSplitIndicator } from "./budget-split-indicator";

describe("budget split context", () => {
  test("exposes percentage plus used and remaining nominal values", () => {
    const html = renderToStaticMarkup(
      <BudgetSplitIndicator
        value={72.5}
        usedAmount={725_000_000}
        remainingAmount={275_000_000}
        tone="warning"
      />,
    );

    expect(html).toContain("Budget terpakai 72.5 persen");
    expect(html).toContain("Terpakai Rp 725 jt");
    expect(html).toContain("Tersisa 28% · Rp 275 jt");
    expect(html).toContain("bg-warning");
  });
});
