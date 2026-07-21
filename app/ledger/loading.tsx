export default function LedgerLoading(): React.JSX.Element {
  return (
    <div className="space-y-lg pb-8" aria-label="Memuat Dashboard" role="status">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-full bg-surface-container" />
        <div className="h-4 w-32 rounded-full bg-surface-container-low" />
      </div>
      <div className="h-14 rounded-full bg-surface-container-low" />
      <div className="h-12 rounded-[20px] bg-surface-container-low" />
      <div className="h-67.5 rounded-[28px] bg-primary/90" />
      <div className="space-y-2 rounded-3xl bg-white p-3 ring-1 ring-outline-variant/10">
        <div className="h-5 w-36 rounded-full bg-surface-container" />
        <div className="h-12 border-t border-outline-variant/25 bg-surface-container-low/50" />
        <div className="h-12 border-t border-outline-variant/25 bg-surface-container-low/50" />
        <div className="h-12 border-t border-outline-variant/25 bg-surface-container-low/50" />
      </div>
      <span className="sr-only">Data finansial sedang disiapkan.</span>
    </div>
  );
}
