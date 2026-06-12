# Rencana Implementasi: Migrasi Model Gemini ke Gemini 3 Flash Preview

Rencana ini menjelaskan pembaruan pada konfigurasi model Gemini AI yang digunakan oleh aplikasi Atria ERP. Kami akan memigrasikan penggunaan model lama (`gemini-1.5-flash` dan `gemini-1.5-pro`) ke model generasi terbaru (`gemini-3-flash-preview`) untuk seluruh pipeline AI (OCR nota belanja dan CFO daily briefing) guna mengoptimalkan biaya dan keandalan sistem.

---

## Proposed Changes

### Komponen: API & Server Actions

#### [MODIFY] [process-receipt.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/ai/process-receipt.ts)
* Mengganti model `"gemini-1.5-flash"` dengan `"gemini-3-flash-preview"` pada baris ke-105 untuk pemrosesan OCR nota belanja.

#### [MODIFY] [route.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/api/cron/daily-briefing/route.ts)
* Mengganti model `"gemini-1.5-pro"` dengan `"gemini-3-flash-preview"` pada baris ke-117 untuk penyusunan CFO daily briefing (menggunakan versi Flash untuk efisiensi biaya).

---

### Komponen: Automated Testing

#### [MODIFY] [gemini.test.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/ai/gemini.test.ts)
* Menyelaraskan model mock generator agar menggunakan `"gemini-3-flash-preview"` untuk menggantikan model versi 1.5.

---

### Komponen: Dokumentasi Teknis

#### [MODIFY] [AI_AGENT_ARCHITECTURE.md](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/docs/06-technical/AI_AGENT_ARCHITECTURE.md)
* Memperbarui penjelasan model yang digunakan pada seluruh agen AI agar konsisten menggunakan `gemini-3-flash-preview`.

---

## Verification Plan

### Automated Tests
* Menjalankan unit test untuk memverifikasi bahwa mock Gemini merespons model baru dengan benar:
  `bun test lib/ai/gemini.test.ts`
* Menjalankan seluruh test suite Atria ERP:
  `bun test`
* Menjalankan verifikasi tipe dan build Next.js:
  `bunx tsc --noEmit && bun run build`

### Manual Verification
1. Lakukan pengujian unggah gambar nota (`public/receipt_test.png`) pada form pengeluaran baru untuk memastikan OCR berhasil membaca nama toko, total, tanggal, dan item belanja dengan sukses menggunakan model baru.
2. Trigger cron daily briefing secara manual untuk memverifikasi briefing harian berhasil dihasilkan.
