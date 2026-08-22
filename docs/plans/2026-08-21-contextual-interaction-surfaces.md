# Contextual Interaction Surfaces

## Keputusan

Atria Web tidak lagi memakai bottom sheet sebagai jawaban default untuk setiap
pilihan atau menu. Bobot surface mengikuti pekerjaan:

- filter utama 2–4 opsi tetap terlihat sebagai pills;
- action lokal dan single-select 1–6 label-only memakai anchored surface;
- contextual options memakai SelectionDialog; search/custom input memakai
  SearchDialog; dua filter memakai anchored panel;
- sheet hanya untuk form tiga field atau lebih, review kompleks, dan detail;
- popover hanya membawa disclosure ringan;
- tooltip hanya menjelaskan label non-kritis dan tidak mencegat tap.

## Implementasi

`@floating-ui/react` menjadi fondasi collision, portal, dismissal, keyboard
navigation, typeahead, dan focus restoration. Atria tetap memiliki API serta
visualnya melalui `ActionMenu`, `AdaptiveSelect`, `ContextPopover`, dan `Tooltip`.
Layer anchored diwariskan dari sheet induk supaya popup nested selalu terlihat,
tetapi tetap berada di bawah overlay modal berikutnya.

Satu internal `DialogFrame` sekarang membawa visual viewport, focus trap,
restoration, body lock, Escape, dan stack untuk `CompactFormDialog`,
`SelectionDialog`, `SearchDialog`, `CalendarDialog`, `SuccessDialog`, serta
`ConfirmationDialog`. Feature memakai `FormSheet`/`DetailSheet`; raw
`BottomSheet` tidak lagi diekspor.

`SheetSelect` dipertahankan satu siklus sebagai alias deprecated. Seluruh consumer
web memakai `AdaptiveSelect`; architecture test menolak pemakaian alias baru.
Expo tidak berubah pada iterasi ini dan mengikuti mapping parity dalam rencana
migrasi cross-platform.

## Acceptance

- Menu/listbox mendukung panah, Home/End, typeahead, Escape, outside press, dan
  focus restoration.
- Menu terbatasi viewport lalu scroll tanpa berubah menjadi sheet.
- Multi-filter settings tidak mengubah hasil sampai `Terapkan filter` ditekan;
  outside press/Escape membuang draft.
- History memakai action menu anchored; rename memakai compact dialog dan delete selalu
  melewati confirmation.
- Icon button mempunyai tooltip hover/focus tanpa native `title` atau tap kedua.
- Geometri dan label aman pada 320, 360, 390, dan 430px serta reduced motion.
