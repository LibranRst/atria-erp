import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act } from "react";

const browser = new Window({ url: "https://atria.test/sheet" });
for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MutationObserver",
] as const) {
  Reflect.set(globalThis, name, name === "window" ? browser : Reflect.get(browser, name));
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { createRoot } = await import("react-dom/client");
const { useSheetPresenceValue } = await import("./use-sheet-presence-value");
type Entity = { readonly id: string; readonly name: string };
type Presence = ReturnType<typeof useSheetPresenceValue<Entity>>;
const captured: { value?: Presence } = {};
const first: Entity = { id: "first", name: "Draft pertama" };
const second: Entity = { id: "second", name: "Draft kedua" };
function Probe({ entity }: { readonly entity: Entity | null }): React.JSX.Element | null {
  const presence = useSheetPresenceValue(entity, entity?.id);
  React.useLayoutEffect((): void => {
    captured.value = presence;
  }, [presence]);
  return presence.presentedValue ? (
    <div data-entity={presence.presentedValue.id} data-open={presence.open}>
      {presence.presentedValue.name}
    </div>
  ) : null;
}
function current(): Presence {
  if (!captured.value) throw new Error("Sheet probe did not render");
  return captured.value;
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function render(entity: Entity | null): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Probe entity={entity} />);
  });
}
try {
  await render(first);
  await render(null);
  assert.equal(current().open, false);
  assert.equal(
    host.textContent,
    first.name,
    "Closing retains its content until the exit completes",
  );
  const oldExit = current().handleExitComplete;
  await render(second);
  await render(null);
  await act(async (): Promise<void> => {
    oldExit();
  });
  assert.equal(
    host.textContent,
    second.name,
    "A delayed exit from another selection must not clear the current closing sheet",
  );
  await act(async (): Promise<void> => {
    current().handleExitComplete();
  });
  assert.equal(host.textContent, "", "The current exit releases the retained selection");

  await render(first);
  await render(null);
  const interruptedExit = current().handleExitComplete;
  await render(first);
  await act(async (): Promise<void> => {
    interruptedExit();
  });
  assert.equal(current().open, true);
  assert.equal(host.textContent, first.name, "Reopening cancels cleanup from the previous close");
  await render(null);
  await act(async (): Promise<void> => {
    interruptedExit();
  });
  assert.equal(host.textContent, first.name, "A repeated close has its own exit generation");
  await act(async (): Promise<void> => {
    current().handleExitComplete();
  });
  assert.equal(host.textContent, "");
  console.log("Sheet presence DOM regressions passed");
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browser.happyDOM.close();
}
