"use client";

import React from "react";
import { Tabs } from "@heroui/react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import type { SegmentedTabsProps } from "../navigation/segmented-tabs";

/** HeroUI owns desktop tab keyboard/selection behavior; the public contract stays shared. */
export function DesktopSegmentedTabs<TValue extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  onUnavailableSelect,
  animated = true,
}: SegmentedTabsProps<TValue>): React.JSX.Element {
  const id = React.useId();
  const reduced = useReducedMotion();
  return (
    <LayoutGroup id={id}>
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
              aria-describedby={
                option.unavailableReason ? `${id}-${option.value}-reason` : undefined
              }
              data-unavailable={option.unavailable || undefined}
            >
              {({ isSelected }): React.JSX.Element => (
                <>
                  {isSelected ? (
                    <motion.span
                      aria-hidden="true"
                      className="atria-desktop-tab-indicator"
                      layoutId={reduced || !animated ? undefined : "active-segment"}
                      initial={false}
                      transition={reduced || !animated ? { duration: 0 } : transitionSpringSnappy}
                    />
                  ) : null}
                  <span className="relative z-10 inline-flex items-center gap-2">
                    {option.icon}
                    <span className="whitespace-nowrap">{option.label}</span>
                    {typeof option.count === "number" ? (
                      <span
                        className={`rounded-full px-1.5 text-meta tabular-nums ${isSelected ? "bg-on-primary text-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                        aria-label={
                          option.countLabel ??
                          `${option.count} ${option.label} memerlukan perhatian`
                        }
                      >
                        {option.count > 99 ? "99+" : option.count}
                      </span>
                    ) : null}
                    {option.unavailableReason ? (
                      <span id={`${id}-${option.value}-reason`} className="sr-only">
                        {option.unavailableReason}
                      </span>
                    ) : null}
                  </span>
                </>
              )}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </LayoutGroup>
  );
}
