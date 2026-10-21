"use client";

import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useSearchParams } from "next/navigation";
import { useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import {
  DashboardDesktopSkeleton,
  resolveDashboardSkeletonTab,
} from "@/features/finance-dashboard/components/desktop/dashboard-desktop-skeletons";

export default function LedgerLoading(): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const initialParams = useSearchParams();
  const tab = resolveDashboardSkeletonTab(
    useBrowserUrlSearchParam("tab", initialParams?.get("tab") ?? null),
  );
  const sizeKey = `${tab}-pageSize`;
  const rawSize = useBrowserUrlSearchParam(sizeKey, initialParams?.get(sizeKey) ?? null);
  const pageSize = rawSize === "50" ? 50 : rawSize === "25" ? 25 : 10;
  const rawMonths = useBrowserUrlSearchParam(
    "trendMonths",
    initialParams?.get("trendMonths") ?? null,
  );
  if (desktop)
    return (
      <DashboardDesktopSkeleton
        tab={tab}
        pageSize={pageSize}
        months={rawMonths === "12" ? 12 : 6}
      />
    );
  return (
    <div className="dashboard-density space-y-sm pb-8" aria-label="Memuat Dashboard" role="status">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-full bg-surface-container" />
        <div className="h-4 w-32 rounded-full bg-surface-container-low" />
      </div>
      <div className="h-12 rounded-full bg-surface-container-low" />
      <div className="h-67.5 rounded-owner bg-surface-inverse shadow-inverse" />
      <div className="space-y-3">
        <div className="h-5 w-36 rounded-full bg-surface-container" />
        <div className="rounded-owner bg-white p-3 ring-1 ring-ring-subtle">
          <div className="flex min-h-16 items-center gap-3 border-b border-outline-variant/25 px-2">
            <div className="h-10 w-10 rounded-icon bg-surface-container-low" />
            <div className="h-4 flex-1 rounded-full bg-surface-container-low" />
          </div>
          <div className="flex min-h-16 items-center gap-3 border-b border-outline-variant/25 px-2">
            <div className="h-10 w-10 rounded-icon bg-surface-container-low" />
            <div className="h-4 flex-1 rounded-full bg-surface-container-low" />
          </div>
          <div className="flex min-h-16 items-center gap-3 px-2">
            <div className="h-10 w-10 rounded-icon bg-surface-container-low" />
            <div className="h-4 flex-1 rounded-full bg-surface-container-low" />
          </div>
        </div>
      </div>
      <span className="sr-only">Data finansial sedang disiapkan.</span>
    </div>
  );
}
