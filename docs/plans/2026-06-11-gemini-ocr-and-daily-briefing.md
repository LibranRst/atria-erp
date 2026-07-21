# Rencana Implementasi: TSK-009 Integrasi Gemini AI OCR Nota & Daily Briefing Cron

Rencana ini menjelaskan kerangka kerja integrasi Google Gen AI SDK (`@google/genai`) untuk memproses pembacaan gambar nota/struk belanja (OCR) secara multimodal dan menyusun briefing finansial CFO harian berbasis AI untuk Owner.

---

## User Review Required

> [!IMPORTANT]
> **Akses Read-Only Database & Token Logging:**
> Pipeline AI dirancang sepenuhnya read-only terhadap database transaksi keuangan riil. Hasil parsing OCR atau daily briefing akan disimpan sebagai log aktivitas proposal di tabel `ai_run` untuk transparansi operasional dan audit konsumsi token API Gemini. Mutasi dana finansial riil tetap dikendalikan manual oleh aksi explicit human approval pada antarmuka pengguna.

---

## Proposed Changes

### Komponen: Integrasi Gemini AI SDK (Core Services)

#### [NEW] [gemini.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/ai/gemini.ts)

- Menginisialisasi klien `GoogleGenAI` menggunakan API key dari variabel lingkungan `GEMINI_API_KEY`.
- Mengekspor instans `ai` yang siap digunakan oleh modul internal lainnya.

### Komponen: Server Actions AI (OCR Receipt Parser)

#### [NEW] [process-receipt.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/ai/process-receipt.ts)

- **`processReceipt(receiptImageUrl: string)`**:
  - Memverifikasi sesi pengguna menggunakan Better Auth.
  - Mengunduh berkas gambar dari ImageKit URL (`receiptImageUrl`) ke dalam Buffer dan mengubahnya menjadi format inline data Base64.
  - Memanggil model multimodal `gemini-1.5-flash` dengan instruksi sistem untuk mengekstrak data struk.
  - Mengatur parameter `responseMimeType: "application/json"` dan `responseJsonSchema` menggunakan tipe Zod/OpenAPI untuk memastikan respons mematuhi struktur teratur:
    - `vendorName` (string)
    - `transactionDate` (string ISO)
    - `subtotal` (number)
    - `tax` (number)
    - `totalAmount` (number)
    - `items` (array of `itemName`, `quantity`, `unitPrice`, `totalPrice`)
  - Mencatat riwayat panggilan AI ke tabel `ai_run` dengan status `COMPLETED`, merekam input payload (URL gambar), hasil teks JSON, dan estimasi token. Jika terjadi kesalahan, status disetel ke `FAILED` dengan `errorMessage` terperinci.
  - Mengembalikan hasil parsing.

### Komponen: API Route & Cron Job (CFO Briefing Pipeline)

#### [NEW] [route.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/api/cron/daily-briefing/route.ts)

- **`POST /api/cron/daily-briefing`**:
  - Melakukan otentikasi header request menggunakan token `CRON_SECRET` untuk mencegah eksekusi liar dari luar.
  - Mengambil data statistik finansial korporat secara agregat (read-only):
    1. Total saldo kas riil bank saat ini.
    2. Total piutang aktif (_receivables_) dari tagihan klien belum lunas.
    3. Total utang aktif (_payables_) yang jatuh tempo dalam 7 hari ke depan.
    4. Jumlah proyek aktif berstatus `ACTIVE`.
    5. Jumlah pengajuan biaya lapangan PM yang menunggu persetujuan Owner.
  - Menyusun prompt finansial harian dan memanggil model `gemini-1.5-pro` (atau `gemini-1.5-flash` sebagai fallback) untuk merangkum narasi CFO briefing berbahasa Indonesia.
  - Menyimpan narasi dan statistik terformat JSON tersebut ke tabel `ai_run` dengan status `COMPLETED` dan `runType = 'FINANCIAL_BRIEFING'`.
  - Mengembalikan status 200 dengan payload ringkasan briefing.

---

## Verification Plan

### Automated Tests

- Membuat berkas unit test baru `lib/ai/gemini.test.ts` untuk menguji:
  1. Inisialisasi SDK Gemini dan pemanggilan generatif dasar.
  2. Alur parser OCR `processReceipt` menggunakan mock response / mock fetch gambar.
  3. Eksekusi API endpoint daily-briefing menggunakan mock token valid vs invalid, serta verifikasi hasil laporan tersimpan di tabel `ai_run`.
     `bun test lib/ai/gemini.test.ts`
- Kompilasi TypeScript dan build Next.js:
  `bunx tsc --noEmit && bun run build`

### Manual Verification

- Memicu endpoint cron harian secara manual menggunakan perintah `curl` dari shell dengan menyertakan token otorisasi:
  `curl -X POST -H "Authorization: Bearer local-cron-token" http://localhost:3000/api/cron/daily-briefing`
