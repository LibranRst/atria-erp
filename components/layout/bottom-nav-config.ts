export type NavItem = {
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

export type SessionUserWithRole = {
  readonly roleId?: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Dashboard",
    href: "/ledger",
    iconName: "dashboard",
    match: (path, params): boolean =>
      path === "/ledger" && params.get("brief") !== "true",
  },
  {
    label: "Projects",
    href: "/projects",
    iconName: "folder",
    match: (path): boolean => path.startsWith("/projects"),
  },
  {
    label: "Materials",
    href: "/materials",
    iconName: "inventory_2",
    match: (path): boolean => path.startsWith("/materials"),
  },
  {
    label: "Expenses",
    href: "/expenses",
    iconName: "receipt_long",
    match: (path): boolean => path.startsWith("/expenses"),
  },
];

export function getRoleNavItems(roleName: string | null): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!roleName) {
      return item.label === "Projects" || item.label === "Expenses";
    }

    if (roleName === "OWNER" || roleName === "FINANCE_ADMIN") {
      return (
        item.label === "Dashboard" ||
        item.label === "Projects" ||
        item.label === "Expenses"
      );
    }

    if (roleName === "PURCHASING") {
      return (
        item.label === "Materials" ||
        item.label === "Expenses" ||
        item.label === "Projects"
      );
    }

    if (roleName === "PROJECT_MANAGER") {
      return (
        item.label === "Projects" ||
        item.label === "Expenses" ||
        item.label === "Materials"
      );
    }

    return (
      item.label === "Projects" ||
      item.label === "Expenses" ||
      item.label === "Materials"
    );
  });
}

export function buildFabActions({
  roleName,
  pathname,
  isProjectDetail,
  isCurrentProjectLocked,
  withQuery,
}: {
  readonly roleName: string | null;
  readonly pathname: string;
  readonly isProjectDetail: boolean;
  readonly isCurrentProjectLocked: boolean;
  readonly withQuery: (key: string, value?: string, targetPath?: string) => string;
}): readonly FabAction[] {
  const isOwnerOrFinance =
    roleName === "OWNER" || roleName === "FINANCE_ADMIN";
  const isPurchasing = roleName === "PURCHASING";
  const isOperational = isOwnerOrFinance || isPurchasing;
  const isMaterialsPage = pathname.startsWith("/materials");
  const isProjectsPage = pathname === "/projects";
  const isExpensesPage = pathname.startsWith("/expenses");
  const canSubmitExpense = isOwnerOrFinance || roleName === "PROJECT_MANAGER";
  const canCreateVendorBill = canSubmitExpense || isPurchasing;

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

    if (roleName === "OWNER" || isPurchasing) {
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

    if (roleName === "OWNER") {
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

    if (isOwnerOrFinance) {
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
    if (isOwnerOrFinance) {
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

    return isPurchasing
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
        ? [{
            label: "Expense Lapangan",
            description: "Klaim biaya proyek",
            iconName: "receipt_long",
            href: withQuery("new-expense"),
          }]
        : []),
      ...(canCreateVendorBill
        ? [{
            label: "Tagihan Vendor",
            description: "Invoice supplier",
            iconName: "request_quote",
            href: withQuery("new-vendor-bill"),
          }]
        : []),
    ];
  }

  return [
    ...(canSubmitExpense
      ? [{
          label: "Expense Lapangan",
          description: "Klaim biaya proyek",
          iconName: "receipt_long",
          href: withQuery("new-expense", "true", "/expenses"),
        }]
      : []),
    ...(canCreateVendorBill
      ? [{
          label: "Tagihan Vendor",
          description: "Invoice supplier",
          iconName: "request_quote",
          href: withQuery("new-vendor-bill", "true", "/expenses"),
        }]
      : []),
    ...(isOwnerOrFinance
      ? [{
          label: "Project Baru",
          description: "Buat workspace",
          iconName: "folder_open",
          href: withQuery("new-project", "true", "/projects"),
        }]
      : []),
  ];
}
