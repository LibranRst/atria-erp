function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`bg-surface-container rounded-full ${className}`} aria-hidden="true" />;
}

export default function ApprovalsLoading(): React.JSX.Element {
  return (
    <div
      className="space-y-lg px-1 pb-8 max-[430px]:-mx-1 max-[430px]:space-y-5 max-[430px]:pb-6"
      aria-label="Memuat persetujuan"
      role="status"
    >
      <div className="space-y-2 px-1">
        <SkeletonLine className="h-8 w-40" />
        <SkeletonLine className="bg-surface-container-low h-3 w-64" />
      </div>

      <section className="rounded-[26px] bg-white/88 p-4 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px] max-[430px]:p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-surface-container h-8 w-8 rounded-[12px]" />
            <SkeletonLine className="h-2.5 w-32" />
          </div>
          <SkeletonLine className="bg-surface-container-low h-7 w-20" />
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="space-y-2">
            <SkeletonLine className="h-7 w-10" />
            <SkeletonLine className="bg-surface-container-low h-2.5 w-44" />
          </div>
          <div className="space-y-2 text-right">
            <SkeletonLine className="bg-surface-container-low ml-auto h-2 w-16" />
            <SkeletonLine className="ml-auto h-4 w-24" />
          </div>
        </div>
        <div className="bg-surface-container-low/65 mt-4 grid grid-cols-2 divide-x divide-black/5.5 rounded-[18px] px-3 py-3">
          <div className="space-y-2 pr-3">
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="h-3 w-8" />
          </div>
          <div className="space-y-2 pl-3">
            <SkeletonLine className="ml-auto h-2 w-24" />
            <SkeletonLine className="ml-auto h-3 w-28" />
          </div>
        </div>
      </section>

      <div className="space-y-2">
        <div className="h-12 rounded-full bg-white/88 ring-1 ring-black/2.5" />
        <div className="bg-surface-container-low flex gap-1 overflow-hidden rounded-full p-1">
          {[84, 96, 82, 76].map((width) => (
            <div key={width} className="h-10 shrink-0 rounded-full bg-white/70" style={{ width }} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex h-10 items-center justify-between px-1">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="bg-surface-container-low h-2.5 w-14" />
        </div>
        <div className="overflow-hidden rounded-[26px] bg-white/88 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px]">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex min-h-[94px] gap-3 border-t border-black/5.5 px-4 py-3 first:border-t-0"
            >
              <div className="bg-surface-container h-9 w-9 shrink-0 rounded-[13px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex justify-between gap-3">
                  <SkeletonLine className="h-4 w-24" />
                  <SkeletonLine className="bg-surface-container-low h-2.5 w-20" />
                </div>
                <SkeletonLine className="h-3 w-48" />
                <SkeletonLine className="bg-surface-container-low h-2.5 w-full" />
                <SkeletonLine className="bg-surface-container-low h-2.5 w-36" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Antrean persetujuan sedang disiapkan.</span>
    </div>
  );
}
