# Paduna Brand System v1.0

**Paduna adalah brand utama yang dipilih pengguna**, menggantikan Atria. Keputusan ini memfinalkan penggunaan nama dalam sistem brand; registrasi merek/domain serta rollout aplikasi adalah pekerjaan lanjutan.

## Mulai di sini

| Dokumen                                                   | Isi                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Strategi brand](01-brand-strategy.md)                    | Filosofi padu + guna, positioning, prinsip, audiens, dan janji.         |
| [Arsitektur dan naming](02-architecture-and-naming.md)    | Paduna / Build / Office; nama project, repo, package, service dan file. |
| [Identitas verbal](03-verbal-identity.md)                 | Suara, pesan, boilerplate, dan contoh copy.                             |
| [Panduan visual](04-visual-guidelines.md)                 | Temu, lockup, clear space, minimum size, warna, tipe dan ikon.          |
| [Aplikasi dan template](05-applications-and-templates.md) | Pemakaian di dokumen, web/mobile, sosial, dan checklist.                |
| [Rollout dan governance](06-rollout-and-governance.md)    | Transisi nama, kompatibilitas, verifikasi dan versi.                    |
| [Decision log](07-decision-log.md)                        | Keputusan yang berlaku dan batasnya.                                    |

`brand-system.json` menyimpan keputusan terstruktur. `naming-map.json` memetakan nama teknis yang direncanakan. `rollout-inventory.csv` mencatat titik masuk repository yang telah diperiksa. `color-contrast.json` memuat perhitungan rasio warna solid.

## Ringkasan keputusan

- **Paduna**: brand induk software operasional bisnis.
- **Paduna Build**: produk biaya/material proyek saat ini.
- **Paduna Office**: produk operasional perusahaan yang direncanakan dan dikembangkan terpisah.
- **Temu**, Manrope, ink `#181817`, terracotta `#B84B2C`, putih dipertahankan.
- **Proyek terkendali. Kerja lebih tenang.** tetap kandidat tagline Build.

## Aset dan hasil ekspor

Master canonical berada di `svg/`. Paket lengkap di `output/branding/paduna-brand-system-v1-2026-10-17/` berisi logo SVG/PNG, ikon web/mobile, layer native, social/share images, template SVG editable, font berlisensi, dokumen sumber, PDF, manifest, checksum, dan skrip pembangkit.

PDF utama tersedia di `output/pdf/paduna-brand-book-v1.pdf`; panduan ringkas di `output/pdf/paduna-quick-reference-v1.pdf`.

Untuk memulai Office di repository terpisah, paket portabel tersedia di
`output/branding/paduna-office-brand-starter-v1/paduna-office-brand-starter-v1.zip`.
Paket ini membawa logo Paduna biasa, ikon Office, palet, font/lisensi, tone of
voice dan brief pembuka. Konsep, scope, UI dan tech stack Office tetap terbuka;
paket tidak membawa aplikasi, aturan bisnis atau design system Build.

## Batas penerapan

Fondasi v1 memfinalkan standar brand dan menyiapkan nama target. Rollout berikutnya menerapkan nama, master Temu, metadata dan aset **Paduna Build pada web dan source Expo**. Keduanya memakai wordmark Paduna biasa; nama aplikasi tetap Paduna Build. Pemeriksaan web desktop/mobile dan bundel iOS/Android tercatat terpisah dari pemeriksaan binary native pada laporan QA. Package, repo/checkout, project Codex, remote, domain, auth, dan deployment tetap tahap berikutnya. Rujukan Atria lama adalah sejarah atau identitas teknis yang perlu migrasi terencana. Identitas perusahaan pengguna pada RAB/proposal tetap dipertahankan.

Rollout Expo: [rencana dan hasil penerapan](../../plans/2026-10-17-paduna-mobile-brand-rollout.md), [laporan pemeriksaan](../../qa/2026-10-17-paduna-mobile-brand.md). PDF dan ZIP fondasi v1 tetap merekam standar saat fondasi dibuat; status aplikasi terkini mengikuti dokumen sumber ini.
