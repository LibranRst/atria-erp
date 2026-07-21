function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`bg-surface-container rounded-full ${className}`} aria-hidden="true" />;
}

export default function ExpensesLoading(): React.JSX.Element {
  return (
    <div
      className="space-y-lg px-1 pb-8 max-[430px]:-mx-1 max-[430px]:space-y-5 max-[430px]:pb-6"
      aria-label="Memuat Kas dan Tagihan"
      role="status"
    >
      <div className="space-y-2 px-1">
        <SkeletonLine className="h-8 w-44" />
        <SkeletonLine className="bg-surface-container-low h-3 w-52" />
      </div>

      <div className="bg-surface-container-low grid h-12 grid-cols-2 gap-1 rounded-full p-1">
        <div className="rounded-full bg-white shadow-sm" />
        <div className="rounded-full" />
      </div>

      <div className="flex min-h-[64px] items-center gap-3 rounded-[22px] bg-white/88 px-3 py-2.5 shadow-[0_12px_28px_rgba(17,17,17,0.05)] ring-1 ring-black/2.5">
        <div className="bg-surface-container h-9 w-9 shrink-0 rounded-[13px]" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine className="h-3 w-36" />
          <SkeletonLine className="bg-surface-container-low h-2.5 w-56" />
        </div>
        <div className="bg-surface-container-high/70 h-7 w-7 rounded-full" />
      </div>

      <section className="rounded-[26px] bg-white/88 p-4 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px] max-[430px]:p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-surface-container h-8 w-8 rounded-[12px]" />
            <SkeletonLine className="h-2.5 w-36" />
          </div>
          <SkeletonLine className="bg-surface-container-low h-7 w-20" />
        </div>
        <div className="mt-4 space-y-2">
          <SkeletonLine className="bg-surface-container-low h-2.5 w-20" />
          <SkeletonLine className="h-5 w-28" />
        </div>
        <div className="bg-surface-container-low/65 mt-4 grid grid-cols-2 divide-x divide-black/5.5 rounded-[18px] px-3 py-3">
          <div className="space-y-2 pr-3">
            <SkeletonLine className="h-2 w-16" />
            <SkeletonLine className="h-4 w-8" />
          </div>
          <div className="space-y-2 pl-3">
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="h-4 w-8" />
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-hidden">
        {[
          { id: "active", width: 82 },
          { id: "verification", width: 96 },
          { id: "approval", width: 82 },
          { id: "ready", width: 94 },
        ].map((item) => (
          <div
            key={item.id}
            className="bg-surface-container-low h-9 shrink-0 rounded-full"
            style={{ width: item.width }}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex h-10 items-center justify-between px-1">
          <SkeletonLine className="h-4 w-32" />
          <SkeletonLine className="bg-surface-container-low h-2.5 w-12" />
        </div>
        <div className="overflow-hidden rounded-[26px] bg-white/88 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px]">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex min-h-[94px] gap-3 border-t border-black/5.5 px-3 py-3 first:border-t-0"
            >
              <div className="bg-surface-container h-9 w-9 shrink-0 rounded-[13px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex justify-between gap-3">
                  <SkeletonLine className="h-2.5 w-24" />
                  <SkeletonLine className="bg-surface-container-low h-2.5 w-14" />
                </div>
                <SkeletonLine className="h-3.5 w-48" />
                <SkeletonLine className="bg-surface-container-low h-2.5 w-full" />
                <SkeletonLine className="bg-surface-container-low h-2.5 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Data pengeluaran dan tagihan sedang disiapkan.</span>
    </div>
  );
}
