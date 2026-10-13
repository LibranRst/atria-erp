"use client";

import { confirmAiBankReconciliationProposal } from "@/app/actions/ai/confirm-bank-reconciliation-proposal";
import { AdaptiveSelect, AppIcon, FormSection, MoneyValue, SegmentedTabs } from "@/components/ui";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import * as React from "react";
import { ProposalCardShell } from "./proposal-card-shell";

export type BankReconciliationMatchItem = {
  readonly cashTransactionId: string;
  readonly cashTransactionDescription: string;
  readonly cashTransactionDate: string;
  readonly statementRow: {
    readonly transactionDate: string;
    readonly description: string;
    readonly amount: number;
    readonly type: "INFLOW" | "OUTFLOW";
  };
  readonly matchedAmount: { readonly amount: number; readonly formatted: string };
};

export type BankReconciliationUnmatchedItem = {
  readonly transactionDate: string;
  readonly description: string;
  readonly amount: number;
  readonly type: "INFLOW" | "OUTFLOW";
  readonly formattedAmount: { readonly amount: number; readonly formatted: string };
};

export type BankReconciliationProposalData = {
  readonly kind: "BANK_RECONCILIATION";
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly accountNumber: string;
  readonly totalMutations: number;
  readonly matchedCount: number;
  readonly unmatchedCount: number;
  readonly matches: readonly BankReconciliationMatchItem[];
  readonly unmatchedMutations: readonly BankReconciliationUnmatchedItem[];
  readonly availableBankAccounts?: readonly {
    readonly id: string;
    readonly name: string;
    readonly bankName: string;
    readonly accountNumber: string;
  }[];
};

type AiReconciliationProposalCardProps = {
  readonly proposal: BankReconciliationProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
};

export function AiReconciliationProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: AiReconciliationProposalCardProps): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">(
    alreadyConfirmed ? "submitted" : "idle",
  );
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  const [selectedBankAccountId, setSelectedBankAccountId] = React.useState(proposal.bankAccountId);
  const [selectedMatchIds, setSelectedMatchIds] = React.useState<ReadonlySet<string>>(
    () => new Set(proposal.matches.map((m) => m.cashTransactionId)),
  );
  const [activeTab, setActiveTab] = React.useState<"matches" | "unmatched">("matches");
  const [importUnmatched, setImportUnmatched] = React.useState(true);
  const isDifferentAccount = selectedBankAccountId !== proposal.bankAccountId;
  const selectedAccount = proposal.availableBankAccounts?.find(
    (a) => a.id === selectedBankAccountId,
  );

  function toggleMatch(id: string): void {
    if (status === "submitting" || alreadyConfirmed || isDifferentAccount) return;
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectedMatches = isDifferentAccount
    ? []
    : proposal.matches.filter((m) => selectedMatchIds.has(m.cashTransactionId));

  async function handleConfirm(): Promise<void> {
    if (!conversationId) {
      setStatus("failed");
      setErrorMessage("Sesi percakapan belum siap. Silakan coba lagi.");
      return;
    }

    if (isDifferentAccount) {
      const allMutations = [
        ...proposal.matches.map((m) => ({
          transactionDate: m.statementRow.transactionDate,
          description: m.statementRow.description,
          amount: m.statementRow.amount,
          type: m.statementRow.type,
        })),
        ...proposal.unmatchedMutations.map((u) => ({
          transactionDate: u.transactionDate,
          description: u.description,
          amount: u.amount,
          type: u.type,
        })),
      ];

      if (allMutations.length === 0) {
        setStatus("failed");
        setErrorMessage("Tidak ada mutasi yang siap diimpor.");
        return;
      }

      setStatus("submitting");

      const result = await confirmAiBankReconciliationProposal({
        toolCallId,
        conversationId,
        bankAccountId: selectedBankAccountId,
        matches: [],
        unmatchedMutations: allMutations,
        importUnmatched: true,
      });

      if (result.success) {
        setStatus("submitted");
        return;
      }

      setStatus("failed");
      setErrorMessage(result.error.message);
      return;
    }

    if (
      selectedMatches.length === 0 &&
      (!importUnmatched || proposal.unmatchedMutations.length === 0)
    ) {
      setStatus("failed");
      setErrorMessage("Pilih minimal satu mutasi untuk direkonsiliasi atau centang impor mutasi.");
      return;
    }

    setStatus("submitting");

    const result = await confirmAiBankReconciliationProposal({
      toolCallId,
      conversationId,
      bankAccountId: selectedBankAccountId,
      matches: selectedMatches.map((m) => ({
        cashTransactionId: m.cashTransactionId,
        statementRow: {
          transactionDate: m.statementRow.transactionDate,
          description: m.statementRow.description,
          amount: m.statementRow.amount,
          type: m.statementRow.type,
        },
      })),
      unmatchedMutations: proposal.unmatchedMutations.map((u) => ({
        transactionDate: u.transactionDate,
        description: u.description,
        amount: u.amount,
        type: u.type,
      })),
      importUnmatched,
    });

    if (result.success) {
      setStatus("submitted");
      return;
    }

    setStatus("failed");
    setErrorMessage(result.error.message);
  }

  const effectiveTitle =
    isDifferentAccount && selectedAccount
      ? `${selectedAccount.bankName} - ${selectedAccount.name}`
      : `${proposal.bankAccountName}`;

  const effectiveConfirmLabel = isDifferentAccount
    ? `Impor ${proposal.totalMutations} Mutasi ke ${selectedAccount?.bankName ?? "Rekening"}`
    : selectedMatches.length > 0
      ? `Konfirmasi Rekonsiliasi (${selectedMatches.length} Mutasi)`
      : "Impor Mutasi Rekening Koran";

  return (
    <ProposalCardShell
      eyebrow="Usulan Rekonsiliasi Bank"
      title={effectiveTitle}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmLabel={effectiveConfirmLabel}
      submittedMessage="Rekonsiliasi mutasi bank berhasil dieksekusi dan dicatat di sistem."
      onConfirm={handleConfirm}
      viewActionLabel="Buka Halaman Rekonsiliasi"
      onViewAction={() => {
        onNavigate?.();
        router.push("/reconciliation");
      }}
    >
      <div className="space-y-3 px-4 py-3">
        {/* Metrik Ringkasan (Atria Inset Metric Cells: 3 compact columns) */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-surface-container-low px-2.5 py-2 text-center">
            <span className="block text-meta font-bold tracking-wider text-on-surface-variant uppercase">
              Total Mutasi
            </span>
            <p className="mt-0.5 text-section font-bold text-on-surface tabular-nums">
              {proposal.totalMutations}
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low px-2.5 py-2 text-center">
            <span className="block text-meta font-bold tracking-wider text-success uppercase">
              Cocok 100%
            </span>
            <p className="mt-0.5 text-section font-bold text-success tabular-nums">
              {isDifferentAccount ? 0 : proposal.matchedCount}
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low px-2.5 py-2 text-center">
            <span className="block text-meta font-bold tracking-wider text-on-surface-variant uppercase">
              {isDifferentAccount ? "Siap Impor" : "Belum Tercatat"}
            </span>
            <p className="mt-0.5 text-section font-bold text-on-surface tabular-nums">
              {isDifferentAccount ? proposal.totalMutations : proposal.unmatchedCount}
            </p>
          </div>
        </div>

        {/* Identitas Rekening Bank (Bersih, Anti-Overflow) */}
        <div className="overflow-hidden rounded-2xl bg-surface-container-low p-1 ring-1 ring-ring-subtle">
          {proposal.availableBankAccounts &&
          proposal.availableBankAccounts.length > 1 &&
          !alreadyConfirmed &&
          status !== "submitting" ? (
            <FormSection presentation="embedded">
              <AdaptiveSelect
                label="Rekening Bank"
                value={selectedBankAccountId}
                onChange={setSelectedBankAccountId}
                options={proposal.availableBankAccounts.map((account) => ({
                  value: account.id,
                  label: `${account.bankName} - ${account.name}`,
                  description: `No. Rek: ${account.accountNumber}`,
                }))}
                placeholder="Pilih rekening bank"
                searchPlaceholder="Cari rekening atau nomor rekening..."
              />
            </FormSection>
          ) : (
            <div className="min-w-0 px-3 py-2">
              <span className="block text-meta font-semibold text-on-surface-variant">
                Rekening Bank
              </span>
              <div className="mt-0.5 truncate text-support font-bold text-on-surface">
                {effectiveTitle}
              </div>
              <div className="text-meta text-on-surface-variant tabular-nums">
                No. Rek: {selectedAccount?.accountNumber ?? proposal.accountNumber}
              </div>
            </div>
          )}
        </div>

        {/* Pemberitahuan jika rekening diubah */}
        {isDifferentAccount && (
          <div className="rounded-2xl bg-accent-container/50 p-3 text-support text-on-surface ring-1 ring-accent/20">
            <div className="flex items-center gap-2 font-bold text-accent">
              <AppIcon name="info" className="icon-sm shrink-0" />
              <span>Rekening Tujuan Diubah</span>
            </div>
            <p className="mt-1 text-on-surface-variant">
              Pencocokan buku kas sebelumnya dihitung untuk{" "}
              <strong>{proposal.bankAccountName}</strong>. Seluruh {proposal.totalMutations} mutasi
              akan diimpor sebagai mutasi rekening koran baru ke{" "}
              <strong>
                {selectedAccount?.bankName} - {selectedAccount?.name}
              </strong>
              .
            </p>
          </div>
        )}

        {/* Segmented Control Internal: Cocok vs Belum Tercatat (Shared UI Compact) */}
        {!isDifferentAccount && (
          <SegmentedTabs<"matches" | "unmatched">
            value={activeTab}
            onChange={setActiveTab}
            density="compact"
            ariaLabel="Pilihan Daftar Mutasi"
            options={[
              {
                value: "matches",
                label: "Cocok",
                count: selectedMatches.length,
              },
              {
                value: "unmatched",
                label: "Belum Tercatat",
                count: proposal.unmatchedMutations.length,
              },
            ]}
          />
        )}

        {/* Konten Tab: Daftar Transaksi Cocok */}
        {!isDifferentAccount && activeTab === "matches" && (
          <div className="space-y-1.5">
            {proposal.matches.length === 0 ? (
              <div className="rounded-2xl bg-surface-container-low p-4 text-center text-support text-on-surface-variant ring-1 ring-ring-subtle">
                Tidak ada mutasi yang cocok persis dengan transaksi kas yang belum direkonsiliasi.
              </div>
            ) : (
              <div className="max-h-64 divide-y divide-black/5.5 overflow-y-auto rounded-2xl bg-white shadow-control ring-1 ring-ring-subtle">
                {proposal.matches.map((match) => {
                  const isSelected = selectedMatchIds.has(match.cashTransactionId);
                  const isInflow = match.statementRow.type === "INFLOW";
                  const isDisabled = status === "submitting" || alreadyConfirmed;

                  return (
                    <div
                      key={match.cashTransactionId}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={isDisabled ? -1 : 0}
                      onClick={() => toggleMatch(match.cashTransactionId)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggleMatch(match.cashTransactionId);
                        }
                      }}
                      className={`flex cursor-pointer items-start gap-3 p-3 transition-colors outline-none hover:bg-surface-container-low/60 focus-visible:bg-surface-container-low/80 ${
                        isSelected ? "bg-white" : "bg-surface-container-low/30 opacity-60"
                      } ${isDisabled ? "cursor-default" : ""}`}
                    >
                      {/* iOS-inspired Custom Check Circle */}
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all ${
                          isSelected
                            ? "bg-primary text-white shadow-sm"
                            : "border-2 border-outline-variant/60 bg-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && <AppIcon name="check" className="icon-xs leading-none" />}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Baris Atas: Deskripsi Statement & Nominal */}
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-row font-semibold text-on-surface">
                            {match.statementRow.description}
                          </span>
                          <span
                            className={`shrink-0 text-row font-bold tabular-nums ${
                              isInflow ? "text-success" : "text-on-surface"
                            }`}
                          >
                            {isInflow ? "+" : "-"}
                            <MoneyValue
                              amount={match.statementRow.amount}
                              variant="compact"
                              size="sm"
                              align="right"
                            />
                          </span>
                        </div>

                        {/* Baris Bawah: Bukti Transaksi Kas Internal */}
                        <div className="flex items-center gap-1.5 text-meta text-on-surface-variant">
                          <span className="shrink-0">{match.statementRow.transactionDate}</span>
                          <span className="text-on-surface-variant/40">•</span>
                          <span className="flex min-w-0 items-center gap-1 truncate font-medium">
                            <AppIcon
                              name="link"
                              className="icon-xs shrink-0 leading-none text-success"
                            />
                            <span className="truncate">
                              Kas: {match.cashTransactionDescription}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Konten Tab: Daftar Mutasi Belum Tercatat */}
        {(isDifferentAccount || activeTab === "unmatched") && (
          <div className="space-y-2">
            {/* Kontrol Check Circle Simpan Mutasi Belum Tercatat */}
            <div
              role="checkbox"
              aria-checked={importUnmatched}
              tabIndex={status === "submitting" || alreadyConfirmed || isDifferentAccount ? -1 : 0}
              onClick={() => {
                if (status !== "submitting" && !alreadyConfirmed && !isDifferentAccount) {
                  setImportUnmatched((prev) => !prev);
                }
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === " " || e.key === "Enter") &&
                  status !== "submitting" &&
                  !alreadyConfirmed &&
                  !isDifferentAccount
                ) {
                  e.preventDefault();
                  setImportUnmatched((prev) => !prev);
                }
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-3.5 py-2.5 ring-1 ring-ring-subtle transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                status === "submitting" || alreadyConfirmed || isDifferentAccount
                  ? "cursor-default opacity-85"
                  : "hover:bg-surface-container"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all ${
                    importUnmatched
                      ? "bg-primary text-white shadow-sm"
                      : "border-2 border-outline-variant/60 bg-transparent"
                  }`}
                  aria-hidden="true"
                >
                  {importUnmatched && <AppIcon name="check" className="icon-xs leading-none" />}
                </div>
                <span className="truncate text-support font-semibold text-on-surface">
                  {isDifferentAccount
                    ? `Simpan Seluruh ${proposal.totalMutations} Mutasi Baru`
                    : `Simpan ${proposal.unmatchedMutations.length} Mutasi Belum Tercatat`}
                </span>
              </div>
              <span className="shrink-0 text-meta font-medium text-on-surface-variant">
                Rekening Koran
              </span>
            </div>

            {/* List Transaksi Belum Tercatat */}
            {proposal.unmatchedMutations.length === 0 && !isDifferentAccount ? (
              <div className="rounded-2xl bg-surface-container-low p-4 text-center text-support text-on-surface-variant ring-1 ring-ring-subtle">
                Semua mutasi bank cocok dengan buku kas.
              </div>
            ) : (
              <div className="max-h-64 divide-y divide-black/5.5 overflow-y-auto rounded-2xl bg-white shadow-control ring-1 ring-ring-subtle">
                {(isDifferentAccount
                  ? [
                      ...proposal.matches.map((m) => ({
                        description: m.statementRow.description,
                        transactionDate: m.statementRow.transactionDate,
                        amount: m.statementRow.amount,
                        type: m.statementRow.type,
                      })),
                      ...proposal.unmatchedMutations,
                    ]
                  : proposal.unmatchedMutations
                ).map((item, idx) => {
                  const isInflow = item.type === "INFLOW";

                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-row font-semibold text-on-surface">
                          {item.description}
                        </p>
                        <p className="text-meta text-on-surface-variant">{item.transactionDate}</p>
                      </div>
                      <span
                        className={`shrink-0 text-row font-bold tabular-nums ${
                          isInflow ? "text-success" : "text-on-surface"
                        }`}
                      >
                        {isInflow ? "+" : "-"}
                        <MoneyValue
                          amount={item.amount}
                          variant="compact"
                          size="sm"
                          align="right"
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </ProposalCardShell>
  );
}
