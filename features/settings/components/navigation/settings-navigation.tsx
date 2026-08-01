"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";

import { SegmentedTabs } from "@/components/ui";
import { WORKSPACE_STICKY_CONTROLS_ENABLED } from "@/lib/presentation/presentation-flags";
import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import { SETTINGS_TABS, type SettingsTab } from "../../utils/settings-tabs-config";

export function SettingsNavigation({
  value,
  onChange,
  showAdministration = false,
  showSetup = false,
}: {
  readonly value: SettingsTab;
  readonly onChange: (value: SettingsTab) => void;
  readonly showAdministration?: boolean;
  readonly showSetup?: boolean;
}): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = React.useState(false);
  const stickyActive = WORKSPACE_STICKY_CONTROLS_ENABLED && isSticky;
  const reduceMotion = useReducedMotion();

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
            key="settings-sticky-surface"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
            className="pointer-events-none absolute inset-0 rounded-3xl bg-white/96 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl"
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
      <div className="relative">
        <SegmentedTabs
          value={value}
          onChange={onChange}
          ariaLabel="Modul Pengaturan ERP"
          layoutId="settings-main-tabs"
          scrollable
          density="compact"
          options={SETTINGS_TABS.filter(
            (module) =>
              (module.value !== "administration" || showAdministration) &&
              (module.value !== "setup" || showSetup),
          ).map((module) => {
            const Icon = module.icon;
            return {
              value: module.value,
              label: module.shortLabel,
              icon: <Icon className="h-3.75 w-3.75" aria-hidden="true" />,
            };
          })}
        />
      </div>
    </motion.div>
  );
}
