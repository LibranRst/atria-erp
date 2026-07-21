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
    <section className="rounded-[24px] bg-white p-4 shadow-[0_12px_30px_rgba(17,17,17,0.045)] ring-1 ring-black/2.5">
      <div className="flex items-start gap-3">
        <div className="bg-surface-container-low text-on-surface-variant flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]">
          <span className="material-symbols-outlined text-on-surface-variant/80 text-[20px]">
            lock
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-on-surface-variant text-[9px] font-bold tracking-[0.14em] uppercase">
            Belum tersedia
          </p>
          <h3 className="text-on-surface mt-0.5 text-[16px] leading-5 font-semibold">
            {tabLabel} masih terkunci
          </h3>
          <p className="text-on-surface-variant mt-1 text-xs leading-5">
            Budget internal harus disetujui sebelum data dan operasi pada bagian ini dapat
            digunakan.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="bg-primary text-on-primary mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-xs font-bold active:scale-[0.98]"
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
    <section className="rounded-[24px] bg-white p-4 shadow-[0_12px_30px_rgba(17,17,17,0.045)] ring-1 ring-black/2.5">
      <div className="flex items-start gap-3">
        <div className="bg-primary text-on-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]">
          <span className="material-symbols-outlined text-[20px]">architecture</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-primary text-[9px] font-bold tracking-[0.14em] uppercase">
            Urutan perencanaan
          </p>
          <h3 className="text-on-surface mt-0.5 text-[16px] leading-5 font-semibold">
            Selesaikan RAP sebelum membuat RAB
          </h3>
          <p className="text-on-surface-variant mt-1 text-xs leading-5">
            RAB mengambil item material dan paket kerja yang telah disiapkan secara client-safe dari
            RAP.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onGoToRap}
        className="bg-primary text-on-primary mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-xs font-bold active:scale-[0.98]"
      >
        Buka RAP
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </button>
    </section>
  );
}
