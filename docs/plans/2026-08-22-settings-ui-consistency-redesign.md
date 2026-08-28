# Settings UI Consistency Redesign

> Tujuan: menyelaraskan halaman `/settings` dengan grammar desain `/ledger` — kurang
> clutter, mudah dibaca, tanpa berlebihan — tanpa mengubah IA maupun memangkas
> kapabilitas apa pun.

## Keputusan terkunci (interview 2026-08-22)

1. **Scope**: konsistensi visual + de-duplikasi **plus** refactor ringan orchestrator
   (pisah hooks/komponen dari manager besar). Bukan rewrite.
2. **IA**: set tab tetap — Ringkasan, Kesiapan Setup*, Alokasi Budget, Kategori,
   Library, Material, Tim & Vendor* (*tergantung role).
3. **Landing**: hub Ringkasan tetap, dengan **satu** permukaan fokus gelap
   terpadu berbasis token (`rounded-owner`, inset `bg-white/8`).
4. **Sticky nav**: TANPA sticky. Dead code flag-gated dicabut khusus di settings;
   `WORKSPACE_STICKY_CONTROLS_ENABLED` global dan konsumen lain tidak disentuh.
5. **Kapabilitas**: nol pemangkasan fungsi (filter, import, template editor, arsip,
   diff preview tetap ada).
6. **Onboarding**: keempat manager juga dipakai panel onboarding via
   `presentation="onboarding"` — kedua konteks wajib jalan.
7. **Chrome baru**: reuse-first. Fakta lapangan mengubah rencana awal:
   `SwitchRow` sudah ada di barrel (extend, bukan promosi baru), dan
   `UnsavedChangesModal`/`ConfirmationDialog` (API standar) menutup kebutuhan dialog
   buang-perubahan. Focal surface gelap jadi komposisi lokal `features/settings`.
8. **Acceptance**: lint+test+build hijau, test kontrak ikut diupdate, screenshot
   manual 320/360/390/430 px tiap tab.

## Temuan clutter yang diperbaiki

| # | Masalah | Lokasi | Solusi |
|---|---------|--------|--------|
| 1 | Sticky tab bar mati (flag `false`) + scrim `backdrop-blur-xl` | `settings-navigation.tsx` | Hapus mesin sticky → wrapper tipis `SegmentedTabs` |
| 2 | Header ganda per modul (`hideHeader` yang tetap render) | 4 manager | Satu aturan: `presentation="settings"` → `WorkspaceModuleHeader`, `"onboarding"` → tanpa header. Prop `hideHeader` dihapus |
| 3 | Dark focal surface 3 implementasi (radius 26/28/30) | hub, setup-readiness, loading skeleton | Komponen lokal `SettingsInverseSurface` token-based |
| 4 | Tombol hand-rolled ~15 titik (`text-white` vs `text-on-primary`) | semua manager | Shared `Button` |
| 5 | Dialog buang-perubahan copy-paste + split idiom | kategori, library ×2, material | `ConfirmationDialog` API standar (`confirmLabel`/`danger`) |
| 6 | Toggle switch hand-rolled (~30 baris) | budget | Extend `SwitchRow` slot `trailing` |
| 7 | Icon tile hand-rolled `h-9 rounded-[13px]` | hub, kategori, material, readiness | `DuotoneIconTile` |
| 8 | Banner inline direinvent 3× ; `SettingsNotice` dsb. nganggur | kategori/library/material/budget | `FormRiskNotice`; dead export `settings-ui.tsx` dihapus |
| 9 | Glass `backdrop-blur` pada save bar sticky | budget | Solid white + `shadow-raised` |
| 10 | Fallback `<p>` mentah untuk modul tak tersedia | dashboard | `GroupedSurface` > `InlineStateRow` |
| 11 | Radius drift nested surface | library price-preview, import tile | Token `rounded-owner`/`rounded-inset` |
| 12 | Orchestrator raksasa (library 569, materials 442) | library/materials | Pisah hooks (filter draft, dirty tracking) + subkomponen |

## Yang tidak disentuh

- Flag global sticky + konsumen lain (approvals, projects, materials tabs).
- Set tab, urutan, URL state `?tab=`, mapping legacy pathname.
- Kontrak filter draft `SettingsFilterBar`, overlay kanonik, `MoneyValue`.
- Perilaku server action / mutasi / permission.
- Salinan Bahasa Indonesia yang ada (hanya penyesuaian minimal bila label pindah).

## Acceptance

1. `bun run lint && bun run test && bun run build` hijau.
2. `settings-presentation.test.tsx` dan `onboarding-workspace.test.ts` diupdate
   dan lulus; panel onboarding dirender ulang tanpa regresi prop.
3. Screenshot `/settings?tab=` overview/budget/categories/library/materials
   (+ setup/administration bila data demo tersedia) di 320/360/390/430 px.
