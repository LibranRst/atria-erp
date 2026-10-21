import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act } from "react";
const browserWindow = new Window({ url: "https://atria.test/ai", width: 1280 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "ResizeObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  const value: unknown = key === "window" ? browserWindow : Reflect.get(browserWindow, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" &&
      ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browserWindow)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { createRoot } = await import("react-dom/client");
const { ReviewCollection, ReviewItem } = await import("./review-collection");
const { ChoiceRow } = await import("./basic-form-controls");
const checkboxChanges: boolean[] = [],
  radioChanges: boolean[] = [];
let detailCalls = 0;
let reviewChecked = true;
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function render(expanded: boolean): void {
  root.render(
    <ReviewCollection ariaLabel="Fixture review">
      <ReviewItem
        title="Panel"
        summary="2 lembar"
        selection={
          <ChoiceRow
            presentation="review"
            title="Pilih panel review"
            checked={reviewChecked}
            onChange={(checked) => {
              reviewChecked = checked;
              render(expanded);
            }}
          />
        }
        editor={<input defaultValue="Harga awal" />}
        expanded={expanded}
        onToggle={() => undefined}
        editable
      />
      <ReviewItem
        title="Panel rincian"
        primaryValue={<span>Rp 125.000</span>}
        summary="2 lembar"
        editor={<p>Deskripsi client-safe</p>}
        expanded={expanded}
        onToggle={() => {
          detailCalls++;
        }}
      >
        <p data-reviewed-change>Harga jual sebelum dan sesudah</p>
      </ReviewItem>
      <li>
        <ChoiceRow
          compact
          title="Pilih panel"
          checked
          onChange={(checked) => checkboxChanges.push(checked)}
          indicatorShape="square"
        />
        <ChoiceRow
          compact
          selectionMode="radio"
          title="Radio pilihan"
          checked
          onChange={(checked) => radioChanges.push(checked)}
          indicatorShape="square"
        />
      </li>
    </ReviewCollection>,
  );
}
await act(async () => render(true));
const input = host.querySelector<HTMLInputElement>("input");
assert.ok(input);
input.value = "Koreksi lokal";
input.focus();
input.setSelectionRange(4, 7);
assert.equal(document.activeElement, input);
await act(async () => render(false));
assert.equal(host.querySelector("input"), input, "Closing preserves the input node");
assert.equal(input.value, "Koreksi lokal");
assert.ok(input.closest("[inert]"), "Collapsed editor cannot receive keyboard focus");
await act(async () => render(true));
assert.equal(host.querySelector("input"), input);
assert.equal(input.value, "Koreksi lokal");
assert.equal(input.closest("[inert]"), null);
const detailRow = [...host.querySelectorAll("li[data-review-item]")].find((row) =>
  row.textContent?.includes("Panel rincian"),
);
assert.ok(detailRow);
const disclosure = detailRow.querySelector("[data-review-disclosure]"),
  detailButton = disclosure?.querySelector<HTMLButtonElement>("button");
assert.ok(disclosure && detailButton);
const change = detailRow.querySelector("[data-reviewed-change]");
assert.ok(change);
assert.ok(
  Boolean(change.compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING),
  "Details follow reviewed context rather than sharing its amount header",
);
assert.equal(detailButton.getAttribute("aria-expanded"), "true");
assert.ok(document.getElementById(detailButton.getAttribute("aria-controls") ?? ""));
await act(async () => detailButton.click());
assert.equal(detailCalls, 1);
const check = host.querySelector<HTMLButtonElement>('[role="checkbox"][aria-label="Pilih panel"]'),
  radio = host.querySelector<HTMLButtonElement>('[role="radio"]');
assert.ok(check && radio);
assert.equal(check.getAttribute("aria-checked"), "true");
assert.ok(check.querySelector(".rounded-sm"));
assert.ok(radio.querySelector(".rounded-full"));
await act(async () => {
  check.click();
  radio.click();
});
assert.deepEqual(checkboxChanges, [false]);
assert.deepEqual(radioChanges, [true]);
const reviewSelection = host.querySelector<HTMLButtonElement>(
  '[role="checkbox"][aria-label="Pilih panel review"]',
);
assert.ok(reviewSelection);
assert.equal(reviewSelection.getAttribute("aria-checked"), "true");
assert.ok(reviewSelection.textContent?.includes("Dipilih"));
assert.ok(reviewSelection.closest("[data-review-actions]"));
await act(async () => reviewSelection.click());
assert.equal(reviewSelection.getAttribute("aria-checked"), "false");
assert.equal(reviewSelection.textContent?.trim(), "Pilih");
assert.equal(host.querySelector("input"), input, "Changing inclusion preserves editor input");
assert.equal(input.value, "Koreksi lokal");
assert.equal(host.querySelector("table"), null);
assert.ok(host.querySelector('ul[aria-label="Fixture review"]'));
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("Review collection DOM passed");
