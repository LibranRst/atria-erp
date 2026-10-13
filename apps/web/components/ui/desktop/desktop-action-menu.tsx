"use client";

import React from "react";
import { Description, Dropdown, Label } from "@heroui/react";
import type { ActionMenuProps } from "../overlay/anchored-surfaces";
import { useOverlayLayers } from "../overlay/overlay-layer-context";
import { AppIcon } from "../icon/app-icon";
import { DesktopButton } from "./desktop-controls";
import { useMenuActionQueue } from "../overlay/use-menu-action-queue";
import { AnimatePresence } from "framer-motion";
import {
  DesktopPopoverBoundary,
  MotionDropdownPopover,
  useDesktopPopoverMotion,
} from "./desktop-popover-motion";

type HeroPlacement = NonNullable<React.ComponentProps<typeof Dropdown.Popover>["placement"]>;
const placements: Readonly<Record<NonNullable<ActionMenuProps["placement"]>, HeroPlacement>> = {
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

export function DesktopActionMenu({
  trigger,
  label,
  items,
  placement = "bottom-end",
  header,
}: ActionMenuProps): React.JSX.Element {
  const layers = useOverlayLayers();
  const [open, setOpen] = React.useState(false);
  const popoverMotion = useDesktopPopoverMotion(open);
  const { queueAction, flushPendingAction, cancelPendingAction } = useMenuActionQueue(() =>
    setOpen(false),
  );
  const changeOpen = (next: boolean): void => {
    if (next) cancelPendingAction();
    setOpen(next);
  };
  return (
    <DesktopPopoverBoundary open={open}>
      <Dropdown isOpen={open} onOpenChange={changeOpen}>
        {typeof trigger.type === "string" ? (
          <DesktopButton
            id={trigger.props.id}
            aria-label={trigger.props["aria-label"] ?? label}
            className={trigger.props.className}
            variant="tertiary"
            size="compact"
          >
            {trigger.props.children}
          </DesktopButton>
        ) : (
          trigger
        )}
        <AnimatePresence onExitComplete={flushPendingAction}>
          {open ? (
            <MotionDropdownPopover
              {...popoverMotion}
              isOpen
              onOpenChange={changeOpen}
              placement={placements[placement]}
              offset={8}
              containerPadding={12}
              style={{ zIndex: layers.anchored }}
              className="atria-desktop-menu"
            >
              {header}
              <Dropdown.Menu
                aria-label={label}
                onAction={(key: React.Key): void => {
                  const item = items.find((option) => option.id === String(key));
                  if (item && !item.disabledReason) queueAction(item.onSelect);
                }}
              >
                {items.map((item) => (
                  <Dropdown.Item
                    key={item.id}
                    id={item.id}
                    textValue={item.label}
                    isDisabled={Boolean(item.disabledReason)}
                    variant={item.tone === "critical" ? "danger" : "default"}
                  >
                    {item.icon ? <AppIcon name={item.icon} className="icon-md shrink-0" /> : null}
                    <div className="min-w-0 flex-1">
                      <Label className="block">{item.label}</Label>
                      {item.disabledReason || item.description ? (
                        <Description className="mt-0.5 block">
                          {item.disabledReason ?? item.description}
                        </Description>
                      ) : null}
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </MotionDropdownPopover>
          ) : null}
        </AnimatePresence>
      </Dropdown>
    </DesktopPopoverBoundary>
  );
}
