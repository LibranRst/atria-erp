"use client";

import { motion } from "framer-motion";
import React from "react";
import { toast } from "sonner";

import { startDeveloperAccountSimulation } from "@/app/actions/developer-account-simulation";
import { ConfirmationSheet } from "@/components/ui";
import {
  getDeveloperSimulationRoleLabel,
  type DeveloperAccountSimulationState,
  type DeveloperSimulationTarget,
} from "@/lib/auth/developer-account-simulation";
import { transitionSpringSnappy } from "@/lib/utils/motion";

type DeveloperAccountSwitcherProps = {
  readonly state: DeveloperAccountSimulationState;
};

export function DeveloperAccountSwitcher({
  state,
}: DeveloperAccountSwitcherProps): React.JSX.Element | null {
  const [selected, setSelected] =
    React.useState<DeveloperSimulationTarget | null>(null);
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
          className="min-w-0 truncate text-[17px] font-bold leading-6 tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5"
        >
          Simulasi developer
        </h2>
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-warning">
          Development
        </span>
      </div>

      <div className="overflow-hidden rounded-[26px] bg-white/[0.94] shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/[0.025] max-[430px]:rounded-[24px]">
        <div className="divide-y divide-black/[0.055]">
          <div className="flex min-h-[72px] items-start gap-3 bg-warning/[0.055] px-3.5 py-3.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-warning/[0.11] text-warning ring-1 ring-warning/[0.08]"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                developer_mode
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-4 text-on-surface">
                Uji akses sebagai akun tim
              </p>
              <p className="mt-1 text-[10px] leading-[1.45] text-on-surface-variant">
                Session ini benar-benar memakai role terpilih. Password akun
                tidak dibaca atau diubah.
              </p>
            </div>
          </div>

          {state.blockers.length > 0
            ? state.blockers.map((blocker) => (
                <div
                  key={blocker}
                  className="flex min-h-[60px] items-center gap-3 px-3.5 py-3"
                >
                  <span
                    className="material-symbols-outlined shrink-0 text-[18px] text-warning"
                    aria-hidden="true"
                  >
                    lock
                  </span>
                  <p className="text-[11px] leading-[1.45] text-on-surface-variant">
                    {blocker}
                  </p>
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
                  className="flex min-h-[68px] w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left outline-none transition-colors active:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 disabled:opacity-55"
                  aria-label={`Simulasikan akun ${target.name}, ${getDeveloperSimulationRoleLabel(target.roleName)}`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-primary/[0.065] text-primary ring-1 ring-primary/[0.06]"
                    aria-hidden="true"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none">
                      person_play
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold leading-4 text-on-surface">
                      {target.name}
                    </span>
                    <span className="mt-1 block truncate text-[10px] leading-[1.3] text-on-surface-variant">
                      {target.email}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] font-bold text-on-surface">
                      {getDeveloperSimulationRoleLabel(target.roleName)}
                    </span>
                    {target.mustChangePassword ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning/[0.09] px-2 py-1 text-[8px] font-bold leading-none text-warning ring-1 ring-warning/[0.08]">
                        <span
                          className="material-symbols-outlined text-[11px] leading-none"
                          aria-hidden="true"
                        >
                          password
                        </span>
                        Password sementara
                      </span>
                    ) : (
                      <span
                        className="material-symbols-outlined mt-0.5 block text-[17px] leading-none text-primary"
                        aria-hidden="true"
                      >
                        chevron_right
                      </span>
                    )}
                  </span>
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
