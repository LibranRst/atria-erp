/**
 * Tone semantik untuk indikator dan sel metrik lintas domain: budget, stok,
 * margin, maupun beban kerja. Sebelumnya tipe ini bernama `DashboardTone` dan
 * tinggal di `features/finance-dashboard`, padahal konsumennya sudah mencakup
 * halaman proyek. Tone di sini menjelaskan kondisi yang ditampilkan, bukan
 * halaman yang menampilkannya.
 *
 * `positive` berarti terkendali, bukan "sukses". Untuk status entitas yang
 * dibaca pengguna, gunakan `StatusBadge` beserta kosakata statusnya.
 */
export type IndicatorTone = "critical" | "warning" | "positive" | "neutral";
