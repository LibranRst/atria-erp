"use client";

import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { Chip } from "@heroui/react";

function statusColor(status: string): "default" | "success" | "warning" | "danger" {
  if (["CRITICAL", "OVER_BUDGET", "CANCELLED", "REJECTED"].includes(status)) return "danger";
  if (["WARNING", "WATCH", "AT_RISK", "PENDING_APPROVAL", "ON_HOLD"].includes(status))
    return "warning";
  if (["ACTIVE", "APPROVED", "HEALTHY", "SAFE", "COMPLETED"].includes(status)) return "success";
  return "default";
}

export function StatusChip({ status }: { readonly status: string }): React.JSX.Element {
  return (
    <Chip size="sm" variant="soft" color={statusColor(status)}>
      {formatBusinessLabel(status)}
    </Chip>
  );
}
