# Desktop Profil dan overlay

## Keputusan yang dikonfirmasi

- Notifikasi desktop menjadi popover yang terikat ke bel, tanpa morph ke tengah atau backdrop modal. Mobile mempertahankan dialog morph.
- Semua shared sheet web pada desktop menjadi modal tengah: ukuran sesuai isi, ukuran wide tetap tersedia untuk review besar, satu body scroll dan footer tetap terlihat. Mobile tetap bottom sheet.
- Profil desktop memakai dua kolom compact: identitas/aksi akun di kiri, keamanan, perangkat/notifikasi, dan akses modul di kanan. Seluruh fungsi existing, termasuk simulasi development yang bersyarat, tetap tersedia.
- Avatar topbar desktop membuka menu dengan identitas, Profil saya, Pengaturan sesuai izin, dan Keluar dengan konfirmasi existing. Edit profil/password tetap di Profil.
- Follow-up: pemasangan aplikasi/PWA dan panduan Home Screen hanya ditampilkan di mobile. Desktop menampilkan “Notifikasi browser” dengan preferensi push existing; skeleton mengikuti visibilitas row yang sama.
- Follow-up spacing: kolom kanan memakai stack sendiri dengan gap 16px, tanpa distribusi tinggi row dari identitas kiri. Wrapper tetap terpasang saat resize; mobile memakai display contents dengan urutan DOM dan gap 12px existing. Skeleton memakai wrapper yang sama.

## Implementasi

Extend public ContextPopover with a scoped HeroUI desktop adapter and configurable width; reuse its existing mobile behavior. Reuse NotificationCenterView and notification context, ActionMenu, UserAvatar, shared buttons, DesktopTable, grouped surfaces, ProfileActionsProvider and existing logout flow. Feature code does not import HeroUI. Shared BottomSheet remains the sole modal focus/dismissal/scroll owner; desktop changes geometry and chrome only. Providers, form children, selection and portal owners stay mounted across resize. Atria colors, typography, contextual button tones and Framer Motion presets remain authoritative.

The profile uses a stable responsive grid, preserving the mobile section order. Desktop gets compact identity/actions and a native HeroUI access table. Push/PWA controls retain their existing behavior. Existing auth/RBAC/business logic and database are outside this change.

Existing mobile literal typography in Profile remains intentionally preserved during this desktop adaptation; the design hook's findings refer to those incumbent branches. New desktop typography uses semantic roles. No global detector suppression or new raw size exception is introduced.

## Verification

Run focused overlay/profile/notification tests, UI lint, TypeScript and scoped-style/token checks. Verify centered standard/wide sheets, dirty-state confirmation, nested selector Escape, popover focus/outside dismissal and profile menu permission/logout behavior. Inspect profile/overlays at desktop 1024/1280/1440 and mobile 320/360/390/430 in one batched round, then at most one repair/confirmation round. Use read-only current page and isolated UI fixtures for mutations; do not alter live account credentials or push subscriptions. Record unrelated global failures separately.

## Evidence

- Final web production build and TypeScript pass; all 938 web tests pass. Focused desktop/overlay/profile/notification coverage passes 166 tests. Native table row collections now invalidate on column changes; the DOM fixture verifies removal/restoration of a column without stale cells.
- Workspace lint passes with one existing exhaustive-deps warning in the AI Material Master proposal card, outside this change. Scoped HeroUI CSS and native token checks pass.
- Actual localhost Profile inspected at all seven required widths: no document overflow, desktop access table and mobile grouped list switch correctly, headings remain readable. Desktop popover is non-modal and anchored, and standard profile editor is centered.
- Unsaved profile name and focused input survive desktop → mobile → desktop. Closing prompts for discard; only the temporary local draft was discarded. Menu → logout confirmation receives focus after the menu exits; Tab/Shift+Tab cycle within confirmation. No sign-out, password change, profile save or push permission/subscription mutation was performed.
- Independent Impeccable finish review: **disposition: ship**, no material fixes. One incomplete 360px full-page capture was recaptured after scrolling device/session controls into view; genuine viewport evidence confirms their rendering. No UI change was required for the capture.
