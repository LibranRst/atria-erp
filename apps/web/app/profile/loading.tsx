import { ProfileWorkspaceLayout } from "@/features/profile/components/views/profile-workspace-layout";

function SkeletonLine({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} aria-hidden="true" />;
}

function ProfileRowSkeleton(): React.JSX.Element {
  return (
    <div data-profile-skeleton-row className="flex min-h-17 items-center gap-3 px-3.5 py-3">
      <div className="h-9 w-9 shrink-0 rounded-[13px] bg-surface-container" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine className="h-3 w-32" />
        <SkeletonLine className="h-2.5 w-full bg-surface-container-low" />
      </div>
      <SkeletonLine className="h-3 w-14 bg-surface-container-low" />
    </div>
  );
}

/** Baris hak akses lebih tinggi dan berakhir dengan label status, bukan teks. */
function AccessRowSkeleton(): React.JSX.Element {
  return (
    <div data-profile-skeleton-row className="flex min-h-18 items-center gap-3 px-3.5 py-3">
      <div className="h-10 w-10 shrink-0 rounded-[14px] bg-surface-container" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine className="h-3 w-36" />
        <SkeletonLine className="h-2.5 w-28 bg-surface-container-low" />
      </div>
      <SkeletonLine className="h-6 w-16 bg-surface-container-low" />
    </div>
  );
}

export default function ProfileLoading(): React.JSX.Element {
  return (
    <ProfileWorkspaceLayout>
      <header className="space-y-2" aria-label="Memuat profil" role="status">
        <SkeletonLine className="h-2.5 w-14 bg-surface-container-low" />
        <SkeletonLine className="h-7 w-32" />
        <SkeletonLine className="h-3 w-64 bg-surface-container-low" />
      </header>

      <section
        data-profile-section="identity"
        className="rounded-owner bg-white/90 p-4 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl max-[430px]:p-3.5"
      >
        <div data-profile-skeleton-identity className="flex items-start gap-3.5">
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

      <div data-profile-column="details">
        <section data-profile-section="account" className="space-y-2">
          <SkeletonLine className="h-4 w-28" />
          <div className="divide-y divide-black/5.5 overflow-hidden rounded-[26px] bg-white/90 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl">
            {[0, 1, 2].map((row) => (
              <ProfileRowSkeleton key={row} />
            ))}
          </div>
        </section>

        <section data-profile-section="access" className="space-y-2">
          <div className="flex items-center justify-between">
            <SkeletonLine className="h-4 w-24" />
            <SkeletonLine className="h-2.5 w-20 bg-surface-container-low" />
          </div>
          <div className="divide-y divide-black/5.5 overflow-hidden rounded-[26px] bg-white/90 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl">
            {[0, 1, 2, 3].map((row) => (
              <AccessRowSkeleton key={row} />
            ))}
          </div>
        </section>

        <section data-profile-section="notifications" className="space-y-2">
          <SkeletonLine className="h-4 w-40" />
          <div className="overflow-hidden rounded-owner bg-white shadow-surface">
            <ProfileRowSkeleton />
            <div data-profile-mobile-only>
              <ProfileRowSkeleton />
            </div>
          </div>
        </section>
      </div>
      <section data-profile-section="session" className="space-y-2">
        <SkeletonLine className="h-4 w-12" />
        <div className="overflow-hidden rounded-owner bg-white shadow-surface">
          <ProfileRowSkeleton />
        </div>
      </section>
      <span className="sr-only">Identitas akun dan hak akses sedang disiapkan.</span>
    </ProfileWorkspaceLayout>
  );
}
