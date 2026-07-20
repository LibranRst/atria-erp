# Administration Workspace Rework

## Goal

Merapikan tab Administrasi Settings agar konsisten dengan design language Atria dan memperbaiki helper text Project Manager yang terpotong oleh edge grouped form.

## Scope

1. Ubah helper `SmartDefaultHint` pada drawer Project agar memiliki inset horizontal dan wrapping yang aman di viewport mobile.
2. Rework `AdministrationManager` menjadi satu workspace dengan:
   - ringkasan user/vendor aktif;
   - shared `SegmentedTabs` untuk state `User` dan `Vendor`;
   - satu grouped list kontekstual dengan row yang dapat dibuka untuk edit;
   - satu primary add action yang mengikuti tab aktif;
   - form create/edit di shared `BottomSheet`, bukan inline di halaman;
   - field memakai shared `FormSection`, `FormField`, `TextInput`, `Textarea`, dan `SheetSelect` dengan placeholder serta helper kontekstual;
   - action aktif/nonaktif tetap eksplisit dan tetap memakai Server Action yang sudah diaudit.
3. Pertahankan RBAC, validasi Zod, audit trail, session invalidation, dan seluruh mutation backend yang ada.

## Verification

- ESLint dan TypeScript.
- Browser check tab User/Vendor dan drawer create/edit.
- Verifikasi viewport 320, 360, 390, dan 430 px tanpa horizontal overflow.
- Verifikasi helper Project Manager tidak lagi menyentuh atau terpotong edge container.
- Cek console browser untuk error.
