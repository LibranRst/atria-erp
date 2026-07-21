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
          className="text-on-surface min-w-0 truncate text-[17px] leading-6 font-bold tracking-[-0.015em] max-[430px]:text-[15px] max-[430px]:leading-5"
        >
          Simulasi developer
        </h2>
        <span className="text-warning shrink-0 text-[9px] font-bold tracking-[0.12em] uppercase">
          Development
        </span>
      </div>

      <div className="overflow-hidden rounded-[26px] bg-white/94 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-[24px]">
        <div className="divide-y divide-black/5.5">
          <div className="bg-warning/5.5 flex min-h-[72px] items-start gap-3 px-3.5 py-3.5">
            <span
              className="bg-warning/11 text-warning ring-warning/8 flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                developer_mode
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-on-surface text-[13px] leading-4 font-bold">
                Uji akses sebagai akun tim
              </p>
              <p className="text-on-surface-variant mt-1 text-[10px] leading-[1.45]">
                Session ini benar-benar memakai role terpilih. Password akun tidak dibaca atau
                diubah.
              </p>
            </div>
          </div>

          {state.blockers.length > 0
            ? state.blockers.map((blocker) => (
                <div key={blocker} className="flex min-h-[60px] items-center gap-3 px-3.5 py-3">
                  <span
                    className="material-symbols-outlined text-warning shrink-0 text-[18px]"
                    aria-hidden="true"
                  >
                    lock
                  </span>
                  <p className="text-on-surface-variant text-[11px] leading-[1.45]">{blocker}</p>
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
                  className="active:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:ring-primary/25 flex min-h-[68px] w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:opacity-55"
                  aria-label={`Simulasikan akun ${target.name}, ${getDeveloperSimulationRoleLabel(target.roleName)}`}
                >
                  <span
                    className="bg-primary/6.5 text-primary ring-primary/6 flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1"
                    aria-hidden="true"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none">
                      person_play
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-on-surface block truncate text-[13px] leading-4 font-bold">
                      {target.name}
                    </span>
                    <span className="text-on-surface-variant mt-1 block truncate text-[10px] leading-[1.3]">
                      {target.email}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-on-surface block text-[10px] font-bold">
                      {getDeveloperSimulationRoleLabel(target.roleName)}
                    </span>
                    {target.mustChangePassword ? (
                      <span className="bg-warning/9 text-warning ring-warning/8 mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] leading-none font-bold ring-1">
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
                        className="material-symbols-outlined text-primary mt-0.5 block text-[17px] leading-none"
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
