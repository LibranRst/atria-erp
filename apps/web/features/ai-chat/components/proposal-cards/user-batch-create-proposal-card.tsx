"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import * as React from "react";

import { confirmAiCreateUserBatchProposal } from "@/app/actions/ai/confirm-create-user-batch-proposal";
import { AppIcon, UserAvatar } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { ProposalCardShell } from "./proposal-card-shell";

export type BatchUserItem = {
  readonly name: string;
  readonly email: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly roleDisplayName: string;
  readonly roleDescription?: string;
  readonly dataScope: "GLOBAL" | "ASSIGNED" | "NONE";
  readonly scopeEffect: string;
  readonly temporaryPassword: string;
};

export type CreateUserBatchProposalData = {
  readonly kind: "CREATE_USER_BATCH";
  readonly count: number;
  readonly users: readonly BatchUserItem[];
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
 * Kartu usulan pembuatan banyak akun staf sekaligus (Batch User Creation).
 *
 * Menampilkan daftar ringkas calon staf, penugasan peran, cakupan proyek,
 * kata sandi sementara, action banner "Salin Semua Kredensial" untuk broadcast WhatsApp,
 * dan tombol atomik untuk mengeksekusi pembuatan seluruh akun dalam satu transaksi database.
 */
export function UserBatchCreateProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: {
  readonly proposal: CreateUserBatchProposalData;
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
  const [isAllCopied, setIsAllCopied] = React.useState<boolean>(false);
  const [copiedPasswordIdx, setCopiedPasswordIdx] = React.useState<number | null>(null);

  async function handleConfirm(): Promise<void> {
    if (!conversationId) {
      setStatus("failed");
      setErrorMessage("Sesi percakapan belum siap. Silakan coba lagi.");
      return;
    }

    setStatus("submitting");
    const result = await confirmAiCreateUserBatchProposal({
      toolCallId,
      conversationId,
      users: proposal.users.map((u) => ({
        name: u.name,
        email: u.email,
        roleId: u.roleId,
        temporaryPassword: u.temporaryPassword,
      })),
    });

    if (result.success) {
      setStatus("submitted");
      return;
    }
    setStatus("failed");
    setErrorMessage(result.error.message);
  }

  async function handleCopyPassword(password: string, index: number): Promise<void> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(password);
        setCopiedPasswordIdx(index);
        setTimeout(() => setCopiedPasswordIdx(null), 2000);
      }
    } catch {
      // Fallback diam
    }
  }

  async function handleCopyAllCredentials(): Promise<void> {
    const lines = [
      `*Daftar Akun Tim Baru Atria ERP (${proposal.count} Pengguna)*:`,
      "",
      ...proposal.users.map(
        (u, i) =>
          `${i + 1}. *${u.name}* (${u.roleDisplayName})\n   Email: ${u.email}\n   Password Sementara: ${u.temporaryPassword}`,
      ),
      "",
      "Catatan: Seluruh pengguna wajib memperbarui kata sandi saat pertama kali masuk ke aplikasi.",
    ];

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(lines.join("\n"));
        setIsAllCopied(true);
        setTimeout(() => setIsAllCopied(false), 2500);
      }
    } catch {
      // Fallback diam
    }
  }

  return (
    <ProposalCardShell
      eyebrow={`${proposal.count} Calon Anggota Tim`}
      title="Usulan Pembuatan Tim Sekaligus"
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmEmphasis="primary"
      confirmLabel={`Buat Semua Pengguna (${proposal.count} Akun)`}
      submittedMessage={`Sebanyak ${proposal.count} akun pengguna telah berhasil dibuat. Salin kredensial di bawah untuk dibagikan.`}
      onConfirm={handleConfirm}
      viewActionLabel="Buka Pengaturan Tim"
      onViewAction={() => {
        onNavigate?.();
        router.push(proposal.settingsHref || "/settings?tab=organization");
      }}
    >
      {/* Action Banner: Salin Semua Kredensial Siap Broadcast WhatsApp */}
      <div className="flex items-center justify-between gap-3 border-b border-black/5.5 bg-surface-container-low/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-support font-bold text-on-surface">Pesan Kredensial Semua Tim</p>
          <p className="truncate text-meta text-on-surface-variant/80">
            Format lengkap seluruh akun siap broadcast WhatsApp
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          transition={transitionSpringSnappy}
          onClick={() => void handleCopyAllCredentials()}
          className={`relative flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-meta font-bold shadow-control transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${
            isAllCopied
              ? "bg-primary font-bold text-on-primary shadow-primary"
              : "bg-surface-container text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest"
          }`}
        >
          <AppIcon
            name={isAllCopied ? "check_circle" : "copy"}
            className="icon-xs shrink-0"
            aria-hidden="true"
          />
          <AnimatePresence mode="wait" initial={false}>
            {isAllCopied ? (
              <motion.span
                key="all-copied"
                initial={{ opacity: 0, y: 3, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -3, scale: 0.9 }}
                transition={transitionSpringSnappy}
                className="inline-block whitespace-nowrap"
              >
                Semua Tersalin!
              </motion.span>
            ) : (
              <motion.span
                key="all-copy"
                initial={{ opacity: 0, y: -3, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 3, scale: 0.9 }}
                transition={transitionSpringSnappy}
                className="inline-block whitespace-nowrap"
              >
                Salin Semua Kredensial
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Daftar Anggota Tim dalam Batch */}
      <div className="divide-y divide-black/5.5">
        {proposal.users.map((u, index) => {
          const initials = getInitials(u.name);
          const isPasswordCopied = copiedPasswordIdx === index;

          return (
            <div key={`${u.email}-${index}`} className="space-y-2.5 px-4 py-3.5">
              {/* Profil & Badge Peran */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar
                    initials={initials}
                    displayName={u.name}
                    renderPx={38}
                    className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-meta font-bold text-primary"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-row font-bold text-on-surface">{u.name}</p>
                    <p className="truncate text-meta text-on-surface-variant">{u.email}</p>
                  </div>
                </div>

                <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-eyebrow font-bold tracking-wide text-primary uppercase">
                  {u.roleDisplayName}
                </span>
              </div>

              {/* Subline Cakupan Proyek */}
              <div className="flex items-center gap-1.5 pl-1 text-meta text-on-surface-variant">
                <AppIcon
                  name="folder"
                  className="icon-xs shrink-0 text-on-surface-variant/70"
                  aria-hidden="true"
                />
                <span className="truncate">
                  <strong className="font-semibold text-on-surface">Cakupan Proyek:</strong>{" "}
                  {u.scopeEffect}
                </span>
              </div>

              {/* Kolom Sandi Kapsul dengan Tombol Salin Inline */}
              <div className="flex min-h-11 items-center justify-between gap-2 rounded-full border border-black/8 bg-white py-1 pr-1.5 pl-4 shadow-control">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-eyebrow font-semibold text-on-surface-variant/70 uppercase">
                    Sandi:
                  </span>
                  <code className="truncate font-mono text-meta font-bold tracking-wide text-on-surface select-all">
                    {u.temporaryPassword}
                  </code>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  transition={transitionSpringSnappy}
                  onClick={() => void handleCopyPassword(u.temporaryPassword, index)}
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
                        Salin
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Catatan Bawah */}
      <div className="flex items-start gap-2 border-t border-black/5.5 bg-surface-container-low/30 px-4 py-2.5 text-meta leading-tight text-on-surface-variant">
        <AppIcon
          name="info"
          className="mt-0.5 icon-xs shrink-0 text-on-surface-variant/70"
          aria-hidden="true"
        />
        <span>
          Seluruh pengguna wajib memperbarui kata sandi ini saat pertama kali masuk ke aplikasi.
        </span>
      </div>

      {proposal.reason && (
        <div className="border-t border-black/5.5 px-4 py-2.5 text-meta text-on-surface-variant">
          <span className="font-semibold text-on-surface">Catatan:</span> {proposal.reason}
        </div>
      )}
    </ProposalCardShell>
  );
}
