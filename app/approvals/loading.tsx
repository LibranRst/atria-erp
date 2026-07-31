function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

export default function ApprovalsLoading(): React.JSX.Element {
  return (
    <div
      className="space-y-sm px-1 pb-8 max-[430px]:-mx-1 max-[430px]:pb-6"
      aria-label="Memuat persetujuan"
      role="status"
    >
      <div className="space-y-2 px-1">
        <SkeletonLine className="h-8 w-40" />
        <SkeletonLine className="h-3 w-64 bg-surface-container-low" />
      </div>

      <section className="rounded-[26px] bg-white/88 p-2 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl max-[430px]:p-3.5">
        <div className="flex items-center justify-between gap-3 p-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-surface-container" />
            <SkeletonLine className="h-2.5 w-32" />
          </div>
          <SkeletonLine className="h-7 w-20 bg-surface-container-low" />
        </div>
        <div className="mt-1 rounded-2xl bg-surface-container-low">
          <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
            <div className="space-y-2">
              <SkeletonLine className="h-8 w-12" />
              <SkeletonLine className="h-2.5 w-44 bg-surface-container-low" />
            </div>
            <div className="space-y-2 text-right">
              <SkeletonLine className="ml-auto h-2.5 w-20 bg-surface-container-low" />
              <SkeletonLine className="ml-auto h-5 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2">
            <div className="h-12 rounded-xl bg-surface-container-lowest" />
            <div className="h-12 rounded-xl bg-surface-container-lowest" />
          </div>
        </div>
      </section>

      <div className="space-y-2">
        <div className="h-12 rounded-full bg-white/88 ring-1 ring-ring-subtle" />
        <div className="flex gap-1 overflow-hidden rounded-full bg-surface-container-low p-1">
          {[84, 96, 82, 76].map((width) => (
            <div key={width} className="h-10 shrink-0 rounded-full bg-white/70" style={{ width }} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex h-10 items-center justify-between px-1">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-2.5 w-14 bg-surface-container-low" />
        </div>
        <div className="overflow-hidden rounded-[26px] bg-white/88 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex min-h-23.5 gap-3 border-t border-black/5.5 px-4 py-3 first:border-t-0"
            >
              <div className="h-9 w-9 shrink-0 rounded-[13px] bg-surface-container" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex justify-between gap-3">
                  <SkeletonLine className="h-4 w-24" />
                  <SkeletonLine className="h-2.5 w-20 bg-surface-container-low" />
                </div>
                <SkeletonLine className="h-3 w-48" />
                <SkeletonLine className="h-2.5 w-full bg-surface-container-low" />
                <SkeletonLine className="h-2.5 w-36 bg-surface-container-low" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Antrean persetujuan sedang disiapkan.</span>
    </div>
  );
}
