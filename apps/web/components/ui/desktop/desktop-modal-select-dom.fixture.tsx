import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { SelectOption } from "../index";

const browserWindow = new Window({ url: "https://atria.test/ledger", width: 1280, height: 960 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
// React Aria focus restoration dispatches CustomEvent. Bind it to the same
// HappyDOM realm as Event; Bun's native constructor cannot model DOM dispatch.
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "NodeList",
  "HTMLCollection",
  "NodeFilter",
  "Event",
  "CustomEvent",
  "FocusEvent",
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
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "dropdown-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
const { createRoot } = await import("react-dom/client");
const {
  AdaptiveSelect,
  DesktopUIProvider,
  ComboboxField,
  FilterSelect,
  ActionMenu,
  Button,
  FormSheet,
  FormSection,
  ConfirmationDialog,
  ContextPopover,
} = await import("../index");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const options = [
  { value: "", label: "Tanpa tautan" },
  { value: "material", label: "Material", group: "Kategori", meta: "25%" },
  { value: "tukang", label: "Tukang", group: "Kategori" },
  { value: "locked", label: "Pilihan terkunci", disabled: true, disabledReason: "Tidak tersedia" },
];
type Case =
  | "empty-create"
  | "empty-custom"
  | "empty-normal"
  | "empty-filter"
  | "late-options"
  | "normal"
  | "search"
  | "filter"
  | "search-filter"
  | "action-menu"
  | "selection-dialog"
  | "disabled"
  | "context-popover";
let outerDismissals = 0;
let selectedValue = "";
let createCalls = 0;
const publicButtonRef: { current: HTMLButtonElement | null } = { current: null };
let contextTransitions: boolean[] = [];
let completeLateChoices: () => void = (): void => {
  throw new Error("Late options fixture is not mounted");
};

function Fixture({ scenario }: { readonly scenario: Case }): React.JSX.Element {
  const [value, setValue] = React.useState(scenario === "normal" ? "material" : "");
  const [creating, setCreating] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState(false);
  const [lateChoices, setLateChoices] = React.useState<readonly SelectOption[]>([]);
  React.useEffect((): (() => void) => {
    completeLateChoices = (): void => setLateChoices(options);
    return (): void => {
      completeLateChoices = (): void => {
        throw new Error("Late options fixture is not mounted");
      };
    };
  }, []);
  function select(next: string): void {
    selectedValue = next;
    setValue(next);
    if (scenario === "selection-dialog") setConfirmation(true);
  }
  function create(): void {
    createCalls++;
    setCreating(true);
  }
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <FormSheet
          open
          title="Modal induk audit"
          dismissal={{ mode: "discard" }}
          onClose={(): void => {
            outerDismissals++;
          }}
        >
          <FormSheet
            open
            title="Modal item audit"
            dismissal={{ mode: "discard" }}
            onClose={(): void => {
              outerDismissals++;
            }}
          >
            <FormSection title="Pilihan">
              {scenario === "context-popover" ? (
                <ContextPopover
                  label="Konteks audit"
                  onOpenChange={(next: boolean): void => {
                    contextTransitions.push(next);
                  }}
                  trigger={<Button id="audit-context">Buka konteks audit</Button>}
                >
                  <AdaptiveSelect
                    id="audit-select"
                    label="Vendor konteks audit"
                    value={value}
                    onChange={select}
                    options={options}
                  />
                </ContextPopover>
              ) : scenario === "empty-custom" ? (
                <ComboboxField
                  id="audit-select"
                  label="Satuan"
                  value={value}
                  onChange={select}
                  options={[]}
                  allowCustomValue
                />
              ) : scenario === "filter" ||
                scenario === "search-filter" ||
                scenario === "empty-filter" ? (
                <FilterSelect
                  label="Status audit"
                  value={value}
                  onChange={select}
                  options={scenario === "empty-filter" ? [] : options}
                  searchable={scenario === "search-filter"}
                />
              ) : scenario === "action-menu" ? (
                <ActionMenu
                  label="Aksi audit"
                  trigger={<Button id="audit-select">Aksi item</Button>}
                  items={[
                    { id: "new", label: "Tambah referensi", onSelect: create },
                    {
                      id: "blocked",
                      label: "Aksi terkunci",
                      disabledReason: "Tidak tersedia",
                      onSelect: (): void => {
                        throw new Error("disabled action ran");
                      },
                    },
                  ]}
                />
              ) : (
                <AdaptiveSelect
                  id="audit-select"
                  label="Kategori audit"
                  value={value}
                  onChange={select}
                  options={
                    scenario.startsWith("empty")
                      ? []
                      : scenario === "late-options"
                        ? lateChoices
                        : scenario === "search"
                          ? [
                              ...options,
                              ...Array.from({ length: 8 }, (_, index) => ({
                                value: `extra-${index}`,
                                label: `Opsi ${index + 1}`,
                                description: "Referensi",
                              })),
                            ]
                          : options
                  }
                  emptyText="Referensi belum tersedia."
                  disabled={scenario === "disabled"}
                  createActionLabel={scenario === "empty-create" ? "Tambah referensi" : undefined}
                  onCreateAction={scenario === "empty-create" ? create : undefined}
                />
              )}
            </FormSection>
            <input id="audit-outside" aria-label="Catatan audit" />
            <FormSheet
              open={creating}
              title="Referensi baru audit"
              dismissal={{ mode: "discard" }}
              onClose={(): void => setCreating(false)}
            >
              <input id="new-reference" aria-label="Nama referensi" autoFocus />
            </FormSheet>
            <ConfirmationDialog
              open={confirmation}
              title="Konfirmasi perubahan"
              description="Tinjau pilihan."
              confirmLabel="Terapkan"
              onConfirm={(): void => setConfirmation(false)}
              onClose={(): void => setConfirmation(false)}
            />
          </FormSheet>
        </FormSheet>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 650));
  });
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
}
async function click(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1 }),
    );
    element.focus();
  });
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 0,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }),
    );
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }),
    );
  });
  await settle();
}
function button(text: string): HTMLButtonElement {
  const element = [...document.querySelectorAll("button")].find(
    (node): boolean => node.textContent?.includes(text) === true,
  );
  assert.ok(element instanceof HTMLButtonElement, `button ${text} exists`);
  return element;
}
function option(text: string): HTMLElement {
  const element = [...document.querySelectorAll('[role="option"], [role="menuitem"]')].find(
    (node): boolean => node.textContent?.includes(text) === true,
  );
  assert.ok(element instanceof HTMLElement, `option ${text} exists`);
  return element;
}
async function type(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert.ok(setter);
  await act(async (): Promise<void> => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
async function render(scenario: Case): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Fixture key={scenario} scenario={scenario} />);
  });
  await settle();
  outerDismissals = 0;
  selectedValue = "";
  createCalls = 0;
  contextTransitions = [];
}
function trigger(): HTMLButtonElement {
  const element =
    document.getElementById("audit-select") ??
    document.querySelector('button[aria-haspopup="listbox"]');
  assert.ok(element instanceof HTMLButtonElement);
  return element;
}
try {
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <Button
          id="public-button-ref"
          ref={(node: HTMLButtonElement | null): void => {
            publicButtonRef.current = node;
          }}
        >
          Pemicu dengan ref
        </Button>
      </WorkspacePresentationProvider>,
    );
  });
  await settle();
  assert.ok(
    publicButtonRef.current instanceof HTMLButtonElement,
    "a public desktop Button forwards its actual DOM ref for shared anchored trigger ownership",
  );
  assert.equal(publicButtonRef.current === document.getElementById("public-button-ref"), true);

  await render("context-popover");
  const contextTrigger = button("Buka konteks audit");
  await click(contextTrigger);
  assert.equal(contextTrigger.getAttribute("aria-expanded"), "true");
  await click(trigger());
  assert.equal(
    contextTrigger.getAttribute("aria-expanded"),
    "true",
    "opening a nested selection keeps its parent ContextPopover open inside two sheets",
  );
  await click(option("Tukang"));
  assert.equal(selectedValue, "tukang");
  assert.equal(
    contextTrigger.getAttribute("aria-expanded"),
    "true",
    "selecting a nested option keeps its parent ContextPopover open",
  );
  assert.equal(outerDismissals, 0);
  await click(contextTrigger);
  assert.equal(
    contextTrigger.getAttribute("aria-expanded"),
    "false",
    "pressing the parent trigger after nested selection closes it once",
  );
  assert.deepEqual(
    contextTransitions,
    [true, false],
    "trigger blur and press do not close then reopen the same parent",
  );

  await render("empty-create");
  await click(trigger());
  assert.equal(
    trigger().getAttribute("aria-expanded"),
    "true",
    "an empty creatable reference list must open inside two nested modals",
  );
  assert.ok(document.body.textContent?.includes("Referensi belum tersedia."));
  await click(button("Tambah referensi"));
  assert.equal(createCalls, 1);
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 3);
  assert.equal(
    document.querySelector('[aria-label="Referensi baru audit"]')?.contains(document.activeElement),
    true,
    "the new sheet retains focus after the menu exits",
  );
  assert.equal(outerDismissals, 0);

  await render("empty-custom");
  await click(trigger());
  const customInput = document.querySelector('input[type="search"]');
  assert.ok(
    customInput instanceof HTMLInputElement,
    "empty custom choices still open a searchable entry",
  );
  await type(customInput, "lembar");
  await click(option("Gunakan “lembar”"));
  assert.equal(selectedValue, "lembar");
  assert.ok(trigger().textContent?.includes("lembar"));

  await render("empty-normal");
  await click(trigger());
  assert.equal(trigger().getAttribute("aria-expanded"), "true");
  assert.ok(document.body.textContent?.includes("Referensi belum tersedia."));

  await render("empty-filter");
  await click(trigger());
  assert.equal(
    trigger().getAttribute("aria-expanded"),
    "true",
    "an empty FilterSelect opens its empty state rather than ignoring presses",
  );
  assert.ok(document.querySelector('[role="listbox"]') instanceof HTMLElement);
  const filterEmptyList = document.querySelector('[role="listbox"]');
  assert.ok(filterEmptyList?.textContent?.includes("Tidak ada pilihan yang cocok."));
  // React Aria wraps empty content in role=option without a focusable/keyed item.
  assert.equal(filterEmptyList?.querySelector('[role="option"][tabindex]'), null);
  assert.equal(outerDismissals, 0);

  await render("late-options");
  await click(trigger());
  const emptyList = document.querySelector('[role="listbox"]');
  assert.ok(emptyList instanceof HTMLElement);
  await act(async (): Promise<void> => {
    completeLateChoices();
  });
  await settle();
  assert.equal(
    trigger().getAttribute("aria-expanded"),
    "true",
    "late reference data does not dismiss the already open menu",
  );
  assert.equal(
    document.querySelector('[role="listbox"]') === emptyList,
    true,
    "late options update the mounted list without replacing its owner",
  );
  await click(option("Material"));
  assert.equal(
    selectedValue,
    "material",
    "reference choices arriving after opening remain selectable",
  );
  assert.equal(outerDismissals, 0);

  await render("normal");
  await click(trigger());
  const locked = option("Pilihan terkunci");
  assert.equal(locked.getAttribute("aria-disabled"), "true");
  await click(locked);
  assert.equal(selectedValue, "");
  await click(option("Tanpa tautan"));
  assert.equal(
    trigger().textContent?.includes("Tanpa tautan"),
    true,
    "an explicit empty-value sentinel remains selectable",
  );
  await click(trigger());
  await click(option("Tukang"));
  assert.equal(selectedValue, "tukang");
  await click(trigger());
  const listbox = document.querySelector('[role="listbox"]');
  assert.ok(listbox instanceof HTMLElement);
  await act(async (): Promise<void> => {
    listbox.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await settle();
  assert.equal(document.querySelectorAll('[role="listbox"]').length, 0);
  assert.equal(document.activeElement?.id, "audit-select");
  assert.equal(outerDismissals, 0);

  for (const scenario of ["search", "filter", "search-filter"] as const) {
    await render(scenario);
    await click(trigger());
    if (scenario !== "filter") {
      const input = document.querySelector('input[type="search"]');
      assert.ok(input instanceof HTMLInputElement);
      await type(input, "Tukang");
      assert.equal(document.querySelectorAll('[role="option"]').length, 1);
    }
    await click(option("Tukang"));
    assert.equal(selectedValue, "tukang", `${scenario} selection updates its value`);
    assert.equal(outerDismissals, 0);
  }

  await render("action-menu");
  await click(trigger());
  await click(option("Tambah referensi"));
  assert.equal(createCalls, 1);
  assert.equal(
    document.querySelector('[aria-label="Referensi baru audit"]')?.contains(document.activeElement),
    true,
  );
  assert.equal(outerDismissals, 0);

  await render("selection-dialog");
  await click(trigger());
  await click(option("Tukang"));
  const confirmation = document.querySelector('[role="alertdialog"]');
  assert.ok(confirmation instanceof HTMLElement);
  assert.ok(confirmation.textContent?.includes("Konfirmasi perubahan"));
  assert.equal(
    confirmation.contains(document.activeElement),
    true,
    "a selection-triggered confirmation retains focus",
  );
  assert.equal(outerDismissals, 0);

  await render("disabled");
  assert.equal(trigger().disabled, true);
  await click(trigger());
  assert.equal(document.querySelectorAll('[role="listbox"]').length, 0);
  console.log("nested desktop selection variants passed");
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browserWindow.happyDOM.close();
}
