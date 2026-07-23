"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import type { PanInfo } from "framer-motion";

import {
  transitionEaseSmooth,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import {
  calculateBottomSheetMetrics,
  MIN_RESIZE_DISTANCE,
  MIN_SHEET_HEIGHT,
  SHEET_TOP_GAP,
} from "./bottom-sheet-metrics";
import { SheetFooterActions } from "./sheet-footer-actions";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { IconButton } from "../button/button";

let nextSheetLayer = 200;
let activeSheetIds: string[] = [];
let bodyLockCount = 0;
let originalBodyOverflow = "";
const SNAP_DISTANCE = 42;
const SNAP_VELOCITY = 520;

function promoteSheet(sheetId: string): number {
  activeSheetIds = activeSheetIds.filter((id) => id !== sheetId);
  activeSheetIds.push(sheetId);
  nextSheetLayer += 2;
  return nextSheetLayer;
}

function deactivateSheet(sheetId: string): void {
  activeSheetIds = activeSheetIds.filter((id) => id !== sheetId);
}

function isTopSheet(sheetId: string): boolean {
  return activeSheetIds.at(-1) === sheetId;
}

function lockBodyScroll(): () => void {
  if (bodyLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
  }
  bodyLockCount += 1;
  document.body.style.overflow = "hidden";

  let released = false;
  return () => {
    if (released) return;
    released = true;
    bodyLockCount = Math.max(0, bodyLockCount - 1);
    if (bodyLockCount === 0) {
      document.body.style.overflow = originalBodyOverflow;
    }
  };
}

function subscribeToDocumentBody(): () => void {
  return () => undefined;
}

function getDocumentBody(): HTMLElement {
  return document.body;
}

function getServerDocumentBody(): null {
  return null;
}

type BottomSheetProps = {
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
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="h-4 w-4" aria-hidden="true" />
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
    const bodyStyle = bodyRef.current ? window.getComputedStyle(bodyRef.current) : null;
    const bodyPadding = bodyStyle
      ? Number.parseFloat(bodyStyle.paddingTop) + Number.parseFloat(bodyStyle.paddingBottom)
      : 0;
    const bodyHeight = (bodyContentRef.current?.scrollHeight ?? 0) + bodyPadding;
    const footerHeight = footerRef.current?.offsetHeight ?? 0;
    const metrics = calculateBottomSheetMetrics({
      viewportHeight: nextViewportHeight,
      handleHeight,
      headerHeight,
      bodyHeight,
      footerHeight,
    });

    setViewportHeight(nextViewportHeight);
    setNaturalHeight(metrics.naturalHeight);
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
    const layer = promoteSheet(sheetId);
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
      if (!isTopSheet(activeSheetId)) return;
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
      deactivateSheet(activeSheetId);
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
        <>
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
            className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-background shadow-[0_-24px_80px_rgba(0,0,0,0.28)] ring-1 ring-outline-variant/20 outline-none"
            style={{
              zIndex: zIndex + 1,
              maxHeight: `calc(100dvh - ${SHEET_TOP_GAP}px)`,
            }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="z-10 flex h-5 shrink-0 items-center justify-center bg-background/95 pt-2">
              <button
                ref={handleRef}
                type="button"
                onClick={toggleExpanded}
                onPointerDown={(event) => {
                  if (!canResize) return;
                  dragControls.start(event);
                }}
                className="flex h-5 w-16 cursor-grab items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:cursor-grabbing disabled:cursor-default"
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
              className="relative z-10 flex h-14 shrink-0 items-center bg-background px-margin-mobile backdrop-blur-md"
            >
              <IconButton
                ref={closeButtonRef}
                label="Tutup"
                icon={<AppIcon name="close" className="text-[24px] leading-none" />}
                variant="secondary"
                onClick={() => onCloseRef.current()}
                className="absolute top-1/2 left-margin-mobile z-10 -translate-y-1/2 shadow-[0_5px_16px_rgba(17,17,17,0.08)]"
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

            <div
              ref={bodyRef}
              className={`no-scrollbar min-h-0 flex-1 px-margin-mobile py-md ${
                contentOverflows ? "overflow-y-auto" : "overflow-y-hidden"
              }`}
            >
              <div ref={bodyContentRef}>{children}</div>
            </div>
            {footer && (
              <div
                ref={footerRef}
                className="shrink-0 border-t border-outline-variant/15 bg-background px-margin-mobile pt-sm pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md"
              >
                {footer}
              </div>
            )}
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(sheet, portalNode);
}

export type ConfirmationModalTone = "default" | "warning" | "danger";

type ConfirmationModalProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly tone?: ConfirmationModalTone;
  readonly children?: React.ReactNode;
  readonly actions: React.ReactNode;
  readonly onClose: () => void;
};

export function ConfirmationModal({
  open,
  title,
  description,
  tone = "default",
  children,
  actions,
  onClose,
}: ConfirmationModalProps): React.JSX.Element | null {
  const dialogRef = React.useRef<HTMLElement>(null);
  const dialogId = React.useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const onCloseRef = React.useRef(onClose);
  const [zIndex, setZIndex] = React.useState(220);
  const portalNode = React.useSyncExternalStore(
    subscribeToDocumentBody,
    getDocumentBody,
    getServerDocumentBody,
  );

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return undefined;
    const activeDialogId = dialogId;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer = promoteSheet(activeDialogId);
    const releaseBodyScroll = lockBodyScroll();
    const animationFrame = window.requestAnimationFrame(() => {
      setZIndex(layer);
      dialogRef.current?.focus({ preventScroll: true });
    });

    function onKeyDown(event: KeyboardEvent): void {
      if (!isTopSheet(activeDialogId)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
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
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      deactivateSheet(activeDialogId);
      releaseBodyScroll();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [dialogId, open]);

  if (portalNode === null) return null;

  const toneClass =
    tone === "danger"
      ? "bg-error-container/25 text-error"
      : tone === "warning"
        ? "bg-warning/12 text-warning"
        : "bg-primary/10 text-primary";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionEaseSmooth}
            className="fixed -inset-10 cursor-default bg-black/45 backdrop-blur-[2px]"
            style={{ zIndex }}
            onClick={() => onCloseRef.current()}
          />
          <div
            className="pointer-events-none fixed inset-0 flex items-center justify-center p-4 sm:p-6"
            style={{ zIndex: zIndex + 1 }}
          >
            <motion.section
              ref={dialogRef}
              tabIndex={-1}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={transitionSpringSmooth}
              className="no-scrollbar pointer-events-auto max-h-[min(82dvh,620px)] w-full max-w-90 overflow-y-auto rounded-[28px] bg-background p-5 shadow-[0_28px_90px_rgba(0,0,0,0.32)] ring-1 ring-white/10 outline-none"
            >
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${toneClass}`}
              >
                {tone === "default" ? (
                  <Check className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                )}
              </div>
              <div className="mt-4 text-center">
                <h2 id={titleId} className="text-lg leading-6 font-bold text-on-surface">
                  {title}
                </h2>
                {description ? (
                  <p
                    id={descriptionId}
                    className="mx-auto mt-2 max-w-75 text-sm leading-5 text-on-surface-variant"
                  >
                    {description}
                  </p>
                ) : null}
              </div>
              {children ? (
                <div className="mt-4 rounded-[22px] bg-surface-container-lowest p-4 ring-1 ring-outline-variant/15">
                  {children}
                </div>
              ) : null}
              <div className="mt-5">{actions}</div>
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    portalNode,
  );
}

type ConfirmationSheetProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly children?: React.ReactNode;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
};

export function ConfirmationSheet({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  pending = false,
  disabled = false,
  children,
  onClose,
  onConfirm,
}: ConfirmationSheetProps): React.JSX.Element | null {
  return (
    <ConfirmationModal
      open={open}
      title={title}
      description={description}
      tone={danger ? "danger" : "default"}
      onClose={onClose}
      actions={
        <SheetFooterActions
          secondary={{ label: "Batal", onClick: onClose, disabled: pending }}
          primary={{
            label: confirmLabel,
            pending,
            disabled,
            onClick: onConfirm,
            variant: danger ? "critical" : "primary",
          }}
        />
      }
    >
      {children}
    </ConfirmationModal>
  );
}
