import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import type { ManagedRole } from "@/server/usecases/administration/roles";
import type { AdministrationTableController } from "../../hooks/use-administration-table";
import {
  AdministrationDesktopTable,
  AdministrationRoleTableSkeleton,
  administrationRoleColumns,
  administrationRoleFilter,
  administrationRoleSearch,
} from "./desktop-administration-tables";

const roles: readonly ManagedRole[] = [
  {
    id: "owner",
    name: "OWNER",
    description: "Pengelola perusahaan",
    dataScope: "GLOBAL",
    isSystem: true,
    isOwnerRole: true,
    userCount: 2,
    permissions: ["view:cost", "manage:roles"],
  },
  {
    id: "site",
    name: "SITE_SUPERVISOR",
    description: "Pengawas lapangan",
    dataScope: "ASSIGNED",
    isSystem: false,
    isOwnerRole: false,
    userCount: 3,
    permissions: ["view:project"],
  },
];
function render(children: React.ReactNode): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      {children}
    </WorkspacePresentationProvider>,
  );
}
const unchanged = (): void => undefined;
const table: AdministrationTableController<ManagedRole> = {
  rows: roles,
  total: 2,
  page: 1,
  pageSize: 10,
  search: "",
  filter: "all",
  sort: { column: "name", direction: "ascending" },
  onSearchChange: unchanged,
  onFilterChange: unchanged,
  onSortChange: unchanged,
  onPageChange: unchanged,
  onPageSizeChange: unchanged,
};
test("role table shows real scope and Owner lock without raw role enums or invented assignments", (): void => {
  const html = render(
    <AdministrationDesktopTable
      title="Peran dan akses"
      description="Cakupan data dan izin anggota tim."
      summary={[
        { label: "Peran", value: 2 },
        { label: "Kustom", value: 1 },
      ]}
      table={table}
      columns={administrationRoleColumns}
      filters={[{ value: "all", label: "Semua peran" }]}
      rowKey={(row: ManagedRole): string => row.id}
      onRowAction={unchanged}
      emptyTitle="Belum ada peran"
    />,
  );
  expect(html).toContain('role="grid"');
  expect(html).toContain("Terkunci");
  expect(html).toContain("Kustom");
  expect(html).toContain("Pengguna");
  expect(html).toContain("Izin aktif");
  expect(html).not.toContain("SITE_SUPERVISOR");
  expect(html).not.toContain("Bersihkan pencarian");
  expect(html).toContain("Proyek ditugaskan");
  expect(html).not.toContain("Jumlah proyek");
  expect(html).toContain("2 hasil");
});
test("role search translates scope and role labels while preserving system/custom filter", (): void => {
  expect(administrationRoleSearch(roles[1]!).toLocaleLowerCase("id-ID")).toContain(
    "pengawas lapangan",
  );
  expect(administrationRoleSearch(roles[1]!)).not.toContain("ASSIGNED");
  expect(administrationRoleFilter(roles[0]!, "custom")).toBe(false);
  expect(administrationRoleFilter(roles[1]!, "custom")).toBe(true);
  expect(administrationRoleFilter(roles[0]!, "system")).toBe(true);
});
test("role loading announces busy state and keeps structural table placeholders hidden", (): void => {
  const html = render(<AdministrationRoleTableSkeleton />);
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('inert=""');
  expect(html).toContain('role="grid"');
  expect(html).not.toContain("Belum ada peran");
});
