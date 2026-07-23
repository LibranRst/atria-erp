"use client";

import { motion } from "framer-motion";
import React from "react";
import { toast } from "sonner";

import { startDeveloperAccountSimulation } from "@/app/actions/developer-account-simulation";
import { ConfirmationSheet, StatusBadge } from "@/components/ui";
import {
  getDeveloperSimulationRoleLabel,
  type DeveloperAccountSimulationState,
  type DeveloperSimulationTarget,
} from "@/lib/auth/developer-account-simulation";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui/icon/app-icon";

type DeveloperAccountSwitcherProps = {
  readonly state: DeveloperAccountSimulationState;
};

export function DeveloperAccountSwitcher({
  state,
}: DeveloperAccountSwitcherProps): React.JSX.Element | null {
  const [selected, setSelected] = React.useState<DeveloperSimulationTarget | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (!state.enabled || state.isSimulating) return null;

  const confirmSimulation = (): void => {
    if (!selected) return;
    startTransition(async () => {
      const result = await startDeveloperAccountSimulation({
        targetUserId: selected.id,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      window.location.assign(result.data.redirectTo);
    });
  };

  return (
    <section className="space-y-2" aria-labelledby="developer-simulation-title">
      <div className="flex min-h-10 items-center justify-between gap-3 px-1">
        <h2
          id="developer-simulation-title"
          className="min-w-0 truncate text-[17px] leading-6 font-bold tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5"
        >
          Simulasi developer
        </h2>
        <StatusBadge tone="warning" label="Development" />
      </div>

      <div className="overflow-hidden rounded-[26px] bg-white/94 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-3xl">
        <div className="divide-y divide-black/5.5">
          <div className="flex min-h-18 items-start gap-3 px-3.5 py-3.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-warning/11 text-warning ring-1 ring-warning/8"
              aria-hidden="true"
            >
              <AppIcon name="developer_mode" className="text-[18px] leading-none" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-4 font-bold text-on-surface">
                Uji akses sebagai akun tim
              </p>
              <p className="mt-1 text-[10px] leading-[1.45] text-on-surface-variant">
                Session ini benar-benar memakai role terpilih. Password akun tidak dibaca atau
                diubah.
              </p>
            </div>
          </div>

          {state.blockers.length > 0
            ? state.blockers.map((blocker) => (
                <div key={blocker} className="flex min-h-15 items-center gap-3 px-3.5 py-3">
                  <AppIcon name="lock" className="shrink-0 text-[18px] text-warning" />
                  <p className="text-[11px] leading-[1.45] text-on-surface-variant">{blocker}</p>
                </div>
              ))
            : state.targets.map((target) => (
                <motion.button
                  key={target.id}
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  transition={transitionSpringSnappy}
                  onClick={() => setSelected(target)}
                  disabled={pending}
                  className="flex min-h-17 w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-inset active:bg-surface-container-low disabled:opacity-55"
                  aria-label={`Simulasikan akun ${target.name}, ${getDeveloperSimulationRoleLabel(target.roleName)}`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-primary/6.5 text-primary ring-1 ring-primary/6"
                    aria-hidden="true"
                  >
                    <AppIcon name="person_play" className="text-[18px] leading-none" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] leading-4 font-bold text-on-surface">
                      {target.name}
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] leading-[1.3]">
                      <span className="truncate text-on-surface-variant">{target.email}</span>
                      <span className="shrink-0 text-outline-variant" aria-hidden="true">
                        ·
                      </span>
                    </span>
                    {target.mustChangePassword ? (
                      <StatusBadge className="mt-2" tone="warning" label="Password sementara" />
                    ) : null}
                  </span>
                  <div className="flex flex-row items-center gap-1 text-[10px]">
                    <span className="shrink-0 rounded-xl bg-black/10 px-3 py-0.5 font-bold text-primary">
                      {getDeveloperSimulationRoleLabel(target.roleName)}
                    </span>
                    <AppIcon
                      name="chevron_right"
                      className="shrink-0 text-[17px] leading-none text-primary"
                      aria-hidden="true"
                    />
                  </div>
                </motion.button>
              ))}
        </div>
      </div>

      <ConfirmationSheet
        open={selected !== null}
        title={`Simulasikan ${selected?.name ?? "akun ini"}?`}
        description={
          selected
            ? `Semua halaman dan mutation berikutnya berjalan sebagai ${getDeveloperSimulationRoleLabel(selected.roleName)} sampai Anda kembali ke Owner.${selected.mustChangePassword ? " Password sementara tidak dibaca atau diubah." : ""}`
            : "Session akan berpindah ke akun tim terpilih."
        }
        confirmLabel="Mulai simulasi"
        pending={pending}
        onClose={() => {
          if (!pending) setSelected(null);
        }}
        onConfirm={confirmSimulation}
      />
    </section>
  );
}
