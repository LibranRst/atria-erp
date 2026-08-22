"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import type { PanInfo } from "framer-motion";

import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import {
  calculateBottomSheetMetrics,
  MIN_RESIZE_DISTANCE,
  MIN_SHEET_HEIGHT,
  SHEET_TOP_GAP,
} from "./bottom-sheet-metrics";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { IconButton } from "../button/button";
import { OverlayLayerProvider } from "./overlay-layer-context";
import { deactivateOverlay, isTopOverlay, lockBodyScroll, promoteOverlay } from "./overlay-stack";

const SNAP_DISTANCE = 42;
const SNAP_VELOCITY = 520;

function subscribeToDocumentBody(): () => void {
  return () => undefined;
}

function getDocumentBody(): HTMLElement {
  return document.body;
}

function getServerDocumentBody(): null {
  return null;
}

export type BottomSheetProps = {
  readonly open: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly initialExpanded?: boolean;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
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
  onClose,
  onExitComplete,
}: BottomSheetProps): React.JSX.Element | null {
  const sheetRef = React.useRef<HTMLElement>(null);
  const handleRef = React.useRef<HTMLButtonElement>(null);
  const headerRef = React.useRef<HTMLElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const bodyContentRef = React.useRef<HTMLDivElement>(null);
  const footerRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const sheetId = React.useId();
  const onCloseRef = React.useRef(onClose);
  const dragControls = useDragControls();
  const [zIndex, setZIndex] = useState(200);
  const [expanded, setExpanded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [naturalHeight, setNaturalHeight] = useState(MIN_SHEET_HEIGHT);
  const [topChromeHeight, setTopChromeHeight] = useState(76);
  const [footerHeight, setFooterHeight] = useState(0);
  const [contentOverflows, setContentOverflows] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);
  const portalNode = React.useSyncExternalStore(
    subscribeToDocumentBody,
    getDocumentBody,
    getServerDocumentBody,
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const updateSheetMetrics = React.useCallback((): void => {
    if (typeof window === "undefined") return;

    const nextViewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const handleHeight = handleRef.current?.offsetHeight ?? 20;
    const headerHeight = headerRef.current?.offsetHeight ?? 56;
    const bodyHeight = bodyContentRef.current?.scrollHeight ?? 0;
    const nextFooterHeight = footerRef.current?.offsetHeight ?? 0;
    const metrics = calculateBottomSheetMetrics({
      viewportHeight: nextViewportHeight,
      handleHeight,
      headerHeight,
      bodyHeight,
      footerHeight: nextFooterHeight,
    });

    setViewportHeight(nextViewportHeight);
    setNaturalHeight(metrics.naturalHeight);
    setTopChromeHeight(handleHeight + headerHeight);
    setFooterHeight(nextFooterHeight);
    setContentOverflows(metrics.contentOverflows);
    if (metrics.contentOverflows) setExpanded(false);
    setHasMeasured(true);
  }, []);

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

  useEffect(() => {
    if (!open) return undefined;

    const observedElements = [
      handleRef.current,
      headerRef.current,
      bodyContentRef.current,
      footerRef.current,
    ].filter((element): element is HTMLElement => element !== null);
    const resizeObserver = new ResizeObserver(() => updateSheetMetrics());

    observedElements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("resize", updateSheetMetrics);
    window.visualViewport?.addEventListener("resize", updateSheetMetrics);
    window.visualViewport?.addEventListener("scroll", updateSheetMetrics);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSheetMetrics);
      window.visualViewport?.removeEventListener("resize", updateSheetMetrics);
      window.visualViewport?.removeEventListener("scroll", updateSheetMetrics);
    };
  }, [open, portalNode, updateSheetMetrics]);

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
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseBodyScroll = lockBodyScroll();

    function onKeyDown(event: KeyboardEvent): void {
      if (!isTopOverlay(activeSheetId)) return;
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
      deactivateOverlay(activeSheetId);
      releaseBodyScroll();
      window.removeEventListener("keydown", onKeyDown);

      const activeElement = document.activeElement;
      const anotherDialogHasFocus =
        activeElement instanceof HTMLElement &&
        activeElement.closest('[role="dialog"][aria-modal="true"]') !== null;
      if (!anotherDialogHasFocus && previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [sheetId, open]);

  if (portalNode === null) return null;

  const expandedHeight = Math.max(MIN_SHEET_HEIGHT, viewportHeight - SHEET_TOP_GAP);
  const canResize = !contentOverflows && expandedHeight - naturalHeight > MIN_RESIZE_DISTANCE;
  const activeHeight = expanded && canResize ? expandedHeight : naturalHeight;

  function toggleExpanded(): void {
    if (!canResize) return;
    setExpanded((current) => !current);
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void {
    if (!canResize) return;

    if (info.offset.y < -SNAP_DISTANCE || info.velocity.y < -SNAP_VELOCITY) {
      setExpanded(true);
      return;
    }

    if (info.offset.y > SNAP_DISTANCE || info.velocity.y > SNAP_VELOCITY) {
      setExpanded(false);
    }
  }

  const sheet = (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <OverlayLayerProvider anchored={zIndex + 2}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionEaseSmooth}
            className="fixed -inset-10 cursor-pointer bg-black/40 backdrop-blur-sm"
            style={{ zIndex }}
            onClick={() => onCloseRef.current()}
            aria-hidden="true"
          />

          <motion.section
            ref={sheetRef}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{
              y: hasMeasured ? 0 : "100%",
              height: activeHeight,
              opacity: hasMeasured ? 1 : 0,
            }}
            exit={{ y: "100%" }}
            transition={transitionSpringSmooth}
            drag={canResize ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.08, bottom: 0.04 }}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-t-owner bg-surface-container-low shadow-sheet ring-1 ring-ring-control outline-none"
            style={{
              zIndex: zIndex + 1,
              maxHeight: `calc(100dvh - ${SHEET_TOP_GAP}px)`,
            }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="absolute inset-x-0 top-0 z-20">
              <div
                className="pointer-events-none absolute inset-0 bg-linear-to-b from-surface-container-low from-0% via-surface-container-low/95 via-70% to-transparent"
                aria-hidden="true"
              />
              <div className="relative z-10 flex h-5 items-center justify-center pt-2">
                <button
                  ref={handleRef}
                  type="button"
                  onClick={toggleExpanded}
                  onPointerDown={(event) => {
                    if (!canResize) return;
                    dragControls.start(event);
                  }}
                  className="flex h-5 w-16 cursor-grab items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:cursor-grabbing disabled:cursor-default"
                  aria-label={expanded ? "Turunkan drawer" : "Perbesar drawer"}
                  disabled={!canResize}
                  style={{ touchAction: "none" }}
                >
                  <span
                    className={`h-1 w-10 rounded-full transition-colors ${
                      canResize ? "bg-outline-variant/70" : "bg-outline-variant/35"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <header
                ref={headerRef}
                className="relative z-10 flex h-14 items-center px-margin-mobile"
              >
                <IconButton
                  ref={closeButtonRef}
                  label="Tutup"
                  icon={<AppIcon name="close" className="icon-xl leading-none" />}
                  variant="secondary"
                  onClick={() => onCloseRef.current()}
                  className="absolute top-1/2 left-margin-mobile z-10 -translate-y-1/2 shadow-control"
                />

                <div className="pointer-events-none absolute top-1/2 left-1/2 w-[min(58vw,15rem)] -translate-x-1/2 -translate-y-1/2 text-center">
                  <h2 className="truncate font-sans text-[18px] leading-tight font-semibold text-on-surface">
                    {title}
                  </h2>
                </div>

                <div className="absolute top-1/2 right-margin-mobile z-10 flex -translate-y-1/2 items-center justify-end gap-1.5">
                  {action}
                </div>
              </header>
            </div>

            <div
              ref={bodyRef}
              data-sheet-body="true"
              className={`no-scrollbar min-h-0 flex-1 overscroll-contain ${
                contentOverflows ? "overflow-y-auto" : "overflow-y-hidden"
              }`}
              style={{
                scrollPaddingTop: topChromeHeight + 16,
                scrollPaddingBottom: footerHeight + 16,
              }}
            >
              <div aria-hidden="true" style={{ height: topChromeHeight }} />
              <div ref={bodyContentRef} className="px-margin-mobile py-md">
                {children}
              </div>
              {footer ? <div aria-hidden="true" style={{ height: footerHeight }} /> : null}
            </div>
            {footer && (
              <div
                ref={footerRef}
                className="absolute inset-x-0 bottom-0 z-20 bg-surface-container-low px-margin-mobile pt-sm pb-[calc(1rem+env(safe-area-inset-bottom))]"
              >
                {/*
                  Peredupan diletakkan sebagai pita terpisah di atas footer,
                  bukan sebagai latar footer itu sendiri.

                  Sebelumnya footer memakai gradien yang transparan di sisi
                  atasnya, sedangkan baris status footer ("2 komponen · Rp …")
                  berada tepat di pita transparan itu — sehingga teks status
                  bertumpuk dengan isi form yang sedang di-scroll di belakangnya.
                  Footer kini solid, dan isi form memudar sebelum menyentuhnya.

                  Pita ini `bottom-full` sehingga berada di luar kotak footer dan
                  tidak ikut terukur oleh `offsetHeight`; perhitungan spacer dan
                  `scrollPaddingBottom` tetap sama.
                */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-full h-6 bg-linear-to-t from-surface-container-low to-transparent"
                />
                {footer}
              </div>
            )}
          </motion.section>
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
