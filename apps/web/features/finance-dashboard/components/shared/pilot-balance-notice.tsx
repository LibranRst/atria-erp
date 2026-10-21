"use client";

import { FormRiskNotice } from "@/components/ui";

export function PilotBalanceNotice({
  inverse = false,
}: {
  readonly inverse?: boolean;
}): React.JSX.Element | null {
  if (process.env.NEXT_PUBLIC_ATRIA_PILOT_MODE !== "true") return null;
  return (
    <FormRiskNotice title="Saldo pilot: snapshot awal + transaksi pilot" inverse={inverse}>
      {null}
    </FormRiskNotice>
  );
}
