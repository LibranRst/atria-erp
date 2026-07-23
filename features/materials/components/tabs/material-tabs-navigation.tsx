"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";

import { SegmentedTabs } from "@/components/ui/navigation/segmented-tabs";
import type { MaterialTab } from "@/features/materials/utils/material-ui-utils";
import { materialTabs } from "@/features/materials/utils/material-ui-utils";
import { WORKSPACE_STICKY_CONTROLS_ENABLED } from "@/lib/presentation/presentation-flags";
import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui/icon/app-icon";

export function MaterialTabsNavigation({
  value,
  shortageCount,
  attentionCount,
  onChange,
}: {
  readonly value: MaterialTab;
  readonly shortageCount: number;
  readonly attentionCount: number;
  readonly onChange: (value: MaterialTab) => void;
}): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const stickyActive = WORKSPACE_STICKY_CONTROLS_ENABLED && isSticky;

  React.useEffect(() => {
    if (!WORKSPACE_STICKY_CONTROLS_ENABLED) return;

    const node = ref.current;
    if (!node) return;
    let frame: number | null = null;
    const update = (): void => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const next = window.scrollY > 0 && node.getBoundingClientRect().top <= 64.5;
        setIsSticky((current) => (current === next ? current : next));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <motion.div
      ref={ref}
      data-sticky={stickyActive ? "true" : "false"}
      animate={{
        marginLeft: stickyActive ? -8 : 0,
        marginRight: stickyActive ? -8 : 0,
        padding: stickyActive ? 8 : 0,
      }}
      transition={reduceMotion ? { duration: 0 } : transitionSpringSmooth}
      className={`${WORKSPACE_STICKY_CONTROLS_ENABLED ? "sticky top-16 z-20 [overflow-anchor:none]" : "relative"} ${stickyActive ? "overflow-hidden rounded-3xl" : ""}`}
    >
      <AnimatePresence initial={false}>
        {stickyActive ? (
          <motion.div
            key="material-sticky-surface"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
            className="pointer-events-none absolute inset-0 rounded-3xl bg-white/96 shadow-[0_1px_2px_rgba(17,17,17,0.03),0_12px_30px_rgba(17,17,17,0.08)] ring-1 ring-black/[0.035] backdrop-blur-xl"
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
      <div className="relative">
        <SegmentedTabs
          value={value}
          onChange={onChange}
          ariaLabel="Tab Material dan Stok"
          layoutId="material-main-tabs"
          scrollable
          density="compact"
          options={materialTabs.map((item) => ({
            value: item.id,
            label: item.label,
            count:
              item.id === "needs" && shortageCount > 0
                ? shortageCount
                : item.id === "inventory" && attentionCount > 0
                  ? attentionCount
                  : undefined,
            icon: (
              <AppIcon name={item.id === "overview"
                  ? "space_dashboard"
                  : item.id === "inventory"
                    ? "inventory_2"
                    : item.id === "needs"
                      ? "assignment_late"
                      : "history"} className="text-[15px]" />
            ),
          }))}
        />
      </div>
    </motion.div>
  );
}
