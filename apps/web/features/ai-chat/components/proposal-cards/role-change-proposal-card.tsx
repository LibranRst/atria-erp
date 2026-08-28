"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { confirmAiRoleChangeProposal } from "@/app/actions/ai/confirm-role-proposal";
import { AppIcon } from "@/components/ui";
import { ProposalCardShell } from "./proposal-card-shell";

export type RoleChangePermissionData = {
  readonly key: string;
  readonly label: string;
  /** Kalimat akibat, bukan nama izin. Ini yang membuat kartunya bisa dinilai. */
  readonly effect: string;
};

export type RoleChangeProposalData = {
  readonly kind: "ROLE_PERMISSION_CHANGE";
  readonly roleId: string;
  readonly roleName: string;
  readonly reason: string;
  readonly affectedUsers: number;
  readonly affectedNames: readonly string[];
  readonly grant: readonly RoleChangePermissionData[];
  readonly revoke: readonly RoleChangePermissionData[];
  readonly modulesGained: readonly string[];
  readonly modulesLost: readonly string[];
  readonly editorHref: string;
};

/**
 * Kartu konfirmasi perubahan izin peran.
 *
 * Ia sengaja menampilkan **akibat** setiap izin dalam kalimat, bukan daftar
 * kunci. Kartu izin yang hanya memuat `pay:cost` tidak bisa dinilai dalam satu
 * ketukan, dan konfirmasi yang tidak bisa dinilai hanyalah stempel. Nama orang
 * yang terdampak ikut disebut karena merekalah yang akan menanggung akibatnya,
 * dan mereka tidak ada di percakapan ini.
 */
export function RoleChangeProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: {
  readonly proposal: RoleChangeProposalData;
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
    const result = await confirmAiRoleChangeProposal({
      toolCallId,
      conversationId,
      roleId: proposal.roleId,
      grant: proposal.grant.map((permission) => permission.key),
      revoke: proposal.revoke.map((permission) => permission.key),
    });

    if (result.success) {
      setStatus("submitted");
      return;
    }
    setStatus("failed");
    setErrorMessage(result.error.message);
  }

  const holders =
    proposal.affectedNames.length > 0
      ? proposal.affectedNames.join(", ")
      : "belum ada pemegang aktif";

  return (
    <ProposalCardShell
      eyebrow="Usulan Perubahan Izin"
      title={proposal.roleName}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmEmphasis="quiet"
      confirmLabel="Terapkan Perubahan Izin"
      submittedMessage="Izin peran diperbarui. Berlaku pada permintaan berikutnya setiap pemegangnya."
      onConfirm={handleConfirm}
      viewActionLabel="Tinjau di Peran & akses"
      onViewAction={() => {
        onNavigate?.();
        router.push(proposal.editorHref);
      }}
    >
      {/*
       * Siapa yang terdampak dibaca lebih dulu, bukan sebagai peringatan merah
       * di bawah tombol. Ini fakta cakupan, bukan bahaya — dan orang-orang ini
       * tidak ada di percakapan untuk membela dirinya sendiri.
       */}
      <div className="flex min-w-0 items-start gap-2.5 px-4 py-3">
        <AppIcon
          name="group"
          className="mt-0.5 icon-sm shrink-0 leading-none text-on-surface-variant"
          aria-hidden="true"
        />
        <p className="min-w-0 text-support leading-[1.45] text-on-surface">
          <span className="font-bold">{proposal.affectedUsers} orang memakai peran ini</span>
          {proposal.affectedNames.length > 0 ? (
            <span className="text-on-surface-variant"> · {holders}</span>
          ) : null}
        </p>
      </div>

      <p className="border-t border-black/5.5 px-4 py-3 text-support leading-[1.45] text-on-surface-variant">
        {proposal.reason}
      </p>

      <div className="divide-y divide-black/5.5 border-t border-black/5.5">
        {proposal.grant.map((permission) => (
          <EffectRow key={`grant-${permission.key}`} permission={permission} direction="grant" />
        ))}
        {proposal.revoke.map((permission) => (
          <EffectRow key={`revoke-${permission.key}`} permission={permission} direction="revoke" />
        ))}
      </div>

      {proposal.modulesLost.length > 0 || proposal.modulesGained.length > 0 ? (
        <div className="space-y-1 border-t border-black/5.5 px-4 py-3">
          {proposal.modulesGained.length > 0 ? (
            <ModuleLine tone="gain" modules={proposal.modulesGained} />
          ) : null}
          {proposal.modulesLost.length > 0 ? (
            <ModuleLine tone="loss" modules={proposal.modulesLost} />
          ) : null}
        </div>
      ) : null}
    </ProposalCardShell>
  );
}

function ModuleLine({
  tone,
  modules,
}: {
  readonly tone: "gain" | "loss";
  readonly modules: readonly string[];
}): React.JSX.Element {
  return (
    <p className="min-w-0 text-meta leading-[1.4] text-on-surface-variant">
      <span className="font-bold text-on-surface">
        {tone === "gain" ? "Modul terbuka" : "Modul menghilang"}
      </span>{" "}
      · {modules.join(", ")}
    </p>
  );
}

function EffectRow({
  permission,
  direction,
}: {
  readonly permission: RoleChangePermissionData;
  readonly direction: "grant" | "revoke";
}): React.JSX.Element {
  const positive = direction === "grant";
  return (
    <div className="flex min-w-0 items-start gap-2.5 px-4 py-3">
      {/*
       * Arahnya dibawa bentuk ikon DAN kalimatnya ("Bisa…" vs "Tidak lagi…"),
       * jadi label "Tambah"/"Cabut" di sisi kanan hanya mengulang sambil
       * memepet teksnya sampai membungkus tiga baris pada 390 px.
       */}
      <span
        className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full ${
          positive ? "bg-success/12 text-success" : "bg-error/10 text-error"
        }`}
        aria-hidden="true"
      >
        <AppIcon name={positive ? "add" : "remove"} className="icon-xs leading-none" />
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
  );
}
