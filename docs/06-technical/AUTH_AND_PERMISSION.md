# Authentication and Permission Rules (RBAC) - Atria ERP

Dokumen ini mendokumentasikan model otorisasi berbasis peran (*Role-Based Access Control* / RBAC) yang diterapkan di Atria ERP. Aturan-aturan ini dirancang untuk melindungi aset keuangan perusahaan, mencegah penyalahgunaan wewenang, dan memastikan kepatuhan audit data transaksional.

---

## 1. Definisi Peran Pengguna (System Roles)

Atria ERP mendefinisikan 7 peran pengguna dengan tanggung jawab operasional yang spesifik:

1.  **OWNER (Pemilik Perusahaan):**
    *   Memiliki akses penuh secara global terhadap seluruh fitur aplikasi, termasuk pengaturan akun bank, buku besar (*ledger*), profitabilitas perusahaan, dan override anggaran.
    *   Satu-satunya peran yang berhak memberikan keputusan akhir (*approval*) untuk pengeluaran di atas plafon anggaran (*over-budget*) atau pembayaran bernilai besar.
2.  **FINANCE_ADMIN (Administrator Keuangan):**
    *   Bertanggung jawab atas pencatatan harian piutang klien (*Accounts Receivable*) dan utang vendor (*Accounts Payable*).
    *   Melakukan rekonsiliasi kas masuk dan kas keluar, verifikasi nota pengeluaran lapangan PM, dan melakukan pembayaran pengeluaran yang telah disetujui.
    *   *Guardrail:* Dilarang melakukan modifikasi anggaran proyek yang telah disetujui (`APPROVED`) tanpa persetujuan Owner. Dilarang mengubah transaksi yang telah direkonsiliasi.
3.  **PROJECT_MANAGER (Manajer Proyek lapangan):**
    *   Menyusun draf Rencana Anggaran Biaya (RAB) proyek yang ditugaskan kepada mereka.
    *   Mengajukan klaim biaya lapangan (*cash advance* atau *reimbursement*) lengkap dengan bukti foto nota dari ponsel.
    *   *Guardrail:* Hanya dapat mengakses data proyek yang ditugaskan secara eksplisit kepada mereka (*assigned projects only*). Dilarang melihat data rekening bank utama perusahaan atau proyek PM lain.
4.  **PURCHASING (Bagian Pengadaan Barang):**
    *   Bertanggung jawab membuat Purchase Order (PO) pembelian material ke vendor berdasarkan item anggaran proyek.
    *   Mencatat tagihan (*vendor bill*) yang masuk dari suplier untuk diverifikasi oleh Finance Admin.
    *   *Guardrail:* Tidak memiliki hak akses untuk melihat saldo kas, buku besar bank, atau memproses pembayaran transfer dana ke vendor.
5.  **SALES (Bagian Penjualan & Klien):**
    *   Mencatat data klien baru dan membuat profil proyek draf setelah penandatanganan kontrak kerja sama.
    *   Menyusun jadwal termin tagihan piutang (*client payment milestones*) sesuai kontrak.
    *   *Guardrail:* Dilarang mengakses modul buku besar pengeluaran, akun bank, atau kas kecil PM.
6.  **DESIGNER (Desainer Interior):**
    *   Memiliki hak akses baca (*read-only*) terhadap draf anggaran belanja material (BoQ) proyek yang ditugaskan untuk memastikan kesesuaian spesifikasi produk dengan desain visual 3D.
    *   *Guardrail:* Dilarang melakukan mutasi saldo, membuat tagihan, atau memproses pengeluaran kas apa pun.
7.  **MARKETING (Pemasaran & Portofolio):**
    *   Dapat mengakses data nama proyek dan foto hasil serah terima kunci untuk keperluan portofolio pemasaran.
    *   *Guardrail:* Dilarang mengakses seluruh data finansial perusahaan (RAB, biaya, tagihan, saldo, ledger).

---

## 2. Matriks Otorisasi Keuangan (Permissions Matrix)

Matriks berikut mendefinisikan tingkat izin untuk setiap peran terhadap sumber daya keuangan utama:

| Sumber Daya Finansial (Resource) | OWNER | FINANCE_ADMIN | PROJECT_MANAGER | PURCHASING | SALES | DESIGNER | MARKETING |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Bank Accounts (`bank_account`)** | ALL | R / U (No Delete) | NONE | NONE | NONE | NONE | NONE |
| **Ledger (`cash_transaction`)** | ALL | C / R / Reconcile | NONE | NONE | NONE | NONE | NONE |
| **Budget (`project_budget`)** | ALL | R | C / R / U (Draft) | R (Assigned) | R (Assigned) | R (Assigned) | NONE |
| **Costs (`project_cost`)** | ALL | R / U / Pay | C / R / U (Draft) | NONE | NONE | NONE | NONE |
| **Bills (`vendor_bill`)** | ALL | C / R / U / Pay | R (Assigned) | C / R / U | NONE | NONE | NONE |
| **Invoices (`client_invoice`)** | ALL | C / R / U / Reconcile | R (Assigned) | NONE | C / R / U | NONE | NONE |
| **Briefs (`ai_run` / Briefing)** | ALL | NONE | NONE | NONE | NONE | NONE | NONE |

### Keterangan Kode Izin:
*   **ALL:** Akses penuh untuk Create, Read, Update, Delete, Approve, dan Reconcile.
*   **C:** Create (Membuat data baru).
*   **R:** Read (Melihat data).
*   **U:** Update (Mengubah data).
*   **NONE:** Tidak memiliki hak akses sama sekali (Akses Ditolak).
*   **Assigned:** Hanya berlaku jika pengguna ditugaskan sebagai PM/Desainer pada proyek tersebut.

---

## 3. Proteksi Endpoint & Middleware (Route-Level Protection)

Atria ERP mengamankan rute URL menggunakan Next.js Middleware. Verifikasi dilakukan di sisi server untuk memastikan pengguna memiliki sesi aktif dan peran yang diizinkan sebelum memuat halaman.

```typescript
// sample next.js middleware logic for route protection
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth"; // Better Auth server instance

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const { pathname } = request.nextUrl;

  // 1. Check if user is authenticated
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const userRole = session.user.role; // e.g. OWNER, FINANCE_ADMIN, PROJECT_MANAGER

  // 2. Protect Admin & Finance Routes
  if (pathname.startsWith("/dashboard/finance") || pathname.startsWith("/dashboard/ledger")) {
    if (userRole !== "OWNER" && userRole !== "FINANCE_ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  // 3. Protect Owner-Only Configuration Pages
  if (pathname.startsWith("/dashboard/settings/bank-accounts")) {
    if (userRole !== "OWNER") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

---

## 4. Helper Verifikasi Otorisasi Server Action (`assertPermission`)

Setiap Server Action yang melakukan mutasi data keuangan wajib memanggil helper `assertPermission` di awal baris kode. Helper ini akan menghentikan eksekusi dan melemparkan kesalahan keamanan (*Forbidden Error*) jika pengguna tidak memiliki izin.

```typescript
// lib/auth/permissions.ts
import { ActionResponse } from "@/lib/types/action-response";

export type PermissionKey =
  | "manage:bank_account"
  | "reconcile:ledger"
  | "approve:budget"
  | "create:budget"
  | "request:cost"
  | "approve:cost"
  | "pay:cost"
  | "create:vendor_bill"
  | "pay:vendor_bill"
  | "create:client_invoice"
  | "view:profitability";

const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  OWNER: [
    "manage:bank_account",
    "reconcile:ledger",
    "approve:budget",
    "create:budget",
    "request:cost",
    "approve:cost",
    "pay:cost",
    "create:vendor_bill",
    "pay:vendor_bill",
    "create:client_invoice",
    "view:profitability"
  ],
  FINANCE_ADMIN: [
    "reconcile:ledger",
    "create:vendor_bill",
    "pay:vendor_bill",
    "create:client_invoice"
  ],
  PROJECT_MANAGER: [
    "create:budget",
    "request:cost"
  ],
  PURCHASING: [
    "create:vendor_bill"
  ],
  SALES: [
    "create:client_invoice"
  ],
  DESIGNER: [],
  MARKETING: []
};

export function assertPermission(user: { id: string; role: string }, permission: PermissionKey): void {
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  if (!permissions.includes(permission)) {
    throw new Error(`FORBIDDEN: Peran ${user.role} tidak memiliki izin ${permission}`);
  }
}
```

---

## 5. Batasan Akses Proyek Ketat (Strict Project Scoping)

Untuk mencegah terjadinya kebocoran informasi margin proyek antar PM lapangan, sistem menerapkan aturan *scoping* yang ketat pada query database.
*   **Global Access (Owner & Admin):** Dapat melihat dan mengubah data seluruh proyek yang ada di sistem tanpa filter penugasan.
*   **Scoped Access (Project Manager & Designer):** Query data anggaran, pengeluaran, dan tagihan vendor wajib menyertakan filter ID pengguna pada relasi proyek aktif.

### Contoh Penegakan Scoping pada Drizzle ORM:
```typescript
// lib/actions/get-project-costs.ts
import { db } from "@/db";
import { projectCost, project } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function getProjectCosts(
  projectId: string,
  user: { id: string; role: string }
): Promise<Array<typeof projectCost.$inferSelect>> {
  if (user.role === "OWNER" || user.role === "FINANCE_ADMIN") {
    // Global Access - No PM filter
    return await db.select().from(projectCost).where(eq(projectCost.projectId, projectId));
  }

  if (user.role === "PROJECT_MANAGER" || user.role === "DESIGNER") {
    // Scoped Access - Verify PM assignment on the project
    const assignedProject = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.projectManagerId, user.id) // Ensure PM is explicitly assigned
      )
    });

    if (!assignedProject) {
      throw new Error("UNAUTHORIZED: Anda tidak ditugaskan pada proyek ini.");
    }

    return await db.select().from(projectCost).where(eq(projectCost.projectId, projectId));
  }

  throw new Error("FORBIDDEN: Akses data biaya proyek ditolak.");
}
```

---

## 6. Batas Persetujuan Keuangan (Payment Approval Thresholds)

Atria ERP menerapkan batasan pengeluaran kas ketat untuk mencegah penarikan kas yang tidak terkendali dari lapangan:

1.  **Pengeluaran Rutin Lapangan (Di bawah Rp 5.000.000):**
    *   Dapat disetujui dan dicairkan secara langsung oleh **FINANCE_ADMIN** setelah bukti struk/nota belanja terverifikasi fisik dan kategorinya cocok dengan anggaran rencana (`project_budget_item`).
2.  **Pengeluaran Nominal Besar (Rp 5.000.000 ke atas):**
    *   Pengajuan pengeluaran kas lapangan oleh PM dengan nominal $\ge$ **Rp 5.000.000** wajib mendapatkan persetujuan persetujuan digital dari **OWNER** di aplikasi mobile sebelum statusnya dapat berubah menjadi `APPROVED` dan dicairkan oleh Finance Admin.
3.  **Pengeluaran Over-Budget (Pelewatan Alokasi Anggaran Rencana):**
    *   Jika sistem mendeteksi nominal pengajuan dana melebihi sisa plafon rencana anggaran kategori (`budget_overrun = true`), status pengajuan akan ditandai secara otomatis oleh sistem.
    *   Pengajuan yang bertanda *overrun* **wajib** mendapatkan persetujuan tertulis berupa catatan override dari **OWNER**, tanpa memandang nominal pengajuan (meskipun di bawah Rp 5.000.000).
    *   Jika Owner melakukan penolakan (*reject*), pengajuan dana tersebut dibatalkan dan tidak dapat ditransfer oleh Finance Admin.
