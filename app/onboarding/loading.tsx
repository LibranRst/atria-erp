export default function OwnerOnboardingLoading(): React.JSX.Element {
  return (
    <section className="w-full space-y-5 px-1 pb-6" aria-label="Memuat onboarding Owner">
      <div className="mx-auto h-1.5 w-12 rounded-full bg-surface-container-high" />
      <div className="space-y-2 px-1">
        <div className="h-3 w-28 rounded-full bg-surface-container-high" />
        <div className="h-8 w-56 rounded-full bg-surface-container-high" />
        <div className="h-4 w-full rounded-full bg-surface-container-high" />
      </div>
      <div className="overflow-hidden rounded-[28px] bg-white ring-1 ring-black/[0.04]">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex min-h-[72px] items-center gap-3 border-b border-black/[0.055] px-4 last:border-b-0">
            <div className="h-10 w-10 rounded-[14px] bg-surface-container-high" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded-full bg-surface-container-high" />
              <div className="h-2.5 w-full rounded-full bg-surface-container-low" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-12 w-full rounded-full bg-primary/15" />
    </section>
  );
}

