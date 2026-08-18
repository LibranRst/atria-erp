import { theme } from "@/theme";

/**
 * Ruang bawah untuk layar yang berada di dalam Native Tabs.
 *
 * Tinggi tab bar **tidak bisa diukur programatis** di Expo Router native tabs,
 * jadi menebak angkanya (sebelumnya `+ 84`) selalu salah di sebagian perangkat.
 * Sejak SDK 55, ScrollView pertama pada tiap tab sudah menerima
 * `contentInsetAdjustmentBehavior` otomatis di iOS dan bottom inset di Android,
 * sehingga tab bar sudah diperhitungkan sistem.
 *
 * Yang tersisa untuk kita hanyalah jarak baca yang disengaja di akhir konten —
 * itulah nilai di bawah ini, dan sumbernya token, bukan tebakan.
 */
export const TAB_SCREEN_BOTTOM_SPACE = theme.spacing.xl;
