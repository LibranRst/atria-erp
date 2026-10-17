"use client";

import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { SettingsDesktopSkeleton } from "@/features/settings/components/shared/settings-desktop-skeleton";

function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

export default function SettingsLoading(): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  if (desktop) return <SettingsDesktopSkeleton />;
  return (
    <div
      className="space-y-sm pb-32 max-[430px]:-mx-1 max-[430px]:pb-28 md:pb-12"
      aria-label="Memuat Pengaturan ERP"
      role="status"
    >
      <div className="space-y-2">
        <SkeletonLine className="h-2.5 w-24 bg-surface-container-low" />
        <SkeletonLine className="h-7 w-44" />
        <SkeletonLine className="h-3 w-64 bg-surface-container-low" />
      </div>
      <section className="rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-icon bg-surface-container-low" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonLine className="h-3.5 w-40" />
            <SkeletonLine className="h-2.5 w-full bg-surface-container-low" />
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-2.5 flex-1 rounded-full bg-surface-container-high" />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <SkeletonLine className="h-2.5 w-16 bg-surface-container-low" />
          <div className="h-10 w-28 rounded-full bg-surface-container-low" />
        </div>
      </section>
      <div className="flex h-12 gap-1 overflow-hidden rounded-full bg-surface-container-low p-1">
        {[96, 82, 88, 82].map((width, index) => (
          <div
            key={`${width}-${index}`}
            className={`h-full shrink-0 rounded-full ${index === 0 ? "bg-white shadow-control" : ""}`}
            style={{ width }}
          />
        ))}
      </div>
      <section className="rounded-owner bg-surface-inverse p-4 shadow-inverse">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <SkeletonLine className="h-2.5 w-28 bg-white/15" />
            <SkeletonLine className="h-8 w-20 bg-white/30" />
          </div>
          <SkeletonLine className="h-6 w-20 bg-white/15" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {[0, 1].map((item) => (
            <div key={item} className="space-y-2 rounded-inset bg-white/8 p-3">
              <SkeletonLine className="h-2 w-20 bg-white/15" />
              <SkeletonLine className="h-4 w-14 bg-white/25" />
            </div>
          ))}
        </div>
        <div className="mt-3.5 h-14 rounded-inset bg-white/8" />
      </section>
      <div className="flex min-h-12 items-center gap-3 rounded-[22px] bg-white px-3 py-2.5 shadow-surface ring-1 ring-ring-subtle">
        <div className="h-8 w-8 shrink-0 rounded-full bg-surface-container-low" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine className="h-3 w-32" />
          <SkeletonLine className="h-2.5 w-52 bg-surface-container-low" />
        </div>
      </div>
      {[4, 5, 4].map((rows, section) => (
        <section key={`${rows}-${section}`} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <SkeletonLine className="h-4 w-36" />
            <SkeletonLine className="h-8 w-24 bg-surface-container-low" />
          </div>
          <div className="overflow-hidden rounded-owner bg-white shadow-surface ring-1 ring-ring-subtle">
            {Array.from({ length: rows }, (_, row) => (
              <div
                key={row}
                className="flex min-h-14 items-center gap-3 border-t border-black/5.5 px-3.5 first:border-t-0"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonLine className="h-3 w-36" />
                  {section > 0 ? (
                    <SkeletonLine className="h-2.5 w-52 bg-surface-container-low" />
                  ) : null}
                </div>
                <SkeletonLine className="h-3 w-20 bg-surface-container-low" />
              </div>
            ))}
          </div>
        </section>
      ))}
      <span className="sr-only">Default finansial dan master data sedang disiapkan.</span>
    </div>
  );
}
