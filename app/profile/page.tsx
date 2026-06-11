import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { auth } from "@/lib/auth";
import { resolveRoleName, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/profile/logout-button";
import { ShieldCheck, User, Mail, ShieldAlert, CheckCircle2 } from "lucide-react";
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

  return (
    <section className="space-y-6 py-6 px-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Profil Pengguna</h1>
        <p className="text-sm text-secondary">Kelola sesi masuk dan lihat tingkat otorisasi Anda.</p>
      </div>

      {/* Kartu Detail Informasi Pengguna */}
      <Card className="rounded-3xl p-2 shadow-lg border-border bg-surface">
        <CardHeader className="pb-4 flex flex-row items-center gap-4 space-y-0">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-light border border-primary/20 text-primary">
            <User className="h-6 w-6" />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 className="text-lg font-bold text-text-primary truncate">{session.user.name}</h2>
            <div className="flex items-center gap-1.5 text-xs text-secondary font-medium">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{session.user.email}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Peran Sistem</p>
              <div>
                <Badge status={getBadgeStatus(roleName)}>{roleName}</Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Status Akun</p>
              <div>
                <Badge status={session.user.isActive ? "APPROVED" : "CRITICAL"}>
                  {session.user.isActive ? "AKTIF" : "NONAKTIF"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kartu Matriks Izin Otorisasi */}
      <Card className="rounded-3xl p-2 shadow-lg border-border bg-surface">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">Hak Akses Finansial</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Daftar kemampuan otorisasi di dalam sistem Atria ERP berdasarkan peran Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning-light/10 p-3.5 text-xs text-warning font-medium">
              <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
              <div>Peran Anda tidak memiliki izin finansial aktif di sistem.</div>
            </div>
          ) : (
            <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-elevated">
              {permissions.map((perm) => (
                <div key={perm} className="flex items-center justify-between px-3.5 py-3 text-xs">
                  <span className="font-semibold text-text-primary">{PERMISSION_DESCRIPTIONS[perm] || perm}</span>
                  <div className="flex items-center gap-1.5 font-medium text-success">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>Aktif</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aksi Logout */}
      <div className="pt-2">
        <LogoutButton />
      </div>
    </section>
  );
}
