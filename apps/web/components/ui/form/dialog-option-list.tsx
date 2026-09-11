"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { transitionSpringSmooth } from "@/lib/utils/motion";
import { AppIcon } from "../icon/app-icon";
import type { SelectOption } from "./form-control-types";
import { cx } from "./form-control-utils";

export type DialogOptionListHandle = {
  readonly focusFirst: () => void;
};

export const DialogOptionList = React.forwardRef<
  DialogOptionListHandle,
  {
    readonly label: string;
    readonly value: string;
    readonly options: readonly SelectOption[];
    readonly emptyText: string;
    readonly animateHeight?: boolean;
    readonly onSelect: (option: SelectOption) => void;
  }
>(function DialogOptionList(
  { label, value, options, emptyText, animateHeight = false, onSelect },
  forwardedRef,
): React.JSX.Element {
  const listId = React.useId();
  const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
  const firstEnabledIndex = options.findIndex((option) => !option.disabled);
  const [activeIndex, setActiveIndex] = React.useState(
    selectedIndex >= 0 ? selectedIndex : firstEnabledIndex,
  );
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const typeahead = React.useRef("");
  const typeaheadTimer = React.useRef<number | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [measuredHeight, setMeasuredHeight] = React.useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
    if (selectedIndex >= 0) {
      const timer = setTimeout(() => {
        optionRefs.current[selectedIndex]?.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [firstEnabledIndex, selectedIndex]);

  React.useLayoutEffect(() => {
    if (!animateHeight) return undefined;
    const content = contentRef.current;
    if (!content) return undefined;

    function measure(): void {
      const el = contentRef.current;
      if (!el) return;
      // Gunakan offsetHeight/scrollHeight agar tidak terdistorsi oleh CSS transform scale saat animasi modal masuk
      const nextHeight = Math.max(el.offsetHeight, el.scrollHeight);
      if (!nextHeight) return;
      setMeasuredHeight((current) =>
        current !== null && Math.abs(current - nextHeight) < 1 ? current : nextHeight,
      );
    }

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [animateHeight]);

  const focusIndex = React.useCallback(
    (candidate: number, direction: 1 | -1 = 1): void => {
      if (options.length === 0) return;
      let next = candidate;
      for (let checked = 0; checked < options.length; checked += 1) {
        const normalized = (next + options.length) % options.length;
        if (!options[normalized]?.disabled) {
          setActiveIndex(normalized);
          const node = optionRefs.current[normalized];
          node?.focus({ preventScroll: true });
          node?.scrollIntoView({ block: "nearest", inline: "nearest" });
          return;
        }
        next += direction;
      }
    },
    [options],
  );

  React.useImperativeHandle(
    forwardedRef,
    () => ({ focusFirst: () => focusIndex(firstEnabledIndex >= 0 ? firstEnabledIndex : 0) }),
    [firstEnabledIndex, focusIndex],
  );

  React.useEffect(
    () => () => {
      if (typeaheadTimer.current) window.clearTimeout(typeaheadTimer.current);
    },
    [],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusIndex((activeIndex >= 0 ? activeIndex : -1) + 1, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusIndex((activeIndex >= 0 ? activeIndex : options.length) - 1, -1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusIndex(0, 1);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusIndex(options.length - 1, -1);
      return;
    }
    if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;

    typeahead.current += event.key.toLocaleLowerCase("id-ID");
    if (typeaheadTimer.current) window.clearTimeout(typeaheadTimer.current);
    typeaheadTimer.current = window.setTimeout(() => {
      typeahead.current = "";
    }, 500);
    const match = options.findIndex(
      (option) =>
        !option.disabled && option.label.toLocaleLowerCase("id-ID").startsWith(typeahead.current),
    );
    if (match >= 0) focusIndex(match);
  }

  const groups = Array.from(new Set(options.map((option) => option.group ?? "")));
  return (
    <motion.div
      role="listbox"
      aria-label={label}
      onKeyDown={onKeyDown}
      initial={false}
      animate={animateHeight && measuredHeight !== null ? { height: measuredHeight } : undefined}
      transition={reduceMotion ? { duration: 0 } : transitionSpringSmooth}
      className="overflow-hidden rounded-3xl bg-white"
    >
      <div ref={contentRef} className="flow-root">
        {options.length === 0 && emptyText ? (
          <p className="px-5 py-8 text-center text-support text-on-surface-variant">{emptyText}</p>
        ) : null}
        {groups.map((group) => (
          <div key={group || "ungrouped"}>
            {group ? (
              <p className="bg-surface-container-low px-5 py-2.5 text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                {group}
              </p>
            ) : null}
            <div className="divide-y divide-outline-variant/20">
              {options.map((option, index) => {
                if ((option.group ?? "") !== group) return null;
                const selected = option.value === value;
                const reasonId = option.disabledReason
                  ? `${listId}-option-${index}-disabled-reason`
                  : undefined;
                return (
                  <button
                    key={option.value}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={option.disabled ? "true" : undefined}
                    aria-describedby={reasonId}
                    tabIndex={activeIndex === index ? 0 : -1}
                    onClick={() => {
                      if (!option.disabled) onSelect(option);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (!option.disabled) onSelect(option);
                    }}
                    className={cx(
                      "flex min-h-12 w-full min-w-0 items-center gap-3 bg-white px-5 py-3 text-left text-on-surface transition-colors outline-none hover:bg-surface-container-low/70 focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container",
                      option.disabled && "cursor-not-allowed opacity-55",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-row font-bold", selected && "text-accent")}>
                        {option.label}
                      </span>
                      {option.description || option.meta || option.disabledReason ? (
                        <span
                          id={reasonId}
                          className={cx("mt-0.5 block text-meta", "text-on-surface-variant")}
                        >
                          {option.disabledReason ?? option.description ?? option.meta}
                        </span>
                      ) : null}
                    </span>
                    {selected ? (
                      <AppIcon
                        name="check"
                        className="icon-sm shrink-0 text-accent"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
});
