function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

export default function SettingsLoading(): React.JSX.Element {
  return (
    <div
      className="space-y-sm pb-8 max-[430px]:-mx-1 max-[430px]:pb-6"
      aria-label="Memuat Pengaturan ERP"
      role="status"
    >
      <div className="space-y-2">
        <SkeletonLine className="h-2.5 w-24 bg-surface-container-low" />
        <SkeletonLine className="h-7 w-44" />
        <SkeletonLine className="h-3 w-64 bg-surface-container-low" />
      </div>
      <div className="flex h-12 gap-1 overflow-hidden rounded-full bg-surface-container-low p-1">
        {[96, 82, 88, 82].map((width, index) => (
          <div
            key={`${width}-${index}`}
            className={`h-full shrink-0 rounded-full ${index === 0 ? "bg-white shadow-control" : ""}`}
            style={{ width }}
          />
        ))}
      </div>
      <div className="space-y-2">
        <SkeletonLine className="h-2 w-24 bg-surface-container-low" />
        <SkeletonLine className="h-5 w-40" />
        <SkeletonLine className="h-3 w-60 bg-surface-container-low" />
      </div>
      <section className="rounded-[30px] bg-surface-inverse p-5 shadow-inverse max-[430px]:rounded-[26px] max-[430px]:p-4">
        <SkeletonLine className="h-2 w-24 bg-white/15" />
        <SkeletonLine className="mt-3 h-7 w-20 bg-white/30" />
        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-white/10 py-4">
          <div className="space-y-2">
            <SkeletonLine className="h-2 w-20 bg-white/15" />
            <SkeletonLine className="h-4 w-16 bg-white/25" />
          </div>
          <div className="space-y-2">
            <SkeletonLine className="ml-auto h-2 w-20 bg-white/15" />
            <SkeletonLine className="ml-auto h-4 w-16 bg-white/25" />
          </div>
        </div>
        <div className="mt-4 h-20 rounded-inset bg-white/[0.07]" />
      </section>
      <section className="space-y-2">
        <SkeletonLine className="h-4 w-36" />
        <div className="overflow-hidden rounded-[26px] bg-white/90 shadow-surface ring-1 ring-ring-subtle">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex min-h-20.5 items-center gap-3 border-t border-black/5.5 px-3.5 first:border-t-0"
            >
              <div className="h-9 w-9 rounded-[13px] bg-surface-container" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonLine className="h-3 w-40" />
                <SkeletonLine className="h-2.5 w-full bg-surface-container-low" />
              </div>
              <div className="h-9 w-9 rounded-full bg-surface-container-low" />
            </div>
          ))}
        </div>
      </section>
      <span className="sr-only">Default finansial dan master data sedang disiapkan.</span>
    </div>
  );
}
