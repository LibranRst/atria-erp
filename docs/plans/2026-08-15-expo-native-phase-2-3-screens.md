# Expo Native Screen Wave 2–3 — Rencana Implementasi

**Tanggal:** 2026-08-15  
**Status:** Siap dijalankan setelah Phase 5  
**Prasyarat:** Step 0–9 dan Phase 3–5 pada rencana migrasi utama sudah hijau  
**Unit berikutnya:** P2.1 — ganti password sementara secara native

Dokumen ini melanjutkan
[`2026-08-15-expo-cross-platform-migration.md`](./2026-08-15-expo-cross-platform-migration.md).
Istilah **Wave 2** dan **Wave 3** di sini adalah gelombang layar native setelah layar Phase 1;
istilah ini tidak mengubah nomor Phase backend/monorepo pada rencana utama.

## Hasil yang dituju

Wave 2 membuat pekerjaan harian Proyek, budget, RAP/RAB, Material, stok, dan keuangan
proyek dapat dilakukan tanpa kembali ke web. Wave 3 memindahkan kontrol yang lebih jarang tetapi
penting: onboarding, saldo awal, rekonsiliasi, Settings, administrasi, profil, dan AI chat.

Prinsip pelaksanaan tetap sama:

- satu unit bernomor di dokumen ini adalah satu unit kerja;
- satu unit tidak boleh menarik unit berikutnya hanya karena file atau domainnya berdekatan;
- semua transport native tetap melewati satu route tRPC yang sudah ada;
- web dan native memakai loader/use-case yang sama, bukan dua implementasi bisnis;
- aplikasi harus tetap bisa dijalankan setelah setiap unit selesai.

## Temuan audit yang menentukan urutan

| Area               | Kondisi sekarang                                                                                | Implikasi                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Password sementara | Shell native menolak `mustChangePassword`; form perubahan hanya ada di web                      | Ini harus menjadi unit pertama agar akun baru tidak bergantung pada web               |
| Proyek             | 93 file, 7 tab, loader detail memuat seluruh pohon proyek sekaligus                             | Jangan mengekspos satu payload raksasa; pecah per domain layar                        |
| Material           | 43 file; dashboard baca dan banyak mutasi stok masih berupa Server Action cookie-only           | Pisahkan read model, operasi stok utama, dan kontrol gudang berisiko tinggi           |
| Settings           | 27 file; loader menggabungkan Settings, administrasi, onboarding, dan saldo awal                | Pecah bootstrap sesuai layar; jangan kirim seluruh Settings pada setiap buka          |
| Rekonsiliasi       | Impor CSV, pencatatan mutasi, pencocokan, pengecualian, dan riwayat berada dalam satu workspace | Pisahkan read/import dari keputusan rekonsiliasi                                      |
| Onboarding         | Dua route native masih bridge ke web                                                            | Nativize setelah Proyek/Material siap supaya setup menunjuk workflow yang nyata       |
| AI chat            | Route streaming HTTP sudah ada, tetapi riwayat masih Server Action dan UI web 36 file           | Gunakan route yang sama dengan bearer + `expo/fetch`; jangan membuat API route baru   |
| Route state web    | Banyak tab/drawer memakai query param                                                           | Native memakai Stack, route params, dan `formSheet`, bukan menyalin query-param state |

Baseline saat rencana ini ditulis: **517 test pass** (`core` 118 + `web` 399), build hijau,
lint 0 error dengan satu warning Storybook lama.

## Keputusan arsitektur yang dikunci

### 1. Satu screen query per layar yang benar-benar terlihat

`screenRouter` boleh bertambah procedure, tetapi tidak boleh menghasilkan satu mega-bootstrap untuk
seluruh detail Proyek. Batas yang dipakai:

- daftar memakai payload ringkas dan pagination/cursor bila koleksi dapat tumbuh;
- detail Proyek dipecah menjadi `overview`, `planning`, `operations`, dan `finance`;
- tab yang belum dibuka tidak ikut di-fetch;
- bootstrap berisi data untuk render pertama dan opsi form yang benar-benar dibutuhkan;
- setiap unit mencatat ukuran payload seed sebelum dinyatakan selesai.

Tidak ada `redirect()` atau `notFound()` di loader yang dipakai tRPC. Loader menerima `Actor` dan
mengembalikan union status seperti `ready`, `restricted`, `notFound`, atau `error`. Page web tetap
menentukan redirect/not-found presentation-nya sendiri.

### 2. Satu use-case untuk dua transport

Untuk setiap mutation:

```text
Server Action web ─┐
                   ├─→ use-case(actor, input) → DB/transaction/audit
tRPC native ───────┘
```

- Server Action membaca sesi dengan `resolveActor()` dan hanya menjadi wrapper tipis.
- tRPC memakai actor bearer dari context yang sudah ada.
- Input divalidasi Zod pada batas use-case/tRPC.
- `revalidatePath()` tetap hanya di wrapper web.
- Route tRPC tidak menyentuh Drizzle secara langsung.
- Allowlist API tetap tepat tiga route: auth, AI chat, dan tRPC.

Saat action lama memiliki `db.transaction`, badan transaksi dipindahkan verbatim. Substitusi identitas
yang diizinkan hanya `currentUser.id` menjadi `actor.userId`. Setiap unit menyimpan bukti diff blok
transaksi tanpa selisih.

### 3. Kontrak wire tidak dimiliki komponen UI

Tipe payload yang dipakai dua platform pindah ke `@atria/core` hanya bila murni. Kontrak tidak boleh
diimpor dari komponen web. `packages/core` tetap tanpa `next/*`, `react*`, Drizzle, Better Auth,
`server-only`, atau `node:*`.

### 4. Native berarti route dan interaksi native, bukan salinan DOM

Atria tetap memakai typed theme + `StyleSheet` dan primitive native yang sudah dibangun. Keputusan
produk yang menolak Material 3 di Android mengalahkan rekomendasi umum untuk memakai komponen
universal `@expo/ui` di seluruh konten. Yang dipakai:

- `NativeTabs`, native Stack, header, deep link, dan `presentation: "formSheet"` dari Expo Router;
- picker/date picker sistem bila tampilannya berada dalam chrome Atria;
- `FlatList` untuk daftar panjang; `FlashList` baru ditambah bila profiling membuktikan perlu;
- `expo-document-picker` untuk CSV, dengan file disalin ke cache sebelum dibaca;
- `expo/fetch` untuk streaming AI;
- existing `GroupedSurface`, `MoneyValue`, `SegmentedTabs`, `StatusBadge`, `FormSection`, dan
  `WorkflowFormSheet` untuk konten.

Referensi versi yang dikunci:

- Expo Router SDK 57: <https://docs.expo.dev/versions/v57.0.0/sdk/router/>
- Expo DocumentPicker SDK 57: <https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/>
- `expo/fetch` SDK 57: <https://docs.expo.dev/versions/v57.0.0/sdk/expo/#expofetch-api>

## Klasifikasi semua route web

| Route web                                             | Pendaratan native                                     | Unit                    |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------- |
| `/`, `/login`                                         | Sudah native                                          | Phase 5 selesai         |
| `/ledger`, `/expenses`, `/expenses/new`, `/approvals` | Sudah native                                          | Phase 5 selesai         |
| `/profile/password`                                   | Native penuh; dapat diakses sebelum active gate       | P2.1                    |
| `/projects`                                           | Native penuh                                          | P2.2–P2.3               |
| `/projects/[id]`                                      | Native penuh, dipecah per domain detail               | P2.4–P2.12              |
| `/materials`                                          | Native penuh                                          | P2.8–P2.10              |
| `/onboarding`, `/onboarding/review`                   | Bridge web diganti native                             | P3.1–P3.2               |
| `/materials/opening`                                  | Native sebagai bagian setup saldo/stok awal           | P3.2                    |
| `/reconciliation`                                     | Native penuh                                          | P3.3–P3.4               |
| `/settings` dan empat subroute aktif                  | Native penuh per domain                               | P3.5–P3.8               |
| `/profile`                                            | Native penuh                                          | P3.9                    |
| `/setup`                                              | Tetap bridge web untuk bootstrap organisasi pertama   | Ditinjau setelah Wave 3 |
| AI chat global                                        | Native sheet/stack, memakai route streaming yang sama | P3.10                   |

`/settings/setup` dan `/settings/administration` tidak dianggap page web terpisah karena file
`page.tsx`-nya memang tidak ada; keduanya saat ini merupakan state di workspace `/settings`.

## Target route Expo

```text
apps/mobile/src/app/
├── profile/
│   ├── index.tsx
│   └── password.tsx
├── (tabs)/
│   ├── projects/
│   │   ├── index.tsx
│   │   └── [projectId]/
│   │       ├── index.tsx          # Ringkasan
│   │       ├── planning.tsx       # RAP/RAB
│   │       ├── operations.tsx     # Stok/Pengeluaran
│   │       └── finance.tsx        # Pembayaran/Margin
│   └── materials/
│       ├── index.tsx
│       ├── [materialId].tsx
│       └── activity.tsx
├── reconciliation/
│   ├── index.tsx
│   └── history.tsx
├── settings/
│   ├── index.tsx
│   ├── budget.tsx
│   ├── categories.tsx
│   ├── library.tsx
│   ├── materials.tsx
│   └── administration.tsx
├── onboarding/
│   ├── index.tsx
│   ├── opening-stock.tsx
│   └── review.tsx
├── chat/index.tsx
└── modal/                         # formSheet untuk form/keputusan per unit
```

Nama route boleh disesuaikan bila Expo Router membutuhkan nesting berbeda, tetapi domain dan batas
payload di atas tidak boleh digabung kembali.

## Brief desain Wave 2–3

- **Mode:** Operate. Pengguna datang untuk membaca posisi lalu melakukan satu tindakan operasional.
- **Fokus:** satu ringkasan yang menjawab keputusan utama, lalu grouped rows; bukan kumpulan card
  identik atau tabel web yang diperkecil.
- **Navigasi detail Proyek:** empat domain (`Ringkasan`, `Perencanaan`, `Operasional`, `Keuangan`)
  mengikuti grammar web yang sudah disetujui. RAP/RAB, Stok/Pengeluaran, dan Pembayaran/Margin adalah
  pilihan sekunder di dalam domainnya.
- **Daftar panjang:** virtualized, pull-to-refresh, skeleton struktural, empty/restricted/offline state.
- **Form:** row borderless di satu `FormSection`; action eksplisit di form sheet; destructive action
  selalu punya alasan/konfirmasi.
- **Aksesibilitas:** target efektif 48×48, label pembaca layar, safe area, keyboard avoidance, dan
  reduced motion.
- **Visual:** cool iOS gray, satu aksen terracotta, uang tabular dan tidak membungkus, status tidak
  bergantung warna.
- **Anti-goal:** tidak menyalin query-param drawer web, tidak membuat dashboard admin generik, tidak
  menampilkan enum mentah, dan tidak membuat grafik dekoratif.

## Wave 2 — pekerjaan harian Proyek dan Material

### P2.1 — Ganti password sementara secara native

- Ekstrak `changeTemporaryPassword` ke use-case ber-actor; pindahkan transaksi verbatim.
- Ekspos mutation melalui `protectedProcedure`, bukan `activeProcedure`, karena hanya prosedur ini
  yang harus dapat dipakai saat `mustChangePassword=true`.
- Ubah auth gate native agar mengarahkan akun tersebut ke `/profile/password`.
- Setelah sukses, hapus sesi/token lokal, kembali ke login, dan wajib login ulang.
- Bukti: sesi lama ditolak, audit `CHANGE_TEMPORARY_PASSWORD` tercatat, dan procedure aktif lain tetap
  menolak `MUST_CHANGE_PASSWORD`.

### P2.2 — Daftar Proyek read-only

- Refactor `getProjectListPageData(actor)` menjadi union status tanpa redirect.
- Pindahkan kontrak list murni ke core dan tambahkan `screen.projects`.
- Ganti placeholder tab Proyek dengan `FlatList`, filter status/kesehatan, pull-to-refresh, skeleton,
  empty/restricted/offline state, dan navigation ke detail.
- PM/Designer hanya menerima proyek yang memang berada dalam scope server.

### P2.3 — Buat dan edit identitas Proyek

- Ekstrak `createProjectAction` dan `updateProjectAction` sebagai use-case terpisah.
- Aktifkan `/modal/project` sebagai form sheet native dengan data client/PM dari bootstrap ringkas.
- Tombol create hanya untuk Owner/Finance; update mengikuti permission dan scope yang sudah ada.
- Jangan ikut memindahkan budget atau aktivasi dalam unit ini.

### P2.4 — Ringkasan detail Proyek

- Pecah bagian overview dari loader detail besar menjadi `screen.projectOverview({ projectId })`.
- Kembalikan identitas, financial health, readiness, blocker, dan lima kategori; jangan ikut mengirim
  RAP item, RAB item, vendor payment, atau semua movement.
- Native route `[projectId]/index` menjadi pintu domain detail dan menjaga locked-project behavior.

### P2.5 — Setup, approval budget, dan aktivasi Proyek

- Ekstrak use-case budget/activation satu per mutation tanpa mengubah formula atau transaksi.
- Port form alokasi kategori, review budget, approve/reject, reallocation dengan alasan, dan activation
  checklist.
- Settings hanya dibaca sebagai default untuk budget baru; perubahan Settings tidak mengubah budget
  proyek yang sudah ada.
- Bukti meliputi persentase kategori, buffer tidak teralokasi, approval, audit, dan locked tabs.

### P2.6 — RAP Material serta paket Tukang/Subcon

- Bootstrap hanya data perencanaan: RAP aktif, category plan, material/vendor/template options.
- Port stage `MATERIAL → TUKANG → SUBCON → REVIEW`, termasuk skip eksplisit dan finalisasi.
- Mutation RAP/category-plan dipindah satu per satu; setiap unit-cost tetap memakai helper cents yang
  ada.
- RAP internal tidak pernah masuk ke kontrak client-facing.

### P2.7 — RAB, revisi, dan Change Order

- Port generate dari sumber terpilih, manual client-safe rows, bundle, approval, refresh source,
  revision, void, client confirmation, dan Change Order.
- Gunakan view-model client-safe khusus; jangan serialisasi internal unit cost, vendor, margin,
  stock availability, atau internal note ke preview/export RAB.
- Integration test lama `rab-revision-action` dan `workflow-rework` wajib tetap hijau tanpa melemahkan
  asersinya.

### P2.8 — Control center Material read-only

- Refactor dashboard Material menjadi loader ber-actor.
- `screen.materials` mengirim ringkasan, inventory, shortage, dan halaman activity pertama; receipt,
  count, transfer, serta opsi form dimuat hanya saat route/action terkait dibuka.
- Ganti placeholder Material dengan empat view: Ringkasan, Persediaan, Kebutuhan, Aktivitas.
- Activity memakai cursor yang sudah ada dan tidak memuat seluruh histori.

### P2.9 — Operasi stok utama

- Port Goods Receipt, Reserve, Use, Return, dan Waste sebagai form sheet native.
- Setiap transaction body dipindah verbatim dan tetap menulis `stock_movement` + `audit_log`.
- Reservation/use tidak membuat `cash_transaction`; Goods Receipt tidak otomatis membayar vendor.
- Waste wajib alasan; link RAP/material hanya valid untuk kategori Material dan proyek yang sama.

### P2.10 — Kontrol gudang dan exception

- Port location, transfer, stock count draft/submit/approve/reject, emergency adjustment, serta receipt
  reversal request/approve/reject.
- Transfer tidak boleh memakai reserved stock; count menolak snapshot basi/di bawah reservation;
  adjustment/reversal selalu punya alasan audit.
- Keputusan berisiko tetap role-gated dan tidak digabung dengan operasi stok utama P2.9.

### P2.11 — Operasional di dalam detail Proyek

- Isi domain `Operasional` dengan stok proyek dan daftar pengeluaran yang memakai read model native
  yang sudah ada.
- Reuse form biaya Phase 5 dengan project terisi otomatis; tambah daftar/tagihan vendor tanpa
  menduplikasi mutation pembayaran.
- Scope dan reservation harus selalu terikat `projectId` route yang sudah diverifikasi server.

### P2.12 — Keuangan Proyek, margin, dan closing

- Isi domain `Keuangan` dengan invoice klien, penerimaan, vendor payment history, cash position,
  profitability, dan closing checklist.
- Balance-changing transaction dipindah verbatim, tetap mengunci rekening dan menulis ledger + audit.
- Closing ditolak selama transaksi belum direkonsiliasi atau reservation belum dibereskan.
- Owner/Finance melihat margin; PM/Designer tidak menerima field global/restricted dari server.

## Wave 3 — setup, kontrol, dan administrasi

### P3.1 — Onboarding Owner native

- Ganti bridge `/onboarding` dengan workspace langkah native dan loader ber-actor.
- Port progress/pause/complete tanpa melewati readiness gate.
- Bootstrap `/setup` sebelum organisasi terbentuk tetap web bridge; tidak dibuat route API baru.

### P3.2 — Saldo/stok awal dan review Finance

- Port entry manual/CSV, preview, submit, review, approve/reject, serta reversal opening inventory.
- Pisahkan draft/preview dari transaction final; semua stok final menulis movement + audit.
- Reviewer tidak boleh menyetujui submission miliknya sendiri sesuai aturan yang sudah ada.

### P3.3 — Rekonsiliasi read/import

- Buat loader ber-actor untuk `Mutasi Bank`, `Catatan Atria`, dan `Riwayat` yang berpaginasi.
- Port input manual dan impor CSV memakai `expo-document-picker` dengan batas 1 MB dan
  `copyToCacheDirectory: true`.
- Impor/pencatatan statement tidak mengubah saldo rekening.

### P3.4 — Keputusan rekonsiliasi

- Port match, suggested match review, exception, clear exception, dan history detail.
- Tidak ada auto-approval; amount, arah, rekening, dan bukti harus terlihat sebelum konfirmasi.
- Reconciled `cash_transaction` tetap immutable; koreksi hanya melalui mekanisme kompensasi yang ada.

### P3.5 — Settings hub read-only

- Pecah `getSettingsPageData` menjadi bootstrap per domain, mulai dari overview/readiness.
- Settings menjadi route stack, bukan satu payload besar dengan semua tab.
- Role tanpa izin mendapat restricted state tanpa data sensitif.

### P3.6 — Budget Allocation dan Expense Categories

- Port default internal budget, target margin, category ratio, enable/disable, dan metadata kategori.
- Total ratio di atas 100% tetap ditolak; perubahan hanya berlaku pada project budget baru.
- Hanya Owner/Finance yang dapat mengubah finance Settings.

### P3.7 — Item & Price Library serta Material Master Settings

- Port create/update/archive/activate template dan material, inventory default, category, serta import
  material.
- Purchasing boleh mengelola Material Master tetapi tidak formula budget/margin.
- Operasi Settings tidak boleh diam-diam membuat stock movement.

### P3.8 — Administrasi tim dan vendor

- Port list/create/update staff, temporary password issuance, vendor management, dan readiness.
- Last-active-owner invariant tetap berlaku; client tidak boleh memasok actor ID.
- `/settings/administration` menjadi route nyata di native tanpa menambah page web palsu.

### P3.9 — Profil dan simulasi developer

- Port profil, matriks akses, sign-out, link Settings, dan developer role simulation.
- Simulation hanya tersedia pada development flag dan selalu menampilkan affordance untuk kembali ke
  Owner.
- Password wajib sudah selesai di P2.1; unit ini tidak mengubah jalur tersebut.

### P3.10 — AI chat native

- Gunakan `/api/ai/chat` yang sudah ada dengan base URL absolut, bearer, dan `expo/fetch` streaming.
- Ekstrak chat-history Server Actions ke use-case/tRPC; route streaming tetap read-only.
- Port conversation picker, composer, follow-up, tool trace, cards, dan deep link ke route native.
- Proposal biaya hanya mem-prefill draft dan selalu membutuhkan konfirmasi manusia; tidak ada mutation
  finance/material otomatis dan tidak ada AI briefing di Dashboard.

### P3.11 — Acceptance lintas platform

- Jalankan walkthrough seed end-to-end untuk Owner, Finance, Purchasing, dan PM.
- Ulangi visual/gesture/keyboard/reduced-motion pada 320, 360, 390, dan 430 px iOS.
- Wajibkan satu perangkat/emulator Android aktif untuk inspeksi terakhir; bundle saja tidak cukup
  untuk menutup seluruh migrasi layar.
- Ukur payload, waktu render daftar panjang, retry/offline state, dan tidak adanya raw enum.
- EAS Build/Submit, push notification, dan offline-first penuh tetap proyek terpisah.

## Gerbang wajib setiap unit

Unit belum selesai sebelum seluruh poin yang relevan hijau:

1. Test targeted untuk loader/use-case/kontrak yang disentuh.
2. Untuk mutation finance/stock: test sebelum refactor tetap hijau tanpa melemahkan asersi, diff
   transaction body identik, dan data demo membuktikan ledger/movement + audit.
3. `bun --filter @atria/mobile typecheck` dan `bun --filter @atria/mobile lint`.
4. `cd apps/mobile && bunx expo install --check`.
5. Export Metro iOS dan Android ke direktori sementara.
6. Smoke test simulator pada route yang berubah; untuk UI baru periksa 320/360/390/430 px.
7. Gerbang repo dari root:

   ```bash
   bun run test
   bun run build
   bun run lint
   ```

   Baseline tidak boleh turun dari 517 pass dan lint harus tetap 0 error.

8. `git diff --check` bersih.
9. Tabel posisi di handoff diperbarui sebelum berhenti.

## Batas yang tetap di luar Wave 2–3

- API route keempat.
- EAS Build/Submit dan store release.
- Push notification.
- Offline-first penuh di luar draft recovery yang sudah ada.
- AI CFO/briefing pada Dashboard.
- Auto-approval rekonsiliasi, auto-payment, atau mutasi stok oleh AI.
- Perubahan schema besar, `packages/db`, atau `packages/api` tanpa rencana terpisah.

## Kriteria selesai keseluruhan

Wave 2–3 selesai ketika seluruh route yang diklasifikasikan native penuh berjalan dari bearer session,
role/scoping sama dengan web, seluruh mutation memakai use-case bersama, transaksi finansial/stok
tetap identik, route bridge tersisa hanya `/setup`, dan acceptance lintas iOS + Android sudah memiliki
bukti perangkat nyata.
