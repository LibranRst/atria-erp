"use client";

import React from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import { toast } from "sonner";

import { activateProjectAction } from "@/app/actions/project/activation";
import { AppIcon, FormSection, WorkflowFormSheet } from "@/components/ui";
import type { ProjectActivationReadiness } from "@atria/core/project/activation-readiness";
type ProjectActivationSheetProps = {
  readonly projectId: string;
  readonly projectName: string;
  readonly canActivate: boolean;
  readonly readiness: ProjectActivationReadiness;
};

export function ProjectActivationSheet({
  projectId,
  projectName,
  canActivate,
  readiness,
}: ProjectActivationSheetProps): React.JSX.Element | null {
  const router = useRouter();
  const [open, setOpen] = React.useState(readiness.isReady && canActivate);
  const [pending, startTransition] = React.useTransition();

  if (!canActivate || !readiness.isReady) return null;

  function activateProject(): void {
    startTransition(async () => {
      const result = await activateProjectAction({ projectId });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      setOpen(false);
      toast.success("Proyek sudah Aktif dan siap untuk operasional.");
      router.refresh();
    });
  }

  return (
    <WorkflowFormSheet
      dismissal={{ mode: "discard" }}
      open={open}
      title="Proyek siap diaktifkan"
      primaryLabel="Aktifkan"
      secondaryLabel="Nanti"
      pendingLabel="Mengaktifkan…"
      pending={pending}
      statusText="Tiga syarat telah terpenuhi. Aktivasi akan membuka alur operasional."
      statusTone="success"
      onClose={() => setOpen(false)}
      onSecondary={() => setOpen(false)}
      onPrimary={activateProject}
    >
      <div className="space-y-4">
        <div className="rounded-3xl bg-primary/7 px-4 py-3">
          <p className="text-meta font-bold tracking-[0.12em] text-primary uppercase">
            Keputusan operasional
          </p>
          <p className="mt-1 text-sm font-bold text-on-surface">{projectName}</p>
          <p className="mt-1 text-support text-on-surface-variant">
            Setelah aktif, proyek dapat digunakan untuk biaya, tagihan, penerimaan barang, dan
            pergerakan stok.
          </p>
        </div>
        <FormSection title="Safeguard sudah lengkap">
          <ReadinessRow label="Project Budget" value="Disetujui" icon="check_circle" />
          <ReadinessRow label="RAP baseline" value="Terkunci" icon="lock" />
          <ReadinessRow label="RAB klien" value="Disetujui" icon="verified" />
        </FormSection>
      </div>
    </WorkflowFormSheet>
  );
}

function ReadinessRow({
  label,
  value,
  icon,
}: {
  readonly label: string;
  readonly value: string;
  readonly icon: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-on-surface">
        <AppIcon name={icon} className="icon-md text-success" />
        {label}
      </span>
      <span className="shrink-0 text-support font-bold text-success">{value}</span>
    </div>
  );
}
