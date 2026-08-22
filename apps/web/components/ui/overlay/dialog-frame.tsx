"use client";

import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import { IconButton } from "../button/button";
import { AppIcon } from "../icon/app-icon";
import { OverlayLayerProvider } from "./overlay-layer-context";
import { deactivateOverlay, isTopOverlay, lockBodyScroll, promoteOverlay } from "./overlay-stack";

function subscribeToDocumentBody(): () => void {
  return () => undefined;
}

function getDocumentBody(): HTMLElement {
  return document.body;
}

function getServerDocumentBody(): null {
  return null;
}

type DialogFrameProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly pending?: boolean;
  readonly placement?: "centered" | "top";
  readonly role?: "dialog" | "alertdialog";
  readonly align?: "left" | "center";
  readonly icon?: React.ReactNode;
  readonly tone?: "default" | "warning" | "critical";
  readonly showCloseButton?: boolean;
  readonly children?: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly onClose: () => void;
};

export function DialogFrame({
  open,
  title,
  description,
  pending = false,
  placement = "centered",
  role = "dialog",
  align = "left",
  icon,
  tone = "default",
  showCloseButton = true,
  children,
  footer,
  onClose,
}: DialogFrameProps): React.JSX.Element | null {
  const dialogRef = React.useRef<HTMLElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const dialogId = React.useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const onCloseRef = React.useRef(onClose);
  const pendingRef = React.useRef(pending);
  const [zIndex, setZIndex] = React.useState(220);
  const reduceMotion = useReducedMotion();
  const portalNode = React.useSyncExternalStore(
    subscribeToDocumentBody,
    getDocumentBody,
    getServerDocumentBody,
  );

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const requestClose = React.useCallback((): void => {
    if (!pendingRef.current) onCloseRef.current();
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;
    const activeDialogId = dialogId;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer = promoteOverlay(activeDialogId);
    const releaseBodyScroll = lockBodyScroll();

    function updateViewport(): void {
      if (!hostRef.current) return;
      hostRef.current.style.height = `${window.visualViewport?.height ?? window.innerHeight}px`;
      hostRef.current.style.top = `${window.visualViewport?.offsetTop ?? 0}px`;
    }

    updateViewport();
    const animationFrame = window.requestAnimationFrame(() => {
      setZIndex(layer);
      const preferred = dialogRef.current?.querySelector<HTMLElement>(
        '[autofocus], [data-dialog-autofocus="true"], input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
      (preferred ?? dialogRef.current)?.focus({ preventScroll: true });
    });

    function onKeyDown(event: KeyboardEvent): void {
      if (!isTopOverlay(activeDialogId)) return;
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
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      deactivateOverlay(activeDialogId);
      releaseBodyScroll();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [dialogId, open, requestClose]);

  if (portalNode === null) return null;

  const toneClass =
    tone === "critical"
      ? "bg-critical-container text-critical"
      : tone === "warning"
        ? "bg-warning/12 text-warning"
        : "bg-primary/10 text-primary";
  return createPortal(
    <AnimatePresence>
      {open ? (
        <OverlayLayerProvider anchored={zIndex + 2}>
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
            className="fixed -inset-10 bg-black/45"
            style={{ zIndex }}
            onClick={requestClose}
          />
          <div
            ref={hostRef}
            className={`pointer-events-none fixed inset-x-0 flex justify-center ${placement === "top" ? "items-start px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4" : "items-center p-4"}`}
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
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              transition={reduceMotion ? { duration: 0 } : transitionSpringSmooth}
              className="pointer-events-auto flex max-h-[min(78dvh,560px)] w-full max-w-90 flex-col overflow-hidden rounded-owner bg-surface-container-low shadow-overlay ring-1 ring-ring-control outline-none"
            >
              <div className={`shrink-0 px-5 pt-5 ${align === "center" ? "text-center" : ""}`}>
                {icon ? (
                  <div
                    className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${toneClass}`}
                  >
                    {icon}
                  </div>
                ) : null}
                <div className="flex min-w-0 items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="text-section font-bold text-on-surface">
                      {title}
                    </h2>
                    {description ? (
                      <p id={descriptionId} className="mt-1 text-support text-on-surface-variant">
                        {description}
                      </p>
                    ) : null}
                  </div>
                  {showCloseButton ? (
                    <IconButton
                      label="Tutup"
                      size="compact"
                      variant="tertiary"
                      icon={<AppIcon name="close" className="icon-md" />}
                      onClick={requestClose}
                    />
                  ) : null}
                </div>
              </div>
              {children ? (
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                  {children}
                </div>
              ) : null}
              {footer ? (
                <div className="shrink-0 bg-surface-container-low px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  {footer}
                </div>
              ) : null}
            </motion.section>
          </div>
        </OverlayLayerProvider>
      ) : null}
    </AnimatePresence>,
    portalNode,
  );
}
