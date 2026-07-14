import { Badge } from "@/components/ui/badge";
import {
  PageHeader,
  MetricGrid,
  MetricPill,
  NativeSection,
} from "@/components/ui/page-primitives";
import {
  resolveRoleName,
  ROLE_PERMISSIONS,
  type PermissionKey,
} from "@/lib/auth/permissions";
import { LogoutButton } from "@/features/profile/components/logout-button";
import { requireServerSession } from "@/lib/server/session";
import Link from "next/link";
import React from "react";

type PermissionGroup = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  readonly permissions: readonly PermissionKey[];
};

type PermissionGroupSummary = PermissionGroup & {
  readonly activePermissions: readonly PermissionKey[];
};

const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "view:bank_account": "Melihat Rekening & Saldo Bank",
  "create:bank_account": "Membuat Rekening Bank Baru",
  "update:bank_account": "Mengubah Informasi Rekening Bank",
  "delete:bank_account": "Menghapus Rekening Bank",
  "view:ledger": "Melihat Catatan Buku Kas Ledger",
  "create:ledger": "Mencatat Mutasi Buku Kas Ledger",
  "reconcile:ledger": "Melakukan Rekonsiliasi Buku Kas Ledger",
  "view:budget": "Melihat Rencana Anggaran (RAB/BoQ)",
  "create:budget": "Membuat Rencana Anggaran Proyek Baru",
  "update:budget": "Mengubah Rencana Anggaran Proyek",
  "approve:budget": "Menyetujui Pengajuan Anggaran Proyek",
  "view:cost": "Melihat Pengeluaran Lapangan (Field Claims)",
  "create:cost": "Mengajukan Pengeluaran Lapangan Baru",
  "update:cost": "Mengubah Pengajuan Pengeluaran Lapangan",
  "approve:cost": "Menyetujui Pengajuan Pengeluaran Lapangan",
  "pay:cost": "Mencairkan Pembayaran Dana Pengeluaran Lapangan",
  "view:vendor_bill": "Melihat Tagihan Vendor",
  "create:vendor_bill": "Mencatat Tagihan Vendor Baru",
  "update:vendor_bill": "Mengubah Data Tagihan Vendor",
  "pay:vendor_bill": "Membayar Tagihan Vendor",
  "view:client_invoice": "Melihat Invoice Penagihan Klien",
  "create:client_invoice": "Membuat Invoice Penagihan Klien Baru",
  "update:client_invoice": "Mengubah Data Invoice Klien",
  "reconcile:client_invoice": "Mencatat Kas Masuk Penerimaan Klien",
  "view:profitability": "Melihat Statistik Profitabilitas Dasbor",
  "view:ai_brief": "Melihat CFO AI Daily Briefing",
  "view:material": "Melihat Material Master",
  "create:material": "Membuat Material Master",
  "update:material": "Mengubah Material Master",
  "view:inventory": "Melihat stok dan inventory",
  "create:stock_movement": "Mencatat pergerakan stok",
  "reserve:stock": "Reservasi stok untuk proyek",
  "use:stock": "Mencatat penggunaan stok",
  "adjust:stock": "Melakukan adjustment stok",
  "waste:stock": "Mencatat waste material",
  "transfer:stock": "Transfer stok antar lokasi",
  "create:stock_count": "Membuat stock count",
  "approve:stock_count": "Menyetujui stock count",
  "request:goods_receipt_reversal": "Meminta pembatalan goods receipt",
  "approve:goods_receipt_reversal": "Menyetujui pembatalan goods receipt",
  "view:rap": "Melihat RAP internal",
  "create:rap": "Membuat RAP internal",
  "update:rap": "Mengubah RAP internal",
  "lock:rap": "Mengunci RAP internal",
  "view:rab": "Melihat RAB client-facing",
  "create:rab": "Membuat RAB client-facing",
  "update:rab": "Mengubah RAB client-facing",
  "approve:rab": "Menyetujui RAB",
  "view:settings": "Melihat Pengaturan ERP",
  "manage:budget_settings": "Mengelola Budget Allocation",
  "manage:expense_categories": "Mengelola Expense Categories",
  "manage:item_library": "Mengelola Item & Price Library",
  "manage:material_settings": "Mengelola Material Master Settings",
};

const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    key: "finance",
    title: "Finance Control",
    description: "Kas, rekening bank, ledger, dan ringkasan profitabilitas.",
    iconName: "account_balance",
    permissions: [
      "view:bank_account",
      "create:bank_account",
      "update:bank_account",
      "delete:bank_account",
      "view:ledger",
      "create:ledger",
      "reconcile:ledger",
      "view:profitability",
    ],
  },
  {
    key: "budget",
    title: "Project Budget",
    description: "Setup, revisi, dan approval budget kategori proyek.",
    iconName: "monitoring",
    permissions: [
      "view:budget",
      "create:budget",
      "update:budget",
      "approve:budget",
    ],
  },
  {
    key: "expenses",
    title: "Expenses & Bills",
    description: "Biaya lapangan, tagihan vendor, dan invoice klien.",
    iconName: "receipt_long",
    permissions: [
      "view:cost",
      "create:cost",
      "update:cost",
      "approve:cost",
      "pay:cost",
      "view:vendor_bill",
      "create:vendor_bill",
      "update:vendor_bill",
      "pay:vendor_bill",
      "view:client_invoice",
      "create:client_invoice",
      "update:client_invoice",
      "reconcile:client_invoice",
    ],
  },
  {
    key: "material",
    title: "Material & Stock",
    description: "Material master, inventory, reservasi, pemakaian, dan audit stok.",
    iconName: "inventory_2",
    permissions: [
      "view:material",
      "create:material",
      "update:material",
      "view:inventory",
      "create:stock_movement",
      "reserve:stock",
      "use:stock",
      "adjust:stock",
      "waste:stock",
      "transfer:stock",
      "create:stock_count",
      "approve:stock_count",
      "request:goods_receipt_reversal",
      "approve:goods_receipt_reversal",
    ],
  },
  {
    key: "planning",
    title: "RAP / RAB",
    description: "Rencana eksekusi internal dan estimate client-safe.",
    iconName: "fact_check",
    permissions: [
      "view:rap",
      "create:rap",
      "update:rap",
      "lock:rap",
      "view:rab",
      "create:rab",
      "update:rab",
      "approve:rab",
    ],
  },
  {
    key: "settings",
    title: "Settings",
    description: "Defaults budget, kategori, library, dan material settings.",
    iconName: "tune",
    permissions: [
      "view:settings",
      "manage:budget_settings",
      "manage:expense_categories",
      "manage:item_library",
      "manage:material_settings",
    ],
  },
  {
    key: "ai",
    title: "AI Brief",
    description: "Ringkasan CFO AI untuk risiko finance dan material.",
    iconName: "auto_awesome",
    permissions: ["view:ai_brief"],
  },
];

function getBadgeStatus(role: string): "PRIMARY" | "APPROVED" | "PENDING" | "DRAFT" {
  switch (role) {
    case "OWNER":
      return "PRIMARY";
    case "FINANCE_ADMIN":
      return "APPROVED";
    case "PROJECT_MANAGER":
      return "PENDING";
    default:
      return "DRAFT";
  }
}

function getInitials(name: string): string {
  const initials = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "A";
}

function summarizePermissionGroups(
  permissions: readonly PermissionKey[],
): readonly PermissionGroupSummary[] {
  const permissionSet = new Set<PermissionKey>(permissions);

  return PERMISSION_GROUPS.map((group) => ({
    ...group,
    activePermissions: group.permissions.filter((permission) =>
      permissionSet.has(permission),
    ),
  }));
}

export default async function ProfilePage(): Promise<React.JSX.Element> {
  const session = await requireServerSession();
  const roleName = await resolveRoleName(session.user.roleId);
  const permissions: readonly PermissionKey[] = ROLE_PERMISSIONS[roleName] ?? [];
  const permissionGroups = summarizePermissionGroups(permissions);
  const accessibleGroupCount = permissionGroups.filter(
    (group) => group.activePermissions.length > 0,
  ).length;
  const canAccessSettings =
    roleName === "OWNER" ||
    roleName === "FINANCE_ADMIN" ||
    roleName === "PURCHASING";
  const displayName = session.user.name || "Pengguna Atria";
  const displayEmail = session.user.email || "Email belum tersedia";

  return (
    <section className="space-y-lg select-none pb-8">
      <PageHeader
        eyebrow="Account"
        title="Profil Saya"
        subtitle="Identitas akun, status sesi, dan ringkasan akses modul."
        badge={<Badge status={getBadgeStatus(roleName)}>{roleName}</Badge>}
      />

      <section className="overflow-hidden rounded-[28px] border border-outline-variant/20 bg-white p-md shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
        <div className="flex min-w-0 items-start gap-md">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-outline-variant/20 bg-primary text-[25px] font-bold leading-none tracking-tight text-on-primary shadow-[0_12px_24px_rgba(17,17,17,0.12)]">
            {getInitials(displayName)}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 truncate text-[19px] font-bold leading-6 text-on-surface">
                {displayName}
              </h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
                  session.user.isActive
                    ? "bg-success-light text-success"
                    : "bg-critical-light text-critical"
                }`}
              >
                {session.user.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs font-medium text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">
                mail
              </span>
              <span className="min-w-0 truncate">{displayEmail}</span>
            </div>
          </div>
        </div>

        <div className="mt-md">
          <MetricGrid minColumnWidth={128}>
            <MetricPill
              label="Hak Aktif"
              value={String(permissions.length)}
              tone="primary"
            />
            <MetricPill
              label="Modul Akses"
              value={`${accessibleGroupCount}/${permissionGroups.length}`}
            />
            <MetricPill
              label="Status Akun"
              value={session.user.isActive ? "Aktif" : "Nonaktif"}
              tone={session.user.isActive ? "default" : "danger"}
            />
          </MetricGrid>
        </div>
      </section>

      <NativeSection
        eyebrow="Session"
        title="Detail Akun"
        contentClassName="space-y-2"
      >
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
              <span className="material-symbols-outlined text-[20px]">
                verified_user
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-on-surface">
                Peran Otentikasi
              </p>
              <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">
                Digunakan untuk menentukan akses menu dan aksi.
              </p>
            </div>
          </div>
          <Badge status={getBadgeStatus(roleName)}>{roleName}</Badge>
        </div>

        {canAccessSettings && (
          <Link
            href="/settings"
            className="flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-full bg-primary px-4 text-on-primary shadow-[0_12px_28px_rgba(17,17,17,0.12)] transition active:scale-[0.97]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="material-symbols-outlined text-[19px]">
                tune
              </span>
              <span className="truncate text-xs font-bold">
                Buka Pengaturan ERP
              </span>
            </span>
            <span className="material-symbols-outlined text-[20px]">
              arrow_forward
            </span>
          </Link>
        )}
      </NativeSection>

      <NativeSection
        eyebrow="Akses Modul"
        title="Ringkasan Hak Akses"
        contentClassName="space-y-2"
        action={
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
            {permissions.length} aktif
          </span>
        }
      >
        {permissionGroups.map((group) => {
          const activeCount = group.activePermissions.length;
          const hasAccess = activeCount > 0;

          return (
            <details
              key={group.key}
              className="group rounded-2xl bg-surface-container-low open:bg-surface-container"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-2xl p-3 transition active:scale-[0.99] [&::-webkit-details-marker]:hidden">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm ${
                    hasAccess
                      ? "bg-white text-primary"
                      : "bg-white/70 text-on-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {group.iconName}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-on-surface">
                      {group.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${
                        hasAccess
                          ? "bg-primary/10 text-primary"
                          : "bg-white text-on-surface-variant"
                      }`}
                    >
                      {hasAccess ? "Aktif" : "Tidak aktif"}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-on-surface-variant">
                    {group.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-on-surface-variant">
                  <span className="font-mono text-xs font-bold">
                    {activeCount}/{group.permissions.length}
                  </span>
                  <span className="material-symbols-outlined text-[20px] transition group-open:rotate-180">
                    expand_more
                  </span>
                </div>
              </summary>

              <div className="px-3 pb-3">
                {hasAccess ? (
                  <div className="space-y-1.5 rounded-2xl bg-white p-2">
                    {group.activePermissions.map((permission) => (
                      <div
                        key={permission}
                        className="flex min-w-0 items-center gap-2 rounded-full bg-surface-container-low px-3 py-2"
                      >
                        <span className="material-symbols-outlined shrink-0 text-[16px] text-success">
                          check_circle
                        </span>
                        <span className="min-w-0 truncate text-[11px] font-semibold text-on-surface">
                          {PERMISSION_DESCRIPTIONS[permission]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white px-3 py-2.5 text-[11px] leading-4 text-on-surface-variant">
                    Peran ini tidak memiliki akses aktif untuk modul ini.
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </NativeSection>

      <div className="px-1">
        <LogoutButton />
      </div>
    </section>
  );
}
