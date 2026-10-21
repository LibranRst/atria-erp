"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/reconciliation-statement-actions";

export async function recordBankStatementRow(
  ...args: WebRpcArgs<"app/actions/finance/reconciliation-statement-actions.recordBankStatementRow">
): Promise<
  WebRpcResult<"app/actions/finance/reconciliation-statement-actions.recordBankStatementRow">
> {
  return callBackendAction(
    "app/actions/finance/reconciliation-statement-actions.recordBankStatementRow",
    args,
    { allowCookieWrites: true },
  );
}

export async function importBankStatementCsv(
  ...args: WebRpcArgs<"app/actions/finance/reconciliation-statement-actions.importBankStatementCsv">
): Promise<
  WebRpcResult<"app/actions/finance/reconciliation-statement-actions.importBankStatementCsv">
> {
  return callBackendAction(
    "app/actions/finance/reconciliation-statement-actions.importBankStatementCsv",
    args,
    { allowCookieWrites: true },
  );
}

export async function importParsedBankStatementRows(
  ...args: WebRpcArgs<"app/actions/finance/reconciliation-statement-actions.importParsedBankStatementRows">
): Promise<
  WebRpcResult<"app/actions/finance/reconciliation-statement-actions.importParsedBankStatementRows">
> {
  return callBackendAction(
    "app/actions/finance/reconciliation-statement-actions.importParsedBankStatementRows",
    args,
    { allowCookieWrites: true },
  );
}
