const activePointers = new WeakMap<Document, Set<number>>();
const interactionListeners = new WeakMap<Document, Set<() => void>>();

/** Focused controls and protected overlays retain their backend through a viewport change. */
export function hasWorkspaceInteraction(document: Document): boolean {
  if (activePointers.get(document)?.size) return true;
  const focused = document.activeElement;
  if (
    focused?.matches(
      'input, textarea, select, button, [role="button"], [contenteditable="true"], [role="combobox"]',
    ) &&
    !focused.closest('[hidden], [aria-hidden="true"], [inert]')
  )
    return true;

  return [
    ...document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]',
    ),
  ].some((overlay): boolean => !overlay.closest('[hidden], [aria-hidden="true"], [inert]'));
}

export function subscribeWorkspaceInteraction(listener: () => void): () => void {
  const listeners = interactionListeners.get(document) ?? new Set<() => void>();
  interactionListeners.set(document, listeners);
  listeners.add(listener);
  // Focus has moved to its next target by the time the queued check runs.
  const update = (): void =>
    queueMicrotask(() => {
      if (listeners.has(listener)) listener();
    });
  const beginPress = (event: PointerEvent): void => {
    const pointers = activePointers.get(document) ?? new Set<number>();
    pointers.add(event.pointerId);
    activePointers.set(document, pointers);
  };
  const finishPress = (event: PointerEvent): void => {
    // Keep the presenter until the browser has dispatched the ensuing click.
    requestAnimationFrame(() => {
      activePointers.get(document)?.delete(event.pointerId);
      for (const current of listeners) current();
    });
  };
  const cancelPress = (event: PointerEvent): void => {
    activePointers.get(document)?.delete(event.pointerId);
    update();
  };
  const clearPresses = (): void => {
    activePointers.get(document)?.clear();
    update();
  };
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", update);
  document.addEventListener("pointerdown", beginPress, true);
  document.addEventListener("pointerup", finishPress, true);
  document.addEventListener("pointercancel", cancelPress, true);
  window.addEventListener("blur", clearPresses);
  const observer = new MutationObserver(update);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "inert", "role"],
  });
  return (): void => {
    document.removeEventListener("focusin", update);
    document.removeEventListener("focusout", update);
    document.removeEventListener("pointerdown", beginPress, true);
    document.removeEventListener("pointerup", finishPress, true);
    document.removeEventListener("pointercancel", cancelPress, true);
    window.removeEventListener("blur", clearPresses);
    listeners.delete(listener);
    observer.disconnect();
  };
}
