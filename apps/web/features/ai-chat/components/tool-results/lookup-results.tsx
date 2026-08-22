"use client";

import { MoneyValue, StatusBadge } from "@/components/ui";
import * as React from "react";
import { ResultShell } from "./result-shell";
import { EMPTY_TOOL_RESULT_CONTEXT, type ToolResultProps } from "./types";

export function VendorsResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const data = output as {
    vendors?: {
      vendorId: string;
      name: string;
      email?: string;
      phone?: string;
      bankName?: string;
    }[];
  };
  if (!data?.vendors || data.vendors.length === 0) return null;

  return (
    <ResultShell
      eyebrow="Katalog Vendor"
      title={`${data.vendors.length} Vendor Terdaftar`}
      href="/settings/library"
      linkLabel="Buka pustaka vendor"
      onNavigate={context.onNavigate}
    >
      <ul className="divide-y divide-black/5.5">
        {data.vendors.map((v) => (
          <li key={v.vendorId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-row font-semibold text-on-surface">{v.name}</p>
              {(v.bankName || v.email) && (
                <p className="text-meta text-on-surface-variant">{v.bankName || v.email}</p>
              )}
            </div>
            {v.phone && <span className="text-meta text-on-surface-variant">{v.phone}</span>}
          </li>
        ))}
      </ul>
    </ResultShell>
  );
}

export function ClientsResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const data = output as {
    clients?: {
      clientId: string;
      name: string;
      companyName?: string;
      email?: string;
      phone?: string;
    }[];
  };
  if (!data?.clients || data.clients.length === 0) return null;

  return (
    <ResultShell
      eyebrow="Daftar Klien"
      title={`${data.clients.length} Klien Terdaftar`}
      href="/projects"
      linkLabel="Buka daftar proyek & klien"
      onNavigate={context.onNavigate}
    >
      <ul className="divide-y divide-black/5.5">
        {data.clients.map((c) => (
          <li key={c.clientId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-row font-semibold text-on-surface">{c.name}</p>
              {c.companyName && (
                <p className="text-meta text-on-surface-variant">{c.companyName}</p>
              )}
            </div>
            {c.phone && <span className="text-meta text-on-surface-variant">{c.phone}</span>}
          </li>
        ))}
      </ul>
    </ResultShell>
  );
}

export function MaterialCatalogResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const data = output as {
    materials?: {
      materialId: string;
      name: string;
      code: string;
      unit: string;
      categoryName: string;
      totalStockOnHand: number;
      totalAvailableStock: number;
      averageCost: { amount: number; formatted: string };
    }[];
  };
  if (!data?.materials || data.materials.length === 0) return null;

  return (
    <ResultShell
      eyebrow="Katalog Material Master"
      title={`${data.materials.length} Material`}
      href="/materials"
      linkLabel="Buka stok & inventori material"
      onNavigate={context.onNavigate}
    >
      <ul className="divide-y divide-black/5.5">
        {data.materials.map((m) => (
          <li key={m.materialId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-row font-semibold text-on-surface">{m.name}</p>
              <p className="text-meta text-on-surface-variant">
                {m.categoryName} • {m.code}
              </p>
            </div>
            <div className="text-right">
              <p className="text-row font-bold text-on-surface">
                {m.totalStockOnHand} {m.unit}
              </p>
              <p className="text-meta text-on-surface-variant">
                Stok tersedia: {m.totalAvailableStock}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </ResultShell>
  );
}

export function UnpaidClientInvoicesResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const data = output as {
    invoices?: {
      invoiceId: string;
      invoiceNumber: string;
      projectName: string;
      clientName: string;
      amount: { amount: number; formatted: string };
      status: string;
      dueDate: string | null;
    }[];
  };
  if (!data?.invoices || data.invoices.length === 0) return null;

  return (
    <ResultShell
      eyebrow="Invoice Belum Lunas"
      title={`${data.invoices.length} Invoice Klien`}
      href="/ledger"
      linkLabel="Buka buku kas & piutang"
      onNavigate={context.onNavigate}
    >
      <ul className="divide-y divide-black/5.5">
        {data.invoices.map((inv) => (
          <li key={inv.invoiceId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-row font-semibold text-on-surface">
                #{inv.invoiceNumber} • {inv.projectName}
              </p>
              <p className="text-meta text-on-surface-variant">{inv.clientName}</p>
            </div>
            <div className="text-right">
              <MoneyValue amount={inv.amount.amount} variant="compact" size="sm" align="right" />
              <StatusBadge
                tone={inv.status === "PAID" ? "completed" : "pending"}
                label={inv.status === "PAID" ? "Lunas" : "Belum Lunas"}
              />
            </div>
          </li>
        ))}
      </ul>
    </ResultShell>
  );
}

export function PendingExpenseApprovalsResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const data = output as {
    pendingExpenses?: {
      expenseId: string;
      projectName: string;
      description: string;
      amount: { amount: number; formatted: string };
      submittedBy: string;
      expenseDate: string;
    }[];
  };
  if (!data?.pendingExpenses || data.pendingExpenses.length === 0) return null;

  return (
    <ResultShell
      eyebrow="Antrean Review Biaya"
      title={`${data.pendingExpenses.length} Pengajuan Menunggu`}
      href="/expenses"
      linkLabel="Buka daftar pengeluaran"
      onNavigate={context.onNavigate}
    >
      <ul className="divide-y divide-black/5.5">
        {data.pendingExpenses.map((exp) => (
          <li key={exp.expenseId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-row font-semibold text-on-surface">{exp.description}</p>
              <p className="text-meta text-on-surface-variant">
                {exp.projectName} • Diajukan {exp.submittedBy}
              </p>
            </div>
            <div className="text-right">
              <MoneyValue amount={exp.amount.amount} variant="compact" size="sm" align="right" />
            </div>
          </li>
        ))}
      </ul>
    </ResultShell>
  );
}
