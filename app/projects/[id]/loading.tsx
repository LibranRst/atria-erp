function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

export default function ProjectDetailLoading(): React.JSX.Element {
  return (
    <div className="space-y-md pb-8" aria-label="Memuat detail proyek" role="status">
      <section className="relative aspect-square overflow-hidden rounded-[28px] bg-primary/90">
        <div className="absolute top-3 right-3 h-12 w-12 rounded-full bg-white/10" />
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
          <div className="flex justify-between gap-3">
            <SkeletonLine className="h-2.5 w-24 bg-white/15" />
            <SkeletonLine className="h-6 w-28 bg-white/15" />
          </div>
          <SkeletonLine className="h-6 w-4/5 bg-white/20" />
          <SkeletonLine className="h-3 w-3/5 bg-white/15" />
        </div>
      </section>

      <div className="space-y-2 rounded-[26px] bg-background/95 p-1">
        <div className="grid h-12 grid-cols-4 gap-1 rounded-full bg-surface-container-low p-1">
          {["overview", "planning", "operations", "finance"].map((item) => (
            <div key={item} className="rounded-full bg-white/70" />
          ))}
        </div>
      </div>

      <section className="rounded-[28px] bg-primary p-4">
        <SkeletonLine className="h-2.5 w-28 bg-white/15" />
        <SkeletonLine className="mt-2 h-8 w-48 bg-white/20" />
        <div className="mt-4 h-2 rounded-full bg-white/15" />
        <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-4">
          {["contract", "budget", "actual"].map((item) => (
            <div key={item} className="px-2 first:pl-0 last:pr-0">
              <SkeletonLine className="h-2 w-12 bg-white/15" />
              <SkeletonLine className="mt-2 h-3 w-16 bg-white/20" />
            </div>
          ))}
        </div>
      </section>

      {["readiness", "actions"].map((section) => (
        <section key={section} className="space-y-2.5">
          <SkeletonLine className="h-5 w-32" />
          <div className="overflow-hidden rounded-3xl bg-white px-4 shadow-surface">
            {["one", "two", "three"].map((row, index) => (
              <div
                key={row}
                className={`flex h-16 items-center gap-3 ${index > 0 ? "border-t border-outline-variant/20" : ""}`}
              >
                <div className="h-9 w-9 rounded-[13px] bg-surface-container-low" />
                <div className="flex-1 space-y-2">
                  <SkeletonLine className="h-3 w-3/5" />
                  <SkeletonLine className="h-2.5 w-4/5 bg-surface-container-low" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <span className="sr-only">
        Identitas, navigasi, dan posisi finansial proyek sedang disiapkan.
      </span>
    </div>
  );
}
