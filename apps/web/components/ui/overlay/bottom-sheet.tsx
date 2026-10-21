"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import type { PanInfo } from "framer-motion";

import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  calculateBottomSheetMetrics,
  DESKTOP_SHEET_VIEWPORT_GAP,
  MIN_RESIZE_DISTANCE,
  MIN_SHEET_HEIGHT,
  SHEET_TOP_GAP,
} from "./bottom-sheet-metrics";
import { AppIcon } from "@/components/ui/icon/app-icon";
import {
  ContentSizeMotionProvider,
  measureContentSizeTarget,
  type ContentSizeMotion,
} from "./content-size-motion";
import { IconButton } from "../button/button";
import { OverlayLayerProvider } from "./overlay-layer-context";
import {
  deactivateOverlay,
  canRestoreOverlayFocus,
  isOverlayKeyHandled,
  isTopOverlay,
  lockBodyScroll,
  promoteOverlay,
} from "./overlay-stack";
import { usePortalContainer } from "./portal-container-context";
import { observeOverlayViewport, readOverlayViewport } from "./overlay-viewport";

const SNAP_DISTANCE = 42;
const SNAP_VELOCITY = 520;

export type BottomSheetProps = {
  readonly open: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly initialExpanded?: boolean;
  readonly desktopSize?: "standard" | "wide";
  readonly desktopFooterPlacement?: "bottom" | "aside";
  /** Desktop-only summary scrolls above protected aside actions with shared shadow gutters. */
  readonly desktopAsideSummary?: React.ReactNode;
  readonly sizing?: "content" | "maximum";
  /** A workflow step change resets this sheet's scroll without replacing its owner. */
  readonly contentKey?: string;
  /** Opt-in read-only dismissal: pulling down from natural height requests the same close path. */
  readonly dismissOnPull?: boolean;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
  /** A stable logical destination when the original opener is replaced during a workflow. */
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Used only when neither an explicit return destination nor the exact invoker is available. */
  readonly fallbackFocusRef?: React.RefObject<HTMLElement | null>;
};

type SheetActionButtonProps = {
  readonly label: string;
  readonly pendingLabel?: string;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  readonly form?: string;
  readonly type?: "button" | "submit";
  readonly onClick?: () => void;
};

export function SheetActionButton({
  label,
  pendingLabel,
  pending = false,
  disabled = false,
  danger = false,
  form,
  type = "button",
  onClick,
}: SheetActionButtonProps): React.JSX.Element {
  const accessibleLabel = pending ? (pendingLabel ?? "Memproses") : label;

  return (
    <IconButton
      type={type}
      form={form}
      disabled={pending || disabled}
      onClick={onClick}
      variant={danger ? "critical" : "primary"}
      label={accessibleLabel}
      icon={
        pending ? (
          <AppIcon name="progress_activity" className="icon-sm animate-spin" aria-hidden="true" />
        ) : (
          <AppIcon name="check" className="icon-sm" aria-hidden="true" />
        )
      }
    />
  );
}

export function BottomSheet({
  open,
  title,
  children,
  footer,
  action,
  initialExpanded = false,
  desktopSize = "standard",
  desktopFooterPlacement = "bottom",
  desktopAsideSummary,
  sizing = "content",
  contentKey,
  dismissOnPull = false,
  onClose,
  onExitComplete,
  returnFocusRef,
  fallbackFocusRef,
}: BottomSheetProps): React.JSX.Element | null {
  // Geometry follows the viewport; focused child controls retain their own presenter.
  const desktop = useWorkspacePresentation() === "desktop";
  const sideFooter = desktop && desktopFooterPlacement === "aside";
  const hasAsideSummary = Boolean(desktopAsideSummary);
  const sheetRef = React.useRef<HTMLElement>(null);
  const viewportHostRef = React.useRef<HTMLDivElement>(null);
  const handleRef = React.useRef<HTMLButtonElement>(null);
  const headerRef = React.useRef<HTMLElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const bodyContentRef = React.useRef<HTMLDivElement>(null);
  const footerRef = React.useRef<HTMLDivElement>(null);
  const footerContentRef = React.useRef<HTMLDivElement>(null);
  const asideSummaryContentRef = React.useRef<HTMLDivElement>(null);
  const footerActionsRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const logicalReturnRef = React.useRef(returnFocusRef);
  const fallbackReturnRef = React.useRef(fallbackFocusRef);
  React.useLayoutEffect(() => {
    logicalReturnRef.current = returnFocusRef;
    fallbackReturnRef.current = fallbackFocusRef;
  }, [returnFocusRef, fallbackFocusRef]);
  const restoreFocus = React.useCallback((): void => {
    const explicit = logicalReturnRef.current?.current;
    const previous = previousFocusRef.current;
    const fallback = fallbackReturnRef.current?.current;
    const target = [explicit, previous, fallback].find((element): element is HTMLElement =>
      Boolean(element && canRestoreOverlayFocus(element)),
    );
    const current = document.activeElement;
    const readerMovedFocus =
      current instanceof HTMLElement &&
      current !== document.body &&
      current !== target &&
      canRestoreOverlayFocus(current);
    if (target && !readerMovedFocus) target.focus({ preventScroll: true });
    previousFocusRef.current = null;
  }, []);
  const sheetId = React.useId();
  const onCloseRef = React.useRef(onClose);
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();
  const [zIndex, setZIndex] = useState(200);
  const [expanded, setExpanded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [viewportTop, setViewportTop] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(MIN_SHEET_HEIGHT);
  const [topChromeHeight, setTopChromeHeight] = useState(76);
  const [footerHeight, setFooterHeight] = useState(0);
  const [contentOverflows, setContentOverflows] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);
  const contentSizeMotions = React.useRef(new Map<string, ContentSizeMotion>());
  const [contentSizeAnimating, setContentSizeAnimating] = useState(false);
  const measuredViewportRef = React.useRef<ReturnType<typeof readOverlayViewport> | null>(null);
  const portalNode = usePortalContainer();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const updateSheetMetrics = React.useCallback((): void => {
    if (typeof window === "undefined") return;

    const nextViewport = readOverlayViewport();
    const viewport = nextViewport.zoomed
      ? (measuredViewportRef.current ?? nextViewport)
      : nextViewport;
    measuredViewportRef.current = viewport;
    const nextViewportHeight = viewport.height;
    const { metrics, handleHeight, headerHeight, nextFooterHeight } = measureContentSizeTarget(
      desktop ? contentSizeMotions.current.values() : [],
      () => {
        const handleHeight = handleRef.current?.offsetHeight ?? (desktop ? 0 : 20);
        const headerHeight = headerRef.current?.offsetHeight ?? (desktop ? 64 : 56);
        const bodyHeight = bodyContentRef.current?.offsetHeight ?? 0;
        const nextFooterHeight = footerRef.current?.offsetHeight ?? 0;
        const footerBottom =
          sideFooter && footerRef.current
            ? Number.parseFloat(window.getComputedStyle(footerRef.current).bottom) || 0
            : 0;
        const asideStyle =
          sideFooter && footerContentRef.current
            ? window.getComputedStyle(footerContentRef.current)
            : null;
        const asideSpacing = asideStyle
          ? (Number.parseFloat(asideStyle.paddingTop) || 0) +
            (Number.parseFloat(asideStyle.paddingBottom) || 0) +
            (hasAsideSummary ? Number.parseFloat(asideStyle.rowGap) || 0 : 0)
          : 0;
        const asideHeight = sideFooter
          ? (footerRef.current?.offsetTop ?? 0) +
            (asideSummaryContentRef.current?.offsetHeight ?? 0) +
            (footerActionsRef.current?.offsetHeight ?? 0) +
            asideSpacing +
            footerBottom
          : 0;
        const metrics = calculateBottomSheetMetrics({
          viewportHeight: nextViewportHeight,
          handleHeight,
          headerHeight,
          bodyHeight,
          footerHeight: sideFooter ? 0 : nextFooterHeight,
          asideHeight,
          viewportGap: desktop ? DESKTOP_SHEET_VIEWPORT_GAP : SHEET_TOP_GAP,
        });

        return { metrics, handleHeight, headerHeight, nextFooterHeight };
      },
    );

    setViewportHeight(nextViewportHeight);
    setViewportTop(viewport.top);
    setNaturalHeight(metrics.naturalHeight);
    setTopChromeHeight(handleHeight + headerHeight);
    setFooterHeight(nextFooterHeight);
    setContentOverflows((current) =>
      contentSizeMotions.current.size > 0 && desktop
        ? current || metrics.contentOverflows
        : metrics.contentOverflows,
    );
    if (metrics.contentOverflows) setExpanded(false);
    setHasMeasured(true);
  }, [desktop, sideFooter, hasAsideSummary]);

  const beginContentSizeMotion = React.useCallback(
    (key: string, motion: ContentSizeMotion): void => {
      contentSizeMotions.current.set(key, motion);
      setContentSizeAnimating(true);
      updateSheetMetrics();
    },
    [updateSheetMetrics],
  );
  const finishContentSizeMotion = React.useCallback(
    (key: string): void => {
      if (!contentSizeMotions.current.delete(key)) return;
      setContentSizeAnimating(contentSizeMotions.current.size > 0);
      updateSheetMetrics();
    },
    [updateSheetMetrics],
  );
  const contentSizeController = React.useMemo(
    () => (desktop ? { begin: beginContentSizeMotion, finish: finishContentSizeMotion } : null),
    [desktop, beginContentSizeMotion, finishContentSizeMotion],
  );

  React.useLayoutEffect(() => {
    if (!open) return undefined;
    const animationFrame = window.requestAnimationFrame(() => {
      setExpanded(initialExpanded);
      setHasMeasured(false);
      updateSheetMetrics();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [initialExpanded, open, portalNode, updateSheetMetrics]);

  React.useLayoutEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [open, contentKey]);

  useEffect(() => {
    if (!open) return undefined;

    const observedElements = [
      handleRef.current,
      headerRef.current,
      bodyContentRef.current,
      footerRef.current,
      footerContentRef.current,
      asideSummaryContentRef.current,
      footerActionsRef.current,
    ].filter((element): element is HTMLElement => element !== null);
    const resizeObserver = new ResizeObserver(() => updateSheetMetrics());

    observedElements.forEach((element) => resizeObserver.observe(element));
    const releaseViewport = sheetRef.current
      ? observeOverlayViewport({
          overlay: sheetRef.current,
          getBody: (): HTMLElement | null => bodyRef.current,
          getViewportBounds: (): DOMRect | null =>
            viewportHostRef.current?.getBoundingClientRect() ?? null,
          isActive: (): boolean => isTopOverlay(sheetId),
          onViewportChange: updateSheetMetrics,
          getInsets: (): { readonly top: number; readonly bottom: number } => ({
            top:
              (handleRef.current?.offsetHeight ?? (desktop ? 0 : 20)) +
              (headerRef.current?.offsetHeight ?? (desktop ? 64 : 56)) +
              16,
            bottom: (sideFooter ? 0 : (footerRef.current?.offsetHeight ?? 0)) + 16,
          }),
        })
      : undefined;

    return () => {
      resizeObserver.disconnect();
      releaseViewport?.();
    };
  }, [desktop, sideFooter, open, portalNode, sheetId, updateSheetMetrics]);

  useEffect(() => {
    if (!open) return undefined;
    const layer = promoteOverlay(sheetId);
    const animationFrame = window.requestAnimationFrame(() => {
      setZIndex(layer);
      sheetRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [open, sheetId]);

  useEffect(() => {
    if (!open) return undefined;
    const activeSheetId = sheetId;
    const activeSheet = sheetRef.current;
    activeSheet?.removeAttribute("data-atria-overlay-closing");
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseBodyScroll = lockBodyScroll();

    function onKeyDown(event: KeyboardEvent): void {
      if (isOverlayKeyHandled(event) || !isTopOverlay(activeSheetId)) return;
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;

      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      activeSheet?.setAttribute("data-atria-overlay-closing", "true");
      deactivateOverlay(activeSheetId);
      releaseBodyScroll();
      window.removeEventListener("keydown", onKeyDown);
      // A conditionally removed owner has no remaining exit animation callback.
      if (!activeSheet?.isConnected) restoreFocus();
    };
  }, [sheetId, open, restoreFocus]);

  function finishExit(): void {
    restoreFocus();
    onExitComplete?.();
  }

  if (portalNode === null) return null;

  const expandedHeight = Math.max(
    0,
    viewportHeight - (desktop ? DESKTOP_SHEET_VIEWPORT_GAP : SHEET_TOP_GAP),
  );
  const canResize =
    !desktop &&
    sizing !== "maximum" &&
    !contentOverflows &&
    expandedHeight - naturalHeight > MIN_RESIZE_DISTANCE;
  const canDismissByPull = dismissOnPull && !desktop;
  const canDrag = canResize || canDismissByPull;
  const activeHeight =
    sizing === "maximum" || (expanded && canResize) ? expandedHeight : naturalHeight;
  const renderedHeight = Math.min(activeHeight, expandedHeight);

  function toggleExpanded(): void {
    if (!canResize && canDismissByPull) {
      onCloseRef.current();
      return;
    }
    if (!canResize) return;
    setExpanded((current) => !current);
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void {
    if (!canDrag) return;

    if (info.offset.y < -SNAP_DISTANCE || info.velocity.y < -SNAP_VELOCITY) {
      if (canResize) setExpanded(true);
      return;
    }

    if (info.offset.y > SNAP_DISTANCE || info.velocity.y > SNAP_VELOCITY) {
      if (canDismissByPull && !expanded) {
        onCloseRef.current();
        return;
      }
      setExpanded(false);
    }
  }

  const sheet = (
    <AnimatePresence onExitComplete={finishExit}>
      {open && (
        <OverlayLayerProvider anchored={zIndex + 2}>
          <ContentSizeMotionProvider value={contentSizeController}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
              className="fixed -inset-10 cursor-pointer bg-black/40 backdrop-blur-sm"
              style={{ zIndex }}
              onClick={() => onCloseRef.current()}
              aria-hidden="true"
            />

            <div
              ref={viewportHostRef}
              className={`pointer-events-none fixed inset-x-0 ${desktop ? "flex items-center justify-center" : ""}`}
              style={{ zIndex: zIndex + 1, top: viewportTop, height: viewportHeight }}
            >
              <motion.section
                ref={sheetRef}
                tabIndex={-1}
                initial={
                  reduceMotion
                    ? { y: 0, opacity: 0 }
                    : desktop
                      ? { y: 12, scale: 0.98, opacity: 0 }
                      : { y: "100%", opacity: 0 }
                }
                animate={{
                  y: reduceMotion || desktop ? 0 : hasMeasured ? 0 : "100%",
                  scale: 1,
                  height: renderedHeight,
                  opacity: hasMeasured ? 1 : 0,
                }}
                exit={
                  reduceMotion
                    ? { y: 0, opacity: 0 }
                    : desktop
                      ? { y: 12, scale: 0.98, opacity: 0 }
                      : { y: "100%", opacity: 0 }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        ...transitionSpringSmooth,
                        height:
                          desktop && contentSizeAnimating
                            ? transitionEaseSmooth
                            : transitionSpringSmooth,
                      }
                }
                drag={canDrag ? "y" : false}
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.08, bottom: 0.04 }}
                onDragEnd={handleDragEnd}
                className={`pointer-events-auto ${desktop ? `relative w-[calc(100%-3rem)] rounded-owner shadow-overlay ${desktopSize === "wide" ? "max-w-5xl" : "max-w-3xl"}` : "absolute inset-x-0 bottom-0 w-full max-w-md rounded-t-owner shadow-sheet"} mx-auto flex flex-col overflow-hidden bg-surface-container-low ring-1 ring-ring-control outline-none`}
                style={{
                  zIndex: zIndex + 1,
                  maxHeight: expandedHeight,
                }}
                role="dialog"
                data-atria-overlay-id={sheetId}
                data-atria-sheet-canvas="true"
                data-atria-overlay-presentation={desktop ? "desktop" : "mobile"}
                aria-modal="true"
                aria-label={title}
              >
                <div className="absolute inset-x-0 top-0 z-20">
                  <div
                    className="scroll-edge-scrim scroll-edge-scrim-sheet scroll-edge-scrim-sheet-header pointer-events-none absolute inset-x-0 top-0 h-[calc(100%+1rem)]"
                    aria-hidden="true"
                  />
                  <div
                    className={
                      desktop ? "hidden" : "relative z-10 flex h-5 items-center justify-center pt-2"
                    }
                  >
                    <button
                      ref={handleRef}
                      type="button"
                      onClick={toggleExpanded}
                      onPointerDown={(event) => {
                        if (!canDrag) return;
                        dragControls.start(event);
                      }}
                      className="flex h-5 w-16 cursor-grab items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:cursor-grabbing disabled:cursor-default"
                      aria-label={
                        !canResize && canDismissByPull
                          ? "Tutup"
                          : expanded
                            ? "Turunkan drawer"
                            : "Perbesar drawer"
                      }
                      disabled={!canDrag}
                      style={{ touchAction: "none" }}
                    >
                      <span
                        className={`h-1 w-10 rounded-full transition-colors ${
                          canDrag ? "bg-outline-variant/70" : "bg-outline-variant/35"
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <header
                    ref={headerRef}
                    className={`relative z-10 flex items-center ${desktop ? "h-16 px-6" : "h-14 px-margin-mobile"}`}
                  >
                    <IconButton
                      ref={closeButtonRef}
                      label="Tutup"
                      icon={<AppIcon name="close" className="icon-xl leading-none" />}
                      variant="secondary"
                      onClick={() => onCloseRef.current()}
                      className={
                        desktop
                          ? "order-3 ml-3 shrink-0 shadow-raised!"
                          : "absolute top-1/2 left-margin-mobile z-10 -translate-y-1/2 shadow-raised!"
                      }
                    />

                    {/*
                  Lebarnya diturunkan dari header, bukan dari viewport. Sisi kiri
                  dipakai tombol tutup: 20px margin + 48px tombol + 4px jeda =
                  72px, dicerminkan ke kanan supaya judulnya tetap benar-benar di
                  tengah. Ukuran lama `min(58vw,15rem)` menaksir ruang itu dari
                  lebar layar, padahal sheet-nya sendiri dibatasi lebar shell —
                  di 375px taksirannya meleset 3px dan judul sependek "Sesuaikan
                  default budget" ikut terpotong.
                */}
                    <div
                      className={
                        desktop
                          ? "order-1 min-w-0 flex-1"
                          : "pointer-events-none absolute top-1/2 left-1/2 w-[calc(100%-9rem)] -translate-x-1/2 -translate-y-1/2 text-center"
                      }
                    >
                      <h2
                        className={`truncate font-sans ${desktop ? "text-section" : "text-title"} leading-tight font-semibold text-on-surface`}
                      >
                        {title}
                      </h2>
                    </div>

                    <div
                      className={
                        desktop
                          ? "order-2 flex items-center gap-2 [&_button]:shadow-raised!"
                          : "absolute top-1/2 right-margin-mobile z-10 flex -translate-y-1/2 items-center justify-end gap-1.5 [&_button]:shadow-raised!"
                      }
                    >
                      {action}
                    </div>
                  </header>
                </div>

                <div
                  ref={bodyRef}
                  data-sheet-body="true"
                  className={`no-scrollbar relative min-h-0 flex-1 overscroll-contain ${
                    contentOverflows ? "overflow-y-auto" : "overflow-y-hidden"
                  } ${sideFooter ? "mr-64" : ""}`}
                  style={{
                    scrollPaddingTop: topChromeHeight + 16,
                    scrollPaddingBottom: (sideFooter ? 0 : footerHeight) + 16,
                  }}
                >
                  <div aria-hidden="true" style={{ height: topChromeHeight }} />
                  <div
                    ref={bodyContentRef}
                    className={desktop ? "px-6 py-md" : "px-margin-mobile py-md"}
                  >
                    {children}
                  </div>
                  {footer && !sideFooter ? (
                    <div aria-hidden="true" style={{ height: footerHeight }} />
                  ) : null}
                </div>
                {footer && (
                  <div
                    ref={footerRef}
                    className={`absolute z-20 ${sideFooter ? "top-16 right-2 bottom-2 w-64 [&_.atria-desktop-button]:shadow-raised!" : `inset-x-0 bottom-0 ${desktop ? "px-6 pt-sm pb-5" : "px-margin-mobile pt-sm pb-[calc(1rem+env(safe-area-inset-bottom))]"} [&_button]:shadow-raised!`}`}
                  >
                    {/*
                  Satu wash di belakang kontrol, tanpa panel footer tambahan.
                  Wash menjaga status tetap terbaca, dengan fade 48px yang
                  berakhir 32px di atas footer. Dekorasi absolut tidak menambah
                  offsetHeight, sehingga spacer dan keyboard clearance stabil.
                */}
                    {!sideFooter && (
                      <div
                        aria-hidden="true"
                        className="scroll-edge-scrim scroll-edge-scrim-sheet scroll-edge-scrim-sheet-footer scroll-edge-scrim-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[calc(100%+2rem)]"
                      />
                    )}
                    <div
                      ref={footerContentRef}
                      className={`relative z-10 ${sideFooter ? "flex h-full flex-col gap-4 p-4" : ""}`}
                    >
                      {sideFooter && desktopAsideSummary && (
                        <div className="-m-4 min-h-0 overflow-y-auto p-4">
                          <div ref={asideSummaryContentRef}>{desktopAsideSummary}</div>
                        </div>
                      )}
                      <div ref={footerActionsRef} className={sideFooter ? "shrink-0" : ""}>
                        {footer}
                      </div>
                    </div>
                  </div>
                )}
              </motion.section>
            </div>
          </ContentSizeMotionProvider>
        </OverlayLayerProvider>
      )}
    </AnimatePresence>
  );

  return createPortal(sheet, portalNode);
}

/** @deprecated Gunakan `ConfirmationDialog` dari `./dialogs`. */
export {
  ConfirmationDialog as ConfirmationModal,
  ConfirmationDialog as ConfirmationSheet,
} from "./dialogs";
export type { ConfirmationDialogTone as ConfirmationModalTone } from "./dialogs";
