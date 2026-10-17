"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import { IconButton } from "../button/button";
import { AppIcon } from "../icon/app-icon";
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
import {
  observeOverlayViewport,
  readOverlayViewport,
  type OverlayViewport,
} from "./overlay-viewport";

export type DialogMorphOrigin = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

const morphContentVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 },
};

type DialogFrameProps = {
  readonly morphOrigin?: DialogMorphOrigin | null;
  readonly morphPresent?: boolean;
  readonly morphClosedContent?: React.ReactNode;
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
  readonly fallbackFocusRef?: React.RefObject<HTMLElement | null>;
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly pending?: boolean;
  readonly placement?: "centered" | "top";
  readonly topInset?: "safe" | "header";
  readonly role?: "dialog" | "alertdialog";
  readonly align?: "left" | "center";
  readonly icon?: React.ReactNode;
  readonly tone?: "default" | "warning" | "critical";
  readonly showCloseButton?: boolean;
  readonly headerAction?: React.ReactNode;
  readonly bodyHeader?: React.ReactNode;
  readonly utility?: React.ReactNode;
  readonly detachedCloseButton?: boolean;
  readonly presentation?: "default" | "choice" | "calendar" | "document";
  readonly children?: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
};

export function DialogFrame({
  open,
  morphOrigin,
  morphPresent,
  morphClosedContent,
  returnFocusRef,
  fallbackFocusRef,
  title,
  description,
  pending = false,
  placement = "centered",
  topInset = "safe",
  role = "dialog",
  align = "left",
  icon,
  tone = "default",
  showCloseButton = true,
  headerAction,
  bodyHeader,
  utility,
  detachedCloseButton = false,
  presentation = "default",
  children,
  footer,
  onClose,
  onExitComplete,
}: DialogFrameProps): React.JSX.Element | null {
  const desktop = useWorkspacePresentation() === "desktop";
  const dialogRef = React.useRef<HTMLElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const contentSizeRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = React.useState<OverlayViewport | null>(null);
  const [contentHeight, setContentHeight] = React.useState<number | null>(null);
  const dialogId = React.useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const onCloseRef = React.useRef(onClose);
  const pendingRef = React.useRef(pending);
  const [zIndex, setZIndex] = React.useState(220);
  const reduceMotion = useReducedMotion();
  const shouldRender = morphOrigin ? (morphPresent ?? open) : open;
  const portalNode = usePortalContainer();

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const requestClose = React.useCallback((): void => {
    if (!pendingRef.current) onCloseRef.current();
  }, []);

  React.useLayoutEffect(() => {
    if (!shouldRender || !morphOrigin || !portalNode || !contentSizeRef.current) return;
    const content = contentSizeRef.current;
    // offsetHeight is independent of shared-element transforms. The inner box
    // keeps its natural, viewport-capped size while the outer box animates height.
    const measure = (): void => setContentHeight(content.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [shouldRender, morphOrigin, portalNode]);

  React.useEffect(() => {
    if (!shouldRender || !portalNode) return undefined;
    const activeDialogId = dialogId;
    const activeDialog = dialogRef.current;
    activeDialog?.removeAttribute("data-atria-overlay-closing");
    const returnFocusTarget = returnFocusRef?.current;
    const fallbackFocusTarget = fallbackFocusRef?.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer = promoteOverlay(activeDialogId);
    const releaseBodyScroll = lockBodyScroll();

    function updateViewport(next: OverlayViewport): void {
      if (!hostRef.current) return;
      hostRef.current.style.height = `${next.height}px`;
      hostRef.current.style.top = `${next.top}px`;
      setViewport(next);
    }

    const releaseViewport = dialogRef.current
      ? observeOverlayViewport({
          overlay: dialogRef.current,
          getBody: (): HTMLElement | null => bodyRef.current,
          getViewportBounds: (): DOMRect | null => hostRef.current?.getBoundingClientRect() ?? null,
          isActive: (): boolean => isTopOverlay(activeDialogId),
          onViewportChange: updateViewport,
        })
      : undefined;
    const animationFrame = window.requestAnimationFrame(() => {
      setZIndex(layer);
      const preferred = dialogRef.current?.querySelector<HTMLElement>(
        '[autofocus], [data-dialog-autofocus="true"], input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
      (preferred ?? dialogRef.current)?.focus({ preventScroll: true });
    });

    function onKeyDown(event: KeyboardEvent): void {
      if (isOverlayKeyHandled(event) || !isTopOverlay(activeDialogId)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
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
      activeDialog?.setAttribute("data-atria-overlay-closing", "true");
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      releaseViewport?.();
      deactivateOverlay(activeDialogId);
      releaseBodyScroll();
      const target = [returnFocusTarget, previousFocus, fallbackFocusTarget].find(
        (element): element is HTMLElement => Boolean(element && canRestoreOverlayFocus(element)),
      );
      const current = document.activeElement;
      const readerMovedFocus =
        current instanceof HTMLElement &&
        current !== document.body &&
        current !== target &&
        canRestoreOverlayFocus(current);
      if (target && !readerMovedFocus) target.focus({ preventScroll: true });
    };
  }, [dialogId, portalNode, requestClose, returnFocusRef, fallbackFocusRef, shouldRender]);

  if (portalNode === null) return null;

  const currentViewport = viewport ?? readOverlayViewport();
  const viewportWidth = currentViewport.width;
  const viewportHeight = currentViewport.height;
  const viewportTop = currentViewport.top;
  const viewportLeft = currentViewport.left;
  const maximumHeight = Math.max(
    0,
    Math.min(
      viewportHeight * (presentation === "document" && desktop ? 0.94 : 0.78),
      presentation === "document" && desktop ? 900 : 560,
      viewportHeight - (placement === "top" && topInset === "header" ? 72 : 16) - 16,
    ),
  );
  const morphTargetWidth = Math.min(360, Math.max(0, viewportWidth - 32));
  const morphTargetHeight = Math.min(contentHeight ?? morphOrigin?.height ?? 0, maximumHeight);
  const morphTarget = morphOrigin
    ? {
        top: topInset === "header" ? 72 : 16,
        left: Math.max(16, (viewportWidth - morphTargetWidth) / 2),
        width: morphTargetWidth,
        height: morphTargetHeight,
        borderRadius: 28,
      }
    : undefined;
  const morphSource = morphOrigin
    ? {
        top: morphOrigin.top - viewportTop,
        left: morphOrigin.left - viewportLeft,
        width: morphOrigin.width,
        height: morphOrigin.height,
        borderRadius: Math.min(morphOrigin.width, morphOrigin.height) / 2,
      }
    : undefined;

  const toneClass =
    tone === "critical"
      ? "bg-critical-container text-critical"
      : tone === "warning"
        ? "bg-warning/12 text-warning"
        : "bg-primary/10 text-primary";
  const choicePresentation = presentation === "choice";
  const calendarPresentation = presentation === "calendar";
  const topPaddingClass =
    topInset === "header"
      ? "pt-[max(4.5rem,env(safe-area-inset-top))]"
      : "pt-[max(1rem,env(safe-area-inset-top))]";
  return createPortal(
    <AnimatePresence onExitComplete={morphOrigin ? undefined : onExitComplete}>
      {shouldRender ? (
        <OverlayLayerProvider anchored={zIndex + 2}>
          <AnimatePresence>
            {open ? (
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
                className={`fixed -inset-10 ${choicePresentation ? "bg-primary/32" : "bg-black/45"}`}
                style={{ zIndex }}
                onClick={requestClose}
              />
            ) : null}
          </AnimatePresence>
          <div
            ref={hostRef}
            className={`pointer-events-none fixed inset-x-0 flex justify-center ${placement === "top" ? `items-start px-4 ${topPaddingClass} pb-4` : "items-center p-4"}`}
            style={{
              zIndex: zIndex + 1,
              height: "100dvh",
              top: 0,
            }}
          >
            <motion.section
              ref={dialogRef}
              tabIndex={-1}
              role={role}
              data-atria-overlay-id={dialogId}
              data-atria-overlay-presentation={desktop ? "desktop" : "mobile"}
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              initial={morphSource ?? (reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 })}
              animate={morphOrigin ? (open ? morphTarget : morphSource) : { opacity: 1, scale: 1 }}
              exit={
                morphOrigin
                  ? undefined
                  : reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.97 }
              }
              transition={reduceMotion ? { duration: 0 } : transitionSpringSmooth}
              onAnimationComplete={morphOrigin && !open ? () => onExitComplete?.() : undefined}
              style={{ maxHeight: maximumHeight }}
              className={`pointer-events-none flex flex-col outline-none ${morphOrigin ? `absolute overflow-hidden rounded-owner ring-1 ring-ring-control ${open ? "bg-surface-container-low shadow-raised" : "bg-surface-container-lowest shadow-control"}` : `w-full ${calendarPresentation ? "max-w-85" : presentation === "document" && desktop ? "max-w-4xl" : "max-w-90"}`} ${utility || detachedCloseButton ? "gap-2" : ""}`}
            >
              {morphOrigin && morphClosedContent ? (
                <motion.div
                  initial={{ opacity: 1, scale: 1 }}
                  animate={{ opacity: open ? 0 : 1, scale: open ? 0.8 : 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : open
                        ? { ...transitionEaseSmooth, duration: 0.15 }
                        : { ...transitionEaseSmooth, duration: 0.2, delay: 0.08 }
                  }
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  {morphClosedContent}
                </motion.div>
              ) : null}
              <motion.div
                variants={morphOrigin ? morphContentVariants : undefined}
                initial={morphOrigin ? "closed" : false}
                animate={morphOrigin ? (open ? "open" : "closed") : undefined}
                exit={morphOrigin ? "closed" : undefined}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : morphOrigin
                      ? open
                        ? { ...transitionEaseSmooth, delay: 0.1, duration: 0.26 }
                        : { ...transitionEaseSmooth, duration: 0.18 }
                      : transitionEaseSmooth
                }
                className={morphOrigin ? "h-full min-h-0 overflow-hidden" : "contents"}
                aria-hidden={morphOrigin && !open ? true : undefined}
              >
                <div
                  ref={contentSizeRef}
                  className={morphOrigin ? "flex flex-col" : "contents"}
                  style={
                    morphOrigin ? { width: morphTargetWidth, maxHeight: maximumHeight } : undefined
                  }
                >
                  {utility || detachedCloseButton ? (
                    <div className="pointer-events-auto flex min-h-10 shrink-0 items-center gap-2">
                      {utility ? (
                        <div className="min-w-0 flex-1">{utility}</div>
                      ) : (
                        <span className="flex-1" />
                      )}
                      {detachedCloseButton ? (
                        <IconButton
                          label="Tutup"
                          size="compact"
                          variant="secondary"
                          className="shadow-raised"
                          icon={<AppIcon name="close" className="icon-md" />}
                          onClick={requestClose}
                        />
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    data-atria-dialog-surface="true"
                    className={`${morphOrigin && !open ? "pointer-events-none" : "pointer-events-auto"} flex min-h-0 flex-1 flex-col overflow-hidden rounded-owner ${morphOrigin ? "" : `ring-1 ring-ring-control ${calendarPresentation ? "bg-surface-container-low p-2 shadow-floating" : choicePresentation ? "bg-surface-container-low shadow-raised" : "bg-surface-container-low shadow-overlay"}`}`}
                  >
                    {calendarPresentation ? (
                      <>
                        <h2 id={titleId} className="sr-only">
                          {title}
                        </h2>
                        {description ? (
                          <p id={descriptionId} className="sr-only">
                            {description}
                          </p>
                        ) : null}
                        {children}
                      </>
                    ) : (
                      <>
                        <div
                          className={`shrink-0 px-5 ${choicePresentation ? "bg-surface-container-low py-4" : "pt-5"} ${align === "center" ? "text-center" : ""}`}
                        >
                          {icon ? (
                            <div
                              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${toneClass}`}
                            >
                              {icon}
                            </div>
                          ) : null}
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <h2 id={titleId} className="text-section font-bold text-on-surface">
                                {title}
                              </h2>
                              {description ? (
                                <p
                                  id={descriptionId}
                                  className="mt-1 text-support text-on-surface-variant"
                                >
                                  {description}
                                </p>
                              ) : null}
                            </div>
                            {headerAction ??
                              (showCloseButton ? (
                                <IconButton
                                  label="Tutup"
                                  size="compact"
                                  variant="tertiary"
                                  className="h-auto w-10 text-on-surface-variant"
                                  icon={<AppIcon name="close" className="icon-md" />}
                                  onClick={requestClose}
                                />
                              ) : null)}
                          </div>
                        </div>
                        {bodyHeader ? <div className="shrink-0 px-2 pb-3">{bodyHeader}</div> : null}
                        {children ? (
                          <div
                            ref={bodyRef}
                            className={`no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain ${choicePresentation ? "mx-2 scroll-pb-2 rounded-3xl pb-2" : "px-5 py-2"}`}
                          >
                            {children}
                          </div>
                        ) : null}
                        {footer ? (
                          <div className="shrink-0 bg-surface-container-low px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                            {footer}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.section>
          </div>
        </OverlayLayerProvider>
      ) : null}
    </AnimatePresence>,
    portalNode,
  );
}
