import React from "react";
import { toast } from "sonner";

import {
  AppIcon,
  Button,
  DetailSection,
  DetailSheet,
  GroupedSurface,
  IconButton,
  InlineStateRow,
  MoneyValue,
  StatusBadge,
  useSheetPresenceValue,
} from "@/components/ui";
import { AccountTransactionRows } from "./account-transaction-rows";
import type { BankAccount } from "@/features/finance-dashboard/types/bank-account-types";

export function AccountDetailSheet({
  open,
  account,
  canArchive,
  canTransfer,
  canMove,
  canEdit = true,
  pending,
  onClose,
  onDebit,
  onCredit,
  onTransfer,
  onEdit,
  onToggleActive,
}: {
  readonly open: boolean;
  readonly account: BankAccount | null;
  readonly canArchive: boolean;
  readonly canTransfer: boolean;
  readonly canMove: boolean;
  readonly canEdit?: boolean;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onDebit: (account: BankAccount) => void;
  readonly onCredit: (account: BankAccount) => void;
  readonly onTransfer: (account: BankAccount) => void;
  readonly onEdit: (account: BankAccount) => void;
  readonly onToggleActive: (account: BankAccount) => void;
}): React.JSX.Element {
  const { presentedValue: presentedAccount, handleExitComplete } = useSheetPresenceValue(
    open ? account : null,
    open ? account?.id : null,
  );

  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const copied = Boolean(presentedAccount && copiedId === presentedAccount.id);
  const isDarkText = presentedAccount?.cardTextColor === "dark";

  React.useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => {
      setCopiedId(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [copiedId]);

  const handleCopyAccountNumber = React.useCallback(async () => {
    const account = presentedAccount;
    if (!account?.accountNumber) return;
    try {
      let copiedSuccessfully = false;
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(account.accountNumber);
          copiedSuccessfully = true;
        } catch {
          // If writeText throws (e.g. permission or focus issues), fall through to textarea fallback
        }
      }
      if (!copiedSuccessfully) {
        if (typeof document !== "undefined") {
          const textArea = document.createElement("textarea");
          textArea.value = account.accountNumber;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          textArea.style.top = "-9999px";
          textArea.setAttribute("readonly", "");
          document.body.appendChild(textArea);
          textArea.select();
          const successful = document.execCommand("copy");
          document.body.removeChild(textArea);
          if (!successful) {
            throw new Error("Fallback copy failed");
          }
        } else {
          throw new Error("Clipboard unavailable");
        }
      }
      setCopiedId(account.id);
      toast.success("Nomor rekening disalin ke clipboard.");
    } catch {
      toast.error("Gagal menyalin nomor rekening.");
    }
  }, [presentedAccount]);

  return (
    <DetailSheet
      open={open && account !== null}
      title="Detail Rekening"
      onClose={onClose}
      onExitComplete={handleExitComplete}
      action={
        canEdit && presentedAccount ? (
          <IconButton
            label="Edit rekening"
            icon={<AppIcon name="edit" className="icon-sm" />}
            variant="secondary"
            disabled={pending}
            onClick={() => onEdit(presentedAccount)}
            className="shadow-control"
          />
        ) : undefined
      }
    >
      {presentedAccount ? (
        <div className="space-y-md">
          {/* Hero Saldo & Identitas */}
          <div
            className={`relative overflow-hidden rounded-owner p-5 ring-1 ${
              isDarkText ? "text-on-surface ring-ring-subtle" : "text-white ring-white/16"
            } ${presentedAccount.isActive ? "" : "opacity-60 grayscale"}`}
            style={{
              backgroundImage: `linear-gradient(135deg, ${presentedAccount.cardColorFrom}, ${presentedAccount.cardColorTo})`,
            }}
          >
            {/* Top row: Bank icon with container + Bank name, alongside StatusBadge */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-icon ${
                    isDarkText ? "bg-black/6 text-on-surface" : "bg-white/16 text-white"
                  }`}
                  aria-hidden="true"
                >
                  <AppIcon name="account_balance" className="icon-sm" />
                </span>
                <div className="min-w-0">
                  <h3
                    className={`truncate text-sm font-bold tracking-tight ${
                      isDarkText ? "text-on-surface" : "text-white"
                    }`}
                  >
                    {presentedAccount.name}
                  </h3>
                  <p
                    className={`truncate text-eyebrow font-bold tracking-wider uppercase ${
                      isDarkText ? "text-on-surface-variant" : "text-white/75"
                    }`}
                  >
                    {presentedAccount.bankName}
                  </p>
                </div>
              </div>
              <StatusBadge
                tone={presentedAccount.isActive ? "healthy" : "inactive"}
                label={presentedAccount.isActive ? "Aktif" : "Diarsipkan"}
                className={
                  isDarkText
                    ? "!bg-black/6 !text-on-surface !shadow-none ring-1 ring-ring-subtle"
                    : "!bg-white/16 !text-white !shadow-none ring-1 ring-white/20"
                }
              />
            </div>

            {/* Saldo Hero */}
            <div className="mt-5">
              <p
                className={`text-eyebrow font-bold tracking-wider uppercase ${
                  isDarkText ? "text-on-surface-variant" : "text-white/75"
                }`}
              >
                Saldo kas tersedia
              </p>
              <div className="mt-1">
                <MoneyValue
                  amount={presentedAccount.balance}
                  variant="fullDynamic"
                  size="2xl"
                  tone={
                    presentedAccount.balance < 0 ? "danger" : isDarkText ? "inherit" : "inverse"
                  }
                />
              </div>
            </div>

            {/* Inset metadata block */}
            <div
              className={`mt-4 rounded-2xl p-3 ${
                isDarkText ? "bg-black/5 ring-1 ring-black/6" : "bg-white/12 ring-1 ring-white/12"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`block text-eyebrow font-bold tracking-wide uppercase ${
                      isDarkText ? "text-on-surface-variant" : "text-white/75"
                    }`}
                  >
                    Nomor rekening
                  </span>
                  <span
                    className={`mt-0.5 block font-mono text-xs font-bold tracking-wider tabular-nums ${
                      isDarkText ? "text-on-surface" : "text-white"
                    }`}
                  >
                    {presentedAccount.accountNumber}
                  </span>
                </div>
                <Button
                  type="button"
                  size="mini"
                  variant="secondary"
                  onClick={handleCopyAccountNumber}
                  leadingIcon={
                    <AppIcon
                      name={copied ? "check" : "content_copy"}
                      className={`icon-xs ${
                        isDarkText ? "text-on-surface-variant" : "text-white/80"
                      }`}
                    />
                  }
                  className={`shrink-0 ${
                    isDarkText
                      ? "bg-white text-on-surface shadow-control ring-1 ring-ring-control"
                      : "bg-white/16 text-white shadow-none ring-1 ring-white/20 hover:bg-white/22"
                  }`}
                >
                  {copied ? "Tersalin" : "Salin"}
                </Button>
              </div>
              <div
                className={`mt-2.5 flex items-center justify-between gap-3 border-t pt-2.5 ${
                  isDarkText ? "border-black/6" : "border-white/12"
                }`}
              >
                <span
                  className={`shrink-0 text-eyebrow font-bold tracking-wide uppercase ${
                    isDarkText ? "text-on-surface-variant" : "text-white/75"
                  }`}
                >
                  Atas nama
                </span>
                <span
                  className={`min-w-0 truncate text-right text-xs font-semibold ${
                    isDarkText ? "text-on-surface" : "text-white"
                  }`}
                >
                  {presentedAccount.holderName}
                </span>
              </div>
            </div>
          </div>

          {/* Operational Actions (3-column grid) */}
          <div className="grid grid-cols-3 gap-1.5 min-[380px]:gap-2">
            <Button
              type="button"
              variant="primary"
              size="compact"
              fullWidth
              leadingIcon={<AppIcon name="south_west" className="icon-xs shrink-0" />}
              disabled={!presentedAccount.isActive || !canMove || pending}
              onClick={() => onDebit(presentedAccount)}
              className="gap-1 px-1.5 text-support max-[360px]:px-1 max-[360px]:text-meta min-[380px]:gap-1.5 min-[380px]:px-2"
            >
              Kas Masuk
            </Button>
            <Button
              type="button"
              variant="criticalQuiet"
              size="compact"
              fullWidth
              leadingIcon={<AppIcon name="north_east" className="icon-xs shrink-0" />}
              disabled={!presentedAccount.isActive || !canMove || pending}
              onClick={() => onCredit(presentedAccount)}
              className="gap-1 px-1.5 text-support max-[360px]:px-1 max-[360px]:text-meta min-[380px]:gap-1.5 min-[380px]:px-2"
            >
              Kas Keluar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              fullWidth
              leadingIcon={<AppIcon name="swap_horiz" className="icon-xs shrink-0" />}
              disabled={!presentedAccount.isActive || !canTransfer || pending}
              onClick={() => onTransfer(presentedAccount)}
              className="gap-1 px-1.5 text-support max-[360px]:px-1 max-[360px]:text-meta min-[380px]:gap-1.5 min-[380px]:px-2"
            >
              Transfer
            </Button>
          </div>

          {/* Polite Warning / Helper for Inactive or Transfer unavailable */}
          <div aria-live="polite">
            {!presentedAccount.isActive ? (
              <GroupedSurface>
                <InlineStateRow
                  icon="archive"
                  tone="warning"
                  title="Rekening diarsipkan"
                  description="Aktifkan kembali rekening di bawah untuk mencatat kas masuk, kas keluar, atau transfer."
                />
              </GroupedSurface>
            ) : !canMove ? (
              <GroupedSurface>
                <InlineStateRow
                  icon="lock"
                  tone="neutral"
                  title="Akses baca rekening"
                  description="Peran Anda belum memiliki izin untuk mencatat mutasi kas."
                />
              </GroupedSurface>
            ) : !canTransfer ? (
              <GroupedSurface>
                <InlineStateRow
                  icon="swap_horiz"
                  tone="neutral"
                  title="Transfer belum tersedia"
                  description="Transfer membutuhkan setidaknya satu rekening aktif lain sebagai tujuan."
                />
              </GroupedSurface>
            ) : null}
          </div>

          {/* Aktivitas Terbaru */}
          <DetailSection
            title="Aktivitas terbaru"
            count={presentedAccount.recentTransactions.length}
            countLabel="Catatan terbaru"
            href="/expenses"
            actionLabel="Kas & Tagihan"
          >
            <AccountTransactionRows transactions={presentedAccount.recentTransactions} />
          </DetailSection>

          {/* Administrative Action (Archive / Reactivate) */}
          {canArchive ? (
            <div className="pt-1">
              <Button
                type="button"
                variant={presentedAccount.isActive ? "criticalQuiet" : "secondary"}
                fullWidth
                leadingIcon={
                  <AppIcon
                    name={presentedAccount.isActive ? "archive" : "restore"}
                    className="icon-sm"
                  />
                }
                disabled={pending}
                onClick={() => onToggleActive(presentedAccount)}
              >
                {presentedAccount.isActive ? "Arsipkan rekening" : "Aktifkan kembali"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </DetailSheet>
  );
}
