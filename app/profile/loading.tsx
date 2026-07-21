function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`bg-surface-container rounded-full ${className}`} aria-hidden="true" />;
}

function ProfileRowSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-[68px] items-center gap-3 px-3.5 py-3">
      <div className="bg-surface-container h-9 w-9 shrink-0 rounded-[13px]" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine className="h-3 w-32" />
        <SkeletonLine className="bg-surface-container-low h-2.5 w-full" />
      </div>
      <SkeletonLine className="bg-surface-container-low h-3 w-14" />
    </div>
  );
}

export default function ProfileLoading(): React.JSX.Element {
  return (
    <div
      className="space-y-5 pb-8 max-[430px]:-mx-1 max-[430px]:space-y-4 max-[430px]:pb-6"
      aria-label="Memuat profil"
      role="status"
    >
      <div className="space-y-2">
        <SkeletonLine className="bg-surface-container-low h-2.5 w-14" />
        <SkeletonLine className="h-7 w-32" />
        <SkeletonLine className="bg-surface-container-low h-3 w-64" />
      </div>

      <section className="rounded-[28px] bg-white/90 p-4 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px] max-[430px]:p-3.5">
        <div className="flex items-start gap-3.5">
          <div
            className="bg-surface-container h-16 w-16 shrink-0 rounded-full max-[430px]:h-14 max-[430px]:w-14"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 space-y-2.5 pt-1">
            <SkeletonLine className="bg-surface-container-low h-5 w-20" />
            <SkeletonLine className="h-5 w-40" />
            <SkeletonLine className="bg-surface-container-low h-3 w-full" />
          </div>
        </div>
        <div className="mt-4 border-t border-black/5.5 pt-3.5">
          <SkeletonLine className="bg-surface-container-low h-2.5 w-20" />
          <SkeletonLine className="mt-2 h-4 w-36" />
        </div>
      </section>

      <section className="space-y-2">
        <SkeletonLine className="h-4 w-28" />
        <div className="divide-y divide-black/5.5 overflow-hidden rounded-[26px] bg-white/90 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px]">
          {[0, 1, 2].map((row) => (
            <ProfileRowSkeleton key={row} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="bg-surface-container-low h-2.5 w-20" />
        </div>
        <div className="divide-y divide-black/5.5 overflow-hidden rounded-[26px] bg-white/90 shadow-[0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px]">
          {[0, 1, 2, 3].map((row) => (
            <ProfileRowSkeleton key={row} />
          ))}
        </div>
      </section>

      <span className="sr-only">Identitas akun dan hak akses sedang disiapkan.</span>
    </div>
  );
}
