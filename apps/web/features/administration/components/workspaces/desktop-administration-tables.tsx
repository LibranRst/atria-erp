"use client";

import React from "react";
import type { AdministrationOverview } from "@/app/actions/administration";
import {
  DesktopTable,
  DesktopTablePagination,
  FilterSelect,
  GroupedSurface,
  SearchInput,
  WorkspaceStatusLabel,
  type DesktopTableColumn,
  type SelectOption,
} from "@/components/ui";
import type { ManagedRole } from "@/server/usecases/administration/roles";
import type { AdministrationTableController } from "../../hooks/use-administration-table";
import { describeDataScope, formatRoleName } from "../../utils/role-editor";

type UserRow = AdministrationOverview["users"][number];
type VendorRow = AdministrationOverview["vendors"][number];

export const administrationUserColumns: readonly DesktopTableColumn<UserRow>[] = [
  {
    key: "name",
    label: "Anggota tim",
    sortable: true,
    sortValue: (row: UserRow): string => row.name,
    render: (row: UserRow): React.ReactNode => <span className="font-semibold">{row.name}</span>,
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    sortValue: (row: UserRow): string => row.email,
    render: (row: UserRow): React.ReactNode => row.email,
  },
  {
    key: "role",
    label: "Peran",
    sortable: true,
    sortValue: (row: UserRow): string => formatRoleName(row.roleName),
    render: (row: UserRow): React.ReactNode => formatRoleName(row.roleName),
  },
  {
    key: "status",
    label: "Status akun",
    sortable: true,
    sortValue: (row: UserRow): number => Number(row.isActive),
    render: (row: UserRow): React.ReactNode => (
      <WorkspaceStatusLabel
        label={row.isActive ? "Aktif" : "Nonaktif"}
        tone={row.isActive ? "positive" : "inactive"}
      />
    ),
  },
  {
    key: "password",
    label: "Password",
    render: (row: UserRow): React.ReactNode =>
      row.mustChangePassword ? (
        <WorkspaceStatusLabel label="Wajib diganti" tone="warning" />
      ) : (
        <span className="text-on-surface-variant">Tidak wajib diganti</span>
      ),
  },
];

export const administrationVendorColumns: readonly DesktopTableColumn<VendorRow>[] = [
  {
    key: "name",
    label: "Vendor",
    sortable: true,
    sortValue: (row: VendorRow): string => row.name,
    render: (row: VendorRow): React.ReactNode => (
      <div className="min-w-0">
        <span className="block font-semibold">{row.name}</span>
        {row.address ? (
          <span className="mt-0.5 block max-w-72 text-support text-on-surface-variant">
            {row.address}
          </span>
        ) : null}
      </div>
    ),
  },
  {
    key: "contact",
    label: "Kontak",
    sortable: true,
    sortValue: (row: VendorRow): string => row.phone,
    render: (row: VendorRow): React.ReactNode => (
      <div>
        <span className="block tabular-nums">{row.phone}</span>
        {row.email ? (
          <span className="mt-0.5 block text-support text-on-surface-variant">{row.email}</span>
        ) : null}
      </div>
    ),
  },
  {
    key: "bank",
    label: "Rekening pembayaran",
    sortable: true,
    sortValue: (row: VendorRow): string => row.bankName ?? "",
    render: (row: VendorRow): React.ReactNode => (
      <div>
        <span className="block">{row.bankName || "Belum diisi"}</span>
        {row.bankAccountNumber ? (
          <span className="mt-0.5 block text-support text-on-surface-variant tabular-nums">
            {row.bankAccountNumber}
          </span>
        ) : null}
      </div>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    sortValue: (row: VendorRow): number => Number(row.isActive),
    render: (row: VendorRow): React.ReactNode => (
      <WorkspaceStatusLabel
        label={row.isActive ? "Aktif" : "Diarsipkan"}
        tone={row.isActive ? "positive" : "inactive"}
      />
    ),
  },
];

export const administrationRoleColumns: readonly DesktopTableColumn<ManagedRole>[] = [
  {
    key: "name",
    label: "Peran",
    sortable: true,
    sortValue: (row: ManagedRole): string => formatRoleName(row.name),
    render: (row: ManagedRole): React.ReactNode => (
      <div className="min-w-0">
        <span className="block font-semibold">{formatRoleName(row.name)}</span>
        {row.description ? (
          <span className="mt-0.5 block max-w-80 text-support text-on-surface-variant">
            {row.description}
          </span>
        ) : null}
      </div>
    ),
  },
  {
    key: "scope",
    label: "Cakupan data",
    sortable: true,
    sortValue: (row: ManagedRole): string => describeDataScope(row.dataScope),
    render: (row: ManagedRole): React.ReactNode => describeDataScope(row.dataScope),
  },
  {
    key: "users",
    label: "Pengguna",
    align: "end",
    sortable: true,
    sortValue: (row: ManagedRole): number => row.userCount,
    render: (row: ManagedRole): React.ReactNode => (
      <span className="tabular-nums">{row.userCount.toLocaleString("id-ID")}</span>
    ),
  },
  {
    key: "permissions",
    label: "Izin aktif",
    align: "end",
    sortable: true,
    sortValue: (row: ManagedRole): number => row.permissions.length,
    render: (row: ManagedRole): React.ReactNode => (
      <span className="tabular-nums">{row.permissions.length.toLocaleString("id-ID")}</span>
    ),
  },
  {
    key: "type",
    label: "Jenis",
    render: (row: ManagedRole): React.ReactNode => (
      <WorkspaceStatusLabel
        label={row.isOwnerRole ? "Terkunci" : row.isSystem ? "Bawaan" : "Kustom"}
        tone={row.isOwnerRole ? "inactive" : row.isSystem ? "neutral" : "positive"}
      />
    ),
  },
];

export function administrationUserSearch(row: UserRow): string {
  return `${row.name} ${row.email} ${formatRoleName(row.roleName)}`;
}

export function administrationVendorSearch(row: VendorRow): string {
  return `${row.name} ${row.phone} ${row.email ?? ""} ${row.address ?? ""} ${row.bankName ?? ""}`;
}

export function administrationRoleSearch(row: ManagedRole): string {
  return `${formatRoleName(row.name)} ${row.description ?? ""} ${describeDataScope(row.dataScope)}`;
}

export function administrationActiveFilter(
  row: { readonly isActive: boolean },
  filter: string,
): boolean {
  return filter === "active" ? row.isActive : filter === "inactive" ? !row.isActive : true;
}

export function administrationRoleFilter(row: ManagedRole, filter: string): boolean {
  return filter === "custom" ? !row.isSystem : filter === "system" ? row.isSystem : true;
}

type AdministrationDesktopTableProps<Row extends object> = {
  readonly title: string;
  readonly description: string;
  readonly summary: readonly { readonly label: string; readonly value: number }[];
  readonly table: AdministrationTableController<Row>;
  readonly columns: readonly DesktopTableColumn<Row>[];
  readonly filters: readonly SelectOption[];
  readonly onRowAction: (row: Row) => void;
  readonly rowKey: (row: Row) => string;
  readonly selectedRowKey?: string | null;
  readonly emptyTitle: string;
};

/** Pure desktop presentation; mutations, drafts and all overlay owners stay in the managers. */
export function AdministrationDesktopTable<Row extends object>({
  title,
  description,
  summary,
  table,
  columns,
  filters,
  onRowAction,
  rowKey,
  selectedRowKey,
  emptyTitle,
}: AdministrationDesktopTableProps<Row>): React.JSX.Element {
  return (
    <section className="min-w-0 space-y-4">
      <GroupedSurface variant="desktopPanel">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-section font-semibold text-on-surface">{title}</h3>
            <p className="mt-1 text-support text-on-surface-variant">{description}</p>
          </div>
          {summary.map((fact) => (
            <div key={fact.label} className="shrink-0">
              <span className="block text-support text-on-surface-variant">{fact.label}</span>
              <span className="mt-0.5 block text-row font-semibold tabular-nums">
                {fact.value.toLocaleString("id-ID")}
              </span>
            </div>
          ))}
        </div>
      </GroupedSurface>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SearchInput
          ariaLabel={`Cari ${title.toLowerCase()}`}
          placeholder="Cari…"
          value={table.search}
          onChange={table.onSearchChange}
          showClear={false}
          className="max-w-72"
        />
        <FilterSelect
          label={`Tampilkan ${title.toLowerCase()}`}
          value={table.filter}
          options={filters}
          onChange={table.onFilterChange}
          presentation="menu"
        />
      </div>
      <DesktopTable
        ariaLabel={title}
        columns={columns}
        rows={table.rows}
        rowKey={rowKey}
        onRowAction={onRowAction}
        selectedRowKey={selectedRowKey}
        sortDescriptor={table.sort}
        onSortChange={table.onSortChange}
        emptyTitle={table.search || table.filter !== "all" ? "Tidak ada hasil" : emptyTitle}
        emptyDescription={
          table.search || table.filter !== "all" ? "Sesuaikan filter atau pencarian." : description
        }
        footer={
          <DesktopTablePagination
            page={table.page}
            pageSize={table.pageSize}
            total={table.total}
            onPageChange={table.onPageChange}
            onPageSizeChange={table.onPageSizeChange}
            ariaLabel={`Navigasi ${title.toLowerCase()}`}
          />
        }
      />
    </section>
  );
}

export function AdministrationRoleTableSkeleton(): React.JSX.Element {
  return (
    <section aria-label="Memuat daftar peran" aria-busy="true" className="space-y-4">
      <p className="sr-only" role="status">
        Memuat peran dan akses…
      </p>
      <div aria-hidden="true" inert className="space-y-4">
        <GroupedSurface variant="desktopPanel">
          <div className="flex items-center justify-between gap-6 p-4">
            <div className="space-y-2">
              <div className="h-5 w-40 rounded-full bg-surface-container-high" />
              <div className="h-3 w-72 rounded-full bg-surface-container-high" />
            </div>
            <div className="h-10 w-32 rounded-full bg-surface-container-high" />
          </div>
        </GroupedSurface>
        <div className="flex justify-end gap-2">
          <div className="h-10 w-64 rounded-full bg-surface-container-high" />
          <div className="h-10 w-36 rounded-full bg-surface-container-high" />
        </div>
        <DesktopTable
          ariaLabel="Struktur daftar peran"
          columns={administrationRoleColumns.map((column) => ({
            ...column,
            sortable: false,
            render: (): React.ReactNode => (
              <span className="block h-3 w-24 rounded-full bg-surface-container-high" />
            ),
          }))}
          rows={[0, 1, 2, 3, 4].map((index): ManagedRole => ({
            id: `loading-role-${index}`,
            name: "",
            description: null,
            dataScope: "NONE",
            isSystem: false,
            isOwnerRole: false,
            userCount: 0,
            permissions: [],
          }))}
          rowKey={(row: ManagedRole): string => row.id}
          footer={<div className="h-8 w-64 rounded-full bg-surface-container-high" />}
        />
      </div>
    </section>
  );
}
