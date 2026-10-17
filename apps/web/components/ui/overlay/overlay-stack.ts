let nextOverlayLayer = 200;
let activeOverlayIds: string[] = [];
let bodyLockCount = 0;
let originalBodyOverflow = "";
const handledKeyboardEvents = new WeakSet<KeyboardEvent>();

/** A nested native selector can close before the parent's window handler runs. */
export function markOverlayKeyHandled(event: KeyboardEvent): void {
  handledKeyboardEvents.add(event);
}

export function isOverlayKeyHandled(event: KeyboardEvent): boolean {
  return event.defaultPrevented || handledKeyboardEvents.has(event);
}

export function promoteOverlay(overlayId: string): number {
  activeOverlayIds = activeOverlayIds.filter((id) => id !== overlayId);
  activeOverlayIds.push(overlayId);
  nextOverlayLayer += 2;
  return nextOverlayLayer;
}

export function deactivateOverlay(overlayId: string): void {
  activeOverlayIds = activeOverlayIds.filter((id) => id !== overlayId);
}

export function isTopOverlay(overlayId: string): boolean {
  return activeOverlayIds.at(-1) === overlayId;
}

/** Closing ancestors cannot receive restored focus; a live parent layer can. */
export function canRestoreOverlayFocus(target: HTMLElement): boolean {
  if (!target.isConnected || target.closest('[data-atria-overlay-closing="true"]')) return false;
  const top = activeOverlayIds.at(-1);
  const owner = target.closest<HTMLElement>("[data-atria-overlay-id]");
  if (top && owner?.getAttribute("data-atria-overlay-id") !== top) return false;
  for (let element: HTMLElement | null = target; element; element = element.parentElement) {
    if (
      element.hidden ||
      element.hasAttribute("inert") ||
      element.getAttribute("aria-hidden") === "true"
    )
      return false;
    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    )
      return false;
  }
  return !target.hasAttribute("disabled");
}

export function lockBodyScroll(): () => void {
  if (bodyLockCount === 0) originalBodyOverflow = document.body.style.overflow;
  bodyLockCount += 1;
  document.body.style.overflow = "hidden";

  let released = false;
  return () => {
    if (released) return;
    released = true;
    bodyLockCount = Math.max(0, bodyLockCount - 1);
    if (bodyLockCount === 0) document.body.style.overflow = originalBodyOverflow;
  };
}
