"use client";

import { MoneyValue } from "@/components/ui";
import { getBankBalancesOutputSchema } from "@/lib/ai/tool-output";
import * as React from "react";

import { bankAccountsHref } from "../../utils/deep-links";
import { ResultRow, ResultShell } from "./result-shell";
import { EMPTY_TOOL_RESULT_CONTEXT, type ToolResultProps } from "./types";

/**
 * Saldo seluruh rekening aktif.
 *
 * Total ditempatkan sebagai nilai fokal di kepala kartu karena itu yang dijawab
 * pertanyaan "kas kita berapa"; rincian per rekening menyusul sebagai baris.
 */

export function BankBalancesResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const parsed = getBankBalancesOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const data = parsed.data;
  if (data.accounts.length === 0) return null;

  return (
    <ResultShell
      eyebrow="Kas tersedia"
      title="Saldo rekening"
      href={bankAccountsHref()}
      linkLabel="Buka rekening"
      onNavigate={context.onNavigate}
    >
      <div className="px-4 pb-3">
        <MoneyValue
          amount={data.totalAvailable.amount}
          variant="fullDynamic"
          size="2xl"
          align="left"
        />
      </div>

      <div className="divide-y divide-black/5.5 border-t border-black/5.5">
        {data.accounts.map((account) => (
          <ResultRow
            key={`${account.bankName}-${account.accountName}`}
            label={account.accountName}
            meta={account.bankName}
            value={
              <MoneyValue
                amount={account.balance.amount}
                variant="fullDynamic"
                size="sm"
                align="right"
              />
            }
          />
        ))}
      </div>
    </ResultShell>
  );
}
