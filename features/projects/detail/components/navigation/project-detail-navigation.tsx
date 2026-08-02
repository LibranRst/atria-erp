"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";
import { toast } from "sonner";

import { AppIcon, SegmentedTabs } from "@/components/ui";
import { WORKSPACE_STICKY_CONTROLS_ENABLED } from "@/lib/presentation/presentation-flags";
import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import type { TabId } from "../../types/project-tabs-types";
export type ProjectDomainId = "overview" | "planning" | "operations" | "finance";

const DOMAIN_OPTIONS = [
  { value: "overview", label: "Ringkasan", icon: "space_dashboard" },
  { value: "planning", label: "Perencanaan", icon: "architecture" },
  { value: "operations", label: "Operasional", icon: "inventory_2" },
  { value: "finance", label: "Keuangan", icon: "account_balance_wallet" },
] as const;

const DOMAIN_TABS: Readonly<
  Record<
    Exclude<ProjectDomainId, "overview">,
    readonly {
      value: TabId;
      label: string;
      icon: string;
    }[]
  >
> = {
  planning: [
    { value: "rap", label: "RAP", icon: "architecture" },
    { value: "rab", label: "RAB", icon: "request_quote" },
  ],
  operations: [
    { value: "stok", label: "Stok", icon: "inventory_2" },
    { value: "expenses", label: "Pengeluaran", icon: "receipt_long" },
  ],
  finance: [
    { value: "payments", label: "Pembayaran", icon: "receipt_long" },
    { value: "profitability", label: "Margin", icon: "trending_up" },
  ],
};

export function projectDomainForTab(tab: TabId): ProjectDomainId {
  if (tab === "overview") return "overview";
  if (tab === "rap" || tab === "rab") return "planning";
  if (tab === "stok" || tab === "expenses") return "operations";
  return "finance";
}

export function defaultTabForDomain(domain: ProjectDomainId, isLocked: boolean): TabId {
  if (domain === "overview") return "overview";
  if (domain === "planning") return "rap";
  if (domain === "operations") return isLocked ? "rap" : "stok";
  return isLocked ? "rap" : "payments";
}

export function isProjectDomainUnavailable(domain: ProjectDomainId, isLocked: boolean): boolean {
  return isLocked && (domain === "operations" || domain === "finance");
}

export function ProjectDetailNavigation({
  activeTab,
  isLocked,
  onTabChange,
}: {
  readonly activeTab: TabId;
  readonly isLocked: boolean;
  readonly onTabChange: (tab: TabId) => void;
}): React.JSX.Element {
  const stickyControlRef = React.useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = React.useState(false);
  const stickyActive = WORKSPACE_STICKY_CONTROLS_ENABLED && isSticky;
  const shouldReduceMotion = useReducedMotion();
  const activeDomain = projectDomainForTab(activeTab);
  const childOptions = activeDomain === "overview" ? null : DOMAIN_TABS[activeDomain];
  const stickyTransition = shouldReduceMotion ? { duration: 0 } : transitionSpringSmooth;
  const surfaceTransition = shouldReduceMotion ? { duration: 0 } : transitionEaseSmooth;

  React.useEffect(() => {
    if (!WORKSPACE_STICKY_CONTROLS_ENABLED) return;

    const stickyControl = stickyControlRef.current;
    if (!stickyControl) return;
    let frameId: number | null = null;

    const updateStickyState = (): void => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const nextSticky = window.scrollY > 0 && stickyControl.getBoundingClientRect().top <= 64.5;
        setIsSticky((current) => (current === nextSticky ? current : nextSticky));
      });
    };

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, []);

  return (
    <motion.div
      ref={stickyControlRef}
      data-sticky={stickyActive ? "true" : "false"}
      data-density={stickyActive ? "floating" : "inline"}
      animate={{
        marginLeft: stickyActive ? -8 : 0,
        marginRight: stickyActive ? -8 : 0,
        padding: stickyActive ? 8 : 0,
      }}
      transition={stickyTransition}
      className={`${WORKSPACE_STICKY_CONTROLS_ENABLED ? "sticky top-16 z-20 [overflow-anchor:none]" : "relative"} ${stickyActive ? "overflow-hidden rounded-3xl" : ""}`}
    >
      <AnimatePresence initial={false}>
        {stickyActive ? (
          <motion.div
            key="sticky-project-detail-surface"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={surfaceTransition}
            className="pointer-events-none absolute inset-0 rounded-3xl bg-white/96 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl"
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
      <div className="relative space-y-2">
        <SegmentedTabs
          value={activeDomain}
          onChange={(domain) => onTabChange(defaultTabForDomain(domain, isLocked))}
          ariaLabel="Kelompok detail proyek"
          layoutId="project-detail-domain"
          options={DOMAIN_OPTIONS.map((domain) => ({
            value: domain.value,
            label: domain.label,
            icon: (
              <AppIcon
                name={isProjectDomainUnavailable(domain.value, isLocked) ? "lock" : domain.icon}
                className="text-section"
              />
            ),
            unavailable: isProjectDomainUnavailable(domain.value, isLocked),
            unavailableReason: isProjectDomainUnavailable(domain.value, isLocked)
              ? `${domain.label} belum tersedia. Selesaikan RAP dan RAB hingga budget proyek disetujui.`
              : undefined,
          }))}
          onUnavailableSelect={(domain) =>
            toast.info(
              `${DOMAIN_OPTIONS.find((item) => item.value === domain)?.label ?? "Bagian ini"} belum tersedia. Selesaikan RAP dan RAB hingga budget proyek disetujui.`,
            )
          }
          scrollable
          fillAvailableSpace
          density="compact"
        />

        {childOptions ? (
          <SegmentedTabs
            value={activeTab}
            onChange={onTabChange}
            ariaLabel={`${DOMAIN_OPTIONS.find((domain) => domain.value === activeDomain)?.label ?? "Detail"} proyek`}
            layoutId={`project-detail-${activeDomain}`}
            options={childOptions.map((tab) => ({
              value: tab.value,
              label: tab.label,
              icon: <AppIcon name={tab.icon} className="text-[15px]" />,
            }))}
            density="compact"
          />
        ) : null}
      </div>
    </motion.div>
  );
}
