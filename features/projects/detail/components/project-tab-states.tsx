"use client";

interface LockedTabStateProps {
  readonly tabLabel: string;
  readonly actionLabel: string;
  readonly actionIcon: string;
  readonly onAction: () => void;
}

export function LockedTabState({
  tabLabel,
  actionLabel,
  actionIcon,
  onAction,
}: LockedTabStateProps): React.JSX.Element {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-[0_12px_30px_rgba(17,17,17,0.045)] ring-1 ring-black/2.5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-low text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant/80">
            lock
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold tracking-[0.14em] text-on-surface-variant uppercase">
            Belum tersedia
          </p>
          <h3 className="mt-0.5 text-[16px] leading-5 font-semibold text-on-surface">
            {tabLabel} masih terkunci
          </h3>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Budget internal harus disetujui sebelum data dan operasi pada bagian ini dapat
            digunakan.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-[16px]">{actionIcon}</span>
        <span>{actionLabel}</span>
      </button>
    </section>
  );
}

interface RabPrerequisiteStateProps {
  readonly onGoToRap: () => void;
}

export function RabPrerequisiteState({ onGoToRap }: RabPrerequisiteStateProps): React.JSX.Element {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-[0_12px_30px_rgba(17,17,17,0.045)] ring-1 ring-black/2.5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary text-on-primary">
          <span className="material-symbols-outlined text-[20px]">architecture</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold tracking-[0.14em] text-primary uppercase">
            Urutan perencanaan
          </p>
          <h3 className="mt-0.5 text-[16px] leading-5 font-semibold text-on-surface">
            Selesaikan RAP sebelum membuat RAB
          </h3>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            RAB mengambil item material dan paket kerja yang telah disiapkan secara client-safe dari
            RAP.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onGoToRap}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary active:scale-[0.98]"
      >
        Buka RAP
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </button>
    </section>
  );
}
