"use client";

import React from "react";
import { Tabs } from "@heroui/react";
import type { SegmentedTabsProps } from "../navigation/segmented-tabs";

/** HeroUI owns desktop tab keyboard/selection behavior; the public contract stays shared. */
export function DesktopSegmentedTabs<TValue extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  onUnavailableSelect,
}: SegmentedTabsProps<TValue>): React.JSX.Element {
  const id = React.useId();
  return (
    <Tabs
      selectedKey={value}
      keyboardActivation="manual"
      onSelectionChange={(key: React.Key): void => {
        const option = options.find((item) => item.value === String(key));
        if (!option || option.disabled) return;
        if (option.unavailable) onUnavailableSelect?.(option.value);
        else onChange(option.value);
      }}
      className={`atria-desktop-tabs w-fit max-w-full min-w-0 ${className ?? ""}`}
    >
      <Tabs.List aria-label={ariaLabel} className="max-w-full overflow-x-auto">
        {options.map((option) => (
          <Tabs.Tab
            key={option.value}
            id={option.value}
            isDisabled={option.disabled}
            aria-disabled={option.unavailable || undefined}
            aria-describedby={option.unavailableReason ? `${id}-${option.value}-reason` : undefined}
            data-unavailable={option.unavailable || undefined}
          >
            {option.icon}
            <span className="whitespace-nowrap">{option.label}</span>
            {typeof option.count === "number" ? (
              <span
                className="rounded-full bg-surface-container-high px-1.5 text-meta tabular-nums"
                aria-label={`${option.count} ${option.label} memerlukan perhatian`}
              >
                {option.count > 99 ? "99+" : option.count}
              </span>
            ) : null}
            {option.unavailableReason ? (
              <span id={`${id}-${option.value}-reason`} className="sr-only">
                {option.unavailableReason}
              </span>
            ) : null}
            <Tabs.Indicator />
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
