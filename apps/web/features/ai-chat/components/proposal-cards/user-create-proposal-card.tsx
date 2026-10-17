"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import * as React from "react";

import { confirmAiCreateUserProposal } from "@/app/actions/ai/confirm-create-user-proposal";
import { AppIcon, UserAvatar } from "@/components/ui";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
import { ProposalCardShell } from "./proposal-card-shell";

export type CreateUserProposalData = {
  readonly kind: "CREATE_USER";
  readonly name: string;
  readonly email: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly roleDisplayName: string;
  readonly roleDescription?: string;
  readonly dataScope: "GLOBAL" | "ASSIGNED" | "NONE";
  readonly scopeEffect: string;
  readonly temporaryPassword: string;
  readonly reason?: string;
  readonly settingsHref?: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * Kartu usulan pembuatan akun pengguna baru.
 *
 * Menampilkan ringkasan identitas tim, penugasan peran, cakupan data proyek,
 * action banner "Salin Kredensial" di bagian atas untuk kemudahan share ke WhatsApp,
 * dan kotak kapsul kata sandi dengan tombol inline "Salin Password".
 */
export function UserCreateProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: {
  readonly proposal: CreateUserProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">(
    alreadyConfirmed ? "submitted" : "idle",
  );
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [isPasswordCopied, setIsPasswordCopied] = React.useState<boolean>(false);
  const [isCredentialsCopied, setIsCredentialsCopied] = React.useState<boolean>(false);

  const initials = getInitials(proposal.name);

  async function handleConfirm(): Promise<void> {
    if (!conversationId) {
      setStatus("failed");
      setErrorMessage("Sesi percakapan belum siap. Silakan coba lagi.");
      return;
    }

    setStatus("submitting");
    const result = await confirmAiCreateUserProposal({
      toolCallId,
      conversationId,
      name: proposal.name,
      email: proposal.email,
      roleId: proposal.roleId,
      temporaryPassword: proposal.temporaryPassword,
    });

    if (result.success) {
      setStatus("submitted");
      return;
    }
    setStatus("failed");
    setErrorMessage(result.error.message);
  }

  async function handleCopyPassword(): Promise<void> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(proposal.temporaryPassword);
        setIsPasswordCopied(true);
        setTimeout(() => setIsPasswordCopied(false), 2000);
      }
    } catch {
      // Fallback diam
    }
  }

  async function handleCopyCredentials(): Promise<void> {
    const textToCopy = [
      `Halo *${proposal.name}*,`,
      `Berikut akun Paduna Build Anda:`,
      `Email: ${proposal.email}`,
      `Password Sementara: ${proposal.temporaryPassword}`,
      `Peran: ${proposal.roleDisplayName}`,
      "",
      `Catatan: Anda wajib memperbarui kata sandi saat pertama kali masuk ke aplikasi.`,
    ].join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
        setIsCredentialsCopied(true);
        setTimeout(() => setIsCredentialsCopied(false), 2500);
      }
    } catch {
      // Fallback diam
    }
  }

  return (
    <ProposalCardShell
      eyebrow="Usulan Pengguna Baru"
      title="Pembuatan Akun Staf"
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmEmphasis="primary"
      confirmLabel="Buat Pengguna Ini"
      submittedMessage={`Akun ${proposal.name} telah berhasil dibuat. Salin kredensial di bawah untuk dibagikan.`}
      onConfirm={handleConfirm}
      viewActionLabel="Buka Pengaturan User"
      onViewAction={() => {
        onNavigate?.();
        router.push(proposal.settingsHref || "/settings?tab=organization");
      }}
    >
      {/* Action Banner: Salin Kredensial Tim Siap Kirim ke WhatsApp */}
      <div className="flex items-center justify-between gap-3 border-b border-black/5.5 bg-surface-container-low/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-support font-bold text-on-surface">Pesan Kredensial Tim</p>
          <p className="truncate text-meta text-on-surface-variant/80">
            Format nama, email & sandi siap kirim ke staf
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
          transition={transitionSpringSnappy}
          onClick={() => void handleCopyCredentials()}
          className={`relative flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-meta font-bold shadow-control transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${
            isCredentialsCopied
              ? "bg-primary font-bold text-on-primary shadow-primary"
              : "bg-surface-container text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest"
          }`}
        >
          <AppIcon
            name={isCredentialsCopied ? "check_circle" : "copy"}
            className="icon-xs shrink-0"
            aria-hidden="true"
          />
          <AnimatePresence mode="wait" initial={false}>
            {isCredentialsCopied ? (
              <motion.span
                key="cred-copied"
                initial={{ opacity: 0, y: 3, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -3, scale: 0.9 }}
                transition={transitionSpringSnappy}
                className="inline-block whitespace-nowrap"
              >
                Tersalin!
              </motion.span>
            ) : (
              <motion.span
                key="cred-copy"
                initial={{ opacity: 0, y: -3, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 3, scale: 0.9 }}
                transition={transitionSpringSnappy}
                className="inline-block whitespace-nowrap"
              >
                Salin Kredensial
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Rincian Akun Pengguna */}
      <div className="space-y-3 px-4 py-3.5">
        {/* Identitas & Badge Peran */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <UserAvatar
              initials={initials}
              displayName={proposal.name}
              renderPx={38}
              className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-meta font-bold text-primary"
            />
            <div className="min-w-0">
              <p className="truncate text-row font-bold text-on-surface">{proposal.name}</p>
              <p className="truncate text-meta text-on-surface-variant">{proposal.email}</p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-eyebrow font-bold tracking-wide text-primary uppercase">
            {proposal.roleDisplayName}
          </span>
        </div>

        {/* Subline Cakupan Proyek & Deskripsi Peran */}
        <div className="space-y-1 rounded-xl border border-black/5.5 bg-surface-container-low/40 px-3 py-2">
          <div className="flex items-center gap-2 text-meta text-on-surface-variant">
            <AppIcon
              name="folder"
              className="icon-xs shrink-0 text-on-surface-variant/70"
              aria-hidden="true"
            />
            <span className="truncate">
              <strong className="font-semibold text-on-surface">Cakupan Proyek:</strong>{" "}
              {proposal.scopeEffect}
            </span>
          </div>
          {proposal.roleDescription && (
            <p className="pl-5 text-meta leading-snug text-on-surface-variant/80 italic">
              {proposal.roleDescription}
            </p>
          )}
        </div>

        {/* Kolom Sandi Kapsul dengan Tombol Salin Inline */}
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-full border border-black/8 bg-white py-1 pr-1.5 pl-4 shadow-control">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-eyebrow font-semibold text-on-surface-variant/70 uppercase">
              Sandi:
            </span>
            <code className="truncate font-mono text-meta font-bold tracking-wide text-on-surface select-all">
              {proposal.temporaryPassword}
            </code>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
            transition={transitionSpringSnappy}
            onClick={() => void handleCopyPassword()}
            className={`relative flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-meta font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${
              isPasswordCopied
                ? "bg-primary font-bold text-on-primary shadow-primary"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high hover:text-primary active:bg-surface-container-highest"
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isPasswordCopied ? (
                <motion.span
                  key="pwd-copied"
                  initial={{ opacity: 0, y: 3, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -3, scale: 0.9 }}
                  transition={transitionSpringSnappy}
                  className="inline-block whitespace-nowrap"
                >
                  Tersalin!
                </motion.span>
              ) : (
                <motion.span
                  key="pwd-copy"
                  initial={{ opacity: 0, y: -3, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 3, scale: 0.9 }}
                  transition={transitionSpringSnappy}
                  className="inline-block whitespace-nowrap"
                >
                  Salin Password
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Catatan Bawah */}
      <div className="flex items-start gap-2 border-t border-black/5.5 bg-surface-container-low/30 px-4 py-2.5 text-meta leading-tight text-on-surface-variant">
        <AppIcon
          name="info"
          className="mt-0.5 icon-xs shrink-0 text-on-surface-variant/70"
          aria-hidden="true"
        />
        <span>Pengguna wajib memperbarui kata sandi ini saat pertama kali masuk ke aplikasi.</span>
      </div>

      {proposal.reason && (
        <div className="border-t border-black/5.5 px-4 py-2.5 text-meta text-on-surface-variant">
          <span className="font-semibold text-on-surface">Catatan:</span> {proposal.reason}
        </div>
      )}
    </ProposalCardShell>
  );
}
