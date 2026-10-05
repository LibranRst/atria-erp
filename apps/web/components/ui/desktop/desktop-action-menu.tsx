"use client";

import React from "react";
import { Description, Dropdown, Label } from "@heroui/react";
import type { ActionMenuProps } from "../overlay/anchored-surfaces";
import { useOverlayLayers } from "../overlay/overlay-layer-context";
import { AppIcon } from "../icon/app-icon";

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
}: ActionMenuProps): React.JSX.Element {
  const layers = useOverlayLayers();
  return (
    <Dropdown>
      {typeof trigger.type === "string" ? (
        <Dropdown.Trigger
          id={trigger.props.id}
          aria-label={trigger.props["aria-label"]}
          className={trigger.props.className}
        >
          {trigger.props.children}
        </Dropdown.Trigger>
      ) : (
        trigger
      )}
      <Dropdown.Popover
        placement={placements[placement]}
        offset={8}
        containerPadding={12}
        style={{ zIndex: layers.anchored }}
        className="atria-desktop-menu"
      >
        <Dropdown.Menu
          aria-label={label}
          onAction={(key: React.Key): void => {
            const item = items.find((option) => option.id === String(key));
            if (item && !item.disabledReason) item.onSelect();
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
              <div className="min-w-0">
                <Label>{item.label}</Label>
                {item.disabledReason ? <Description>{item.disabledReason}</Description> : null}
              </div>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
