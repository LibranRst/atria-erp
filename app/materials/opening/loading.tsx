function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`bg-surface-container rounded-full ${className}`} aria-hidden="true" />;
}

export default function OpeningInventoryLoading(): React.JSX.Element {
  return (
    <div className="space-y-5 pb-8" aria-label="Memuat saldo awal stok" role="status">
      <header className="space-y-2 px-1">
        <SkeletonLine className="bg-surface-container-low h-2.5 w-20" />
        <SkeletonLine className="h-8 w-52" />
        <SkeletonLine className="bg-surface-container-low h-3 w-full max-w-72" />
      </header>

      <section className="space-y-2.5">
        <div className="space-y-1 px-1">
          <SkeletonLine className="h-2.5 w-28" />
          <SkeletonLine className="bg-surface-container-low h-2.5 w-64" />
        </div>
        <div className="divide-outline-variant/20 ring-outline-variant/15 divide-y overflow-hidden rounded-[24px] bg-white ring-1">
          {["w-36", "w-44", "w-32", "w-60"].map((width) => (
            <div key={width} className="space-y-2 px-4 py-3.5">
              <SkeletonLine className="bg-surface-container-low h-2.5 w-24" />
              <SkeletonLine className={`h-4 ${width}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="bg-surface-container-low h-2.5 w-12" />
        </div>
        <div className="divide-outline-variant/20 ring-outline-variant/15 divide-y overflow-hidden rounded-[24px] bg-white ring-1">
          {["w-48", "w-32", "w-36"].map((width) => (
            <div key={width} className="space-y-2 px-4 py-3.5">
              <SkeletonLine className="bg-surface-container-low h-2.5 w-24" />
              <SkeletonLine className={`h-4 ${width}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary rounded-[24px] p-4">
        <SkeletonLine className="h-2.5 w-20 bg-white/20" />
        <SkeletonLine className="mt-3 h-7 w-44 bg-white/35" />
        <SkeletonLine className="mt-3 h-2.5 w-full bg-white/15" />
      </section>
      <SkeletonLine className="bg-primary/20 h-12 w-full" />
      <span className="sr-only">Form saldo awal dan riwayat pengajuan sedang disiapkan.</span>
    </div>
  );
}
