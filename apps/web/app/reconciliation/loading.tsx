function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

function ReconciliationRowSkeleton({
  card = false,
}: {
  readonly card?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={`min-h-25 px-4 py-3.5 ${card ? "rounded-[26px] bg-white shadow-surface ring-1 ring-ring-subtle" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine className="h-3 w-40" />
          <SkeletonLine className="h-2.5 w-32 bg-surface-container-low" />
        </div>
        <div className="h-7 w-7 rounded-full bg-surface-container-high/70" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-2.5">
        <SkeletonLine className="h-2.5 w-24 bg-surface-container-low" />
        <SkeletonLine className="h-3.5 w-24" />
      </div>
    </div>
  );
}

export default function ReconciliationLoading(): React.JSX.Element {
  return (
    <div className="space-y-sm pb-8" aria-label="Memuat rekonsiliasi" role="status">
      <div className="space-y-2">
        <SkeletonLine className="h-8 w-40" />
        <SkeletonLine className="h-3 w-58 bg-surface-container-low" />
      </div>

      <section className="rounded-[26px] bg-white/88 p-2 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl max-[430px]:p-3.5">
        <div className="flex items-center justify-between gap-3 p-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-surface-container" />
            <SkeletonLine className="h-2.5 w-32" />
          </div>
          <SkeletonLine className="h-7 w-22 bg-surface-container-low" />
        </div>
        <div className="mt-1 rounded-2xl bg-surface-container-low">
          <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
            <div className="space-y-2">
              <SkeletonLine className="h-8 w-10" />
              <SkeletonLine className="h-2.5 w-40 bg-surface-container-low" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2">
            <div className="h-12 rounded-xl bg-surface-container-lowest" />
            <div className="h-12 rounded-xl bg-surface-container-lowest" />
          </div>
        </div>
      </section>

      <div className="grid h-12 grid-cols-3 gap-1 rounded-full bg-surface-container-low p-1">
        <div className="rounded-full bg-white shadow-control" />
        <div className="rounded-full" />
        <div className="rounded-full" />
      </div>

      <section className="space-y-2">
        <div className="flex min-h-11 items-center justify-between px-1">
          <div className="space-y-2">
            <SkeletonLine className="h-4 w-24" />
            <SkeletonLine className="h-2.5 w-48 bg-surface-container-low" />
          </div>
        </div>
        <div className="space-y-3">
          <ReconciliationRowSkeleton card />
          <ReconciliationRowSkeleton card />
          <div className="space-y-2">
            <SkeletonLine className="ml-1 h-2.5 w-28 bg-surface-container-low" />
            <div className="overflow-hidden rounded-[26px] bg-white/88 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl">
              <ReconciliationRowSkeleton />
            </div>
          </div>
        </div>
      </section>

      <span className="sr-only">Antrean rekonsiliasi sedang disiapkan.</span>
    </div>
  );
}
