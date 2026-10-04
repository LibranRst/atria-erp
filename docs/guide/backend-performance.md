# Bukti performa backend lokal — 1 Oktober 2026

API Hono + Bun dapat melayani endpoint native tanpa menjalankan Next. Dalam pemeriksaan terbatas ini, API memakai sekitar 228 MiB RSS setelah hangat; rekonstruksi backend lama dalam Next memakai sekitar 1.082 MiB. Angka ini menunjukkan overhead runtime pada kondisi yang diuji, bukan jaminan penghematan untuk penggunaan Atria yang sudah login.

## Hasil pemeriksaan

| Pengukuran                                    | Backend lama: Next dev, Webpack | Backend mandiri: Hono + Bun watch |
| --------------------------------------------- | ------------------------------: | --------------------------------: |
| Siap menerima koneksi                         |                       426.34 ms |                         268.62 ms |
| Request pertama: auth tanpa cookie            |                      3895.93 ms |                          15.03 ms |
| Request pertama: screen.home tanpa sesi       |                      2316.93 ms |                           2.60 ms |
| Auth hangat: median / p95                     |              3.43 ms / 11.83 ms |                 0.32 ms / 0.49 ms |
| screen.home hangat: median / p95              |               3.26 ms / 6.25 ms |                 0.22 ms / 0.48 ms |
| Edit sampai respons versi baru                |                       532.43 ms |                         284.48 ms |
| RSS proses beserta turunannya, setelah hangat |                      1081.6 MiB |                         227.9 MiB |
| Puncak RSS yang tersampel                     |                      1331.4 MiB |                         227.9 MiB |
| Puncak sampel jumlah ps %CPU                  |                          284.6% |                            130.6% |

Auth mengembalikan HTTP 200 dengan sesi `null`; query tRPC `screen.home` mengembalikan HTTP 401. Semua 30 request hangat per endpoint menghasilkan status yang sama pada kedua runtime. P95 memakai sampel terurut ke-29 dari 30 request. RSS menghitung seluruh proses turunan yang terpantau, bukan hanya launcher.

## Cara mengukur

- Mesin yang sama: macOS 27.0.1 arm64, Node 22.23.2, Bun 1.3.14, Next 16.2.9. Proses diuji bergantian, memakai port terisolasi 3100 dan 3101.
- Backend lama direkonstruksi dari snapshot source sebelum migrasi. Hanya API routes, actions, loaders, auth, schema, dan dependensinya yang disertakan; halaman frontend lengkap dan Metro tidak dijalankan. API baru memakai snapshot source `apps/api` saat pengukuran.
- Keduanya memakai dependency workspace yang sama dan URL database dummy di `127.0.0.1:1`. Tidak ada cookie, akun, data produksi, login, atau mutasi database. File environment asli tidak dimuat.
- Urutan yang sama: startup, request pertama `/api/auth/get-session`, request pertama `/api/trpc/screen.home?batch=1` dengan input SuperJSON `null`, masing-masing 30 request hangat melalui koneksi lokal, jeda dua detik, lalu satu edit entrypoint.
- Startup dihitung dari spawn sampai log siap dan koneksi TCP tersedia; Next belum mengompilasi route saat itu. Request pertama mengukur biaya kompilasi route Next. Direktori `.next` sementara dihapus sebelum menjalankan baseline.
- Edit hanya mengubah header penanda pada salinan sementara. Waktu reload berakhir ketika query yang tetap menghasilkan 401 membawa versi header baru. Ini menguji watcher/rekompilasi, bukan perubahan logika domain.
- RSS dan jumlah `%CPU` proses disampel melalui `ps` setiap 150 ms. `%CPU` adalah nilai yang dilaporkan `ps`, dapat melebihi 100% karena banyak core, dan bukan pengukuran energi atau total waktu CPU. Puncak singkat antar-sampel dapat terlewat.

## Batas bukti dan tindak lanjut

Baseline default Turbopack gagal pada rekonstruksi di `/tmp` karena root tracing/dependency symlink melintasi workspace. Karena itu tabel memakai satu fallback **Next dev dengan Webpack**; hasil ini tidak membandingkan langsung konfigurasi Turbopack aplikasi asli. Source frontend lengkap juga tidak ada dalam baseline, sehingga angka tidak mewakili beban Next + frontend + Metro pada Mac pengguna.

Ini satu pemeriksaan lokal, tanpa pengulangan statistik startup/reload dan tanpa mengendalikan cache filesystem atau seluruh pekerjaan lain pada mesin. Pengukuran ini tidak membuktikan latensi login, query dashboard yang sudah terautentikasi, transaksi finance/material, OCR, AI, SSE, atau performa produksi.

Untuk membandingkan pengalaman mobile sebenarnya, ulangi pada database disposable yang sama dengan sesi native sah: login, dashboard, daftar proyek, daftar biaya, serta satu mutasi native yang aman. Jalankan Metro yang sama, ukur beberapa cold start/reload dan RSS/CPU selama alur tersebut. Jalankan baseline full Next dengan bundler default yang sama; sampaikan hasil terpisah dari pengukuran di atas.

Rekaman mentah dan script sementara tersedia selama sesi ini di `/tmp/atria-backend-performance/results.json`, `benchmark.py`, dan log per runtime. Proses benchmark sudah dihentikan; server Next/API lain tidak dihentikan. Artefak `/tmp` bukan bagian source repo dan dapat hilang setelah restart.
