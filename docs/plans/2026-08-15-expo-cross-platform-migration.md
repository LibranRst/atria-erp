# Migrasi Cross-Platform ke Expo — Rencana Implementasi

**Tanggal:** 2026-08-15
**Status:** Berjalan. Phase 0 (Expo skills) selesai. Phase 1 sampai Step 2 (`git mv` ke `apps/web`) selesai dengan semua gerbang hijau.
**Posisi terbaru & prompt serah-terima antar-agent:** [2026-08-15-expo-migration-handoff.md](./2026-08-15-expo-migration-handoff.md)
**Ruang lingkup:** Menjadikan Atria ERP aplikasi native Android + iOS dengan Expo SDK 57, berbagi database, auth, business logic, Zod schema, dan design token dengan web. Web tetap berjalan tanpa perubahan perilaku.

---

## Konteks

Atria ERP hari ini adalah satu Next.js 16 App Router app (Bun, Neon + Drizzle, Better Auth, Tailwind v4) yang sudah **mobile-first secara konstruksi**: shell `max-w-md` (448px) satu kolom di semua viewport, header fixed 56px, bottom tab bar + FAB, bottom sheet, capsule controls, spring motion. Secara IA dan visual, ini praktis sudah aplikasi mobile yang kebetulan dirender di browser.

Yang diminta: bikin versi **native Android + iOS** dengan React Native / Expo, memakai design system yang sama ("The Quiet Command Center"), condong ke iOS di kedua platform — **bukan** Material Design di Android — dan memakai komponen bawaan Expo (termasuk elemen iOS 26 seperti bottom sheet native) daripada membangun ulang dari nol.

Hasil akhir: web tetap hidup dan tidak berubah perilakunya; app native berbagi database, auth, business logic, Zod schema, dan design token yang sama.

### Dua kendala nyata yang membentuk seluruh rencana ini

1. **Server Actions tidak bisa dipanggil dari React Native.** Semua mutation (106 file di `app/actions/**`) memakai protokol RSC dan `lib/server/session.ts` yang cookie-only. Native client butuh transport HTTP sungguhan.
2. **`@expo/ui` universal me-render Jetpack Compose di Android** — yaitu Material 3, yang eksplisit ditolak. Jadi "pakai komponen Expo" harus dipilih per komponen, bukan menyeluruh.

### Keputusan yang sudah dikunci

| Topik   | Keputusan                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------- |
| Bridge  | tRPC di dalam Next app — SATU route handler baru `app/api/trpc/[trpc]/route.ts`                       |
| Repo    | Monorepo penuh: `apps/web`, `apps/mobile`, `packages/*`                                               |
| UI      | Hybrid — native chrome (tabs, stack, sheet, context menu, haptics) + konten digambar dari token Atria |
| Phase 1 | login → `/ledger` → `/expenses` (+ kamera/OCR) → `/approvals`                                         |

---

## Target layout

```
atria-erp/
├── apps/
│   ├── web/                    # Next.js app sekarang, dipindah apa adanya
│   │   ├── app/                #   + app/api/trpc/[trpc]/route.ts  (route ke-3)
│   │   ├── components/ features/ lib/ db/ drizzle/ public/
│   │   ├── server/             #   BARU: actor.ts, usecases/**, trpc/**
│   │   └── next.config.ts .env drizzle.config.ts bunfig.toml eslint.config.mjs
│   └── mobile/                 # Expo SDK 57 (RN 0.86, React 19.2)
│       ├── src/app/            #   Expo Router — routes only
│       ├── src/screens/        #   badan layar
│       ├── src/components/     #   primitive Atria versi RN
│       ├── src/theme/          #   re-export packages/tokens + helper RN
│       ├── app.json eas.json AGENTS.md
├── packages/
│   ├── core/                   # Zod schemas, money/date utils, domain logic murni
│   └── tokens/                 # design token: generated dari app/globals.css
├── docs/  tsconfig.base.json  package.json (workspace root)
```

**Dua koreksi terhadap asumsi awal**, keduanya hasil pembacaan kode:

- **Tidak ada `packages/db`.** `@/db` diimpor **111 file / 214 statement**, dan `db/seed.ts` mengimpor `@/lib/auth` (yang mengimpor `@/db`) → memindahkannya bikin siklus. `apps/mobile` tidak pernah menyentuh DB; ia hanya mengimpor _tipe_ router. Simetri tidak sepadan dengan 111 file churn. Ekstrak nanti, saat ada konsumen server kedua (worker/cron/CLI).
- **Tidak ada `packages/api`.** Use-case butuh `@/db`, `@/lib/auth/scoping`, `@/lib/finance/balance-mutation`; dan 10 screen loader mengimpor **tipe UI** dari komponen feature (`@/features/expenses/components/lists/expense-list`) — jadi `packages/api` akan bergantung pada `apps/web/features/**`, siklus lagi. Use-case tinggal di `apps/web/server/`. Mobile mengimpor `import type { AppRouter }` yang dihapus total saat kompilasi, jadi Metro tidak pernah melihat modulnya.

---

## Phase 0 — Agent tooling (Expo skills)

Dikerjakan lebih dulu supaya semua agent (termasuk sesi ini) bekerja dengan pengetahuan Expo SDK 57 yang benar, bukan dari memori training.

**Claude Code** — marketplace `claude-plugins-official` sudah terdaftar di mesin ini dan plugin `expo` terkonfirmasi ada di katalognya (287 plugin). Plugin ini sekalian mengonfigurasi Expo MCP server.

```bash
claude plugin install expo@claude-plugins-official
```

**Codex** — CLI sudah terpasang di `~/.nvm/versions/node/v24.18.0/bin/codex`.

```bash
codex plugin add expo@openai-curated
```

**Antigravity** — tidak punya marketplace sendiri untuk ini; `expo/skills` mendukungnya lewat skills CLI (Antigravity terdaftar sebagai target resmi di README repo).

```bash
npx skills@latest add expo/skills --skill '*' --agent antigravity
```

`--skill '*'` memilih seluruh 25 skill; tanpa `--agent`, CLI akan menanyakan target.

**Hasil nyatanya project-scoped, bukan global.** Skill mendarat di `.agents/skills/` di repo ini — bergabung dengan skill milik Atria sendiri (`atria-design`, `atria-finance`, `atria-knowledge`, `atria-material`, `atria-qa`) dan `impeccable`. `.gitignore:9` (`!.agents/skills/**`) memang sengaja meng-un-ignore direktori itu, jadi repo ini konvensinya **meng-commit** skill bersama — 25 direktori baru siap di-commit dan otomatis ikut untuk siapa pun yang clone. Verifikasi:

```bash
ls .agents/skills | grep -c expo
```

Satu yang ikut terbawa dan sebaiknya dihapus: `expo-skill-eval` berasal dari `.claude/skills/` milik repo expo/skills sendiri (harness eval internal mereka), bukan skill produk.

**File konteks project** untuk app mobile (dibaca semua agent, termasuk Antigravity yang memakai `GEMINI.md` di root repo):

```bash
curl -o apps/mobile/AGENTS.md https://raw.githubusercontent.com/expo/expo/main/packages/create-expo/template/agent-files/AGENTS.md
```

Lalu `apps/mobile/CLAUDE.md` berisi `@AGENTS.md`, dan tambahkan pointer ke `apps/mobile/` di `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` root.

25 skill yang masuk mencakup yang paling relevan di sini: `expo-router`, `expo-native-ui`, `expo-ui`, `expo-design-system`, `expo-data-fetching`, `expo-project-structure`, `eas-simulator`, `eas-app-stores`.

---

## Phase 1 — Monorepo + shared packages

> Detail mekanis (workspace field, tsconfig, eslint scoping, drizzle, arch tests) disusun terpisah — lihat bagian **Mekanika migrasi** di bawah.

Prinsip: pemindahan ini murni mekanis dan harus bisa dibuktikan dengan `bun run build` + `bun test` hijau **sebelum** satu baris React Native ditulis.

**`packages/core`** — kode yang sudah murni dan langsung dipakai dua platform:

- Seluruh `lib/validations/**` (13 modul Zod) — nilai reuse tertinggi, satu sumber validasi untuk web, tRPC, dan mobile.
- `lib/types/action-response.ts` — kontrak `ActionResponse<T>` jadi kontrak wire untuk tRPC juga.
- `lib/utils/{money,date,error-message,client-id}.ts` — termasuk `formatIdr`, `formatShortIdr`, `formatTightIdr`, `parseNumericToCents`, `fromCents`.
- `lib/project/**` (activation-readiness, effective-health, pricing, project-overview, quotation-total, rab-selection, rap-rab, rap-setup)
- `lib/finance/{approval-summary,approval-types,bank-statement-csv,budget-indicator,cash-direction,dashboard-overview}.ts`
- `lib/material/**`, `lib/presentation/**`, `lib/budget/excel-budget.ts`, `lib/import/csv.ts`, `lib/onboarding/owner-onboarding.ts`
- `lib/auth/{role-constants,administration-access,developer-account-simulation}.ts`
- `lib/forms/local-form-recovery.ts` — logikanya murni, storage adapter di-inject (web: localStorage, mobile: MMKV).
- Tambahan yang **wajib** ikut atau `packages/core` tidak akan compile: `lib/budget/excel-budget.ts` (diimpor `validations/budget.ts` **dan** `finance/dashboard-overview.ts`) dan `lib/types/indicator-tone.ts` (diimpor `finance/budget-indicator.ts`).
- Tambahan yang dipakai layar Phase 1: `lib/activity-detail/{types,validation}.ts`, `lib/onboarding/owner-onboarding.ts` (diimpor 15×, termasuk loader `/ledger`), `lib/import/csv.ts`.

**Satu file wajib di-split: `lib/auth/permissions.ts`.** File ini mengekspor konstanta murni _dan_ membuka koneksi DB di module scope (`import { db } from "@/db"`). Ini sudah jadi bug web laten, bukan sekadar penghalang mobile — **tiga komponen `"use client"` mengimpor value binding darinya**: `components/layout/mobile-shell.tsx:17`, `components/layout/bottom-nav.tsx:7`, `features/profile/components/developer/developer-simulation-banner.tsx:9`. Artinya `drizzle-orm` + `@neondatabase/serverless` ada di graf bundle client hari ini.

Split: bagian murni (`PermissionKey`, `ROLE_PERMISSIONS`, `ROLE_ID_TO_NAME`, `actorHasPermission`) → `packages/core/src/auth/permissions.ts`. Bagian DB (`resolveRoleName`, `assertPermission`) tetap di `apps/web/lib/auth/permissions.ts` dengan path yang sama, jadi **11 importer yang ada tidak berubah**. Lalu perbaiki tiga komponen client itu supaya mengimpor dari `@atria/core/auth`.

**Tetap server-only, tidak dipindah:** `lib/auth.ts`, `lib/auth/scoping.ts`, `lib/budget/{budget-sync,project-budget-creation}.ts`, `lib/finance/{approval-details,balance-mutation,vendor-bill-write}.ts`, seluruh `lib/ai/**` kecuali `gemini.ts`. `db/`, `drizzle/`, dan `drizzle.config.ts` tetap di `apps/web` (lihat koreksi di atas).

**Test yang tidak boleh ikut pindah** — 11 file di bawah `lib/**` sebenarnya integration test terhadap `app/actions/**` dan menyentuh DB sungguhan (`lib/finance/actions*.test.ts`, `dashboard.test.ts`, `bank-accounts.test.ts`, `ocr-form.test.ts`, dua `*.integration.test.ts`, `lib/project/{activation-action,rab-revision-action,workflow-rework}.test.ts`, `lib/auth/permissions.test.ts`). Semua tetap di `apps/web`. Satu kasus campuran: `lib/material/stock-valuation.test.ts` — subjeknya murni dan pindah, tapi test-nya juga mengimpor `@/app/actions/material/inventory-utils`; split test-nya.

**Ditinggal / ditulis ulang untuk RN:** `lib/server/session.ts`, `lib/utils/use-url-search-param.ts` (tulang punggung pola modal-via-query-param — di RN jadi route modal Expo Router), `lib/hooks/use-preserved-scroll-height.ts` (drop), `lib/auth-client.ts`, `lib/utils/cn.ts`.

---

## Phase 2 — Backend bridge

### 2a. Better Auth: aktifkan native client (aditif)

`lib/auth.ts` sekarang **tidak punya plugin sama sekali**. Tambahkan:

```ts
import { bearer } from "better-auth/plugins";
import { expo } from "@better-auth/expo";

plugins: [bearer(), expo()],
trustedOrigins: [...existing, "atria://", "exp://**"],
```

`bearer()` tidak butuh perubahan schema. `getServerSession()` harus menerima header `Authorization` selain cookie, supaya satu jalur session melayani dua client. `proxy.ts` (gate `isActive` + `mustChangePassword`) berbasis cookie dan tidak melindungi native client — gate yang sama harus ditegakkan ulang di context tRPC, bukan diandalkan dari proxy.

Client mobile: `createAuthClient` + `expoClient({ scheme: "atria", storagePrefix: "atria", storage: SecureStore })`. Token disimpan di `expo-secure-store` dan disuntikkan ke header lewat `authClient.getCookie()`.

**Gerbang `mustChangePassword` — lubang paling halus di seluruh migrasi ini.** Matcher `proxy.ts` adalah `["/((?!api|_next/static|_next/image|favicon.ico|login|setup).*)"]`, jadi seluruh `/api/**` dilewati. Gerbang ganti-kata-sandi-sementara hari ini **hanya** hidup di `proxy.ts`. Tanpa penanganan eksplisit, user native dengan password sementara bisa memakai seluruh API. Karena itu tRPC butuh `activeProcedure` terpisah yang menolak `actor.mustChangePassword` (sambil tetap menghormati `canUseTemporaryPasswordDuringDeveloperSimulation`). Tidak ada test yang akan menangkap ini sendiri — tulis `server/trpc/procedures.test.ts` khusus untuknya.

### 2b. Ekstraksi use-case + tRPC

Pola: badan tiap Server Action dipindah ke fungsi use-case di `apps/web/server/usecases/**` yang menerima **actor context** eksplisit (session + role yang sudah di-resolve) alih-alih membaca `next/headers` sendiri. Server Action jadi pembungkus tipis; tRPC procedure memanggil use-case yang sama.

```
Server Action (web)  ─┐
                      ├─→ usecase(ctx, input) ─→ db.transaction + audit_log
tRPC procedure (RN)  ─┘
```

Ini yang menjaga guardrail finance tetap di **satu** tempat: lock pesimistik `bank_account`, verifikasi dana, `cash_transaction` + `audit_log`, immutability baris yang sudah direkonsiliasi. Tidak ada jalur mutation kedua.

`ActionResponse<T>` tetap jadi bentuk balikan di kedua sisi — mobile tidak perlu belajar kontrak error baru.

10 loader `features/*/server/get*PageData.ts` sudah mengembalikan view-model lengkap dengan status ter-tag. Ini jadi **screen-bootstrap query**: satu query tRPC per layar, kontrak data identik dengan page web sehingga tidak bisa drift. Dua hal harus dibereskan dulu:

- Loader memanggil `requireServerSession()` yang `redirect("/login")` — control-flow throw khas Next, tidak bisa dipakai dari tRPC. Ubah signature jadi `getXPageData(actor)` dan ganti tiap `redirect(...)` jadi return terdiskriminasi. `get-approvals-page-data.ts` sudah memodelkan ini benar dengan `{ status: "restricted" }`; perluas polanya. Page component yang melakukan `redirect`, loader hanya melapor — pemisahan yang lebih baik bahkan tanpa mobile.
- `get-expenses-page-data.ts` mengimpor tipe balikannya dari **komponen UI** (`@/features/expenses/components/lists/expense-list`). Tipe milik UI bocor jadi kontrak wire; berubah karena alasan desain web akan diam-diam mengubah tipe mobile. Pindahkan ~8 tipe itu ke `packages/core/src/types/expenses.ts` dan biarkan komponen maupun loader mengimpor dari sana.

**Ukuran payload perlu diukur, bukan diasumsikan.** `getExpensesPageData` hari ini mengembalikan _seluruh_ baris `projectCost` plus semua vendor bill, payment, vendor, dan project aktif beserta pohon budget/RAP/category-plan-nya. Di web itu payload RSC ke browser via wifi; ke HP di lapangan lewat seluler, bentuknya salah. Kirim apa adanya di Phase 1 **dengan gerbang pengukuran eksplisit di device nyata**, dan siapkan varian berpaginasi.

Paket baru: `@trpc/server` 11 + `superjson` di web; `@trpc/client`, `@trpc/tanstack-react-query`, `@tanstack/react-query`, `superjson` di mobile.

**`superjson` tidak opsional.** Respons tRPC adalah JSON polos, sementara payload action berisi instance `Date` (`submitFieldRequest` mengembalikan `projectCost.$inferSelect` dengan `createdAt`/`paidAt`/`updatedAt`; `getExpensesPageData` mengembalikan ratusan). RSC menserialisasi `Date` transparan, tRPC tidak. Uang tetap `numeric(15,2)` → `string`, jadi tidak ada `bigint` di kawat.

### 2c. Amandemen invariant — sekaligus tegakkan yang selama ini cuma prosa

Ternyata **tidak ada test yang menghitung jumlah API route**. `CLAUDE.md:51` menulis "Exactly two API routes exist… Do not add further API routes", tapi tidak satu pun dari tiga architecture test menyebut `api`. Jadi menambah route ke-3 secara teknis lolos tanpa mengubah apa pun — dan itu justru jawaban yang salah.

Momen menambah `/api/trpc` adalah momen yang tepat untuk mengubah prosa jadi test. Tambahkan asersi allowlist di `server-boundaries.test.ts` yang mengunci persis tiga handler (`ai/chat`, `auth/[...better-auth]`, `trpc/[trpc]`), lalu perbarui CLAUDE.md jadi tiga dengan kontraknya: route tRPC hanya mendelegasikan ke `apps/web/server/usecases/**`, tidak pernah memuat business logic, dan setiap mutation tetap melewati use-case yang sama dengan Server Action. Sebelum mempercayai test ini, buktikan ia menggigit — tambahkan `app/api/x/route.ts` dummy dan pastikan merah.

---

## Phase 3 — Design tokens & primitive RN

### 3a. `packages/tokens` — satu sumber, dua target

Blok `@theme` di `app/globals.css` bisa di-parse. Tulis script generator (`scripts/generate-tokens.ts`) yang membacanya dan mengemit `packages/tokens/src/tokens.ts`, lalu jalankan di CI supaya drift ketahuan. Web tetap membaca CSS; mobile membaca TS.

Yang harus di-resolve saat generate (RN tidak punya padanannya):

- `color-mix()` → rgba yang sudah dihitung: `--ring-subtle` (#3c3c43 @ 2%), `--ring-control` (@ 6%), `--focus-ring` (accent @ 35%), `--focus-ring-strong` (@ 55%).
- Utility opacity inline yang dipakai di JSX (`bg-white/88`, `bg-white/10`, `divide-outline-variant/20`, `bg-warning/9`, `bg-error/7.5`) → token bernama.

**Tidak ada dark mode** di sistem ini — tidak ada blok `.dark`, tidak ada `prefers-color-scheme`, nol utility `dark:`. Jadi token adalah objek beku, tanpa plumbing theme-switching. "Tier gelap" yang ada (`--surface-inverse`, `shadow-inverse`, `--critical-on-inverse`) adalah konsep _surface_, bukan tema. Di RN, kunci `userInterfaceStyle: "light"` di `app.json` supaya OS dark mode tidak merusak palet.

### 3b. Styling: typed theme + StyleSheet, bukan NativeWind

Rekomendasi saya: **jangan** pakai NativeWind. Alasannya konkret — Tailwind v4 di RN butuh NativeWind v5 yang masih `5.0.0-preview.4` plus `react-native-css` versi nightly; untuk app dengan ledger integrity itu risiko yang tidak sepadan. Skill `expo-native-ui` resmi juga menyatakan "CSS and Tailwind are not supported — use inline styles". Token semantik Atria (`surface-container-lowest`, `text-meta`, `radius-owner`) terbaca sama jelasnya sebagai objek TS.

Kalau nanti NativeWind v5 stabil, migrasi dari `packages/tokens` ke preset Tailwind adalah langkah mekanis — bukan penulisan ulang.

### 3c. Peta porting dependensi

| Web                                  | Mobile                                                                          | Catatan                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@phosphor-icons/react/ssr`          | `phosphor-react-native` 3.0.6                                                   | Nama & weight identik → tabel `componentNameByLegacyName` (118 key) di `AppIcon` pindah 1:1. Ukuran jadi `size={20}`, bukan class `icon-lg`.       |
| `next/font` Manrope + JetBrains Mono | `@expo-google-fonts/manrope`, `@expo-google-fonts/jetbrains-mono` + `expo-font` |                                                                                                                                                    |
| `framer-motion`                      | `react-native-reanimated` 4.5                                                   | `stiffness`/`damping`/`mass` dari `lib/utils/motion.ts` masuk langsung ke `withSpring`. 8 preset + 4 variant set jadi `packages/tokens/motion.ts`. |
| `sonner`                             | `sonner-native` 0.27                                                            | API sepadan; ~120 baris override toast (radius 24px, tombol capsule, `shadow-raised`) jadi style props.                                            |
| `shadow-*` (inset rim + drop)        | `boxShadow` style prop                                                          | New Arch mendukung `inset`. iOS penuh; Android inset butuh API 29+ → di bawah itu, jatuhkan rim, pertahankan drop shadow.                          |
| `after:-inset-*` hit area            | `hitSlop`                                                                       | Dipakai di compact button, back button, avatar, section action, tab.                                                                               |
| `localStorage` draft recovery        | `react-native-mmkv`                                                             | `lib/forms/local-form-recovery.ts` sudah menerima storage adapter.                                                                                 |
| `<input type="file" capture>`        | `expo-image-picker` / `expo-camera`                                             | Alur sesudahnya (`signImagekit()` → upload ImageKit → `processReceipt()`) tidak berubah.                                                           |

**Satu yang benar-benar butuh desain ulang:** `MoneyValue` varian `fullDynamic` memakai CSS container query (`clamp(min, 8.25cqw–10cqw, max)`). RN tidak punya padanannya. Ganti dengan `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale` yang diturunkan dari rasio min/max yang sama. Ini primitive paling banyak dipakai (126 call site), jadi selesaikan lebih dulu dan uji di lebar 320/360/390/430.

### 3d. Urutan primitive (ranking dari pemakaian nyata)

Bangun 12 ini dulu — ini yang membawa produk:

`AppIcon` (333) · `FormField` (158) · `MoneyValue` (126) · `FormSection` (120) · `TextInput` (71) · `SheetSelect` (65) · `GroupedSurface` (50) · `BottomSheet` (35) · `StatusBadge` (33) · `Button` (32) · `SegmentedTabs` (27) · `FactRow`/`SummaryFact` (27)

Aturan yang harus ikut porting, bukan hanya tampilannya:

- **Nested-Stays-Flat** — hanya surface pemilik yang punya elevasi; icon tile, metric pill, baris form dalam grup, dan track segmented tab selalu tanpa bayangan.
- **Kosakata bentuk tidak boleh campur** — capsule untuk kontrol berdiri sendiri; 28/20/16 untuk container.
- **One Accent Rule** — `success` sengaja _ink netral_, bukan hijau. Jangan "perbaiki" ini.
- Peta 50-key `BadgeStatus` → `{label, tone}` (label Bahasa Indonesia) adalah data murni → pindah verbatim ke `packages/core`.
- Mono hanya untuk nilai uang _eksak sekunder_, tidak pernah untuk angka primer.

### 3e. Di mana komponen Expo dipakai (dan di mana tidak)

Sesuai keputusan hybrid — native untuk yang memang digambar OS, Atria untuk isinya:

| Pakai native/Expo                                                                                                                      | Gambar sendiri dari token                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Expo Router **Native Tabs** — tab bar sistem, Liquid Glass di iOS 26, `minimizeBehavior` saat scroll                                   | Bottom nav _pill_ + FAB morph menu web tidak dipetakan langsung; FAB jadi `NativeTabs.BottomAccessory` (iOS 26+) atau FAB Atria di Android |
| Native **Stack** + `Stack.Title`, header search bar, toolbar                                                                           | Header morph menu → jadi native stack title + menu                                                                                         |
| **`presentation: "formSheet"`** Expo Router (`sheetAllowedDetents`, `sheetGrabberVisible`, footer) — ini pengganti utama `BottomSheet` | Isi sheet: `SheetSection`, `FormSection`, `SheetFooterActions` — semua Atria                                                               |
| `Link.Menu` / `Link.Preview` context menu (long-press)                                                                                 | —                                                                                                                                          |
| `expo-haptics`, `@react-native-community/datetimepicker`, `expo-glass-effect` (dipakai _hemat_)                                        | Kartu, baris, badge, meter, metric pill, segmented tabs                                                                                    |
| SF Symbols via `expo-image` untuk chrome navigasi yang digambar OS                                                                     | Phosphor untuk semua ikon di dalam konten (identik dengan web)                                                                             |

Kemenangan terbesarnya ada di sheet: `BottomSheet` web adalah **663 baris** drag-to-resize, pengukuran detent, focus trap, scroll lock, dan scrim gradien buatan tangan. `presentation: "formSheet"` menggantikan seluruh mesin itu dengan detent, grabber, dan gesture native — sementara isi sheet tetap 100% komponen Atria. Ini juga jalur yang paling tidak berisiko bocor Material, karena kita tidak memakai container Material sama sekali; `calculateBottomSheetMetrics` dan `use-animated-sheet-close` menjadi tidak terpakai di mobile.

Catatan penting: `@expo/ui` **universal** (`Button`, `Switch`, `Picker`, `List`) me-render Material di Android. Yang dipakai hanya yang perilakunya bernilai dan tampilannya tertutup oleh chrome kita — praktisnya picker dan date picker. `Button`/`List`/`Switch`/`Card` versi Atria dibuat sendiri dari `View` + token.

Ada juga tegangan dengan DESIGN.md: sistem ini melarang glass/gradient. Liquid Glass diterima **hanya** di permukaan yang memang digambar OS (tab bar, sheet backdrop) — bukan sebagai bahasa visual di dalam konten. Kalau di simulator iOS 26 ternyata tab bar Liquid Glass merusak ketenangan palet, fallback-nya `NativeTabs` dengan `tintColor` terkunci dan konten opaque.

---

## Phase 4 — Shell & navigasi mobile

Navigasi web hari ini **digerakkan query param, bukan route**: ~10 param (`tab`, `action`, `view`, `filter`, `flow`, `new-expense`, `new-vendor-bill`, `new-project`, `new-invoice`, `expense-draft`) membuka 4 drawer global yang di-mount permanen di `MobileShell`. Jangan tiru ini di RN — petakan ke route modal Expo Router.

```
src/app/
├── _layout.tsx              # QueryClient, AuthProvider, font, SafeArea
├── login.tsx
├── (tabs)/_layout.tsx       # NativeTabs, difilter role via getRoleNavItems()
│   ├── ledger.tsx  projects.tsx  materials.tsx  expenses.tsx
├── expenses/new.tsx         # presentation: formSheet
├── approvals/index.tsx
└── modal/...                # bekas drawer global → route modal
```

Tab difilter peran memakai `getRoleNavItems(roleName)` + `ROLE_PERMISSIONS` dari `packages/core` — logika role yang sama persis dengan web. Native Tabs tidak mendukung penambahan tab dinamis saat runtime, jadi deklarasikan semua tab dan sembunyikan yang tidak diizinkan lewat `NativeTabs.Trigger` yang tidak dirender untuk peran itu (dievaluasi sekali setelah session termuat, sebelum tab layout mount).

Safe area: `useSafeAreaInsets()` + `contentInsetAdjustmentBehavior="automatic"` menggantikan tiga tempat `env(safe-area-inset-bottom)` di web.

---

## Phase 5 — Layar Phase 1

Urutan sengaja menyentuh setiap layer sekali, jadi masalah integrasi muncul di awal:

1. **Login** — `authClient.signIn.email` + SecureStore, gate `mustChangePassword`, redirect berbasis peran meniru `app/page.tsx` (OWNER → onboarding gate → `/ledger`; FINANCE_ADMIN → `/onboarding/review` bila ada pending; PURCHASING → `/materials`; sisanya → `/projects`).
2. **`/ledger`** — layar terberat secara visual; membuktikan `MoneyValue`, `SummarySurface`, `SegmentedTabs`, `MetricPill`, `StatusBadge`. Satu query tRPC ke `getFinanceDashboardPageData`. Tab Ringkasan/Persetujuan/Budget/Jatuh Tempo/Rekening/Material.
3. **`/expenses` + form baru** — permukaan form terbesar: `FormSection` grouped mode, `SheetSelect`, `MoneyInput`, `QuantityStepper`, `WorkflowFormSheet`. Termasuk draft recovery hybrid (MMKV + `saveExpenseDraft`).
4. **Kamera → OCR** — `expo-image-picker` → `signImagekit()` → upload ImageKit → `processReceipt()` (Gemini). Jalur server tidak berubah sama sekali.
5. **`/approvals`** — antrean approval, mutation pertama yang menulis uang dari native. Wajib memverifikasi: Owner approval untuk pembayaran ≥ Rp 5.000.000, penulisan `cash_transaction` + `audit_log`, dan penolakan baris yang sudah direkonsiliasi.

Skeleton loading: tiap route utama butuh skeleton struktural yang mencerminkan hierarki finalnya — sama seperti aturan `loading.tsx` di web. Bukan spinner.

---

## Verifikasi

Toolchain di mesin ini sudah siap: Xcode 26.6 dengan runtime simulator **iOS 26.5** (jadi Liquid Glass, Native Tabs iOS 26, dan `expo-glass-effect` bisa benar-benar diuji), Android SDK lengkap, Bun 1.3.14, Node 22.

**Gerbang per fase** — tiap fase tidak dianggap selesai sebelum perintahnya hijau:

```bash
bun test lib/architecture/     # Phase 1: boundary masih ditegakkan setelah pindah
bun run build                  # Phase 1: web masih build
bun test                       # Phase 1 & 2: ~100 test suite, termasuk lib/ai/tools/read-only.test.ts
```

Phase 2 — bridge terbukti sebelum ada UI: panggil satu query dan satu mutation tRPC dengan bearer token dari `curl`/script, konfirmasi baris `audit_log` tertulis, dan konfirmasi request tanpa permission ditolak `FORBIDDEN`.

Phase 3–5 — di simulator, lewat MCP iOS Simulator:

- Lebar wajib diperiksa: **320, 360, 390, 430 px**. Preview desktop bukan bukti.
- iOS 26 simulator untuk Native Tabs + Liquid Glass; emulator Android untuk memastikan tidak ada Material yang bocor dan inset shadow degrade dengan benar di API < 29.
- Reduced motion aktif → tidak ada animasi dekoratif yang tersisa.
- Uji finansial end-to-end di data seed (`bun run db:demo:reset`): ajukan expense dari native → approve → verifikasi saldo bank, `cash_transaction`, dan `audit_log` cocok dengan yang dilihat web.

## Dokumen yang harus diperbarui

- `CLAUDE.md` + `AGENTS.md` + `GEMINI.md` — layout monorepo, invariant "tiga API route" dengan batasannya, aturan mobile.
- `docs/06-technical/ARCHITECTURE.md` — layer use-case dan bridge tRPC.
- `docs/06-technical/API_ACTIONS.md` — `ActionResponse` sebagai kontrak dua transport.
- `docs/plans/2026-08-15-expo-cross-platform-migration.md` — rencana ini, disimpan ke repo (syarat AGENTS.md sebelum perubahan executable besar).
- `DESIGN.md` — bagian native: di mana Liquid Glass diterima, aturan `boxShadow`, ukuran ikon.

## Di luar cakupan (Phase 2–3 berikutnya)

`/projects` + 7 tab detailnya (93 file — slice terbesar), `/materials` (43), `/settings` (27), `/reconciliation`, `/onboarding`, AI chat (`/api/ai/chat` sudah HTTP streaming dan akan jalan di Expo dengan `useChat` begitu bearer aktif — hanya butuh base URL absolut), push notification, EAS Build/Submit, offline-first di luar draft recovery.

Urutan executable untuk layar lanjutan tersebut sekarang disusun di
[`2026-08-15-expo-native-phase-2-3-screens.md`](./2026-08-15-expo-native-phase-2-3-screens.md).

## Temuan sampingan yang perlu diputuskan terpisah

- `features/expenses/utils/expense-receipt-ocr.ts` (~baris 49) punya **fallback public key ImageKit yang di-hardcode** ke dalam bundle client saat `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` kosong. `IMAGEKIT_PRIVATE_KEY` dan `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` juga tidak ada di `.env.example`.
- `mobile-shell.tsx` memakai URL gambar Google remote yang di-hardcode sebagai avatar.
- `ds-bundle/` (gitignored) sudah basi dan bertentangan dengan sistem sekarang — README-nya menyebut Inter + biru iOS `#007AFF`, padahal sistemnya Manrope + terracotta `#b84b2c`. Sumber kebenaran tetap `app/globals.css` + `DESIGN.md` + `.impeccable/design.json`.
- Ada `bun.lock` **dan** `pnpm-lock.yaml` di root. `node_modules/.modules.yaml` mengungkap tree yang terpasang sekarang dibuat pnpm (`nodeLinker: isolated`) — bertentangan dengan CLAUDE.md yang menyatakan Bun. Repo yang drift, bukan dokumennya. Diselesaikan di langkah 1.
- `lib/auth/permissions.ts` menarik `drizzle-orm` + `@neondatabase/serverless` ke dalam graf bundle **client** lewat tiga komponen `"use client"`. Bug web yang berdiri sendiri, kebetulan ketemu; diperbaiki di langkah 4.
- `docs/06-technical/API_ACTIONS.md` mendokumentasikan `ActionResponse` sebagai kontrak, tapi `payFieldRequest` menerima tiga string posisional **tanpa schema Zod sama sekali** — `projectCostId`/`bankAccountId` tidak tervalidasi. Ditutup saat langkah 6 menambahkan `payFieldRequestSchema`.
- `features/settings/utils/settings-tabs-config.ts` memetakan `/settings/setup` dan `/settings/administration`, tapi file page-nya tidak ada.
- Tidak ada script `test` di `package.json` meski ada ~100 file `.test.ts`.

---

## Mekanika migrasi

**Package manager.** Pilih **Bun**, hapus `pnpm-lock.yaml` + `pnpm-workspace.yaml`. Alasan terkuatnya bukan preferensi: `node_modules/.modules.yaml` menunjukkan tree yang terpasang sekarang dibuat **pnpm** dengan `nodeLinker: isolated` — bertentangan dengan CLAUDE.md, dan **Metro tidak bisa mentolerirnya** (resolver Expo menelusuri direktori nyata, bukan symlink; workaround standarnya memaksa `node-linker=hoisted`, yang membuang satu-satunya keunggulan pnpm). Bun workspace hoist secara default. Ditambah: `bunfig.toml` `preload` sudah load-bearing (`mock.module("server-only")`), dan `package.json` memakai field khusus Bun (`trustedDependencies`, `ignoreScripts`) yang **harus tinggal di root** — kalau ikut pindah ke `apps/web/package.json`, keduanya diabaikan diam-diam. `pnpm-workspace.yaml` isinya cuma placeholder `allowBuilds` yang belum pernah diisi.

**Empat file config yang rusak diam-diam saat pindah** — tidak satu pun ketahuan oleh `bun test`, jadi periksa satu per satu:

1. **`scripts/dev-lan.mjs` benar-benar pecah.** Ia menghitung `nextBin = path.join(rootDir, "node_modules/.bin/next")` dengan `rootDir` = induk dari `scripts/`. Setelah pindah itu jadi `apps/web`, tapi Bun meng-hoist `.bin/next` ke `node_modules/.bin/` di root repo → `spawn` ENOENT. Ganti ke `bunx next dev`, atau telusuri ke atas mencari `.bin/next` yang benar-benar ada. Sekalian buat `--require=./scripts/prefer-lan-network-host.cjs` jadi absolut.
2. **`.env` dan `.env.example` harus ikut ke `apps/web/`.** drizzle-kit, `bun db/seed.ts`, dan `scripts/reset-database.ts` semua membaca `.env` dari cwd. Konsekuensi lanjutan: `db/seed.ts:125` memakai `path.resolve(process.cwd(), ".atria-demo")`, jadi fixture demo akan mendarat di `apps/web/.atria-demo/`. Terima itu (dan longgarkan `.gitignore` jadi `**/.atria-demo/`) atau ubah ke `import.meta.dir`.
3. **`.prettierrc.json`** `tailwindStylesheet` harus jadi `./apps/web/app/globals.css`.
4. **`eslint.config.mjs`** dipindah **utuh** ke `apps/web/` — setiap string di dalamnya (`./app/globals.css` untuk `cssPath`, `.next/**`, `scratch/**`) sudah relatif terhadap yang akan jadi app root, jadi nol edit. Jangan di-hoist ke root: `cssPath` bersifat cwd-relative dan `eslint-config-next` mau root project Next. Root `lint` = `bun --filter '*' lint`, jadi cwd selalu direktori package.

**`bunfig.toml` ikut ke `apps/web/`** (dimuat dari cwd). Konsekuensinya: **jangan pernah jalankan `bun test` telanjang dari root** — tanpa bunfig, setiap `features/**/server/*.test.ts` akan meledak di `import "server-only"`, dan ia juga akan menelusuri `.claude/worktrees/**` yang berisi 6 salinan basi test `lib/**`. Root script `test` harus `bun --filter '*' test`.

**Anchor architecture test ke `import.meta.dir`, bukan `process.cwd()`.** Ketiganya memakai `const WORKSPACE_ROOT = process.cwd()`. Mengganti ke `path.resolve(import.meta.dir, "..", "..")` membuatnya independen dari cara pemanggilan. Kalau tetap pakai `cwd`, mereka _kebetulan_ jalan di bawah `bun --filter` lalu pecah begitu seseorang menjalankan file-nya langsung — mode kegagalan terburuk.

Root `package.json` dapat `"workspaces": ["apps/*", "packages/*"]` dan `"packageManager": "bun@1.3.14"`.

**Path alias.** `paths` di-resolve relatif terhadap direktori tsconfig yang mendeklarasikannya. Jadi `apps/web/tsconfig.json` memetakan `@/*` → `./*`, dan **seluruh 111 import `@/db` plus semua `@/lib/**` tetap byte-identik** — inilah yang membuat langkah pindah bisa murni `git mv`. Package shared diimpor lewat nama (`@atria/core`, `@atria/tokens`).

`tsconfig.base.json` di root sengaja **tidak** menetapkan `jsx`, `lib`, atau `types`, karena mobile berbeda di ketiganya. `packages/core/tsconfig.json` memakai `"lib": ["esnext"]` **tanpa `dom`** — itu yang mencegah `localStorage`/`document` menyelinap ke kode shared. `apps/mobile/tsconfig.json` extends `expo/tsconfig.base` saja (jangan tumpuk dengan base repo — `jsx`-nya bentrok) dan memetakan `@/*` → `./src/*`. Pemetaan terakhir itu adalah **firewall fisik**: dari mobile, `@/db`, `@/components/ui`, dan `@/lib/auth` sama sekali tidak resolve. Tidak perlu lint rule.

Mobile mengambil tipe router lewat subpath export di `apps/web/package.json` (`"./api": "./server/trpc/root.ts"`) sebagai **devDependency**, dengan `no-restricted-imports` yang melarang value import dari `@atria/web/*`.

**Split versi React.** Web di `react@19.2.4`; Expo SDK 57 memakai pasangan React/RN-nya sendiri. Simpan `react`/`react-dom` hanya di `apps/web`, `react`/`react-native` hanya di `apps/mobile`, dan **tidak ada di root** — Bun akan menyarangkan salinan yang bentrok. `packages/core` tidak boleh mengimpor React sama sekali.

**Guard baru untuk `packages/core`:** test purity di dalam package itu sendiri yang menolak impor `next/*`, `react*`, `drizzle-orm`, `better-auth`, `server-only`, `node:*`, dan — yang paling penting — impor `@/` apa pun. Test kedua itu yang menangkap file yang diseret masuk tapi masih membawa `from "@/db"`.

**`next.config.ts`** butuh `transpilePackages: ["@atria/core"]` dan `outputFileTracingRoot` ke root repo (wajib untuk build monorepo di Vercel; tanpanya Next menelusuri dari `apps/web` dan melewatkan `node_modules` yang di-hoist).

**Urutan yang bisa dibuktikan** — jangan gabungkan langkah, tiap langkah punya gerbangnya sendiri:

0. **Baseline.** `bun install && bun test && bun run build && bun run lint`. Catat angka lulus/gagalnya. Beberapa `lib/finance/*.integration.test.ts` dan `lib/project/*-action.test.ts` menyentuh DB nyata — kalau sudah ada yang merah, itu harus diketahui **sekarang**, bukan setelah 800 file dipindah.
1. **Buang pnpm**, `rm -rf node_modules && bun install`. Gerbang: hasil identik dengan langkah 0. Instalasi Bun yang hoisted bisa memunculkan konflik peer yang sebelumnya tertutup isolasi pnpm (kandidat paling mungkin: `@storybook/nextjs` 10.5.5 vs `next` 16.2.9).
2. **`git mv` murni** ke `apps/web/` + root workspace + tsconfig base + perbaikan empat config di atas. **Nol perubahan isi file sumber.** Lakukan sebagai **satu commit berisi `git mv` saja**, supaya `git log --follow` selamat dan reviewer bisa diff dengan `-M`.
   → Gerbang: identik dengan langkah 0, **plus** verifikasi manual yang tidak akan tertangkap `bun test` — `bun run dev` benar-benar start, `bun run db:seed` menemukan `.env`, `.atria-demo/` mendarat di tempat yang diharapkan, Storybook masih resolve `../components/**`, dan `cssPath` eslint masih ketemu.
3. **Re-anchor architecture test** ke `import.meta.dir`, tambah `server` ke `SOURCE_ROOTS`, tambah guard server-only untuk `apps/web/server/**`, tambah test allowlist route (dua entri dulu). Gerbang: hijau **dan** terbukti menggigit saat diberi route dummy.
4. **Ekstrak `packages/core`** + split `lib/auth/permissions.ts` + perbaiki tiga komponen client + test purity. Gerbang: suite web tidak berubah. Bonus yang layak diukur: bandingkan ukuran bundle client route `/ledger` sebelum/sesudah — drizzle keluar dari graf `mobile-shell.tsx` harusnya terlihat.
5. **Plugin Better Auth** (`expo()` lalu `bearer()`, urutan itu penting), tanpa tRPC. Jalankan `bunx @better-auth/cli generate` dan pastikan **nol diff schema** — jangan percaya klaim "tidak ada perubahan schema" tanpa membuktikannya. Lalu login web manual: test me-mock `auth.api.getSession`, jadi tidak akan menangkap `trustedOrigins` yang rusak.
6. **Satu vertical slice.** Buat `server/actor.ts`, refactor **persis satu** action end-to-end: `payFieldRequest`. Gerbang paling bernilai di seluruh rencana ini — `lib/finance/actions-field.test.ts` dan `dashboard.test.ts` harus lulus **tanpa diedit sama sekali**. Kalau test perlu diubah, yang drift adalah wrapper-nya, bukan test-nya. Ini membuktikan pola ekstraksi mempertahankan perilaku finansial pada satu action yang memindahkan uang, mengunci baris, dan menulis ledger + audit sekaligus.
7. **Skeleton tRPC + route ke-3**, satu mutation saja. Gerbang: tanpa auth → `401`; peran salah → `403`; test allowlist hijau dengan tepat tiga entri.
8. **Permukaan Phase 1** — refactor 4 loader ke `actor` + `{ status }`, `screenRouter`, `media.signImagekit`, `ai.processReceipt`, `activeProcedure`. Verifikasi ulang keempat route web di 320/360/390/430 px: refactor `redirect` → `status` menyentuh control flow pada reference implementation yang sudah disetujui.
9. **Scaffold `apps/mobile`** — tanpa satu layar pun. Buktikan kabelnya dulu: `AppRouter` resolve lewat `import type`, `expo start` build, login + satu query `screen.approvals` mengembalikan data nyata di device fisik lewat LAN. Kalau Metro tidak menemukan `@atria/core`, obatnya `resolver.nodeModulesPaths` + `disableHierarchicalLookup = true`.

**Langkah paling berisiko, berurutan:** (2) pemindahan — semua yang di bawahnya mengasumsikannya berhasil; (6) use-case pertama; (9) resolusi Metro — scaffold sebelum menulis layar, supaya kegagalan resolusi berharga satu jam, bukan satu minggu; (4) split `permissions.ts`; dan (2b) celah `mustChangePassword` yang bukan risiko langkah melainkan risiko kebenaran yang tidak akan ditangkap test mana pun.

**Architecture tests** (`lib/architecture/`) — ketiganya anchor ke `process.cwd()`, jadi semua ikut pindah dan perlu re-anchor. Empat asersi `server-boundaries.test.ts` (`features/*/actions/` terlarang, `features/**/server/**` wajib `server-only`, `page.tsx` tidak boleh impor `@/db`/`drizzle-orm`, `"use server"` hanya boleh ekspor async function yang dideklarasikan langsung) semuanya **tetap berlaku apa adanya** dan justru harus dipertahankan — asersi keempat itulah yang memaksa pola wrapper tipis di §2b tetap sah (`export { x } from ...` akan ditolak; barrel yang ada lolos justru karena sengaja tidak memakai `"use server"`).

`apps/mobile` **terkecualikan secara konstruksi** begitu anchor-nya `apps/web` — tidak ada test yang menelusuri keluar dari sana. Itu memang benar: mobile punya sistem UI berbeda, tanpa `@/components/ui`, tanpa Tailwind, tanpa `"use server"`. Jangan paksa `ui-import-boundaries.test.ts` menutupi RN.

`feature-boundaries.test.ts` hanya butuh rename anchor. `ALLOWED_EDGES` tidak berubah: router tRPC hidup di `apps/web/server/`, bukan `features/`, jadi tidak membuat edge baru.

**Test.** Tambahkan script `test` yang selama ini tidak ada. Root = `bun --filter '*' test`; menjalankan file tunggal jadi `cd apps/web && bun test lib/finance/dashboard.test.ts` — perbarui CLAUDE.md baris 30–36.
