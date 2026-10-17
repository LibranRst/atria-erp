"use client";

import React from "react";

type Region = "list" | "detail";
type OwnedFocus = { readonly element: HTMLElement; readonly region: Region };
type Invoker = { readonly element: HTMLElement; readonly rowKey: string | null };

const focusable =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const keyedRow = '[role="row"][data-key], tr[data-key]';

function visible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (
      current.hidden ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true"
    )
      return false;
    const style = getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    )
      return false;
  }
  return true;
}

function focus(element: HTMLElement | null, temporary = false): boolean {
  if (!element || !visible(element) || element.hasAttribute("disabled")) return false;
  const original = element.getAttribute("tabindex");
  if (temporary && original === null) element.setAttribute("tabindex", "-1");
  element.focus({ preventScroll: true });
  if (temporary && original === null) element.removeAttribute("tabindex");
  return document.activeElement === element;
}

function focusWithin(owner: HTMLElement | null, region: Region): boolean {
  if (!owner || !visible(owner)) return false;
  const first = [...owner.querySelectorAll<HTMLElement>(focusable)].find(visible);
  if (focus(first ?? null)) return true;
  const semantic = owner.querySelector<HTMLElement>(
    region === "list" ? '[role="grid"], table' : 'h1, h2, h3, [role="heading"]',
  );
  return focus(semantic ?? owner, true);
}

/**
 * Repairs focus only when an owned list/detail node disappears or becomes hidden.
 * Callers retain responsive layout, selection and the existing overlay behavior owner.
 */
export function useListDetailFocus({
  active = true,
  narrow,
  selectionKey,
}: {
  readonly active?: boolean;
  readonly narrow: boolean;
  readonly selectionKey: string | null;
}): {
  readonly listRef: React.RefCallback<HTMLElement>;
  readonly detailRef: React.RefCallback<HTMLElement>;
} {
  const list = React.useRef<HTMLElement | null>(null);
  const detail = React.useRef<HTMLElement | null>(null);
  const owned = React.useRef<OwnedFocus | null>(null);
  const invoker = React.useRef<Invoker | null>(null);
  const listRef = React.useCallback((element: HTMLElement | null): void => {
    list.current = element;
  }, []);
  const detailRef = React.useCallback((element: HTMLElement | null): void => {
    detail.current = element;
  }, []);

  React.useEffect(() => {
    if (!active) return;
    function rememberElement(element: EventTarget | null): void {
      if (!(element instanceof HTMLElement) || element === document.body) return;
      if (list.current?.contains(element)) {
        owned.current = { element, region: "list" };
        const row = element.closest<HTMLElement>(keyedRow);
        if (row) invoker.current = { element, rowKey: row.getAttribute("data-key") };
      } else if (detail.current?.contains(element)) {
        owned.current = { element, region: "detail" };
      } else owned.current = null;
    }
    function remember(event: FocusEvent): void {
      rememberElement(event.target);
    }
    document.addEventListener("focusin", remember, true);
    // Resuming a retained pane can leave its row focused without another focusin.
    rememberElement(document.activeElement);
    return (): void => document.removeEventListener("focusin", remember, true);
  }, [active]);

  // Every committed reflow can remove focused content, including a refreshed row.
  // No polling, viewport subscription, focus trap or dismissal handler is added.
  React.useLayoutEffect(() => {
    if (!active) {
      owned.current = null;
      return;
    }
    const previous = owned.current;
    if (!previous || visible(previous.element)) return;
    const current = document.activeElement;
    if (
      current instanceof HTMLElement &&
      current !== document.body &&
      current !== previous.element &&
      !list.current?.contains(current) &&
      !detail.current?.contains(current)
    ) {
      owned.current = null;
      return;
    }
    // Existing dialogs and anchored selectors keep sole ownership of their focus.
    const overlay = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]',
      ),
    ].some(visible);
    if (overlay) return;
    if (selectionKey !== null && (narrow || previous.region === "detail")) {
      if (focusWithin(detail.current, "detail")) return;
    }
    const saved = invoker.current;
    if (saved && focus(saved.element)) return;
    const restoredRow = saved?.rowKey
      ? [...(list.current?.querySelectorAll<HTMLElement>(keyedRow) ?? [])].find(
          (row) => row.getAttribute("data-key") === saved.rowKey,
        )
      : undefined;
    if (focus(restoredRow ?? null, true)) return;
    focusWithin(list.current, "list");
  });

  return { listRef, detailRef };
}
