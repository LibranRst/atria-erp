# Rencana Desain: Pemisahan Porsi Desain & Jasa vs Produksi Fisik pada Budget & RAB (Design & Build Scope Separation)

Tanggal: **7 September 2026**  
Status: **DRAFT / PROPOSED**  
Domain: **Project Finance, Budget Control & RAB/RAP Integration**

---

## 1. Latar Belakang & Masalah (Problem Statement)

Pada industri *Interior Design & Build* (seperti Dekoria), kontrak proyek sering kali merupakan paket terpadu (*hybrid*) yang memuat dua komponen fundamental:
1. **Porsi Jasa Keahlian / Profesional (Design & Management Fee)**:
   - Jasa Desain 3D photorealistic, gambar kerja workshop (*shop drawing*), supervisi berkala, dan fee manajemen proyek.
   - **Karakteristik biaya**: Memiliki modal material fisik **Rp0** (karena dikerjakan oleh tim in-house arsitek/desainer). Sebagian besar nilai ini adalah **Laba Kotor (Gross Margin) / Kontribusi Overhead Studio**.
2. **Porsi Produksi & Pengerjaan Fisik (Fit-Out & Construction)**:
   - Pembuatan kabinet multipleks, pelapisan HPL, borongan tukang kayu/finishing, serta vendor spesialis marmer/kaca.
   - **Karakteristik biaya**: Memiliki modal riil *Cost of Goods Sold* (COGS) di kategori `MATERIAL`, `TUKANG`, dan `SUBCON`.

### Masalah yang Terjadi Saat Ini
Dalam implementasi saat ini, rumus plafon anggaran Atria ERP menerapkan **Batas Budget Internal (Cap 90%)** dan **Rasio Kategori (Material 38%, Tukang 28%, dll.)** secara *pukul rata* ke **seluruh nilai kontrak**:
- Pada proyek *Studio Bassura City Unit 18B*, nilai kontrak disepakati **Rp50.000.000**.
- Dari angka tersebut, kebutuhan fisik riil (RAP) sebenarnya hanya **Rp25.265.000** (Material Rp7,26jt, Tukang Rp10jt, Subcon Rp8jt).
- Di penawaran klien (RAB), selisih nilai sebesar **Rp21.927.778** dimasukkan sebagai item manual: `Jasa Desain 3D, Shop Drawing, Supervisi & Manajemen Proyek`.
- **Dampak Negatif**:
  Saat RAB disetujui, sistem mengalikan 38% Material ke basis internal budget Rp45.000.000 (90% dari Rp50jt). Akibatnya, **Plafon Material melonjak menjadi Rp17.100.000**, padahal kebutuhan fisik riilnya hanya Rp7,26 juta!
  Hal ini membingungkan Owner dan PM, serta berisiko membuat tim lapangan merasa memiliki ruang anggaran belanja material yang sangat longgar (Rp17jt), padahal uang tersebut adalah hak fee desain perusahaan.

---

## 2. Tujuan Solusi (Objectives)

1. **Item Manual Non-Fisik Tidak Merusak Plafon Produksi**: Baris manual yang bersifat fee/jasa (seperti Jasa Desain 3D, Manajemen Fee) tidak boleh menaikkan plafon belanja Material atau Tukang.
2. **Margin Keahlian Terkunci Utuh**: Porsi Jasa Desain langsung diakui 100% sebagai penambah Target Gross Margin perusahaan, bukan dicairkan ke pagu pengeluaran proyek.
3. **Mempertahankan 5 Kategori Kanonis**: Tidak mengotori buku besar pengeluaran kas dengan kategori biaya fiktif. 5 Kategori Kanonis (`MATERIAL`, `TUKANG`, `SUBCON`, `OPERASIONAL`, `LAIN_LAIN`) tetap murni mencatat kas keluar riil ke toko/pekerja/vendor.
4. **Plafon Biaya Lapangan Realistis**: Plafon belanja material dan upah tukang tetap ketat mencerminkan kebutuhan riil lapangan (+ batas toleransi aman).

---

## 3. Arsitektur Teknis & Solusi Desain

### 3.1 Klasifikasi Tipe Item Manual pada RAB (`itemType` / `isProductionCost`)
Pada tabel `rab_estimate_item`, baris yang bertipe `MANUAL_CLIENT_LINE` diberi klasifikasi sifat biaya:
- **`COMMERCIAL_FEE` / `PROFESSIONAL_SERVICE` (Non-Fisik / Jasa)**:
  - Contoh: Jasa Desain 3D, Supervisi, Project Management Fee, Diskon Komersial.
  - Sifat: $0\%$ biaya belanja lapangan. Menambah nilai kontrak ke klien, tetapi **TIDAK** menambah pagu belanja Material/Tukang.
- **`PRODUCTION_ADDON` (Pekerjaan Fisik Tambahan)**:
  - Contoh: Tambahan ambalan gantung, tambahan stop kontak, ganti handle premium.
  - Sifat: Menambah lingkup kerja fisik lapangan. Boleh dialokasikan ke kategori biaya tertentu.

### 3.2 Rumus Rescale Anggaran saat RAB Disetujui (`approveRabEstimate`)

Saat Owner menyetujui RAB di Step B3, sistem memecah kalkulasi menjadi dua kantong:

```
TOTAL KONTRAK KLIEN (RAB Approved Value)
  │
  ├── [A] Subtotal Item Jasa Non-Fisik (COMMERCIAL_FEE)
  │     └─ Contoh: Jasa Desain 3D = Rp21.927.778
  │     └─ Perlakuan: 100% dialokasikan langsung ke Target Gross Profit / Margin!
  │
  └── [B] Subtotal Item Produksi Fisik (PRODUCTION_SCOPE)
        └─ Contoh: Material + Tukang + Subcon = Rp28.072.222
        └─ Perlakuan: Pagu Budget Cap (90%) dan Rasio Kategori HANYA diterapkan ke angka ini!
```

#### Kalkulasi Baru:
1. **Basis Anggaran Produksi**:
   $$\text{Production Base} = \sum \text{Item RAP Material} + \sum \text{Item Category Plan} + \sum \text{Manual Item (Fisik)}$$
   Di Bassura City: $\text{Production Base} = \mathbf{\text{Rp28.072.222}}$
2. **Plafon Biaya Produksi Internal**:
   $$\text{Internal Budget} = \text{Production Base} \times 90\% = \mathbf{\text{Rp25.265.000}}$$
3. **Plafon Kategori Pengeluaran**:
   - Material (38% dari Basis Produksi): $\mathbf{\text{Rp9.600.000}}$ *(Sangat pas dengan RAP Rp7,26jt!)*
   - Tukang (40% dari Basis Produksi): $\mathbf{\text{Rp10.100.000}}$ *(Sangat pas dengan RAP Rp10jt!)*
   - Subcon (22% dari Basis Produksi): $\mathbf{\text{Rp5.565.000}}$ *(Pas dengan subcon!)*
4. **Target Gross Margin Perusahaan**:
   $$\begin{aligned}
   \text{Target Gross Amount} &= \text{Total Kontrak} - \text{Internal Budget} \\
   &= \text{Rp50.000.000} - \text{Rp25.265.000} = \mathbf{\text{Rp24.735.000}}\ (\mathbf{49,47\%})
   \end{aligned}$$

---

## 4. Antarmuka Pengguna (UI/UX)

1. **Sheet Modal "Tambah Baris Manual RAB"**:
   - Ditambahkan selector tipe baris:
     - 🔘 **Jasa Desain / Manajemen Fee** *(Rekomendasi untuk penyeimbang margin, tidak menaikkan pagu belanja material/tukang)*.
     - 🔘 **Pekerjaan Fisik Tambahan** *(Memerlukan belanja material/tukang tambahan)*.
2. **Tab Ringkasan Finansial Proyek (`/projects/[id]?tab=summary`)**:
   - Ditampilkan kartu metrik yang jelas:
     - **Nilai Kontrak Klien**: Rp50.000.000
     - **Porsi Jasa Desain & Fee**: Rp21.927.778
     - **Pagu Belanja Lapangan (Plafon)**: Rp25.265.000
     - **Margin Kotor Terkunci**: Rp24.735.000 (49,5%)
   - Tim lapangan langsung paham bahwa uang yang boleh dibelanjakan adalah Rp25,2 juta, bukan Rp45 juta!

---

## 5. Rencana Implementasi Bertahap (Rollout)

- **Tahap 1 (Dokumentasi & Kesepahaman Konseptual)**: Menyelaraskan panduan UAT dan dokumentasi tim agar pemisahan konsep Jasa Desain vs Produksi Fisik dipahami dengan seragam.
- **Tahap 2 (Skema Database)**: Menambahkan kolom `item_nature` (`PRODUCTION` vs `PROFESSIONAL_FEE`) pada `rab_estimate_item`.
- **Tahap 3 (Logika Server Action)**: Memperbarui fungsi `approveRabEstimate` di `apps/web/app/actions/project/rap-rab-approval.ts` agar hanya me-rescale kategori dari subtotal item bertipe `PRODUCTION`.
- **Tahap 4 (UI Selector & Testing)**: Menambahkan opsi radio pada drawer penambahan item manual RAB dan melengkapi unit test invarian finansial.
