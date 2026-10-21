"use client";

/* eslint-disable react-hooks/refs -- Floating UI exposes stable callback setters on a property named `refs`; no `.current` value is read during render. */

import { useWorkspaceControlPresentation } from "@/lib/navigation/workspace-presentation";
import { DesktopActionMenu } from "../desktop/desktop-action-menu";
import { DesktopContextPopover } from "../desktop/desktop-context-popover";
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
import { AppIcon } from "../icon/app-icon";
import { useOverlayLayers } from "./overlay-layer-context";
import { getAnchoredContainerRadius } from "./anchored-listbox";

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

/** Anchor identity belongs above the server/client presentation branches. */
function useStableTrigger(trigger: AnchoredTrigger): AnchoredTrigger {
  const generatedId = React.useId();
  return React.cloneElement(trigger, { id: trigger.props.id ?? `anchored-trigger-${generatedId}` });
}

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
  readonly radiusClass?: string;
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
  radiusClass = "rounded-[26px]",
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
        className={`w-full overflow-y-auto overscroll-contain ${radiusClass} bg-white/95 shadow-floating ring-1 ring-ring-control backdrop-blur-xl ${comfortable ? "p-4" : "p-2"}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

export type ActionMenuItem = {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly description?: string;
  readonly tone?: "default" | "critical";
  readonly disabledReason?: string;
  readonly onSelect: () => void;
};

export type ActionMenuProps = {
  readonly trigger: AnchoredTrigger;
  readonly label: string;
  readonly items: readonly ActionMenuItem[];
  readonly placement?: Placement;
  readonly header?: React.ReactNode;
};

export function ActionMenu(props: ActionMenuProps): React.JSX.Element {
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const trigger = useStableTrigger(props.trigger);
  if (props.items.length > MAX_ACTION_MENU_ITEMS) {
    throw new RangeError(`ActionMenu menerima maksimal ${MAX_ACTION_MENU_ITEMS} tindakan.`);
  }
  if (desktop) return <DesktopActionMenu {...props} trigger={trigger} />;
  if (typeof window === "undefined") {
    return React.cloneElement(trigger, {
      "aria-haspopup": "menu",
      "aria-expanded": false,
    });
  }

  return <ActionMenuClient {...props} trigger={trigger} />;
}

function ActionMenuClient({
  trigger,
  label,
  items,
  placement = "bottom-end",
  header,
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

  const hasComplexContent = items.some((item) => Boolean(item.disabledReason || item.description));
  const radiusClass = getAnchoredContainerRadius(items.length, hasComplexContent);

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
                radiusClass={radiusClass}
                ariaLabel={label}
              >
                {header}
                <div className="space-y-1">
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
                        className={`flex min-h-12 w-full items-center gap-3 rounded-full px-4 py-2.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-[1.05] ${
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
                          {item.disabledReason || item.description ? (
                            <span
                              id={reasonId}
                              className="mt-0.5 block text-meta font-semibold text-on-surface-variant"
                            >
                              {item.disabledReason ?? item.description}
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

export type ContextPopoverProps = {
  readonly trigger: AnchoredTrigger;
  readonly label: string;
  readonly children: React.ReactNode;
  readonly placement?: Placement;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly width?: number;
};

export function ContextPopover(props: ContextPopoverProps): React.JSX.Element {
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const trigger = useStableTrigger(props.trigger);
  if (desktop) return <DesktopContextPopover {...props} trigger={trigger} />;
  if (typeof window === "undefined") {
    return React.cloneElement(trigger, {
      "aria-haspopup": "dialog",
      "aria-expanded": false,
    });
  }

  return <ContextPopoverClient {...props} trigger={trigger} />;
}

function ContextPopoverClient({
  trigger,
  label,
  children,
  placement = "bottom-start",
  open: controlledOpen,
  onOpenChange,
  width = CONTEXT_POPOVER_WIDTH_PX,
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
            width: `${Math.min(width, availableWidth)}px`,
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

export type TooltipProps = {
  readonly content: string;
  readonly children: AnchoredTrigger;
  readonly disabled?: boolean;
  readonly placement?: Placement;
  readonly touch?: boolean;
};

export function Tooltip(props: TooltipProps): React.JSX.Element {
  const trigger = useStableTrigger(props.children);
  if (typeof window === "undefined" || props.disabled) return trigger;
  return <TooltipClient {...props}>{trigger}</TooltipClient>;
}

function TooltipClient({
  content,
  children,
  disabled = false,
  placement = "top",
  touch = false,
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
    // A tooltip annotates its trigger; it must not intercept the owner's Escape.
    useDismiss(context, { enabled: !disabled, referencePress: true, bubbles: { escapeKey: true } }),
    useRole(context, { role: "tooltip", enabled: !disabled }),
    useClick(context, {
      enabled: !disabled && Boolean(touch),
      ignoreMouse: true,
    }),
  ]);

  return (
    <>
      <FloatingTrigger
        trigger={children}
        referenceRef={refs.setReference}
        getReferenceProps={(userProps) => {
          const baseProps = getReferenceProps(userProps);
          const originalOnKeyDown = baseProps.onKeyDown as
            React.KeyboardEventHandler<HTMLElement> | undefined;
          const referenceProps = {
            ...baseProps,
            onKeyDown: (event: React.KeyboardEvent<HTMLElement>): void => {
              originalOnKeyDown?.(event);
              // React Aria custom keyboard handlers stop propagation by default.
              // The tooltip owns neither dialog dismissal nor its focus trap.
              if (
                (event.key === "Escape" || event.key === "Tab") &&
                !event.defaultPrevented &&
                "continuePropagation" in event &&
                typeof event.continuePropagation === "function"
              )
                event.continuePropagation();
            },
          };
          if (!touch) return referenceProps;
          const originalOnClick = baseProps.onClick as
            React.MouseEventHandler<HTMLElement> | undefined;
          return {
            ...referenceProps,
            onClick: (event: React.MouseEvent<HTMLElement>) => {
              const nativeEvent = event.nativeEvent;
              const isTouch =
                ("pointerType" in nativeEvent && nativeEvent.pointerType === "touch") ||
                "touches" in nativeEvent;
              if (isTouch) {
                event.stopPropagation();
                const target = event.currentTarget as HTMLElement | null;
                if (target?.closest("a, button")) {
                  event.preventDefault();
                }
              }
              originalOnClick?.(event);
            },
          };
        }}
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
