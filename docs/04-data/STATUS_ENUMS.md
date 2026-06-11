# Status Enums - Atria ERP

Dokumen ini mendefinisikan seluruh status enum yang digunakan dalam database Atria ERP. Enum ini didefinisikan menggunakan string dalam bahasa Inggris agar kompatibel dengan definisi skema **Drizzle ORM** dan PostgreSQL, sementara penjelasannya disajikan dalam Bahasa Indonesia untuk panduan operasional tim pengembang.

---

## 1. Project Status (`project_status`)
Menggambarkan fase siklus hidup dari suatu proyek kontraktor dan desain interior.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Ketentuan Transisi |
| :--- | :--- | :--- |
| `DRAFT` | Proyek baru dibuat dari modul penjualan. Rancangan RAB sedang disusun oleh PM dan belum aktif. | Status awal setelah proyek dibuat dari alur penjualan. |
| `ACTIVE` | Proyek sedang berjalan secara fisik di lapangan. Pengajuan biaya dan invoice termin dapat diproses. | Diaktifkan setelah RAB disetujui (`APPROVED`) oleh Owner. |
| `ON_HOLD` | Proyek dihentikan sementara karena kendala di lapangan atau keterlambatan pembayaran dari klien. | Dapat dipicu secara manual oleh Admin/Owner. |
| `COMPLETED` | Proyek telah selesai dikerjakan secara fisik dan seluruh administrasi keuangan telah ditutup. | Diubah oleh Admin setelah serah terima kunci dan pelunasan termin terakhir. |
| `CANCELLED` | Proyek dibatalkan oleh klien atau perusahaan. Seluruh alokasi anggaran dibebaskan. | Pembatalan hanya bisa dilakukan sebelum status `COMPLETED`. |

---

## 2. Project Financial Health (`project_financial_health`)
Indikator real-time kesehatan finansial proyek berdasarkan perbandingan antara total pengeluaran riil (`actual_spent`) dengan total rencana anggaran (`allocated_amount`).

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Kriteria Kalkulasi |
| :--- | :--- | :--- |
| `HEALTHY` | Penggunaan anggaran proyek aman dan masih di bawah batas peringatan. | $\text{Actual Spent} < 90\% \text{ dari Total Budget}$ |
| `WARNING` | Pengeluaran proyek mendekati batas anggaran yang direncanakan. Perlu pengawasan ekstra. | $90\% \le \text{Actual Spent} < 100\% \text{ dari Total Budget}$ |
| `CRITICAL` | Pengeluaran proyek telah melampaui rencana anggaran (over-budget). | $\text{Actual Spent} \ge 100\% \text{ dari Total Budget}$ |

---

## 3. Client Invoice & Payment Status (`invoice_status`)
Menunjukkan status penagihan (*Accounts Receivable* / AR) kepada klien untuk setiap milestone/termin kontrak.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Kriteria |
| :--- | :--- | :--- |
| `UNPAID` | Invoice telah diterbitkan dan dikirim ke klien, tetapi belum ada pembayaran yang diterima. | Saldo pembayaran = 0. |
| `PARTIALLY_PAID` | Klien telah membayar sebagian dari nilai nominal invoice termin. | $0 < \text{Total Paid} < \text{Invoice Amount}$ |
| `PAID` | Klien telah melunasi seluruh nilai nominal invoice termin tersebut. | $\text{Total Paid} = \text{Invoice Amount}$ |
| `OVERDUE` | Klien belum melunasi invoice dan tanggal pembayaran telah melewati jatuh tempo (`due_date`). | $\text{Tanggal Sekarang} > \text{Due Date}$ dan status masih `UNPAID`/`PARTIALLY_PAID`. |
| `VOID` | Invoice dibatalkan karena kesalahan input atau negosiasi ulang kontrak. | Tidak memicu piutang lagi di ledger. |

---

## 4. Client Payment Stage (`client_payment_stage`)
Kategori tahap/milestone penagihan piutang kontrak kepada klien.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Catatan Operasional |
| :--- | :--- | :--- |
| `DP` | *Down Payment* (Uang Muka), biasanya dibayarkan sebelum proyek dimulai fisik (20% - 30%). | Pemicu proyek berubah status menjadi `ACTIVE`. |
| `PROGRESS_1` | Tagihan termin pertama berdasarkan progres fisik di lapangan (misal: struktur/dinding selesai 50%). | Memerlukan verifikasi opname lapangan oleh PM. |
| `PROGRESS_2` | Tagihan termin kedua (misal: pekerjaan MEP & MEP selesai 80%). | Opsional tergantung kesepakatan nilai proyek. |
| `PELUNASAN` | Retensi / Pelunasan akhir setelah serah terima pekerjaan (Handover / BAST). | Biasanya bernilai 10% - 20% dari nilai kontrak. |
| `AD_HOC` | Tagihan pekerjaan tambah/kurang (*variation order* / VO) di luar kontrak utama. | Dibuat terpisah berdasarkan negosiasi di tengah proyek. |

---

## 5. Vendor Bill & Payable Status (`payable_status`)
Status tagihan hutang (*Accounts Payable* / AP) dari vendor atas pengadaan material atau subkontraktor.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Kriteria |
| :--- | :--- | :--- |
| `UNPAID` | Tagihan dari vendor telah terdaftar tetapi belum dibayar sama sekali oleh kas perusahaan. | Saldo pembayaran = 0. |
| `PARTIALLY_PAID` | Perusahaan telah mengangsur sebagian pembayaran tagihan kepada vendor. | $0 < \text{Total Paid} < \text{Bill Amount}$ |
| `PAID` | Tagihan vendor telah dilunasi sepenuhnya. | $\text{Total Paid} = \text{Bill Amount}$ |
| `OVERDUE` | Tagihan vendor belum lunas dan telah melewati tanggal jatuh tempo pembayaran. | $\text{Tanggal Sekarang} > \text{Due Date}$ & belum lunas. |
| `VOID` | Tagihan vendor dibatalkan karena retur material atau pembatalan PO. | Tagihan dihapus dari komitmen beban keuangan. |

---

## 6. Vendor Payment Status (`vendor_payment_status`)
Menyatakan status proses transaksi pembayaran hutang kepada vendor.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Alur Kerja |
| :--- | :--- | :--- |
| `PENDING` | Rencana pembayaran vendor dijadwalkan oleh Admin, menunggu approval mutasi dari Owner. | Status awal ketika pembayaran diusulkan. |
| `PROCESSING` | Dana sedang diproses keluar (misal: kliring bank atau transfer terjadwal). | Status sementara saat bank memproses transfer. |
| `COMPLETED` | Dana telah berhasil didebit dari rekening perusahaan dan diterima oleh vendor. Saldo berkurang. | Memicu pencatatan ledger `cash_transaction` dan update `vendor_bill` ke `PAID`. |
| `FAILED` | Transfer bank gagal (salah rekening/saldo tidak cukup). | Pembayaran dibatalkan, tagihan kembali berstatus `UNPAID`. |

---

## 7. Budget Status (`budget_status`)
Status persetujuan Rencana Anggaran Biaya (RAB/BoQ) proyek secara keseluruhan.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Otoritas |
| :--- | :--- | :--- |
| `DRAFT` | Anggaran sedang dirancang oleh PM atau Admin lapangan. | PM / Admin. |
| `PENDING_APPROVAL` | Anggaran proyek selesai dirancang dan diajukan ke Owner untuk diperiksa kelayakannya. | PM mengajukan ke Owner. |
| `APPROVED` | Anggaran disetujui oleh Owner. Kategori biaya dikunci dan proyek dapat dijalankan (`ACTIVE`). | Hanya disetujui oleh Owner. |
| `REJECTED` | Anggaran ditolak oleh Owner karena estimasi biaya terlalu tinggi atau margin terlalu tipis. | Owner mengembalikan ke status `DRAFT` disertai catatan revisi. |

---

## 8. Cost Approval Status (`cost_approval_status`)
Status otorisasi pengeluaran dana lapangan (klaim biaya PM, cash advance, reimbursement) yang dicatat pada `project_cost`.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Aksi Sistem / Otoritas |
| :--- | :--- | :--- |
| `SUBMITTED` | Pengajuan dana baru saja dikirim oleh PM lapangan dari HP dengan bukti foto nota. | Aksi awal oleh PM. |
| `VERIFIED` | Struk/nota fisik dan nominal pengajuan telah diverifikasi kesesuaiannya oleh Admin Finance. | Diverifikasi oleh Admin. |
| `APPROVED` | Mutasi kas disetujui oleh Owner (untuk pengajuan > Rp 5 juta atau jika terjadi over-budget). | Disetujui oleh Owner. |
| `PAID` | Admin Finance telah mentransfer dana ke PM/Vendor dan menandai transaksi sebagai lunas. | Memicu pemotongan saldo `bank_account` & penulisan `cash_transaction`. |
| `REJECTED` | Pengajuan ditolak karena nota tidak jelas, salah kategori, atau tidak disetujui Owner. | Dana tidak cair, status diarsipkan. |

---

## 9. Cash Transaction Type (`cash_transaction_type`)
Jenis mutasi kas pada buku besar (*ledger*) utama.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Efek Akuntansi |
| :--- | :--- | :--- |
| `DEBIT` | Kas masuk (uang masuk ke rekening perusahaan). | Menambah saldo pada `bank_account.balance` (+). |
| `CREDIT` | Kas keluar (uang keluar dari rekening perusahaan). | Mengurangi saldo pada `bank_account.balance` (-). |

---

## 10. Cash Transaction Category (`cash_transaction_category`)
Kategori klasifikasi untuk laporan arus kas operasional maupun non-operasional.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Penggunaan |
| :--- | :--- | :--- |
| `client_payment` | Pembayaran termin masuk dari klien. | AR (Accounts Receivable) - Kas Masuk. |
| `vendor_payment` | Pelunasan tagihan tempo material/jasa vendor. | AP (Accounts Payable) - Kas Keluar. |
| `petty_cash_refill` | Pengisian kembali saldo kas kecil lapangan. | Mutasi Antar Kas (Credit bank utama, Debit kas kecil). |
| `office_rent` | Biaya sewa kantor perusahaan. | Pengeluaran Operasional Umum. |
| `utilities` | Biaya listrik, internet, air kantor. | Pengeluaran Operasional Umum. |
| `salary` | Gaji karyawan dan komisi lapangan. | Pengeluaran Operasional Umum. |
| `cash_advance` | Panjar/uang muka kerja PM untuk belanja eceran. | Kas Keluar Lapangan. |
| `reimbursement` | Penggantian uang pribadi PM yang terpakai belanja. | Kas Keluar Lapangan. |
| `other` | Transaksi kas lainnya yang tidak terklasifikasi. | Pengeluaran/Pemasukan Umum. |

---

## 11. Alert Severity (`alert_severity`)
Tingkat keparahan dari peringatan keuangan (*finance alerts*) yang dipicu secara otomatis oleh sistem.

| Nilai Enum | Deskripsi (Bahasa Indonesia) | Pemicu Utama |
| :--- | :--- | :--- |
| `INFO` | Informasi umum transaksi penting (misal: DP klien masuk > Rp 100 juta). | Mutasi kas masuk besar atau approval baru. |
| `WARNING` | Peringatan dini terkait anggaran (misal: kategori RAB proyek mencapai 90% terpakai). | Realisasi biaya $\ge 90\%$ anggaran. |
| `CRITICAL` | Peringatan bahaya fatal (misal: pengeluaran over-budget > 100% atau penarikan kas mencurigakan). | Realisasi biaya $> 100\%$ anggaran atau sisa kas minus. |
