import { theme } from "@/theme";

/**
 * Jarak baca setelah konten; tinggi dock floating dimiliki shared shell.
 *
 * Layar menambahkan TAB_BAR_CLEARANCE pada padding ini.
 * Safe area sistem tetap diperhitungkan ScrollView/native stack. FAB dan tab
 * bar berada di satu owning layout, jadi tidak ada estimasi native bar lain.
 */
export const TAB_SCREEN_BOTTOM_SPACE = theme.spacing.xl;
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + theme.spacing.md;
