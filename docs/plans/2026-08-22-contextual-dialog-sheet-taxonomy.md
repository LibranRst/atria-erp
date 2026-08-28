# Contextual Dialog & Sheet Taxonomy

## Keputusan

- `FormSheet`: tiga field atau lebih, atau review/impact context yang panjang.
- `DetailSheet`: detail kontekstual/read-only yang membutuhkan ruang atau scroll.
- `CompactFormDialog`: satu sampai dua field compact.
- `AdaptiveSelect` anchored listbox: seluruh pilihan yang tidak membutuhkan search,
  termasuk row berdeskripsi, grouping, metadata, dan disabled reason.
- `SelectionDialog`: explicit protected-context override saja, bukan auto default.
- `SearchDialog`: lebih dari enam opsi, create/custom value, dan combobox.
- `CalendarDialog`, `SuccessDialog`, dan `ConfirmationDialog` membawa intentnya
  masing-masing; dua filter sekunder memakai `AnchoredFilterPanel`.

## Interface

Satu internal `DialogFrame` menyembunyikan portal, backdrop, visual viewport,
focus trap/restoration, body lock, Escape, pending dismissal, reduced motion, dan
overlay stack. Raw `BottomSheet` hanya implementasi internal semantic sheet.
Compatibility aliases lama dipertahankan satu siklus tetapi architecture test
menolak consumer baru.

## Selection/search presentation

- `SelectionDialog` dan `SearchDialog` memakai live `choice` presentation: soft
  scrim, `shadow-raised surface-container-low` canvas/header, dan compact inset
  white option group dengan shared divider. Tidak ada owner card tambahan di
  dalam option group.
- Divider membentang selebar dialog. Selected option mempertahankan white surface
  dan ditandai label + check terracotta tanpa rectangular fill.
- `SelectionDialog` tetap satu plane dengan compact close control pada header.
- `SearchDialog` memisahkan floating search capsule dan close circle pada utility
  row di atas results plane; keduanya tetap berada dalam semantic dialog yang sama.
- White `DialogOptionList` surface tetap mounted, mengukur inner content dengan
  `ResizeObserver`, lalu menganimasikan explicit height saat query berubah tanpa
  layout scale/stretch pada row. Search caller tidak memberi `key` dari query.
- Compact form, calendar, confirmation, success, sheets, dan anchored surfaces
  mempertahankan visual contract sebelumnya.

## Acceptance

- Dialog dari sheet/panel berada satu layer di atas parent dan kembali ke trigger.
- Search tetap top-biased ketika keyboard membuka; list yang scroll, bukan shell.
- Choice rows, sticky search, dan header action tetap berada dalam satu focus trap
  dan tidak terpotong pada visual viewport pendek.
- Single selection/custom value commit langsung.
- Filter draft hanya commit lewat Terapkan dan dibuang pada dismissal.
- Success maksimal empat fakta dan menunggu aksi eksplisit.
- Semua surface stabil pada 320/360/390/430px serta reduced motion.
