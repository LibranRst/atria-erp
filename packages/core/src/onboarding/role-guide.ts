import { z } from "zod";
import type { PermissionKey, RoleDataScope } from "../auth/permissions";
import { SYSTEM_ROLES } from "../auth/role-constants";
import { formatBusinessLabel } from "../presentation/business-labels";

export const ROLE_GUIDE_VERSION = 1;

export type RoleGuideAccess = {
  readonly roleId: string;
  readonly roleName: string;
  readonly permissions: readonly PermissionKey[];
  readonly dataScope: RoleDataScope;
};
export type RoleGuideResponsibility = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
};
export type RoleGuideAction = {
  readonly label: string;
  readonly href: "/ledger" | "/projects" | "/materials" | "/profile";
};
export type RoleGuideContent = {
  readonly roleLabel: string;
  readonly responsibilities: readonly RoleGuideResponsibility[];
  readonly scopeNote: string;
  readonly primaryAction: RoleGuideAction;
};
export type OwnRoleGuide = RoleGuideContent & {
  readonly contextKey: string;
  readonly shouldAutoShow: boolean;
  readonly canAcknowledge: boolean;
};

export const acknowledgeRoleGuideSchema = z
  .object({
    contextKey: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type AcknowledgeRoleGuideInput = z.infer<typeof acknowledgeRoleGuideSchema>;

/** This exact list drives the guide context; technical/deferred grants never trigger a replay. */
export const ROLE_GUIDE_PERMISSIONS: readonly PermissionKey[] = [
  "view:ledger",
  "create:ledger",
  "reconcile:ledger",
  "view:budget",
  "view:rap",
  "view:profitability",
  "view:cost",
  "create:cost",
  "verify:cost",
  "pay:cost",
  "view:vendor_bill",
  "create:vendor_bill",
  "pay:vendor_bill",
  "view:approval_queue",
  "decide:all_approvals",
  "approve:cost",
  "approve:budget",
  "view:inventory",
  "create:stock_movement",
  "view:material",
  "create:material",
  "update:material",
  "view:settings",
  "manage:users",
  "manage:budget_settings",
  "manage:expense_categories",
  "view:client_invoice",
  "create:client_invoice",
  "update:client_invoice",
];

export function buildRoleGuide(access: RoleGuideAccess): RoleGuideContent {
  const held = new Set(access.permissions);
  const can = (key: PermissionKey): boolean => held.has(key);
  const projectScope = access.dataScope !== "NONE";
  const ledger = can("view:ledger") && access.dataScope === "GLOBAL";
  // Match the list loader, not only the seed/navigation matrix.
  const projects = can("view:budget") && projectScope;
  const inventory = can("view:inventory");
  const system = SYSTEM_ROLES.find((role) => role.id === access.roleId);
  const name = system?.name.toUpperCase();
  const labels: Readonly<Record<string, string>> = {
    OWNER: "Owner",
    FINANCE_ADMIN: "Finance Admin",
    PROJECT_MANAGER: "Project Manager",
    PURCHASING: "Purchasing",
  };
  const roleLabel = (name ? labels[name] : undefined) ?? formatBusinessLabel(access.roleName);
  const rows: RoleGuideResponsibility[] = [];
  function add(id: string, title: string, parts: readonly string[]): void {
    if (parts.length > 0) rows.push({ id, title, description: parts.join(" ") });
  }
  add("budget", "Pantau keuangan proyek", [
    ...(projects ? ["Periksa budget kategori dan sisa budget proyek."] : []),
    ...(can("view:profitability") && access.dataScope === "GLOBAL"
      ? ["Tinjau risiko margin."]
      : []),
    ...(projects && can("view:rap") ? ["Periksa RAP dan kebutuhan material."] : []),
  ]);
  add(
    "approval",
    "Tinjau pengajuan tim",
    can("view:approval_queue") && access.dataScope === "GLOBAL"
      ? [
          can("decide:all_approvals") || can("approve:cost") || can("approve:budget")
            ? "Tinjau dan putuskan pengajuan sesuai kewenangan Anda."
            : "Periksa status pengajuan yang menunggu penanganan tim.",
        ]
      : [],
  );
  add(
    "settings",
    can("manage:users")
      ? can("manage:budget_settings") || can("manage:expense_categories")
        ? "Kelola tim dan default"
        : "Kelola anggota tim"
      : "Kelola pengaturan biaya",
    can("view:settings")
      ? [
          ...(can("manage:users") ? ["Kelola anggota tim dan peran akun."] : []),
          ...(can("manage:budget_settings") ? ["Atur default alokasi budget."] : []),
          ...(can("manage:expense_categories") ? ["Kelola pengaturan kategori biaya."] : []),
        ]
      : [],
  );
  add(
    "verify",
    "Verifikasi pengeluaran",
    projectScope && can("view:cost") && can("verify:cost")
      ? ["Periksa kategori, nominal, dan bukti pengeluaran sebelum diteruskan."]
      : [],
  );
  add("payment", "Proses pembayaran", [
    ...(projectScope && can("view:cost") && can("pay:cost")
      ? ["Catat pembayaran pengeluaran sesuai status pengajuan."]
      : []),
    ...(projectScope && can("view:vendor_bill") && can("pay:vendor_bill")
      ? ["Proses pembayaran tagihan vendor."]
      : []),
    ...(ledger && can("create:ledger") ? ["Catat transaksi kas beserta bukti."] : []),
  ]);
  add(
    "reconcile",
    "Cocokkan catatan keuangan",
    ledger && can("reconcile:ledger") ? ["Cocokkan catatan Atria dengan mutasi bank."] : [],
  );
  add(
    "cost",
    "Ajukan pengeluaran proyek",
    projectScope && can("view:cost") && can("create:cost")
      ? ["Pilih kategori biaya, isi nominal, dan sertakan bukti untuk tim keuangan."]
      : [],
  );
  add(
    "vendor",
    "Catat tagihan vendor",
    can("view:vendor_bill") && can("create:vendor_bill")
      ? ["Catat tagihan vendor untuk diproses tim keuangan."]
      : [],
  );
  add(
    "stock",
    "Periksa material dan stok",
    inventory ? ["Periksa stok tersedia dan kebutuhan material sebelum membeli."] : [],
  );
  add(
    "movement",
    "Catat penerimaan dan stok",
    inventory && can("create:stock_movement")
      ? ["Catat barang yang diterima dan pergerakan stok sesuai kewenangan."]
      : [],
  );
  const canManageMaterial =
    can("view:material") && (can("create:material") || can("update:material"));
  const canCreateBill = can("view:vendor_bill") && can("create:vendor_bill");
  add(
    "material",
    canCreateBill ? "Kelola material dan pembelian" : "Kelola daftar material",
    canManageMaterial
      ? [
          ...(can("view:material") && can("create:material") ? ["Tambahkan material baru."] : []),
          ...(can("view:material") && can("update:material")
            ? ["Perbarui spesifikasi material."]
            : []),
          ...(can("view:vendor_bill") && can("create:vendor_bill")
            ? ["Catat tagihan vendor untuk diproses tim keuangan."]
            : []),
        ]
      : [],
  );
  add(
    "invoice",
    "Kelola tagihan klien",
    projectScope && can("view:client_invoice")
      ? [
          ...(can("create:client_invoice") ? ["Buat tagihan klien sesuai termin proyek."] : []),
          ...(can("update:client_invoice") ? ["Perbarui rincian tagihan sesuai kewenangan."] : []),
          ...(!can("create:client_invoice") && !can("update:client_invoice")
            ? ["Periksa status tagihan klien pada proyek yang dapat Anda akses."]
            : []),
        ]
      : [],
  );
  const priority: Readonly<Record<string, readonly string[]>> = {
    OWNER: ["budget", "approval", "settings"],
    FINANCE_ADMIN: ["verify", "payment", "reconcile"],
    PROJECT_MANAGER: ["budget", "cost", "vendor"],
    PURCHASING: ["stock", "movement", "material"],
  };
  const preferred = name ? (priority[name] ?? []) : [];
  const ordered = [...rows].sort((left, right): number => {
    const rank = (id: string): number => {
      const index = preferred.indexOf(id);
      return index < 0 ? preferred.length + rows.findIndex((row) => row.id === id) : index;
    };
    return rank(left.id) - rank(right.id);
  });
  const primaryAction: RoleGuideAction = ledger
    ? {
        label: system?.id === SYSTEM_ROLES[1].id ? "Buka dashboard keuangan" : "Lihat dashboard",
        href: "/ledger",
      }
    : projects
      ? {
          label: access.dataScope === "ASSIGNED" ? "Buka proyek saya" : "Buka proyek",
          href: "/projects",
        }
      : inventory
        ? { label: "Cek material & stok", href: "/materials" }
        : { label: "Lihat hak akses", href: "/profile" };
  const scopeNote =
    access.dataScope === "ASSIGNED"
      ? projects
        ? "Anda hanya dapat mengakses proyek yang ditugaskan kepada Anda. Jika proyek belum muncul, minta Owner atau Finance Admin menugaskan Anda."
        : "Data proyek, bila tersedia, terbatas pada penugasan dan izin akun Anda."
      : access.dataScope === "GLOBAL"
        ? projects || ledger
          ? "Anda dapat mengakses seluruh proyek. Tindakan mengikuti izin akun Anda."
          : "Menu dan tindakan mengikuti izin akun Anda. Periksa hak akses di Profil."
        : "Akun Anda tidak memiliki akses daftar proyek. Menu dan tindakan tersedia sesuai izin akun Anda.";
  return { roleLabel, responsibilities: ordered.slice(0, 3), scopeNote, primaryAction };
}

export function serializeRoleGuideContext(access: RoleGuideAccess): string {
  const held = new Set(access.permissions);
  return JSON.stringify([
    ROLE_GUIDE_VERSION,
    access.roleId,
    access.roleName,
    access.dataScope,
    ROLE_GUIDE_PERMISSIONS.filter((permission) => held.has(permission)).toSorted(),
  ]);
}

export function isRoleGuideWorkspaceRoute(pathname: string): boolean {
  return !["/", "/login", "/setup", "/profile/password", "/onboarding", "/api", "/admin"].some(
    (route) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)),
  );
}
