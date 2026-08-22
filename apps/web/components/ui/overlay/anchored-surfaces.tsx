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
  useFocus,
  useHover,
  useInteractions,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
  type Placement,
} from "@floating-ui/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { transitionEaseSmooth, transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon, type AppIconName } from "../icon/app-icon";
import { useOverlayLayers } from "./overlay-layer-context";

export const ANCHORED_SURFACE_OFFSET_PX = 8;
export const ANCHORED_SURFACE_GUTTER_PX = 12;
const ACTION_MENU_EXIT_FALLBACK_MS = 320;
const ACTION_MENU_WIDTH_PX = 224;
const CONTEXT_POPOVER_WIDTH_PX = 288;
export const MAX_ACTION_MENU_ITEMS = 6;

type TriggerElementProps = React.HTMLAttributes<HTMLElement> & {
  readonly ref?: React.Ref<HTMLElement>;
};

export type AnchoredTrigger = React.ReactElement<TriggerElementProps>;

function triggerRef(trigger: AnchoredTrigger): React.Ref<HTMLElement> | undefined {
  return trigger.props.ref;
}

function FloatingTrigger({
  trigger,
  referenceRef,
  getReferenceProps,
}: {
  readonly trigger: AnchoredTrigger;
  readonly referenceRef: (node: HTMLElement | null) => void;
  readonly getReferenceProps: (userProps?: React.HTMLProps<Element>) => Record<string, unknown>;
}): React.JSX.Element {
  const mergedRef = useMergeRefs([referenceRef, triggerRef(trigger)]);
  const props = getReferenceProps({
    ...trigger.props,
    ref: mergedRef,
  }) as TriggerElementProps;

  return React.cloneElement(trigger, props);
}

function transformOriginFor(placement: Placement): string {
  const side = placement.split("-")[0];
  const alignment = placement.split("-")[1];
  const horizontal = alignment === "start" ? "left" : alignment === "end" ? "right" : "center";
  const vertical = side === "top" ? "bottom" : side === "bottom" ? "top" : "center";

  if (side === "left") return `${alignment === "end" ? "bottom" : "top"} right`;
  if (side === "right") return `${alignment === "end" ? "bottom" : "top"} left`;
  return `${vertical} ${horizontal}`;
}

type SharedFloatingSurfaceProps = {
  readonly placement: Placement;
  readonly floatingStyles: React.CSSProperties;
  readonly setFloating: (node: HTMLElement | null) => void;
  readonly getFloatingProps: (userProps?: React.HTMLProps<HTMLElement>) => Record<string, unknown>;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly ariaLabel?: string;
  readonly comfortable?: boolean;
};

function FloatingSurface({
  placement,
  floatingStyles,
  setFloating,
  getFloatingProps,
  children,
  className = "",
  ariaLabel,
  comfortable = false,
}: SharedFloatingSurfaceProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const layers = useOverlayLayers();
  const interactionProps = getFloatingProps({ "aria-label": ariaLabel });

  return (
    <div
      {...interactionProps}
      ref={setFloating}
      style={{ ...floatingStyles, zIndex: layers.anchored }}
      className={className}
    >
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
        style={{ maxHeight: "inherit", transformOrigin: transformOriginFor(placement) }}
        className={`w-full overflow-y-auto overscroll-contain rounded-inset bg-white shadow-raised ring-1 ring-ring-control ${comfortable ? "p-4" : "p-1.5"}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

export type ActionMenuItem = {
  readonly id: string;
  readonly label: string;
  readonly icon?: AppIconName;
  readonly tone?: "default" | "critical";
  readonly disabledReason?: string;
  readonly onSelect: () => void;
};

type ActionMenuProps = {
  readonly trigger: AnchoredTrigger;
  readonly label: string;
  readonly items: readonly ActionMenuItem[];
  readonly placement?: Placement;
};

export function ActionMenu(props: ActionMenuProps): React.JSX.Element {
  if (props.items.length > MAX_ACTION_MENU_ITEMS) {
    throw new RangeError(`ActionMenu menerima maksimal ${MAX_ACTION_MENU_ITEMS} tindakan.`);
  }
  if (typeof window === "undefined") {
    return React.cloneElement(props.trigger, {
      "aria-haspopup": "menu",
      "aria-expanded": false,
    });
  }

  return <ActionMenuClient {...props} />;
}

function ActionMenuClient({
  trigger,
  label,
  items,
  placement = "bottom-end",
}: ActionMenuProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const itemLabels = React.useRef<Array<string | null>>(items.map((item) => item.label));
  const pendingAction = React.useRef<(() => void) | null>(null);
  const actionTimer = React.useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    itemLabels.current = items.map((item) => item.label);
  }, [items]);

  const {
    refs,
    floatingStyles,
    context,
    placement: resolvedPlacement,
  } = useFloating({
    open,
    onOpenChange(nextOpen) {
      if (nextOpen) pendingAction.current = null;
      setOpen(nextOpen);
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
        apply({ availableHeight, availableWidth, elements }) {
          Object.assign(elements.floating.style, {
            width: `${Math.min(ACTION_MENU_WIDTH_PX, availableWidth)}px`,
            maxHeight: `${Math.max(96, availableHeight)}px`,
          });
        },
      }),
    ],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "menu" });
  const navigation = useListNavigation(context, {
    listRef: itemRefs,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
    focusItemOnOpen: "auto",
    disabledIndices: [],
  });
  const typeahead = useTypeahead(context, {
    listRef: itemLabels,
    activeIndex,
    onMatch: setActiveIndex,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    role,
    navigation,
    typeahead,
  ]);

  const flushPendingAction = React.useCallback((): void => {
    if (actionTimer.current) {
      window.clearTimeout(actionTimer.current);
      actionTimer.current = null;
    }
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }, []);

  React.useEffect(
    () => () => {
      if (actionTimer.current) window.clearTimeout(actionTimer.current);
    },
    [],
  );

  function queueAction(item: ActionMenuItem): void {
    if (item.disabledReason) return;
    pendingAction.current = item.onSelect;
    setOpen(false);
    actionTimer.current = window.setTimeout(
      flushPendingAction,
      reduceMotion ? 0 : ACTION_MENU_EXIT_FALLBACK_MS,
    );
  }

  return (
    <>
      <FloatingTrigger
        trigger={trigger}
        referenceRef={refs.setReference}
        getReferenceProps={getReferenceProps}
      />
      <FloatingPortal>
        <AnimatePresence onExitComplete={flushPendingAction}>
          {open ? (
            <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
              <FloatingSurface
                placement={resolvedPlacement}
                floatingStyles={floatingStyles}
                setFloating={refs.setFloating}
                getFloatingProps={getFloatingProps}
                ariaLabel={label}
              >
                <div>
                  {items.map((item, index) => {
                    const reasonId = item.disabledReason
                      ? `${context.floatingId}-${item.id}-reason`
                      : undefined;
                    return (
                      <button
                        key={item.id}
                        ref={(node) => {
                          itemRefs.current[index] = node;
                        }}
                        type="button"
                        role="menuitem"
                        tabIndex={activeIndex === index ? 0 : -1}
                        aria-disabled={item.disabledReason ? "true" : undefined}
                        aria-describedby={reasonId}
                        {...getItemProps({
                          onClick: () => queueAction(item),
                          onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            queueAction(item);
                          },
                        })}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-full px-3.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                          item.tone === "critical"
                            ? "text-critical hover:bg-critical-container/60 focus-visible:bg-critical-container/60"
                            : "text-on-surface hover:bg-surface-container-low focus-visible:bg-surface-container-low"
                        } ${item.disabledReason ? "cursor-not-allowed opacity-55" : ""}`}
                      >
                        {item.icon ? (
                          <AppIcon
                            name={item.icon}
                            className="icon-sm shrink-0"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-row font-bold">{item.label}</span>
                          {item.disabledReason ? (
                            <span
                              id={reasonId}
                              className="mt-0.5 block text-meta font-semibold text-on-surface-variant"
                            >
                              {item.disabledReason}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </FloatingSurface>
            </FloatingFocusManager>
          ) : null}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
}

type ContextPopoverProps = {
  readonly trigger: AnchoredTrigger;
  readonly label: string;
  readonly children: React.ReactNode;
  readonly placement?: Placement;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
};

export function ContextPopover(props: ContextPopoverProps): React.JSX.Element {
  if (typeof window === "undefined") {
    return React.cloneElement(props.trigger, {
      "aria-haspopup": "dialog",
      "aria-expanded": false,
    });
  }

  return <ContextPopoverClient {...props} />;
}

function ContextPopoverClient({
  trigger,
  label,
  children,
  placement = "bottom-start",
  open: controlledOpen,
  onOpenChange,
}: ContextPopoverProps): React.JSX.Element {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const {
    refs,
    floatingStyles,
    context,
    placement: resolvedPlacement,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(ANCHORED_SURFACE_OFFSET_PX),
      flip({ padding: ANCHORED_SURFACE_GUTTER_PX }),
      shift({ padding: ANCHORED_SURFACE_GUTTER_PX }),
      size({
        padding: ANCHORED_SURFACE_GUTTER_PX,
        apply({ availableHeight, availableWidth, elements }) {
          Object.assign(elements.floating.style, {
            width: `${Math.min(CONTEXT_POPOVER_WIDTH_PX, availableWidth)}px`,
            maxHeight: `${Math.max(96, availableHeight)}px`,
          });
        },
      }),
    ],
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: "dialog" }),
  ]);

  return (
    <>
      <FloatingTrigger
        trigger={trigger}
        referenceRef={refs.setReference}
        getReferenceProps={getReferenceProps}
      />
      <FloatingPortal>
        <AnimatePresence>
          {open ? (
            <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
              <FloatingSurface
                placement={resolvedPlacement}
                floatingStyles={floatingStyles}
                setFloating={refs.setFloating}
                getFloatingProps={getFloatingProps}
                ariaLabel={label}
                comfortable
              >
                <div>{children}</div>
              </FloatingSurface>
            </FloatingFocusManager>
          ) : null}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
}

type TooltipProps = {
  readonly content: string;
  readonly children: AnchoredTrigger;
  readonly disabled?: boolean;
  readonly placement?: Placement;
};

export function Tooltip(props: TooltipProps): React.JSX.Element {
  if (typeof window === "undefined" || props.disabled) return props.children;
  return <TooltipClient {...props} />;
}

function TooltipClient({
  content,
  children,
  disabled = false,
  placement = "top",
}: TooltipProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const layers = useOverlayLayers();
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: ANCHORED_SURFACE_GUTTER_PX }),
      shift({ padding: ANCHORED_SURFACE_GUTTER_PX }),
    ],
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, {
      enabled: !disabled,
      mouseOnly: true,
      move: false,
      delay: { open: 450, close: 100 },
    }),
    useFocus(context, { enabled: !disabled, visibleOnly: true }),
    useDismiss(context, { enabled: !disabled, referencePress: true }),
    useRole(context, { role: "tooltip", enabled: !disabled }),
  ]);

  return (
    <>
      <FloatingTrigger
        trigger={children}
        referenceRef={refs.setReference}
        getReferenceProps={getReferenceProps}
      />
      <FloatingPortal>
        <AnimatePresence>
          {open && !disabled ? (
            <div
              ref={refs.setFloating}
              {...getFloatingProps()}
              style={{ ...floatingStyles, zIndex: layers.tooltip }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
                className="pointer-events-none max-w-56 rounded-full bg-primary px-3 py-1.5 text-center text-meta font-bold text-on-primary shadow-raised"
              >
                {content}
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
}
