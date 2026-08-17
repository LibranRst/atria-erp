"use client";

import Link from "next/link";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { AppIcon } from "@/components/ui";
import {
  transitionEaseSmooth,
  transitionSpringBouncy,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import type { HeaderMenuItem } from "./header-menu-config";

type HeaderMorphMenuProps = {
  readonly isOpen: boolean;
  readonly items: readonly HeaderMenuItem[];
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  readonly title: string;
  readonly onToggle: () => void;
  readonly onClose: () => void;
};

export function HeaderMorphMenu({
  isOpen,
  items,
  pathname,
  searchParams,
  title,
  onToggle,
  onClose,
}: HeaderMorphMenuProps): React.JSX.Element {
  React.useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const activeIndex = Math.max(
    items.findIndex((item) => item.match(pathname, searchParams)),
    0,
  );
  const closedWidth = Math.min(Math.max(title.length * 8 + 56, 124), 220);
  const openHeight = Math.min(24 + items.length * 48 + Math.max(items.length - 1, 0) * 4, 520);
  const activeTitleY = 16 + activeIndex * 52;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            aria-label="Close navigation menu"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionEaseSmooth}
            className="fixed inset-0 z-70 cursor-pointer bg-black/20 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none relative z-80 flex h-10 w-55 items-start justify-center">
        <motion.div
          animate={{
            width: isOpen ? 292 : closedWidth,
            height: isOpen ? openHeight : 40,
            borderRadius: isOpen ? 28 : 20,
          }}
          transition={isOpen ? transitionSpringBouncy : transitionSpringSmooth}
          className={`pointer-events-auto absolute top-0 left-1/2 max-h-[calc(100dvh-5.5rem)] max-w-[calc(100vw-2rem)] overflow-hidden bg-white ring-1 ring-ring-subtle ${isOpen ? "shadow-raised" : "shadow-control"}`}
          style={{ x: "-50%" }}
        >
          <motion.button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            tabIndex={isOpen ? -1 : 0}
            onClick={onToggle}
            whileTap={{ scale: 0.97 }}
            animate={{
              opacity: isOpen ? 0 : 1,
              scale: isOpen ? 0.96 : 1,
              x: isOpen ? -34 : 0,
              y: isOpen ? activeTitleY : 0,
            }}
            transition={isOpen ? transitionSpringBouncy : transitionSpringSmooth}
            className={`absolute inset-x-0 top-0 flex h-10 w-full cursor-pointer items-center justify-center px-5 text-center text-sm font-semibold tracking-tight text-on-surface will-change-[opacity,transform] outline-none after:absolute after:-inset-y-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring ${
              isOpen ? "pointer-events-none" : "pointer-events-auto"
            }`}
          >
            <span className="block max-w-full truncate">{title}</span>
          </motion.button>

          <motion.nav
            animate={{
              opacity: isOpen ? 1 : 0,
              y: isOpen ? 0 : -8,
              scale: isOpen ? 1 : 0.98,
            }}
            transition={
              isOpen
                ? { ...transitionEaseSmooth, delay: 0.08, duration: 0.22 }
                : { ...transitionEaseSmooth, duration: 0.1 }
            }
            className={`no-scrollbar max-h-[calc(100dvh-5.5rem)] overflow-y-auto p-3 will-change-[opacity,transform] ${
              isOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
            aria-hidden={!isOpen}
            aria-label="Navigasi halaman"
            role="menu"
          >
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const isActive = item.match(pathname, searchParams);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={isActive ? "page" : undefined}
                    tabIndex={isOpen ? 0 : -1}
                    onClick={onClose}
                    className={`flex min-h-12 items-center justify-between gap-4 rounded-full px-5 text-left transition-colors duration-150 active:scale-[0.98] ${
                      isActive
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                    }`}
                  >
                    <span className="min-w-0 truncate text-sm font-bold">{item.label}</span>
                    <AppIcon
                      name={item.iconName}
                      weight={isActive ? "fill" : "regular"}
                      className={`icon-md shrink-0 ${isActive ? "text-on-primary" : "text-on-surface-variant/55"}`}
                    />
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        </motion.div>
      </div>
    </>
  );
}
