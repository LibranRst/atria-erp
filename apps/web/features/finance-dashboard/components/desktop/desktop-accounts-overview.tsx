"use client";
import React from "react";
import {
  Button,
  DesktopTable,
  FilterSelect,
  GroupedSurface,
  MoneyValue,
  StatusBadge,
  type DesktopTableColumn,
} from "@/components/ui";
import type { BankAccount } from "../../types/bank-account-types";
import { useUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";
export function DesktopAccountsOverview({
  accounts,
  totalCash,
  unreconciledCount,
  onSelect,
  onCreate,
  canCreate,
}: {
  readonly accounts: readonly BankAccount[];
  readonly totalCash: number;
  readonly unreconciledCount: number;
  readonly onSelect: (account: BankAccount) => void;
  readonly onCreate: () => void;
  readonly canCreate: boolean;
}): React.JSX.Element {
  const filter = useUrlSearchParam("accounts-filter") ?? "all";
  const rawPage = Number(useUrlSearchParam("accounts-page") ?? 1),
    rawSize = useUrlSearchParam("accounts-pageSize");
  const size = rawSize === "50" ? 50 : rawSize === "25" ? 25 : 10;
  const matches = accounts.filter(
    (row) => filter === "all" || (filter === "active" ? row.isActive : !row.isActive),
  );
  const sort = useUrlSearchParam("accounts-sort") ?? "name",
    descending = useUrlSearchParam("accounts-direction") === "descending";
  const sorted = [...matches].sort((a, b) => {
    const value =
      sort === "balance" ? a.balance - b.balance : a.name.localeCompare(b.name, "id-ID");
    return value * (descending ? -1 : 1) || a.id.localeCompare(b.id);
  });
  const page = Math.min(
    Math.max(1, Number.isFinite(rawPage) ? Math.floor(rawPage) : 1),
    Math.max(1, Math.ceil(sorted.length / size)),
  );
  const update = (patch: Readonly<Record<string, string>>): void => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({ ...patch, page: patch.page ?? "1" }))
      url.searchParams.set(`accounts-${key}`, value);
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  };
  const columns: readonly DesktopTableColumn<BankAccount>[] = [
    {
      key: "name",
      label: "Rekening",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold">{row.name}</p>
          <p className="text-support text-on-surface-variant">
            {row.bankName} · •••• {row.accountNumber.slice(-4)}
          </p>
        </div>
      ),
    },
    { key: "holder", label: "Pemilik", render: (row) => row.holderName },
    {
      key: "balance",
      label: "Saldo",
      sortable: true,
      align: "end",
      render: (row) => <MoneyValue amount={row.balance} size="md" variant="compact" />,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <StatusBadge
          tone={row.isActive ? "neutral" : "inactive"}
          label={row.isActive ? "Aktif" : "Arsip"}
        />
      ),
    },
    {
      key: "activity",
      label: "Aktivitas terakhir",
      render: (row) =>
        row.recentTransactions[0] ? (
          <div>
            <p className="max-w-64 truncate text-support">
              {row.recentTransactions[0].description}
            </p>
            <p className="text-meta text-on-surface-variant">
              {new Date(row.recentTransactions[0].createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                timeZone: "Asia/Jakarta",
              })}
            </p>
          </div>
        ) : (
          "Belum ada aktivitas"
        ),
    },
  ];
  return (
    <div className="space-y-4">
      <GroupedSurface
        variant="desktopPanel"
        className="flex items-center justify-between gap-4 p-4"
      >
        <div>
          <p className="mb-1 text-support text-on-surface-variant">Saldo rekening perusahaan</p>
          <MoneyValue amount={totalCash} size="lg" variant="compact" />
        </div>
        <p className="text-support text-on-surface-variant">
          {accounts.filter((row) => row.isActive).length} aktif · {unreconciledCount} catatan belum
          cocok
        </p>
        {canCreate ? (
          <Button size="compact" onClick={onCreate}>
            Tambah rekening
          </Button>
        ) : null}
      </GroupedSurface>
      <div className="flex items-center justify-between">
        <h2 className="text-section font-semibold">Rekening perusahaan</h2>
        <FilterSelect
          label="Status rekening"
          value={filter}
          searchable={false}
          onChange={(value) => update({ filter: value })}
          options={[
            { value: "all", label: "Semua rekening" },
            { value: "active", label: "Aktif" },
            { value: "archive", label: "Arsip" },
          ]}
        />
      </div>
      <DesktopTable
        ariaLabel="Rekening perusahaan"
        columns={columns}
        rows={sorted.slice((page - 1) * size, page * size)}
        rowKey={(row) => row.id}
        onRowAction={onSelect}
        emptyTitle="Belum ada rekening"
        sortDescriptor={{ column: sort, direction: descending ? "descending" : "ascending" }}
        onSortChange={(next) => update({ sort: String(next.column), direction: next.direction })}
        footer={
          <div className="flex items-center justify-between gap-3 text-support">
            <span>
              {matches.length} rekening · Halaman {page}
            </span>
            <div className="flex gap-2">
              <FilterSelect
                label="Baris"
                value={String(size)}
                searchable={false}
                options={[
                  { value: "10", label: "10 baris" },
                  { value: "25", label: "25 baris" },
                  { value: "50", label: "50 baris" },
                ]}
                onChange={(value) => update({ pageSize: value })}
              />
              <Button
                size="compact"
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
              >
                Sebelumnya
              </Button>
              <Button
                size="compact"
                disabled={page * size >= matches.length}
                onClick={() => update({ page: String(page + 1) })}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        }
      />
    </div>
  );
}
