let nextOverlayLayer = 200;
let activeOverlayIds: string[] = [];
let bodyLockCount = 0;
let originalBodyOverflow = "";

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
