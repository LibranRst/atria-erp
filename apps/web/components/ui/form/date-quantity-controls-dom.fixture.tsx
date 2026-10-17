import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act, useState } from "react";

const browserWindow = new Window({ url: "https://atria.test/materials", width: 1440, height: 900 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "Element",
  "Node",
  "NodeFilter",
  "Event",
  "MouseEvent",
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
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DatePickerField } = await import("./date-form-controls");
const { FormField, QuantityStepper } = await import("./basic-form-controls");
const { FormSection } = await import("./guided-form");
const { FormSheet } = await import("../overlay/semantic-sheets");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const dates: string[] = [];

function Fixture({
  presentation,
}: {
  readonly presentation: "desktop" | "mobile";
}): React.JSX.Element {
  const [date, setDate] = useState("2026-10-16");
  const [quantity, setQuantity] = useState("2.5");
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <FormSheet
        open
        title="Rincian pengujian"
        dismissal={{ mode: "preserve" }}
        onClose={() => undefined}
      >
        <FormSection>
          <DatePickerField
            id="date"
            label="Tanggal pemeriksaan"
            value={date}
            onChange={(next): void => {
              dates.push(next);
              setDate(next);
            }}
          />
          <FormField label="Jumlah" helper="Setengah satuan diperbolehkan." required>
            <QuantityStepper
              id="quantity"
              value={quantity}
              min={1.5}
              max={3}
              step={0.5}
              onChange={setQuantity}
            />
          </FormField>
        </FormSection>
      </FormSheet>
    </WorkspacePresentationProvider>
  );
}

async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  });
}

function input(): HTMLInputElement {
  const element = document.getElementById("quantity");
  assert.ok(element instanceof HTMLInputElement);
  return element;
}

function trigger(): HTMLButtonElement {
  const element = document.getElementById("date");
  assert.ok(element instanceof HTMLButtonElement);
  return element;
}

function button(label: string): HTMLButtonElement {
  const element = document.querySelector(`button[aria-label="${label}"]`);
  assert.ok(element instanceof HTMLButtonElement);
  return element;
}

await act(async (): Promise<void> => root.render(<Fixture presentation="desktop" />));
await settle();
const initialInput = input();
const initialTrigger = trigger();
assert.equal(initialInput.value, "2.5");
assert.equal(initialInput.required, true);
const helperId = initialInput.getAttribute("aria-describedby");
assert.ok(helperId && document.getElementById(helperId)?.textContent?.includes("Setengah"));

await act(async (): Promise<void> => button("Tambah jumlah").click());
assert.equal(input().value, "3");
assert.equal(button("Tambah jumlah").disabled, true);
await act(async (): Promise<void> => button("Kurangi jumlah").click());
await act(async (): Promise<void> => button("Kurangi jumlah").click());
await act(async (): Promise<void> => button("Kurangi jumlah").click());
assert.equal(input().value, "1.5");
assert.equal(button("Kurangi jumlah").disabled, true);

await act(async (): Promise<void> => initialTrigger.click());
await settle();
assert.equal(document.querySelectorAll('[role="dialog"]').length, 2);
const focusedDay = document.activeElement;
assert.ok(
  focusedDay instanceof HTMLButtonElement && focusedDay.getAttribute("role") === "gridcell",
);
await act(async (): Promise<void> => root.render(<Fixture presentation="mobile" />));
await settle();
assert.ok(input() === initialInput);
assert.ok(trigger() === initialTrigger);
assert.ok(document.activeElement === focusedDay);
assert.equal(document.querySelectorAll('[role="dialog"]').length, 2);
assert.ok(trigger().classList.contains("atria-desktop-field"));

await act(async (): Promise<void> => {
  focusedDay.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
});
const nextDay = document.activeElement;
assert.ok(nextDay instanceof HTMLButtonElement);
assert.ok(nextDay.getAttribute("aria-label")?.includes("17 Oktober 2026"));
await act(async (): Promise<void> => nextDay.click());
for (
  let frame = 0;
  frame < 20 && document.querySelectorAll('[role="dialog"]').length > 1;
  frame += 1
) {
  await settle();
}
assert.deepEqual(dates, ["2026-10-17"]);
assert.ok(trigger().getAttribute("aria-label")?.includes("17 Okt 2026"));
assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
assert.ok(document.activeElement === initialTrigger);
assert.equal(input().value, "1.5");
await act(async (): Promise<void> => root.unmount());
await browserWindow.happyDOM.cancelAsync();
console.log("date and quantity controls preserve nested keyboard, values and resize ownership");
