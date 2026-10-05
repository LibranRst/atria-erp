export type OverlayViewport = {
  readonly height: number;
  readonly width: number;
  readonly top: number;
  readonly left: number;
  readonly bottomInset: number;
  readonly zoomed: boolean;
};

/** Keyboard geometry is independent of layout resize; manual zoom keeps browser ownership. */
export function readOverlayViewport(): OverlayViewport {
  const visual = window.visualViewport;
  const zoomed = visual !== null && visual !== undefined && Math.abs(visual.scale - 1) > 0.01;
  const height = Math.max(0, zoomed ? window.innerHeight : (visual?.height ?? window.innerHeight));
  const top = zoomed ? 0 : Math.max(0, visual?.offsetTop ?? 0);
  return {
    height,
    width: zoomed ? window.innerWidth : (visual?.width ?? window.innerWidth),
    top,
    left: zoomed ? 0 : (visual?.offsetLeft ?? 0),
    bottomInset: zoomed ? 0 : Math.max(0, window.innerHeight - top - height),
    zoomed,
  };
}

type OverlayViewportObserverOptions = {
  readonly overlay: HTMLElement;
  readonly getBody: () => HTMLElement | null;
  readonly isActive: () => boolean;
  readonly onViewportChange: (viewport: OverlayViewport) => void;
  readonly getInsets?: () => { readonly top: number; readonly bottom: number };
};

function isEditableField(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  if (element instanceof HTMLInputElement) {
    return (
      !element.disabled &&
      !element.readOnly &&
      ![
        "button",
        "checkbox",
        "color",
        "file",
        "hidden",
        "image",
        "radio",
        "range",
        "reset",
        "submit",
      ].includes(element.type)
    );
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/** Reveal within the owning scroll body, without changing focus or document scroll. */
function revealFocusedField({
  overlay,
  getBody,
  isActive,
  getInsets,
}: OverlayViewportObserverOptions): void {
  const body = getBody();
  if (!body || !isActive()) return;
  const viewport = readOverlayViewport();
  if (viewport.zoomed) return;
  const field = document.activeElement;
  if (!isEditableField(field) || !body.contains(field)) return;
  if (field.closest('[aria-modal="true"]') !== overlay) return;

  const insets = getInsets?.() ?? { top: 16, bottom: 16 };
  const bodyBounds = body.getBoundingClientRect();
  const fieldBounds = field.getBoundingClientRect();
  const top = Math.max(bodyBounds.top + insets.top, viewport.top);
  const bottom = Math.min(bodyBounds.bottom - insets.bottom, viewport.top + viewport.height);
  if (bottom <= top) return;
  const delta =
    fieldBounds.top < top
      ? fieldBounds.top - top
      : fieldBounds.bottom > bottom
        ? Math.min(fieldBounds.bottom - bottom, fieldBounds.top - top)
        : 0;
  const maximum = Math.max(0, body.scrollHeight - body.clientHeight);
  const target = Math.min(maximum, Math.max(0, body.scrollTop + delta));
  if (Math.abs(target - body.scrollTop) >= 1) body.scrollTop = target;
}

/** Existing overlay owners retain focus/dismissal; this observes only viewport and visibility. */
export function observeOverlayViewport(options: OverlayViewportObserverOptions): () => void {
  let frame: number | null = null;
  let previousViewport: OverlayViewport | null = null;
  let observedBody: HTMLElement | null = null;
  const bodyObserver = new ResizeObserver(scheduleReveal);
  function scheduleReveal(): void {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame((): void => {
      frame = null;
      revealFocusedField(options);
    });
  }
  function updateViewport(): void {
    const viewport = readOverlayViewport();
    // Keep the last unzoomed layout while the user magnifies or pans it.
    if (viewport.zoomed) return;
    if (
      previousViewport?.height === viewport.height &&
      previousViewport.width === viewport.width &&
      previousViewport.top === viewport.top &&
      previousViewport.left === viewport.left &&
      previousViewport.bottomInset === viewport.bottomInset
    )
      return;
    previousViewport = viewport;
    options.onViewportChange(viewport);
  }
  function observeBody(): void {
    const body = options.getBody();
    if (observedBody === body) return;
    bodyObserver.disconnect();
    observedBody = body;
    if (body) bodyObserver.observe(body);
  }
  function onFocus(): void {
    observeBody();
    scheduleReveal();
  }
  function onResize(): void {
    observeBody();
    updateViewport();
    scheduleReveal();
  }
  // Visual panning updates the frame but must not fight a user's reading gesture.
  function onViewportScroll(): void {
    updateViewport();
  }
  const visual = window.visualViewport;
  options.overlay.addEventListener("focusin", onFocus);
  window.addEventListener("resize", onResize);
  visual?.addEventListener("resize", onResize);
  visual?.addEventListener("scroll", onViewportScroll);
  onResize();

  return (): void => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    bodyObserver.disconnect();
    options.overlay.removeEventListener("focusin", onFocus);
    window.removeEventListener("resize", onResize);
    visual?.removeEventListener("resize", onResize);
    visual?.removeEventListener("scroll", onViewportScroll);
  };
}
