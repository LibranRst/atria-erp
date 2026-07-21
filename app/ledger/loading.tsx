export default function LedgerLoading(): React.JSX.Element {
  return (
    <div className="space-y-lg pb-8" aria-label="Memuat Dashboard" role="status">
      <div className="space-y-2">
        <div className="bg-surface-container h-8 w-40 rounded-full" />
        <div className="bg-surface-container-low h-4 w-32 rounded-full" />
      </div>
      <div className="bg-surface-container-low h-14 rounded-full" />
      <div className="bg-surface-container-low h-12 rounded-[20px]" />
      <div className="bg-primary/90 h-[270px] rounded-[28px]" />
      <div className="ring-outline-variant/10 space-y-2 rounded-[24px] bg-white p-3 ring-1">
        <div className="bg-surface-container h-5 w-36 rounded-full" />
        <div className="border-outline-variant/25 bg-surface-container-low/50 h-12 border-t" />
        <div className="border-outline-variant/25 bg-surface-container-low/50 h-12 border-t" />
        <div className="border-outline-variant/25 bg-surface-container-low/50 h-12 border-t" />
      </div>
      <span className="sr-only">Data finansial sedang disiapkan.</span>
    </div>
  );
}
