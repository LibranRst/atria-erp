# Contextual Dialog & Sheet Taxonomy

## Keputusan

- `FormSheet`: tiga field atau lebih, atau review/impact context yang panjang.
- `DetailSheet`: detail kontekstual/read-only yang membutuhkan ruang atau scroll.
- `CompactFormDialog`: satu sampai dua field compact.
- `SelectionDialog`: 3–6 opsi berdeskripsi tanpa search.
- `SearchDialog`: lebih dari enam opsi, grouping, create/custom value, dan combobox.
- `CalendarDialog`, `SuccessDialog`, dan `ConfirmationDialog` membawa intentnya
  masing-masing; dua filter sekunder memakai `AnchoredFilterPanel`.

## Interface

Satu internal `DialogFrame` menyembunyikan portal, backdrop, visual viewport,
focus trap/restoration, body lock, Escape, pending dismissal, reduced motion, dan
overlay stack. Raw `BottomSheet` hanya implementasi internal semantic sheet.
Compatibility aliases lama dipertahankan satu siklus tetapi architecture test
menolak consumer baru.

## Acceptance

- Dialog dari sheet/panel berada satu layer di atas parent dan kembali ke trigger.
- Search tetap top-biased ketika keyboard membuka; list yang scroll, bukan shell.
- Single selection/custom value commit langsung.
- Filter draft hanya commit lewat Terapkan dan dibuang pada dismissal.
- Success maksimal empat fakta dan menunggu aksi eksplisit.
- Semua surface stabil pada 320/360/390/430px serta reduced motion.
