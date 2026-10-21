"use client";

import { Dropdown } from "@heroui/react";
import { motion, useReducedMotion, useAnimate, type MotionProps } from "framer-motion";
import {
  anchoredPopoverClosed,
  anchoredPopoverOpen,
  transitionSpringSnappy,
} from "@/lib/utils/motion";
import React from "react";
import { markOverlayKeyHandled } from "../overlay/overlay-stack";
import { useMenuActionQueue } from "../overlay/use-menu-action-queue";

/** Native RAC controls filter capture props; a shared DOM boundary marks the
 * event before the selector closes, without preventing its own key handling. */
export function DesktopPopoverBoundary({
  open,
  children,
}: {
  readonly open: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="contents"
      onKeyDownCapture={(event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (open && event.key === "Escape") markOverlayKeyHandled(event.nativeEvent);
      }}
    >
      {children}
    </div>
  );
}

// HeroUI/React Aria owns positioning, dismissal and focus. Framer only animates
// the existing popover; scoped CSS intentionally has no second motion owner.
export const MotionDropdownPopover = motion.create(Dropdown.Popover);
/** Animate the actual Select surface while preserving its hidden collection. */
export function useDesktopSelectPopover(afterClose?: () => void): {
  readonly open: boolean;
  readonly isExiting: boolean;
  readonly setOpen: (next: boolean) => void;
  readonly surfaceRef: React.RefCallback<HTMLDivElement>;
  readonly queueAction: (action: () => void) => void;
} {
  const reduced = useReducedMotion();
  const [, animate] = useAnimate<HTMLDivElement>();
  const [open, updateOpen] = React.useState(false);
  const [isExiting, setExiting] = React.useState(false);
  const openRef = React.useRef(false);
  const nodeRef = React.useRef<HTMLDivElement | null>(null);
  const epoch = React.useRef(0);
  const active = React.useRef<ReturnType<typeof animate> | null>(null);
  const finished = React.useRef(false);
  const queued = React.useRef<{ flush: () => void; cancel: () => void }>({
    flush: () => {},
    cancel: () => {},
  });
  const surfaceRef = React.useCallback(
    (node: HTMLDivElement | null): void => {
      if (nodeRef.current === node) return;
      epoch.current++;
      active.current?.stop();
      nodeRef.current = node;
      if (!node || !openRef.current) return;
      active.current = animate(
        node,
        reduced
          ? anchoredPopoverOpen
          : {
              opacity: [anchoredPopoverClosed.opacity, anchoredPopoverOpen.opacity],
              scale: [anchoredPopoverClosed.scale, anchoredPopoverOpen.scale],
              y: [anchoredPopoverClosed.y, anchoredPopoverOpen.y],
            },
        reduced ? { duration: 0 } : transitionSpringSnappy,
      );
    },
    [animate, reduced],
  );
  const setOpen = React.useCallback(
    (next: boolean): void => {
      if (next === openRef.current) return;
      openRef.current = next;
      const n = ++epoch.current;
      active.current?.stop();
      updateOpen(next);
      const node = nodeRef.current;
      if (next) {
        finished.current = false;
        queued.current.cancel();
        setExiting(false);
        if (node)
          active.current = animate(
            node,
            anchoredPopoverOpen,
            reduced ? { duration: 0 } : transitionSpringSnappy,
          );
      } else if (reduced || !node) {
        finished.current = true;
        setExiting(false);
        afterClose?.();
      } else {
        setExiting(true);
        const closing = animate(node, anchoredPopoverClosed, transitionSpringSnappy);
        active.current = closing;
        void Promise.resolve(closing).then(
          () => {
            if (epoch.current !== n || openRef.current) return;
            finished.current = true;
            setExiting(false);
            afterClose?.();
          },
          () => {},
        );
      }
    },
    [afterClose, animate, reduced],
  );
  const close = React.useCallback((): void => setOpen(false), [setOpen]);
  const { queueAction, flushPendingAction, cancelPendingAction } = useMenuActionQueue(close);
  React.useEffect(() => {
    queued.current = { flush: flushPendingAction, cancel: cancelPendingAction };
  }, [flushPendingAction, cancelPendingAction]);
  React.useEffect(() => {
    if (!open && !isExiting && finished.current) {
      finished.current = false;
      queued.current.flush();
    }
  }, [open, isExiting]);
  return { open, isExiting, setOpen, surfaceRef, queueAction };
}

export function useDesktopPopoverMotion(open: boolean): MotionProps {
  const reduced = useReducedMotion();
  return {
    initial: reduced ? false : anchoredPopoverClosed,
    animate: open
      ? anchoredPopoverOpen
      : { opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : 4 },
    exit: { opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : 4 },
    transition: reduced ? { duration: 0 } : transitionSpringSnappy,
  };
}
