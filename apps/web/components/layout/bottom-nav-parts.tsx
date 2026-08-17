"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import {
  transitionEaseSmooth,
  transitionSpringBouncy,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import type { FabAction, NavItem } from "./bottom-nav-config";
import { AppIcon, DuotoneIconTile } from "@/components/ui";
export function BottomTabBar({
  activeIndex,
  clickedTabHref,
  items,
  pathname,
  searchParams,
  onTabClick,
}: {
  readonly activeIndex: number;
  readonly clickedTabHref: string | null;
  readonly items: readonly NavItem[];
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  readonly onTabClick: (href: string) => void;
}): React.JSX.Element {
  return (
    <nav
      aria-label="Primary mobile navigation"
      className="pointer-events-auto relative z-10 flex h-full flex-row items-center justify-center rounded-full bg-white p-1 shadow-raised ring-1 ring-ring-subtle"
    >
      {activeIndex !== -1 && (
        <motion.div
          className="absolute top-1 bottom-1 rounded-full bg-primary shadow-primary"
          initial={false}
          animate={{
            left: `calc(4px + (100% - 8px) * ${activeIndex} / ${items.length})`,
            width: `calc((100% - 8px) / ${items.length})`,
          }}
          transition={transitionSpringBouncy}
        />
      )}

      {items.map((item): React.JSX.Element => {
        const isActive = clickedTabHref
          ? item.href === clickedTabHref
          : item.match(pathname, searchParams);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onTabClick(item.href)}
            className={`relative flex h-10 w-15 flex-1 flex-col items-center justify-center rounded-full px-2 transition-all duration-200 after:absolute after:-inset-y-1 after:content-[''] active:scale-90 ${
              isActive ? "text-on-primary" : "text-on-surface-variant"
            }`}
          >
            <AppIcon
              name={item.iconName}
              weight={isActive ? "fill" : "regular"}
              className="relative z-10 icon-lg"
            />
          </Link>
        );
      })}
    </nav>
  );
}

export function QuickActionFab({
  actions,
  contentRef,
  isOpen,
  menuHeight,
  onAction,
  onOpen,
}: {
  readonly actions: readonly FabAction[];
  readonly contentRef: React.RefObject<HTMLDivElement | null>;
  readonly isOpen: boolean;
  readonly menuHeight: number | null;
  readonly onAction: (action: FabAction) => void;
  readonly onOpen: () => void;
}): React.JSX.Element {
  return (
    <div className="relative z-30 h-14 w-14 shrink-0">
      <motion.div
        onClick={() => {
          if (!isOpen) onOpen();
        }}
        whileHover={!isOpen ? { scale: 1.02 } : undefined}
        whileTap={!isOpen ? { scale: 0.95 } : undefined}
        animate={{
          height: isOpen && menuHeight ? menuHeight : 56,
          width: isOpen ? 238 : 56,
          right: isOpen ? -40 : 0,
          bottom: isOpen ? 68 : 0,
        }}
        transition={isOpen ? transitionSpringBouncy : transitionSpringSmooth}
        className={`pointer-events-auto absolute right-0 z-50 origin-bottom-right cursor-pointer overflow-hidden rounded-[28px] border transition-colors duration-300 select-none ${
          isOpen
            ? "border-outline-variant/20 bg-white shadow-raised"
            : "border-primary bg-primary shadow-floating"
        }`}
      >
        <motion.div
          animate={{
            opacity: isOpen ? 0 : 1,
            scale: isOpen ? 0.75 : 1,
          }}
          transition={transitionEaseSmooth}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <AppIcon name="add" className="scale-75 text-[32px] text-white" />
        </motion.div>

        <motion.div
          ref={contentRef}
          animate={{
            opacity: isOpen ? 1 : 0,
            scale: isOpen ? 1 : 0.95,
          }}
          transition={transitionEaseSmooth}
          className={`flex w-60 flex-col p-2 ${
            isOpen ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div className="flex flex-col gap-1 pr-1">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                tabIndex={isOpen ? 0 : -1}
                onClick={(event) => {
                  event.stopPropagation();
                  onAction(action);
                }}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-full p-2 text-left transition-colors duration-150 ${
                  action.disabled
                    ? "opacity-50 hover:bg-transparent active:bg-transparent"
                    : "hover:bg-surface-container-low active:bg-surface-container-high"
                }`}
              >
                <DuotoneIconTile
                  name={action.iconName}
                  className={`h-9 w-9 ${action.disabled ? "opacity-55" : ""}`}
                  iconClassName="icon-lg"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-xs leading-5 font-bold ${action.disabled ? "text-on-surface-variant" : "text-on-surface"}`}
                  >
                    {action.label}
                  </span>
                  <span className="block truncate text-meta font-semibold text-on-surface-variant">
                    {action.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function BottomNavBackdrop({
  isOpen,
  onClose,
}: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}): React.JSX.Element {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.button
          type="button"
          aria-label="Close quick actions"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionEaseSmooth}
          className="pointer-events-auto fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px]"
        />
      )}
    </AnimatePresence>
  );
}
