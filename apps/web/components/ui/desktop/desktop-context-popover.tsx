"use client";

import React from "react";
import { useMergeRefs } from "@floating-ui/react";
import { Popover } from "@heroui/react";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { useInteractOutside } from "react-aria/useInteractOutside";
import type { ContextPopoverProps } from "../overlay/anchored-surfaces";
import { useOverlayLayers } from "../overlay/overlay-layer-context";
import { DesktopPopoverBoundary, useDesktopPopoverMotion } from "./desktop-popover-motion";

const MotionPopover = motion.create(Popover.Content);
type HeroPlacement = NonNullable<React.ComponentProps<typeof Popover.Content>["placement"]>;
const placements: Readonly<Record<NonNullable<ContextPopoverProps["placement"]>, HeroPlacement>> = {
  top: "top",
  "top-start": "top start",
  "top-end": "top end",
  bottom: "bottom",
  "bottom-start": "bottom start",
  "bottom-end": "bottom end",
  left: "left",
  "left-start": "left top",
  "left-end": "left bottom",
  right: "right",
  "right-start": "right top",
  "right-end": "right bottom",
};

function ContextPopoverContent({
  label,
  children,
  placement,
  width,
  contentRef,
  triggerRef,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly placement: NonNullable<ContextPopoverProps["placement"]>;
  readonly width: number;
  readonly contentRef: React.RefObject<HTMLDivElement | null>;
  readonly triggerRef: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  const present = useIsPresent();
  const animation = useDesktopPopoverMotion(present);
  const layers = useOverlayLayers();
  return (
    <MotionPopover
      {...animation}
      ref={contentRef}
      isExiting={!present}
      isNonModal
      shouldCloseOnInteractOutside={(target: Element): boolean =>
        !triggerRef.current?.contains(target)
      }
      placement={placements[placement]}
      offset={8}
      containerPadding={12}
      className="atria-desktop-context-popover"
      style={{ width, zIndex: layers.anchored }}
    >
      <Popover.Dialog aria-label={label}>{children}</Popover.Dialog>
    </MotionPopover>
  );
}

/** Rich contextual content has a non-modal dialog; menus retain their own contract. */
export function DesktopContextPopover({
  trigger,
  label,
  children,
  placement = "bottom-start",
  width = 288,
  open: controlledOpen,
  onOpenChange,
}: ContextPopoverProps): React.JSX.Element {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const contentRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement>(null);
  const mergedTriggerRef = useMergeRefs([trigger.props.ref, triggerRef]);
  const setOpen = (next: boolean): void => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  // React Aria's non-modal popover handles blur/Escape, but not outside pointers.
  useInteractOutside({
    ref: contentRef,
    isDisabled: !open,
    onInteractOutside: (event: PointerEvent): void => {
      // Nested HeroUI selects/menus use their own portal and dismissal owner.
      if (event.target instanceof Element && event.target.closest("[data-trigger][data-placement]"))
        return;
      if (event.target instanceof Node && !triggerRef.current?.contains(event.target))
        setOpen(false);
    },
  });

  return (
    <DesktopPopoverBoundary open={open}>
      <Popover isOpen={open} onOpenChange={setOpen}>
        {React.cloneElement(trigger, { "aria-haspopup": "dialog", ref: mergedTriggerRef })}
        <AnimatePresence>
          {open ? (
            <ContextPopoverContent
              label={label}
              placement={placement}
              width={width}
              contentRef={contentRef}
              triggerRef={triggerRef}
            >
              {children}
            </ContextPopoverContent>
          ) : null}
        </AnimatePresence>
      </Popover>
    </DesktopPopoverBoundary>
  );
}
