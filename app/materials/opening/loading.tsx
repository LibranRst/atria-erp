function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

export default function OpeningInventoryLoading(): React.JSX.Element {
  return (
    <div className="space-y-5 pb-8" aria-label="Memuat saldo awal stok" role="status">
      <header className="space-y-2 px-1">
        <SkeletonLine className="h-2.5 w-20 bg-surface-container-low" />
        <SkeletonLine className="h-8 w-52" />
        <SkeletonLine className="h-3 w-full max-w-72 bg-surface-container-low" />
      </header>

      <section className="space-y-2.5">
        <div className="space-y-1 px-1">
          <SkeletonLine className="h-2.5 w-28" />
          <SkeletonLine className="h-2.5 w-64 bg-surface-container-low" />
        </div>
        <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-white ring-1 ring-ring-subtle">
          {["w-36", "w-44", "w-32", "w-60"].map((width) => (
            <div key={width} className="space-y-2 px-4 py-3.5">
              <SkeletonLine className="h-2.5 w-24 bg-surface-container-low" />
              <SkeletonLine className={`h-4 ${width}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="h-2.5 w-12 bg-surface-container-low" />
        </div>
        <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-white ring-1 ring-ring-subtle">
          {["w-48", "w-32", "w-36"].map((width) => (
            <div key={width} className="space-y-2 px-4 py-3.5">
              <SkeletonLine className="h-2.5 w-24 bg-surface-container-low" />
              <SkeletonLine className={`h-4 ${width}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-primary p-4">
        <SkeletonLine className="h-2.5 w-20 bg-white/20" />
        <SkeletonLine className="mt-3 h-7 w-44 bg-white/35" />
        <SkeletonLine className="mt-3 h-2.5 w-full bg-white/15" />
      </section>
      <SkeletonLine className="h-12 w-full bg-primary/20" />
      <span className="sr-only">Form saldo awal dan riwayat pengajuan sedang disiapkan.</span>
    </div>
  );
}
