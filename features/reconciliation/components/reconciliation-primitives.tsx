import type { ReconciliationWorkspace } from "@/app/actions/finance/reconciliation-workspace";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { formatIsoDate } from "@/components/ui/form/form-control-utils";
import { AppIcon } from "@/components/ui/icon/app-icon";
import type { CashDirection } from "@/lib/finance/cash-direction";
import { formatIdr } from "@/lib/utils/money";

export type ReconciliationView = "cash" | "statement" | "history";

export interface StatementDraft {
  readonly bankAccountId: string;
  readonly transactionDate: string;
  readonly description: string;
  readonly amount: string;
  readonly type: CashDirection;
}

export interface ImportDraft {
  readonly bankAccountId: string;
  readonly fileName: string;
  readonly content: string;
}

export function newStatementDraft(bankAccountId: string): StatementDraft {
  return {
    bankAccountId,
    transactionDate: formatIsoDate(new Date()),
    description: "",
    amount: "",
    type: "INFLOW",
  };
}

export function formatReconciliationDate(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function directionCopy(type: CashDirection): string {
  return type === "INFLOW" ? "Dana masuk" : "Dana keluar";
}

function directionIcon(type: CashDirection): string {
  return type === "INFLOW" ? "south_west" : "north_east";
}

export function ReconciliationEmptyState({
  kind,
}: {
  readonly kind: ReconciliationView;
}): React.JSX.Element {
  const statement = kind === "statement";
  const history = kind === "history";

  return (
    <div className="flex min-h-30 items-center gap-3 px-4 py-5">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ring-1 ${statement ? "bg-surface-container-low text-on-surface-variant ring-ring-subtle" : "bg-success/8 text-success ring-success/6"}`}
        aria-hidden="true"
      >
        <AppIcon
          name={history ? "history" : statement ? "receipt_long" : "check_circle"}
          className="text-[19px] leading-none"
        />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-on-surface">
          {history
            ? "Belum ada riwayat"
            : statement
              ? "Belum ada mutasi bank"
              : "Semua catatan sudah cocok"}
        </p>
        <p className="mt-0.5 text-meta text-on-surface-variant">
          {history
            ? "Pasangan yang sudah dikonfirmasi akan tersimpan di sini."
            : statement
              ? "Impor CSV rekening koran untuk menemukan pasangan secara otomatis."
              : "Tidak ada transaksi internal yang perlu ditinjau."}
        </p>
      </div>
    </div>
  );
}

export function ReconciliationRow({
  title,
  context,
  status,
  statusTone = "neutral",
  amount,
  type,
  interactive = true,
  presentation = "grouped",
  onClick,
  ariaLabel,
}: {
  readonly title: string;
  readonly context: string;
  readonly status: string;
  readonly statusTone?: "neutral" | "success" | "warning";
  readonly amount: number;
  readonly type: CashDirection;
  readonly interactive?: boolean;
  readonly presentation?: "card" | "grouped";
  readonly onClick?: () => void;
  readonly ariaLabel?: string;
}): React.JSX.Element {
  const statusClass =
    statusTone === "success"
      ? "text-success"
      : statusTone === "warning"
        ? "text-warning"
        : "text-on-surface-variant/65";
  const content = (
    <>
      <span className="flex min-w-0 items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[13px] leading-5 font-semibold tracking-[-0.01em] text-on-surface">
            {title}
          </span>
          <span className="mt-1 block truncate text-meta font-medium text-on-surface-variant/70">
            {context}
          </span>
        </span>
        {interactive ? (
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-on-surface-variant/38"
            aria-hidden="true"
          >
            <AppIcon name="chevron_right" className="text-[18px] leading-none" />
          </span>
        ) : null}
      </span>
      <span className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3">
        <span
          className={`flex max-w-[42%] min-w-0 items-center gap-1.5 text-meta font-semibold ${statusClass}`}
        >
          <AppIcon
            name={
              statusTone === "success"
                ? "check_circle"
                : statusTone === "warning"
                  ? "error"
                  : directionIcon(type)
            }
            className="shrink-0 text-[14px] leading-none"
          />
          <span className="truncate">{status}</span>
        </span>
        <MoneyValue
          amount={amount}
          variant="fullDynamic"
          prefix={type === "INFLOW" ? "+" : "-"}
          tone={type === "INFLOW" ? "primary" : "danger"}
          align="right"
          size="sm"
          className="min-w-0 flex-1"
        />
      </span>
    </>
  );
  const className = `block min-h-25 w-full px-4 py-3.5 text-left outline-none transition-colors focus-visible:bg-surface-container-low active:bg-surface-container-low/70 ${
    presentation === "card"
      ? "overflow-hidden rounded-[26px] bg-white shadow-surface ring-1 ring-ring-subtle"
      : ""
  }`;

  if (!interactive) return <div className={className}>{content}</div>;

  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>
      {content}
    </button>
  );
}

export function ReconciliationHistoryRow({
  item,
  onClick,
}: {
  readonly item: ReconciliationWorkspace["history"][number];
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Buka riwayat ${item.cashDescription}, ${formatIdr(item.amount)}`}
      className="block min-h-27 w-full px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
    >
      <span className="flex min-w-0 items-start gap-3">
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex min-w-0 items-center gap-2">
            <AppIcon
              name="receipt_long"
              className="shrink-0 text-[14px] leading-none text-on-surface-variant/55"
            />
            <span className="truncate text-[12px] leading-4 font-semibold text-on-surface">
              {item.cashDescription}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-2 pl-0.5">
            <AppIcon name="link" className="shrink-0 text-[13px] leading-none text-success" />
            <span className="truncate text-support font-medium text-on-surface-variant/75">
              {item.statementDescription}
            </span>
          </span>
        </span>
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-on-surface-variant/38"
          aria-hidden="true"
        >
          <AppIcon name="chevron_right" className="text-[18px] leading-none" />
        </span>
      </span>
      <span className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3">
        <span className="flex max-w-[42%] min-w-0 items-center gap-1.5 text-meta font-semibold text-success">
          <AppIcon name="check_circle" className="shrink-0 text-[14px] leading-none" />
          <span className="truncate">Cocok {formatReconciliationDate(item.reconciledAt)}</span>
        </span>
        <MoneyValue
          amount={item.amount}
          variant="fullDynamic"
          prefix={item.type === "INFLOW" ? "+" : "-"}
          tone={item.type === "INFLOW" ? "primary" : "danger"}
          align="right"
          size="sm"
          className="min-w-0 flex-1"
        />
      </span>
    </button>
  );
}

export function SheetMoneySummary({
  amount,
  type,
  label,
  meta,
  confirmed = false,
}: {
  readonly amount: number;
  readonly type: CashDirection;
  readonly label: string;
  readonly meta: string;
  readonly confirmed?: boolean;
}): React.JSX.Element {
  return (
    <section className="px-1 py-1 text-center" aria-label={label}>
      <p
        className={`flex items-center justify-center gap-1.5 text-meta font-bold ${confirmed ? "text-success" : "text-on-surface-variant"}`}
      >
        <AppIcon
          name={confirmed ? "check_circle" : directionIcon(type)}
          className="text-[15px] leading-none"
        />
        {label}
      </p>
      <MoneyValue
        amount={amount}
        variant="fullDynamic"
        prefix={type === "INFLOW" ? "+" : "-"}
        tone={type === "INFLOW" ? "primary" : "danger"}
        align="center"
        size="hero"
        className="mx-auto mt-2 w-full"
      />
      <p className="mt-1.5 text-meta font-medium text-on-surface-variant/70">{meta}</p>
    </section>
  );
}

export function EvidenceDescription({
  icon,
  title,
  description,
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-17 items-start gap-3 px-4 py-3.5">
      <AppIcon
        name={icon}
        className="mt-0.5 shrink-0 text-[17px] leading-none text-on-surface-variant/55"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-5 font-semibold text-on-surface">{title}</span>
        <span className="mt-0.5 block text-meta font-medium text-on-surface-variant/70">
          {description}
        </span>
      </span>
    </div>
  );
}

export function EvidenceMetaRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-12 items-start justify-between gap-4 px-4 py-3">
      <span className="shrink-0 text-meta font-medium text-on-surface-variant">{label}</span>
      <span className="min-w-0 text-right text-support font-semibold wrap-break-word text-on-surface">
        {value}
      </span>
    </div>
  );
}
