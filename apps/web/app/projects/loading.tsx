function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

export default function ProjectsLoading(): React.JSX.Element {
  return (
    <div className="space-y-sm pb-10 max-[430px]:pb-8" aria-label="Memuat Proyek" role="status">
      <div className="space-y-2 px-1">
        <SkeletonLine className="h-8 w-28" />
        <SkeletonLine className="h-3 w-64 bg-surface-container-low" />
      </div>

      <section className="rounded-[26px] bg-white/88 p-2 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl max-[430px]:p-3.5">
        <div className="flex items-center justify-between gap-3 p-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-surface-container" />
            <SkeletonLine className="h-2.5 w-28" />
          </div>
          <SkeletonLine className="h-7 w-24 bg-surface-container-low" />
        </div>
        <div className="mt-1 rounded-2xl bg-surface-container-low">
          <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
            <div className="space-y-2">
              <SkeletonLine className="h-8 w-12" />
              <SkeletonLine className="h-2.5 w-28 bg-surface-container-low" />
            </div>
            <div className="space-y-2 text-right">
              <SkeletonLine className="ml-auto h-2.5 w-24 bg-surface-container-low" />
              <SkeletonLine className="ml-auto h-5 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 p-2">
            <div className="h-12 rounded-xl bg-surface-container-lowest" />
            <div className="h-12 rounded-xl bg-surface-container-lowest" />
            <div className="h-12 rounded-xl bg-surface-container-lowest" />
          </div>
        </div>
      </section>

      <div className="space-y-2">
        <div className="h-12 rounded-full bg-surface-container-low" />
        <div className="flex h-12 gap-1 overflow-hidden rounded-full bg-surface-container-low p-1">
          {[78, 66, 72, 82].map((width) => (
            <div
              key={width}
              className="h-full shrink-0 rounded-full bg-white/70"
              style={{ width }}
            />
          ))}
        </div>
      </div>

      <section className="space-y-2.5">
        <div className="flex h-10 items-center justify-between px-1">
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="h-2.5 w-14 bg-surface-container-low" />
        </div>
        {["first", "second"].map((id) => (
          <div
            key={id}
            className="rounded-[26px] bg-white/88 p-1.5 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl"
          >
            <div className="aspect-4/3 rounded-[22px] bg-surface-container" />
            <div className="px-2.5 pt-3 pb-1.5">
              <SkeletonLine className="h-2.5 w-44 bg-surface-container-low" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <SkeletonLine className="h-2.5 w-14 bg-surface-container-low" />
                  <SkeletonLine className="h-5 w-24" />
                  <SkeletonLine className="h-2.5 w-28 bg-surface-container-low" />
                </div>
                <div className="space-y-1.5">
                  <SkeletonLine className="h-2.5 w-20 bg-surface-container-low" />
                  <SkeletonLine className="h-5 w-24" />
                  <SkeletonLine className="h-2.5 w-28 bg-surface-container-low" />
                </div>
              </div>
              <div className="mt-3.5 flex items-end justify-between gap-3">
                <div className="space-y-1.5">
                  <SkeletonLine className="h-2.5 w-20 bg-surface-container-low" />
                  <SkeletonLine className="h-6 w-32" />
                  <SkeletonLine className="h-2.5 w-28 bg-surface-container-low" />
                </div>
                <div className="space-y-1.5 pb-1">
                  <SkeletonLine className="ml-auto h-2.5 w-20 bg-surface-container-low" />
                  <SkeletonLine className="ml-auto h-3 w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
      <span className="sr-only">Portfolio dan daftar proyek sedang disiapkan.</span>
    </div>
  );
}
