import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpenseLineBudgetContextCard } from "./expense-line-context-cards";

test("desktop expense context preserves cents and a negative remainder for over-budget review", (): void => {
  const html = renderToStaticMarkup(
    <ExpenseLineBudgetContextCard compact categoryName="Material" amount={31.25} remaining={30} />,
  );
  expect(html).toContain("31,25");
  expect(html).toContain("-1,25");
  expect(html).toContain("Sisa setelah item");
  expect(html).toContain("persetujuan khusus Owner");
});

test("a known zero remainder is shown without losing the draft subtotal", (): void => {
  const html = renderToStaticMarkup(
    <ExpenseLineBudgetContextCard compact categoryName="Operasional" amount={30} remaining={30} />,
  );
  expect(html).toContain("Rp 30");
  expect(html).toContain("Rp 0");
  expect(html).not.toContain("persetujuan khusus Owner");
});
