import type { PermissionKey } from "@atria/core/auth/permissions";
import {
  getRoleNavItems as getSharedRoleNavItems,
  ROLE_NAV_ITEMS,
  type RoleNavItem,
} from "@atria/core/navigation/role-navigation";

export type NavItem = RoleNavItem & {
  readonly label: string;
  readonly href: string;
  readonly iconName: string;
  readonly match: (pathname: string, searchParams: URLSearchParams) => boolean;
};

export type FabAction = {
  readonly label: string;
  readonly description: string;
  readonly iconName: string;
  readonly href: string;
  readonly disabled?: boolean;
};

const navMatchByHref: Record<RoleNavItem["href"], NavItem["match"]> = {
  "/ledger": (path, params): boolean => path === "/ledger" && params.get("brief") !== "true",
  "/projects": (path): boolean => path.startsWith("/projects"),
  "/materials": (path): boolean => path.startsWith("/materials"),
  "/expenses": (path): boolean => path.startsWith("/expenses"),
};

export const NAV_ITEMS: readonly NavItem[] = ROLE_NAV_ITEMS.map((item) => ({
  ...item,
  match: navMatchByHref[item.href],
}));

export function getRoleNavItems(permissions: readonly PermissionKey[]): readonly NavItem[] {
  return getSharedRoleNavItems(permissions).map((item) => ({
    ...item,
    match: navMatchByHref[item.href],
  }));
}

export function buildFabActions({
  permissions,
  pathname,
  isProjectDetail,
  isCurrentProjectLocked,
  withQuery,
}: {
  readonly permissions: readonly PermissionKey[];
  readonly pathname: string;
  readonly isProjectDetail: boolean;
  readonly isCurrentProjectLocked: boolean;
  readonly withQuery: (key: string, value?: string, targetPath?: string) => string;
}): readonly FabAction[] {
  /*
   * Aksi cepat mengikuti izin, bukan nama peran: satu tombol yang muncul untuk
   * peran yang tidak berhak hanya menawarkan pintu yang akan ditolak server.
   *
   * Izinnya datang sebagai daftar efektif dari sesi, bukan hasil pencarian nama
   * peran di matriks seed — peran buatan Owner tidak ada di matriks itu.
   */
  const held = new Set<PermissionKey>(permissions);
  const can = (permission: PermissionKey): boolean => held.has(permission);
  const isOperational = can("create:stock_movement");
  const canCreateInvoice = can("create:client_invoice");
  const canCreateProject = can("create:project");
  const isMaterialsPage = pathname.startsWith("/materials");
  const isProjectsPage = pathname === "/projects";
  const isExpensesPage = pathname.startsWith("/expenses");
  const canSubmitExpense = can("create:cost");
  const canCreateVendorBill = can("create:vendor_bill");

  if (isMaterialsPage && isOperational) {
    const actions: FabAction[] = [
      {
        label: "Lokasi Baru",
        description: "Tambah gudang atau area stok",
        iconName: "add_location_alt",
        href: withQuery("action", "LOCATION"),
      },
      {
        label: "Terima Barang",
        description: "Catat penerimaan barang",
        iconName: "arrow_downward",
        href: withQuery("action", "RECEIVE"),
      },
      {
        label: "Reservasi Material",
        description: "Commit ke proyek",
        iconName: "inventory",
        href: withQuery("action", "RESERVE"),
      },
      {
        label: "Pakai Material",
        description: "Catat pemakaian lapangan",
        iconName: "warehouse",
        href: withQuery("action", "USE"),
      },
      {
        label: "Kembalikan Sisa",
        description: "Kembalikan sisa material",
        iconName: "undo",
        href: withQuery("action", "RETURN"),
      },
      {
        label: "Material Terbuang",
        description: "Catat rusak atau hilang",
        iconName: "report_problem",
        href: withQuery("action", "WASTE"),
      },
    ];

    if (can("create:stock_count")) {
      actions.push(
        {
          label: "Transfer Stok",
          description: "Pindahkan antar lokasi",
          iconName: "sync_alt",
          href: withQuery("action", "TRANSFER"),
        },
        {
          label: "Stock Opname",
          description: "Audit fisik barang",
          iconName: "fact_check",
          href: withQuery("action", "COUNT"),
        },
      );
    }

    if (can("adjust:stock")) {
      actions.push({
        label: "Penyesuaian Darurat",
        description: "Owner-only correction",
        iconName: "construction",
        href: withQuery("action", "ADJUST"),
      });
    }

    return actions;
  }

  if (isMaterialsPage) {
    return canSubmitExpense
      ? [
          {
            label: "Expense Lapangan",
            description: "Catat biaya proyek",
            iconName: "receipt_long",
            href: withQuery("new-expense", "true", "/expenses"),
          },
        ]
      : [];
  }

  if (isProjectDetail) {
    const actions: FabAction[] = [
      {
        label: "Expense Proyek",
        description: isCurrentProjectLocked
          ? "Terkunci (RAB belum disetujui)"
          : "Pengeluaran lapangan",
        iconName: isCurrentProjectLocked ? "lock" : "receipt_long",
        href: withQuery("new-expense"),
        disabled: isCurrentProjectLocked,
      },
      {
        label: "Tagihan Vendor",
        description: isCurrentProjectLocked
          ? "Terkunci (RAB belum disetujui)"
          : "Untuk project ini",
        iconName: isCurrentProjectLocked ? "lock" : "request_quote",
        href: withQuery("new-vendor-bill"),
        disabled: isCurrentProjectLocked,
      },
    ];

    if (canCreateInvoice) {
      actions.push({
        label: "Invoice Klien",
        description: isCurrentProjectLocked
          ? "Terkunci (RAB belum disetujui)"
          : "Buat invoice manual",
        iconName: isCurrentProjectLocked ? "lock" : "description",
        href: withQuery("new-invoice"),
        disabled: isCurrentProjectLocked,
      });
    }

    return actions;
  }

  if (isProjectsPage) {
    if (canCreateProject) {
      return [
        {
          label: "Project Baru",
          description: "Buat workspace proyek",
          iconName: "folder_open",
          href: withQuery("new-project"),
        },
      ];
    }

    if (canSubmitExpense) {
      return [
        {
          label: "Expense Lapangan",
          description: "Catat biaya proyek",
          iconName: "receipt_long",
          href: withQuery("new-expense", "true", "/expenses"),
        },
      ];
    }

    return canCreateVendorBill && !canSubmitExpense
      ? [
          {
            label: "Tagihan Vendor",
            description: "Catat invoice supplier",
            iconName: "request_quote",
            href: withQuery("new-vendor-bill", "true", "/expenses"),
          },
        ]
      : [];
  }

  if (isExpensesPage) {
    return [
      ...(canSubmitExpense
        ? [
            {
              label: "Expense Lapangan",
              description: "Klaim biaya proyek",
              iconName: "receipt_long",
              href: withQuery("new-expense"),
            },
          ]
        : []),
      ...(canCreateVendorBill
        ? [
            {
              label: "Tagihan Vendor",
              description: "Invoice supplier",
              iconName: "request_quote",
              href: withQuery("new-vendor-bill"),
            },
          ]
        : []),
    ];
  }

  return [
    ...(canSubmitExpense
      ? [
          {
            label: "Expense Lapangan",
            description: "Klaim biaya proyek",
            iconName: "receipt_long",
            href: withQuery("new-expense", "true", "/expenses"),
          },
        ]
      : []),
    ...(canCreateVendorBill
      ? [
          {
            label: "Tagihan Vendor",
            description: "Invoice supplier",
            iconName: "request_quote",
            href: withQuery("new-vendor-bill", "true", "/expenses"),
          },
        ]
      : []),
    ...(canCreateProject
      ? [
          {
            label: "Project Baru",
            description: "Buat workspace",
            iconName: "folder_open",
            href: withQuery("new-project", "true", "/projects"),
          },
        ]
      : []),
  ];
}
