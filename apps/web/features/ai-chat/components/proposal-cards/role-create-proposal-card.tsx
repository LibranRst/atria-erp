"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { confirmAiCreateRoleProposal } from "@/app/actions/ai/confirm-create-role-proposal";
import { AppIcon } from "@/components/ui";
import { ProposalCardShell } from "./proposal-card-shell";

export type RoleCreatePermissionData = {
  readonly key: string;
  readonly label: string;
  readonly effect: string;
};

export type CreateRoleProposalData = {
  readonly kind: "CREATE_ROLE";
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly dataScope: "GLOBAL" | "ASSIGNED" | "NONE";
  readonly scopeEffect: string;
  readonly permissions: readonly RoleCreatePermissionData[];
  readonly editorHref: string;
};

/**
 * Kartu usulan peran baru.
 *
 * Peringatannya berbeda dari kartu perubahan izin, dan itu jujur: peran baru
 * tidak mengubah kemampuan siapa pun sampai ada yang ditugaskan ke dalamnya.
 * Yang perlu dibaca justru cakupan proyeknya — satu baris yang paling mudah
 * terlewat dan paling luas akibatnya.
 */
export function RoleCreateProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: {
  readonly proposal: CreateRoleProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">(
    alreadyConfirmed ? "submitted" : "idle",
  );
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  async function handleConfirm(): Promise<void> {
    if (!conversationId) {
      setStatus("failed");
      setErrorMessage("Sesi percakapan belum siap. Silakan coba lagi.");
      return;
    }

    setStatus("submitting");
    const result = await confirmAiCreateRoleProposal({
      toolCallId,
      conversationId,
      name: proposal.displayName,
      description: proposal.description || undefined,
      dataScope: proposal.dataScope,
      permissions: proposal.permissions.map((permission) => permission.key),
    });

    if (result.success) {
      setStatus("submitted");
      return;
    }
    setStatus("failed");
    setErrorMessage(result.error.message);
  }

  return (
    <ProposalCardShell
      eyebrow="Usulan Peran Baru"
      title={proposal.displayName}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmEmphasis="quiet"
      confirmLabel="Buat Peran Ini"
      submittedMessage="Peran dibuat. Belum ada yang memakainya sampai Anda menugaskan seseorang."
      onConfirm={handleConfirm}
      viewActionLabel="Buka Peran & akses"
      onViewAction={() => {
        onNavigate?.();
        router.push(proposal.editorHref);
      }}
    >
      {/*
       * Kabar bahwa peran baru belum dipakai siapa pun itu MENENANGKAN, bukan
       * bahaya. Sebelumnya ia dirender lewat `warningMessage` dan keluar dengan
       * latar merah alarm — nada yang berlawanan dengan artinya.
       */}
      <div className="flex min-w-0 items-start gap-2.5 px-4 py-3">
        <AppIcon
          name="info"
          className="mt-0.5 icon-sm shrink-0 leading-none text-on-surface-variant"
          aria-hidden="true"
        />
        <p className="min-w-0 text-support leading-[1.45] text-on-surface-variant">
          <span className="font-bold text-on-surface">Belum dipakai siapa pun.</span> Peran baru
          tidak mengubah akses siapa pun sampai Anda menugaskan seseorang di Pengaturan.
        </p>
      </div>

      {proposal.description ? (
        <p className="border-t border-black/5.5 px-4 py-3 text-support leading-[1.45] text-on-surface-variant">
          {proposal.description}
        </p>
      ) : null}

      <div className="flex min-w-0 items-center gap-2.5 border-t border-black/5.5 px-4 py-3">
        <AppIcon
          name="folder"
          className="icon-sm shrink-0 leading-none text-on-surface-variant"
          aria-hidden="true"
        />
        <p className="min-w-0 text-support text-on-surface-variant">
          <span className="font-bold text-on-surface">Cakupan proyek</span> · {proposal.scopeEffect}
        </p>
      </div>

      {proposal.permissions.length > 0 ? (
        <div className="divide-y divide-black/5.5 border-t border-black/5.5">
          {proposal.permissions.map((permission) => (
            <div key={permission.key} className="flex min-w-0 items-start gap-2.5 px-4 py-3">
              <span
                className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success/12 text-success"
                aria-hidden="true"
              >
                <AppIcon name="add" className="icon-xs leading-none" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-support leading-[1.4] font-semibold text-on-surface">
                  {permission.effect}
                </span>
                <span className="mt-0.5 block truncate font-mono text-eyebrow text-on-surface-variant">
                  {permission.key}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="border-t border-black/5.5 px-4 py-3 text-support text-on-surface-variant">
          Dibuat tanpa izin. Nyalakan izinnya setelah peran tersimpan.
        </p>
      )}
    </ProposalCardShell>
  );
}
