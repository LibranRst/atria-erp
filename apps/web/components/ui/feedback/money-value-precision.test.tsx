import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MoneyValue } from "./page-primitives";
test("exact review keeps adjacent-cent values distinct while preserving existing whole-rupiah defaults", () => {
  const before = renderToStaticMarkup(
    <MoneyValue amount={100.49} variant="fullDynamic" fractionDigits={2} />,
  );
  const after = renderToStaticMarkup(
    <MoneyValue amount={100.5} variant="fullDynamic" fractionDigits={2} />,
  );
  expect(before).toContain("Rp 100,49");
  expect(after).toContain("Rp 100,50");
  expect(before).not.toBe(after);
  expect(renderToStaticMarkup(<MoneyValue amount={100.5} variant="fullDynamic" />)).toContain(
    "Rp 101",
  );
});
