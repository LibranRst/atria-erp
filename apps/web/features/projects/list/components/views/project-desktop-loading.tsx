import React from "react";
import { GroupedSurface } from "@/components/ui";

function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}
function TableSkeleton({ rows = 6 }: { readonly rows?: number }): React.JSX.Element {
  return (
    <GroupedSurface className="px-4">
      <div aria-hidden="true">
        <div className="grid h-10 grid-cols-6 items-center gap-5 border-b border-outline-variant/25">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonLine key={index} className="h-3 w-4/5" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="grid h-12 grid-cols-6 items-center gap-5 border-b border-outline-variant/20 last:border-b-0"
          >
            {Array.from({ length: 6 }, (_, cell) => (
              <SkeletonLine
                key={cell}
                className={cell === 0 ? "h-4 w-full" : "h-3 w-3/4 bg-surface-container-low"}
              />
            ))}
          </div>
        ))}
      </div>
    </GroupedSurface>
  );
}

export function ProjectDesktopLoading({
  detail = false,
}: {
  readonly detail?: boolean;
}): React.JSX.Element {
  return (
    <div
      className="space-y-5"
      role="status"
      aria-label={detail ? "Memuat detail proyek" : "Memuat Proyek"}
      aria-busy="true"
    >
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <SkeletonLine className="h-7 w-48" />
          <SkeletonLine className="h-3 w-72" />
        </div>
        <SkeletonLine className="h-8 w-24" />
      </div>
      {detail ? (
        <div aria-hidden="true" className="flex gap-2">
          {["overview", "planning", "operations", "finance"].map((tab) => (
            <SkeletonLine key={tab} className="h-9 w-28" />
          ))}
        </div>
      ) : null}
      <GroupedSurface className="p-4">
        <div
          className={detail ? "grid grid-cols-3 gap-5 xl:grid-cols-6" : "grid grid-cols-4 gap-5"}
        >
          {Array.from({ length: detail ? 6 : 4 }, (_, index) => (
            <div key={index} className="space-y-2">
              <SkeletonLine className="h-3 w-20" />
              <SkeletonLine className="h-5 w-24" />
            </div>
          ))}
        </div>
      </GroupedSurface>
      {!detail ? (
        <div className="flex gap-3">
          <SkeletonLine className="h-10 w-80" />
          <SkeletonLine className="h-10 w-48" />
        </div>
      ) : null}
      <SkeletonLine className="h-5 w-36" />
      <TableSkeleton />
      {detail ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <TableSkeleton rows={3} />
          <TableSkeleton rows={3} />
        </div>
      ) : null}
      <span className="sr-only">
        {detail
          ? "Identitas, navigasi, dan posisi finansial proyek sedang disiapkan."
          : "Portfolio dan daftar proyek sedang disiapkan."}
      </span>
    </div>
  );
}
