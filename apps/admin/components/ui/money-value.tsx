import { formatIdr, formatShortIdr } from "@atria/core/utils/money";

export function MoneyValue({
  amount,
  compact = false,
  className = "",
}: {
  readonly amount: number;
  readonly compact?: boolean;
  readonly className?: string;
}): React.JSX.Element {
  const full = formatIdr(amount);
  return (
    <span
      className={`whitespace-nowrap tabular-nums ${className}`}
      title={compact ? full : undefined}
    >
      {compact ? formatShortIdr(amount) : full}
    </span>
  );
}
