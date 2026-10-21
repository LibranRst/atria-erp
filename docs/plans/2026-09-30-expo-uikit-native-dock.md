# Dock UIKit native — tab selection/scrubbing dan FAB dismissal

Pengguna meminta kontrol iOS yang benar-benar native: tab, active state dan hold/drag dimiliki sistem. Implementasi ChromeButton/pill sebelumnya tidak memenuhi kontrak itu. Header yang sudah dipilih pengguna dipertahankan.

## Arah

- Reuse Router tab history, native stacks, role navigation, effective capabilities, project locks dan shared quick-action catalog.
- iOS memakai `UITabBarController`/`UITabBar`/`UITabBarItem` asli; UIKit mengelola active appearance, label, touch/scrubbing dan accessibility. Tidak menggambar active pill atau gesture recognizer JS. Controller tersebut hanya memiliki permukaan navigasi; konten/routing tetap memakai Router/native stacks yang sudah ada.
- FAB memakai `UIButton` dengan configuration Liquid Glass native dan `UIMenu`/`UIAction` asli. `showsMenuAsPrimaryAction=true`, `changesSelectionAsPrimaryAction=false`; hanya pemilihan action yang mengirim event ke JS.
- Adapter lokal Expo diperlukan karena public NativeTabs SDK 57 tidak memiliki slot/lebar untuk FAB sidecar. Apple mendukung UITabBar standalone. Tujuannya menjaga tab/FAB sejajar tanpa search-tab palsu atau modifikasi private UIKit. Jika kontrol standalone tidak memberi gesture/appearance sistem yang diminta, evaluasi container UITabBarController sebelum acceptance.
- Shared `NativeNavigationDock` menjadi kontrak UI platform; Android/web compose primitives existing selama port native platform berikutnya. Tidak mengklaim fallback itu UIKit.

## Bug dan loop merah

- Simulator iPhone 17 Pro/iOS 26.5, native Atria client: membuka FAB lalu tap luar untuk dismiss menghilangkan bidang FAB; screenshot menunjukkan glyph kotak meskipun AX masih melaporkan `plus`.
- `bun apps/mobile/scripts/check-fab-dismiss.ts --udid F23B09C8-A70B-4957-BE7F-D236BD64D15B` telah dijalankan: **FAIL: bidang FAB hilang setelah dismiss (0.186)**. Loop memakai sentuhan fisik, screenshot PNG dan rasio pixel gelap di tengah FAB; juga menolak menu tertinggal, keyboard, form baru atau route berubah. AX-only test tidak menangkap bug visual ini.
- Hipotesis: (1) native snapshot transisi SwiftUI Menu/glass mempertahankan material salah; prediksi UIKit primary menu menutup loop; (2) React remount saat dismiss; prediksi tab/host baru saja memperbaiki bug; (3) tap penutup diteruskan ke action/route; prediksi route/form berubah walau tidak memilih action.
- Uji bar UIKit lebih dulu dengan FAB lama; ulangi loop. Lalu ubah hanya pemilik FAB ke UIButton/UIMenu. Jangan menganggap menu-open tanpa keyboard sebagai bukti dismissal benar.

## Gerbang

1. Native hierarchy menunjukkan UITabBar, active state bukan custom black pill; hold lalu drag berpindah tab melalui event UIKit.
2. Scroll tidak meminimalkan bar, tab/FAB tetap sejajar; safe area dan clearance konten terjaga.
3. Loop dismissal merah menjadi hijau, lalu ulang beberapa kali tanpa route/form/keyboard baru.
4. Typecheck/lint/tests, local native build/run dan export iOS/Android. Android runtime dan physical iPhone tetap dilaporkan terpisah.

Tidak mengubah finance/material mutations, akun, database, atau website.

Referensi: [UIKit UITabBar](https://developer.apple.com/documentation/uikit/uitabbar), [Expo NativeTabs SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/), [UIKit Liquid Glass buttons](https://developer.apple.com/videos/play/wwdc2025/284/).

## Hasil akhir

- Standalone UITabBar tidak memberikan geometry iOS 26 yang benar di container kecil. Final memakai containment UITabBarController publik, `tabBarMinimizeBehavior=.never`, native safe-area extent, cached controller/items per route ID dan system-owned selection. Tidak mengubah private UIKit view atau mengimplementasikan recognizer sendiri.
- `NativeNavigationDock` adalah primitive baru yang dibutuhkan oleh kontrak native tab selection/scrubbing + aligned action sidecar; iOS adapter meneruskan DTO/event ke local Expo module. Android/web tetap mengomposisi shared ChromeSurface/ChromeButton/ActionMenu; **fallback ini belum dianggap native UIKit/Compose**.
- FAB final memakai `UIButton.Configuration.glass()` dengan semantic foreground `label`, UIMenu/UIAction, dan `changesSelectionAsPrimaryAction=false`. UIKit menangani menu/touch/dismissal. Tidak ada SwiftUI Host atau custom glass/active-state rendering di dock iOS.
- Diagnosis disempurnakan: state resting setelah 1.5 detik dapat pulih pada kedua menu, jadi menunggu resting state saja tidak mengunci bug. Failure yang relevan muncul selama transisi (sekitar 700 ms): icon/material salah atau ikon kehilangan kontras. Regression loop kini mengukur kontras glyph di tengah terhadap area diagonal di dalam FAB, sehingga netral/gelap sama-sama valid. Fixture bug SwiftUI yang benar-benar direkam menghasilkan kontras **3.333**, gagal threshold 80. Native glass button final lolos **5 loop buka/tutup berturut-turut** pada interval 700 ms, tanpa keyboard/form/route baru.
- iPhone 17 Pro/iOS 26.5, 402 pt: hold 800 ms lalu drag Dashboard → Proyek → Biaya benar-benar memilih Biaya melalui native delegate. Rekaman touch tersedia; active pill mengikuti UIKit. Scroll Kas & Tagihan tidak mengubah bounds bar/controls dan tidak compact. Menu FAB terbuka tanpa keyboard; memilih Expense Lapangan membuka native form sheet, tidak disubmit, lalu didismiss.
- Local native build/run sukses; mobile typecheck/lint dan 10 tests lolos; export iOS/Android lolos. Module UIKit lokal memerlukan **client/build native Atria**, tidak tersedia di Expo Go. Physical iPhone, seluruh viewport, VoiceOver dan Android appearance belum menjadi evidence runtime tahap ini.
- Bukti lokal/gitignored: `.atria-demo/verification/native-dock-2026-09-30/native-dock-{top,scrolled,menu}.jpg`, `native-tab-scrubbing.mp4`, dan PNG `fab-dismiss-*.png`. Export: `/tmp/atria-uikit-dock-{ios,android}`. Tidak ada transaksi atau reset akun/database.
