"use client";

import { motion } from "framer-motion";
import React from "react";
import { toast } from "sonner";

import { stopDeveloperAccountSimulation } from "@/app/actions/developer-account-simulation";
import { authClient } from "@/lib/auth-client";
import { ROLE_ID_TO_NAME } from "@/lib/auth/permissions";
import { formatProfileRole } from "@/features/profile/utils/profile-access";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui/icon/app-icon";

type SessionShape = {
  readonly session?: { readonly developerActorUserId?: unknown };
  readonly user?: {
    readonly name?: unknown;
    readonly roleId?: unknown;
  };
};

function readSimulationContext(value: unknown): {
  readonly active: boolean;
  readonly userName: string;
  readonly roleLabel: string;
} {
  if (typeof value !== "object" || value === null) {
    return { active: false, userName: "Akun tim", roleLabel: "Simulasi" };
  }
  const sessionValue = value as SessionShape;
  const actorId = sessionValue.session?.developerActorUserId;
  const roleId = sessionValue.user?.roleId;
  const roleName =
    typeof roleId === "string" ? (ROLE_ID_TO_NAME[roleId] ?? "Role tidak dikenal") : "UNKNOWN";
  return {
    active: typeof actorId === "string" && actorId.length > 0,
    userName: typeof sessionValue.user?.name === "string" ? sessionValue.user.name : "Akun tim",
    roleLabel: formatProfileRole(roleName),
  };
}

export function DeveloperSimulationBanner(): React.JSX.Element | null {
  const { data } = authClient.useSession();
  const simulation = readSimulationContext(data);
  const [pending, startTransition] = React.useTransition();

  if (!simulation.active) return null;

  const restoreOwner = (): void => {
    startTransition(async () => {
      const result = await stopDeveloperAccountSimulation();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      window.location.assign(result.data.redirectTo);
    });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-md px-margin-mobile">
      <aside
        className="pointer-events-auto relative isolate flex min-h-15 min-w-0 items-center gap-2 overflow-hidden rounded-[22px] bg-white/88 p-1.5 pl-2 shadow-floating ring-1 ring-ring-subtle backdrop-blur-xl"
        aria-live="polite"
        aria-label="Mode simulasi developer aktif"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-warning/10 text-warning ring-1 ring-warning/8"
          aria-hidden="true"
        >
          <AppIcon name="developer_mode" className="text-[18px] leading-none" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] leading-5 font-bold text-on-surface">
            Simulasi · {simulation.roleLabel}
          </span>
          <span className="block truncate text-meta text-on-surface-variant">
            {simulation.userName}
          </span>
        </span>
        <motion.button
          type="button"
          onClick={restoreOwner}
          disabled={pending}
          whileTap={pending ? undefined : { scale: 0.97 }}
          transition={transitionSpringSnappy}
          className="flex min-h-12 shrink-0 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-55"
        >
          <span className="flex h-10 items-center rounded-full bg-on-surface px-3.5 text-[10px] font-bold text-white shadow-control">
            {pending ? "Memulihkan…" : "Kembali"}
          </span>
        </motion.button>
      </aside>
    </div>
  );
}
