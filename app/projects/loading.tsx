function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

export default function ProjectsLoading(): React.JSX.Element {
  return (
    <div
      className="space-y-lg pb-10 max-[430px]:space-y-5 max-[430px]:pb-8"
      aria-label="Memuat Proyek"
      role="status"
    >
      <div className="space-y-2 px-1">
        <SkeletonLine className="h-8 w-28" />
        <SkeletonLine className="h-3 w-64 bg-surface-container-low" />
      </div>

      <section className="rounded-[26px] bg-white/88 p-4 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-3xl max-[430px]:p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-surface-container" />
            <SkeletonLine className="h-2.5 w-28" />
          </div>
          <SkeletonLine className="h-7 w-24 bg-surface-container-low" />
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="space-y-2">
            <SkeletonLine className="h-7 w-10" />
            <SkeletonLine className="h-2.5 w-28 bg-surface-container-low" />
          </div>
          <div className="space-y-2 text-right">
            <SkeletonLine className="ml-auto h-2.5 w-24 bg-surface-container-low" />
            <SkeletonLine className="ml-auto h-5 w-28" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-black/5.5 rounded-[18px] bg-surface-container-low/65 px-3 py-3">
          <div className="space-y-2 pr-2">
            <SkeletonLine className="h-2 w-14" />
            <SkeletonLine className="h-3 w-16" />
          </div>
          <div className="space-y-2 px-2">
            <SkeletonLine className="mx-auto h-2 w-12" />
            <SkeletonLine className="mx-auto h-3 w-16" />
          </div>
          <div className="space-y-2 pl-2">
            <SkeletonLine className="ml-auto h-2 w-14" />
            <SkeletonLine className="ml-auto h-3 w-16" />
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
            className="rounded-[26px] bg-white/88 p-3.5 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-3xl"
          >
            <div className="flex gap-3">
              <div className="h-18.5 w-18.5 shrink-0 rounded-[20px] bg-surface-container" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonLine className="h-2.5 w-20 bg-surface-container-low" />
                <SkeletonLine className="h-4 w-full" />
                <SkeletonLine className="h-2.5 w-28 bg-surface-container-low" />
                <SkeletonLine className="h-2 w-36 bg-surface-container-low" />
              </div>
            </div>
            <div className="mt-3 border-t border-black/5.5 pt-3">
              <div className="flex justify-between">
                <SkeletonLine className="h-4 w-24" />
                <SkeletonLine className="h-3 w-20 bg-surface-container-low" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-[18px] bg-surface-container-low/65 px-3 py-3">
                <SkeletonLine className="h-4 w-20" />
                <SkeletonLine className="ml-auto h-4 w-20" />
              </div>
              <div className="mt-3 flex justify-between">
                <SkeletonLine className="h-2.5 w-32 bg-surface-container-low" />
                <SkeletonLine className="h-2.5 w-16" />
              </div>
            </div>
          </div>
        ))}
      </section>
      <span className="sr-only">Portfolio dan daftar proyek sedang disiapkan.</span>
    </div>
  );
}
