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
    <div className="rounded-[28px] border border-outline-variant/20 bg-white px-6 py-14 text-center shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-surface-container-low text-on-surface-variant shadow-sm">
        <span className="material-symbols-outlined text-[36px] text-on-surface-variant/80">
          lock
        </span>
      </div>
      <h3 className="text-lg font-semibold leading-6 text-on-surface">
        Fitur {tabLabel} Terkunci
      </h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-on-surface-variant">
        Proyek ini belum memiliki RAB yang disetujui oleh klien. Susun RAP
        internal dulu, lalu generate dan approve RAB dari source RAP tersebut.
      </p>
      <button
        onClick={onAction}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary active:scale-95"
      >
        <span className="material-symbols-outlined text-[16px]">
          {actionIcon}
        </span>
        <span>{actionLabel}</span>
      </button>
    </div>
  );
}

interface RabPrerequisiteStateProps {
  readonly onGoToRap: () => void;
}

export function RabPrerequisiteState({
  onGoToRap,
}: RabPrerequisiteStateProps): React.JSX.Element {
  return (
    <div className="rounded-[28px] border border-outline-variant/20 bg-white p-md text-center shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-on-primary">
        <span className="material-symbols-outlined text-[32px]">
          architecture
        </span>
      </div>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-wide text-deep-teal">
        RAP dulu, baru RAB
      </p>
      <h3 className="mt-1 text-lg font-semibold leading-6 text-on-surface">
        Buat RAP internal sebelum generate RAB client.
      </h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-on-surface-variant">
        RAB akan digenerate dari item RAP material, work package, subcon
        package, dan line manual yang sudah client-safe.
      </p>
      <button
        type="button"
        onClick={onGoToRap}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary active:scale-95"
      >
        Buka RAP
        <span className="material-symbols-outlined text-[16px]">
          arrow_forward
        </span>
      </button>
    </div>
  );
}
