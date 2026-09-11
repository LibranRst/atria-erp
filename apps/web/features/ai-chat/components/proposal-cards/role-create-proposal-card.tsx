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
 * Kartu usulan pembuatan peran baru (Role Create).
 *
 * Mengusulkan peran kustom dengan prinsip Least Privilege:
 * - Menampilkan nama peran & deskripsi operasional.
 * - Inset visual untuk Cakupan Proyek dan Keamanan Akses (0 anggota aktif).
 * - Daftar wewenang operasional dengan icon checkmark dan keterangan dampak bisnis.
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
      confirmEmphasis="primary"
      confirmLabel="Buat Peran Ini"
      submittedMessage="Peran dibuat. Belum ada yang memakainya sampai Anda menugaskan seseorang di Pengaturan."
      onConfirm={handleConfirm}
      viewActionLabel="Buka Peran & akses"
      onViewAction={() => {
        onNavigate?.();
        router.push(proposal.editorHref);
      }}
    >
      {/* Panel Ringkasan Peran & Wawasan Keamanan */}
      <div className="px-4 py-3.5 space-y-3">
        {proposal.description ? (
          <p className="text-support leading-relaxed text-on-surface">
            {proposal.description}
          </p>
        ) : null}

        {/* Inset Grid: Cakupan Proyek & Keamanan Akses */}
        <div className="grid grid-cols-2 gap-2">
          {/* Sel 1: Cakupan Proyek */}
          <div className="rounded-xl border border-black/5.5 bg-surface-container-low/40 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-eyebrow font-bold text-on-surface-variant uppercase tracking-wider">
              <AppIcon name="folder" className="icon-xs text-on-surface-variant/70" aria-hidden="true" />
              <span>Cakupan proyek</span>
            </div>
            <p className="text-meta font-bold text-on-surface truncate capitalize">
              {proposal.scopeEffect}
            </p>
          </div>

          {/* Sel 2: Status Pemegang */}
          <div className="rounded-xl border border-black/5.5 bg-surface-container-low/40 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-eyebrow font-bold text-on-surface-variant uppercase tracking-wider">
              <AppIcon name="check_circle" className="icon-xs text-success" aria-hidden="true" />
              <span>Keamanan Akses</span>
            </div>
            <p className="text-meta font-bold text-on-surface truncate">
              Belum dipakai siapa pun
            </p>
          </div>
        </div>

        {/* Penjelasan Keamanan Tenang */}
        <div className="flex min-w-0 items-start gap-2 text-meta text-on-surface-variant leading-tight">
          <AppIcon
            name="info"
            className="mt-0.5 icon-xs shrink-0 text-on-surface-variant/70"
            aria-hidden="true"
          />
          <p className="min-w-0">
            Peran baru tidak mengubah akses siapa pun sampai Anda menugaskan seseorang di Pengaturan.
          </p>
        </div>
      </div>

      {/* Daftar Wewenang Operasional */}
      {proposal.permissions.length > 0 ? (
        <div className="border-t border-black/5.5">
          <div className="flex items-center justify-between border-b border-black/5.5 bg-surface-container-low/60 px-4 py-2.5">
            <span className="text-support font-bold text-on-surface">
              Wewenang Operasional ({proposal.permissions.length} Izin)
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-eyebrow font-bold text-primary uppercase">
              Least Privilege
            </span>
          </div>

          <div className="divide-y divide-black/5.5">
            {proposal.permissions.map((permission) => (
              <div key={permission.key} className="flex min-w-0 items-start gap-2.5 px-4 py-3">
                <span
                  className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success/12 text-success"
                  aria-hidden="true"
                >
                  <AppIcon name="check_circle" className="icon-xs leading-none" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-support leading-snug font-bold text-on-surface">
                    {permission.effect}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-eyebrow text-on-surface-variant/70">
                    {permission.key}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-black/5.5 bg-surface-container-low/30 px-4 py-3 text-support text-on-surface-variant">
          Dibuat tanpa izin. Nyalakan izinnya setelah peran tersimpan di Pengaturan.
        </div>
      )}
    </ProposalCardShell>
  );
}
