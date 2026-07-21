function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`bg-surface-container rounded-full ${className}`} aria-hidden="true" />;
}

export default function MaterialsLoading(): React.JSX.Element {
  return (
    <div
      className="space-y-lg pb-8 max-[430px]:-mx-1 max-[430px]:space-y-5 max-[430px]:pb-6"
      aria-label="Memuat Material dan Stok"
      role="status"
    >
      <div className="space-y-2 px-1">
        <SkeletonLine className="bg-surface-container-low h-2.5 w-24" />
        <SkeletonLine className="h-8 w-44" />
        <SkeletonLine className="bg-surface-container-low h-3 w-64" />
      </div>

      <div className="bg-surface-container-low flex h-12 gap-1 overflow-hidden rounded-full p-1">
        {[104, 96, 104, 96].map((width, index) => (
          <div
            key={`${width}-${index}`}
            className={`h-full shrink-0 rounded-full ${index === 0 ? "bg-white shadow-sm" : "bg-transparent"}`}
            style={{ width }}
          />
        ))}
      </div>

      <section className="bg-primary rounded-[30px] px-5 py-5 max-[430px]:rounded-[26px] max-[430px]:px-4 max-[430px]:py-4">
        <SkeletonLine className="h-2 w-20 bg-white/20" />
        <SkeletonLine className="mt-3 h-7 w-48 bg-white/35" />
        <div className="mt-5 rounded-[22px] bg-white/7.5 p-3.5 ring-1 ring-white/6">
          <div className="flex justify-between gap-4">
            <div className="space-y-2">
              <SkeletonLine className="h-2 w-20 bg-white/15" />
              <SkeletonLine className="h-4 w-24 bg-white/25" />
            </div>
            <div className="space-y-2">
              <SkeletonLine className="ml-auto h-2 w-16 bg-white/15" />
              <SkeletonLine className="ml-auto h-4 w-20 bg-white/25" />
            </div>
          </div>
          <SkeletonLine className="mt-4 h-2 w-full bg-white/15" />
          <div className="mt-3 flex justify-between">
            <SkeletonLine className="h-2 w-24 bg-white/15" />
            <SkeletonLine className="h-2 w-20 bg-white/15" />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex h-10 items-center justify-between px-1">
          <SkeletonLine className="h-4 w-32" />
          <SkeletonLine className="bg-surface-container-low h-2.5 w-16" />
        </div>
        <div className="overflow-hidden rounded-[26px] bg-white/90 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px]">
          {[0, 1].map((row) => (
            <div
              key={row}
              className="flex min-h-[72px] items-center gap-3 border-t border-black/5.5 px-4 py-3 first:border-t-0"
            >
              <div className="bg-surface-container h-9 w-9 shrink-0 rounded-[13px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonLine className="h-3 w-44" />
                <SkeletonLine className="bg-surface-container-low h-2.5 w-full" />
              </div>
              <SkeletonLine className="h-4 w-6" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex h-10 items-center justify-between px-1">
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="bg-surface-container-low h-7 w-20" />
        </div>
        <div className="overflow-hidden rounded-[26px] bg-white/90 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px]">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex min-h-[64px] items-center gap-3 border-t border-black/5.5 px-4 py-3 first:border-t-0"
            >
              <div className="bg-surface-container h-9 w-9 shrink-0 rounded-[13px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonLine className="h-3 w-36" />
                <SkeletonLine className="bg-surface-container-low h-2.5 w-full" />
              </div>
              <SkeletonLine className="h-3 w-16" />
            </div>
          ))}
        </div>
      </section>
      <span className="sr-only">Posisi stok dan aktivitas material sedang disiapkan.</span>
    </div>
  );
}
