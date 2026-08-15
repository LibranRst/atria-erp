export default function LedgerLoading(): React.JSX.Element {
  return (
    <div className="dashboard-density space-y-sm pb-8" aria-label="Memuat Dashboard" role="status">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-full bg-surface-container" />
        <div className="h-4 w-32 rounded-full bg-surface-container-low" />
      </div>
      <div className="h-12 rounded-full bg-surface-container-low" />
      <div className="h-67.5 rounded-owner bg-surface-inverse shadow-inverse" />
      <div className="space-y-3">
        <div className="h-5 w-36 rounded-full bg-surface-container" />
        <div className="rounded-owner bg-white p-3 ring-1 ring-ring-subtle">
          <div className="flex min-h-16 items-center gap-3 border-b border-outline-variant/25 px-2">
            <div className="h-10 w-10 rounded-icon bg-surface-container-low" />
            <div className="h-4 flex-1 rounded-full bg-surface-container-low" />
          </div>
          <div className="flex min-h-16 items-center gap-3 border-b border-outline-variant/25 px-2">
            <div className="h-10 w-10 rounded-icon bg-surface-container-low" />
            <div className="h-4 flex-1 rounded-full bg-surface-container-low" />
          </div>
          <div className="flex min-h-16 items-center gap-3 px-2">
            <div className="h-10 w-10 rounded-icon bg-surface-container-low" />
            <div className="h-4 flex-1 rounded-full bg-surface-container-low" />
          </div>
        </div>
      </div>
      <span className="sr-only">Data finansial sedang disiapkan.</span>
    </div>
  );
}
