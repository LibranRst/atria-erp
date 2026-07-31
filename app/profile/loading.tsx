function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

function ProfileRowSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-17 items-center gap-3 px-3.5 py-3">
      <div className="h-9 w-9 shrink-0 rounded-[13px] bg-surface-container" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine className="h-3 w-32" />
        <SkeletonLine className="h-2.5 w-full bg-surface-container-low" />
      </div>
      <SkeletonLine className="h-3 w-14 bg-surface-container-low" />
    </div>
  );
}

export default function ProfileLoading(): React.JSX.Element {
  return (
    <div
      className="space-y-sm pb-8 max-[430px]:-mx-1 max-[430px]:pb-6"
      aria-label="Memuat profil"
      role="status"
    >
      <div className="space-y-2">
        <SkeletonLine className="h-2.5 w-14 bg-surface-container-low" />
        <SkeletonLine className="h-7 w-32" />
        <SkeletonLine className="h-3 w-64 bg-surface-container-low" />
      </div>

      <section className="rounded-[28px] bg-white/90 p-4 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl max-[430px]:p-3.5">
        <div className="flex items-start gap-3.5">
          <div
            className="h-16 w-16 shrink-0 rounded-full bg-surface-container max-[430px]:h-14 max-[430px]:w-14"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 space-y-2.5 pt-1">
            <SkeletonLine className="h-5 w-20 bg-surface-container-low" />
            <SkeletonLine className="h-5 w-40" />
            <SkeletonLine className="h-3 w-full bg-surface-container-low" />
          </div>
        </div>
        <div className="mt-4 border-t border-black/5.5 pt-3.5">
          <SkeletonLine className="h-2.5 w-20 bg-surface-container-low" />
          <SkeletonLine className="mt-2 h-4 w-36" />
        </div>
      </section>

      <section className="space-y-2">
        <SkeletonLine className="h-4 w-28" />
        <div className="divide-y divide-black/5.5 overflow-hidden rounded-[26px] bg-white/90 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl">
          {[0, 1, 2].map((row) => (
            <ProfileRowSkeleton key={row} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-2.5 w-20 bg-surface-container-low" />
        </div>
        <div className="divide-y divide-black/5.5 overflow-hidden rounded-[26px] bg-white/90 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl">
          {[0, 1, 2, 3].map((row) => (
            <ProfileRowSkeleton key={row} />
          ))}
        </div>
      </section>

      <span className="sr-only">Identitas akun dan hak akses sedang disiapkan.</span>
    </div>
  );
}
