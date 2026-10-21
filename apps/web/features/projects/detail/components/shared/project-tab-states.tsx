"use client";
import { AppIcon, Button } from "@/components/ui";
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
    <section className="rounded-3xl bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-low text-on-surface-variant">
          <AppIcon name="lock" className="icon-lg text-on-surface-variant/80" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
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
      <Button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary active:z-10 active:shadow-raised"
        variant="primary"
      >
        <AppIcon name={actionIcon} className="icon-sm" />
        <span>{actionLabel}</span>
      </Button>
    </section>
  );
}

interface RabPrerequisiteStateProps {
  readonly onGoToRap: () => void;
}

export function RabPrerequisiteState({ onGoToRap }: RabPrerequisiteStateProps): React.JSX.Element {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary text-on-primary">
          <AppIcon name="architecture" className="icon-lg" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-bold tracking-[0.14em] text-primary uppercase">
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
      <Button
        type="button"
        onClick={onGoToRap}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary active:z-10 active:shadow-raised"
        variant="primary"
      >
        Buka RAP
        <AppIcon name="arrow_forward" className="icon-sm" />
      </Button>
    </section>
  );
}
