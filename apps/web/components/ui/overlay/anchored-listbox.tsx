"use client";

/* eslint-disable react-hooks/refs -- Floating UI exposes stable callback setters on a property named `refs`; no `.current` value is read during render. */

import React from "react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
  type Placement,
} from "@floating-ui/react";
import { AnimatePresence } from "framer-motion";

import type { SelectOption } from "../form/form-control-types";
import { AppIcon } from "../icon/app-icon";
import {
  ANCHORED_SURFACE_GUTTER_PX,
  ANCHORED_SURFACE_OFFSET_PX,
  type AnchoredTrigger,
} from "./anchored-surfaces";
import { useOverlayLayers } from "./overlay-layer-context";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";

type AnchoredListboxProps = {
  readonly trigger: AnchoredTrigger;
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly placement?: Placement;
};

export function AnchoredListbox(props: AnchoredListboxProps): React.JSX.Element {
  if (typeof window === "undefined") {
    return React.cloneElement(props.trigger, {
      "aria-haspopup": "listbox",
      "aria-expanded": false,
    });
  }

  return <AnchoredListboxClient {...props} />;
}

function AnchoredListboxClient({
  trigger,
  label,
  value,
  options,
  onChange,
  placement = "bottom-start",
}: AnchoredListboxProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(
    selectedIndex >= 0 ? selectedIndex : null,
  );
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const itemLabels = React.useRef<Array<string | null>>(options.map((option) => option.label));
  const reduceMotion = useReducedMotion();
  const layers = useOverlayLayers();

  React.useEffect(() => {
    itemLabels.current = options.map((option) => option.label);
  }, [options]);

  const {
    refs,
    floatingStyles,
    context,
    placement: resolvedPlacement,
  } = useFloating({
    open,
    onOpenChange(nextOpen) {
      setOpen(nextOpen);
      if (nextOpen) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    },
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(ANCHORED_SURFACE_OFFSET_PX),
      flip({ padding: ANCHORED_SURFACE_GUTTER_PX }),
      shift({ padding: ANCHORED_SURFACE_GUTTER_PX }),
      size({
        padding: ANCHORED_SURFACE_GUTTER_PX,
        apply({ availableHeight, rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: `${Math.max(96, availableHeight)}px`,
          });
        },
      }),
    ],
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "listbox" });
  const navigation = useListNavigation(context, {
    listRef: itemRefs,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    onNavigate: setActiveIndex,
    loop: true,
    focusItemOnOpen: "auto",
  });
  const typeahead = useTypeahead(context, {
    listRef: itemLabels,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    onMatch: setActiveIndex,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    role,
    navigation,
    typeahead,
  ]);

  const mergedTriggerRef = useMergeRefs([refs.setReference, trigger.props.ref]);
  const triggerProps = getReferenceProps({
    ...trigger.props,
    ref: mergedTriggerRef,
  }) as unknown as React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> };

  const transformOrigin = resolvedPlacement.startsWith("top") ? "bottom" : "top";

  function selectOption(option: SelectOption): void {
    if (option.disabled) return;
    setOpen(false);
    onChange(option.value);
  }

  return (
    <>
      {React.cloneElement(trigger, triggerProps)}
      <FloatingPortal>
        <AnimatePresence>
          {open ? (
            <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
              <div
                ref={refs.setFloating}
                {...getFloatingProps({ "aria-label": label })}
                style={{
                  ...floatingStyles,
                  zIndex: layers.anchored,
                }}
              >
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
                  style={{ maxHeight: "inherit", transformOrigin }}
                  className="w-full overflow-y-auto overscroll-contain rounded-inset bg-white p-1.5 shadow-raised ring-1 ring-ring-control"
                >
                  {options.map((option, index) => {
                    const active = option.value === value;
                    return (
                      <button
                        key={option.value}
                        ref={(node) => {
                          itemRefs.current[index] = node;
                        }}
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={option.disabled}
                        tabIndex={activeIndex === index ? 0 : -1}
                        {...getItemProps({
                          onClick: () => selectOption(option),
                          onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            selectOption(option);
                          },
                        })}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-full px-3.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-45 ${
                          active
                            ? "bg-primary text-on-primary"
                            : "text-on-surface hover:bg-surface-container-low focus-visible:bg-surface-container-low"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate text-row font-bold">
                          {option.label}
                        </span>
                        {active ? (
                          <AppIcon name="check" className="icon-sm shrink-0" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </motion.div>
              </div>
            </FloatingFocusManager>
          ) : null}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
}
