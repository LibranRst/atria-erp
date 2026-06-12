import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { resolveRoleName, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/profile/logout-button";
import React from "react";

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
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
};

export default async function ProfilePage(): Promise<React.JSX.Element> {
  // 1. Dapatkan sesi pengguna secara asinkron
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });

  // Jika tidak terotentikasi, alihkan ke login
  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Selesaikan nama peran dan matriks izin
  const roleName = await resolveRoleName(session.user.roleId);
  const permissions = ROLE_PERMISSIONS[roleName] || [];

  const getBadgeStatus = (role: string) => {
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
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <section className="space-y-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="space-y-base">
          <p className="font-label-caps text-primary">Pengaturan Sistem</p>
          <h1 className="font-headline-lg text-on-surface">Profil Pengguna</h1>
        </div>
        <Badge status={getBadgeStatus(roleName)}>
          {roleName}
        </Badge>
      </div>

      {/* Profile Card dengan Inisial Kustom */}
      <div className="premium-card p-md border border-outline-variant/30 flex items-center gap-md">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-container border border-outline-variant/20 text-primary text-xl font-display font-bold">
          {getInitials(session.user.name)}
        </div>
        <div className="space-y-base min-w-0">
          <h2 className="font-body-lg font-bold text-on-surface truncate">{session.user.name}</h2>
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">mail</span>
            <span className="truncate">{session.user.email}</span>
          </div>
        </div>
      </div>

      {/* Group 1: Informasi Sistem */}
      <div className="space-y-sm px-1">
        <h2 className="font-label-caps text-on-surface-variant">Detail Sesi Akun</h2>
        <div className="premium-card border border-outline-variant/30 overflow-hidden divide-y divide-outline-variant/10">
          {/* Row 1: Peran */}
          <div className="flex items-center justify-between p-md text-xs">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-surface-container flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
              <span className="font-semibold text-on-surface text-[13px]">Peran Otentikasi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-on-surface-variant">{roleName}</span>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </div>
          </div>

          {/* Row 2: Status Akun */}
          <div className="flex items-center justify-between p-md text-xs">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-surface-container flex items-center justify-center text-success shrink-0">
                <span className="material-symbols-outlined text-success text-[20px]">check_circle</span>
              </div>
              <span className="font-semibold text-on-surface text-[13px]">Status Pengguna</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${session.user.isActive ? "text-primary" : "text-error"}`}>
                {session.user.isActive ? "Aktif" : "Nonaktif"}
              </span>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </div>
          </div>
        </div>
      </div>

      {/* Group 2: Hak Otorisasi */}
      <div className="space-y-sm px-1">
        <div className="flex items-center justify-between">
          <h2 className="font-label-caps text-on-surface-variant">Hak Akses Finansial</h2>
          <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full border border-outline-variant/20">
            {permissions.length} Hak Aktif
          </span>
        </div>
        
        {permissions.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-secondary/30 bg-surface-container-low p-md text-xs text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-secondary text-[20px]">warning</span>
            <div className="leading-relaxed">Peran Anda tidak memiliki izin finansial aktif di sistem.</div>
          </div>
        ) : (
          <div className="premium-card border border-outline-variant/30 overflow-hidden divide-y divide-outline-variant/10 max-h-[320px] overflow-y-auto">
            {permissions.map((perm) => (
              <div key={perm} className="flex items-center justify-between p-md text-xs hover:bg-surface-container-low/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-surface-container flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[20px]">key</span>
                  </div>
                  <span className="font-medium text-on-surface truncate text-[13px]">
                    {PERMISSION_DESCRIPTIONS[perm] || perm}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-primary font-bold">
                  <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                  <span>Aktif</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aksi Logout */}
      <div className="pt-2 px-1">
        <LogoutButton />
      </div>
    </section>
  );
}
