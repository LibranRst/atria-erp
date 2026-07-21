export default function OwnerOnboardingLoading(): React.JSX.Element {
  return (
    <section className="w-full space-y-5 px-1 pb-6" aria-label="Memuat onboarding Owner">
      <div className="bg-surface-container-high mx-auto h-1.5 w-12 rounded-full" />
      <div className="space-y-2 px-1">
        <div className="bg-surface-container-high h-3 w-28 rounded-full" />
        <div className="bg-surface-container-high h-8 w-56 rounded-full" />
        <div className="bg-surface-container-high h-4 w-full rounded-full" />
      </div>
      <div className="overflow-hidden rounded-[28px] bg-white ring-1 ring-black/4">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex min-h-[72px] items-center gap-3 border-b border-black/5.5 px-4 last:border-b-0"
          >
            <div className="bg-surface-container-high h-10 w-10 rounded-[14px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="bg-surface-container-high h-3 w-2/3 rounded-full" />
              <div className="bg-surface-container-low h-2.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-primary/15 h-12 w-full rounded-full" />
    </section>
  );
}
