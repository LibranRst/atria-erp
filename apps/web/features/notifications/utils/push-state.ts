import { isIosPushAvailableWithoutInstall } from "@/lib/pwa/install";
import type { InstallEnvironment } from "@/lib/pwa/install";

/** Izin notifikasi yang dilaporkan browser. */
export type PushPermission = "granted" | "denied" | "default" | "unsupported";

/** Hasil pencatatan langganan di server, sejauh yang bisa dipastikan klien. */
export type ServerRegistration = "unknown" | "confirmed" | "failed";

/**
 * Kondisi perangkat yang bisa diamati klien sebelum memutuskan tampilan.
 *
 * `pushApiSupported` sengaja dihitung pemanggil (`"serviceWorker" in navigator`,
 * `"PushManager" in window`, `"Notification" in window`) karena tidak ada cara
 * yang bisa dipercaya untuk membacanya tanpa objek browser itu sendiri.
 */
export type PushEnvironment = {
  readonly secureContext: boolean;
  readonly pushApiSupported: boolean;
  readonly serverKeyConfigured: boolean;
  readonly install: InstallEnvironment;
};

export type PushSignals = {
  readonly environment: PushEnvironment;
  readonly permission: PushPermission;
  readonly serverRegistration: ServerRegistration;
  readonly subscribed: boolean;
};

/**
 * Keadaan yang ditampilkan kontrol push.
 *
 * `checking` bukan keluaran `resolvePushState`: itu keadaan awal sebelum kondisi
 * perangkat selesai dibaca.
 */
export type PushState =
  | "insecure"
  | "checking"
  | "unsupported"
  | "ios-install-required"
  | "unconfigured"
  | "denied"
  | "sync-required"
  | "enabled"
  | "disabled";

/**
 * Menerjemahkan kondisi perangkat menjadi satu keadaan yang bisa dirender.
 *
 * Urutan cabang adalah bagian dari kontraknya:
 *
 * 0. Alamat HTTP tidak aman → jelaskan HTTPS tanpa menawarkan izin.
 * 1. Konfigurasi pengiriman belum lengkap → tidak ada tombol yang bisa berhasil, jadi
 *    keadaan ini menang atas panduan pemasangan iOS.
 * 2. iOS di tab biasa → `PushManager`/`Notification` memang tidak ada, dan itu
 *    bukan alasan menyebut browsernya "tidak mendukung". Instruksi pemasangan
 *    ke Layar Utama ditampilkan sebelum cabang unsupported.
 * 3. Baru setelah itu: browser tanpa Push API, izin yang ditolak, langganan yang
 *    belum tercatat di server, aktif, atau belum berlangganan.
 */
export function resolvePushState(signals: PushSignals): PushState {
  const { environment, permission, serverRegistration, subscribed } = signals;
  if (!environment.secureContext) return "insecure";
  if (!environment.serverKeyConfigured) return "unconfigured";
  const installRequiredOnIos =
    environment.install.platform === "ios" &&
    !isIosPushAvailableWithoutInstall(environment.install);
  if (installRequiredOnIos) return "ios-install-required";
  if (!environment.pushApiSupported) return "unsupported";
  if (permission === "denied" || permission === "unsupported") return "denied";
  if (!subscribed) return "disabled";
  return serverRegistration === "failed" ? "sync-required" : "enabled";
}

type PushCopy = {
  readonly badge: string;
  readonly badgeTone: "critical" | "healthy" | "neutral" | "pending" | "warning";
  readonly description: string;
  readonly action: "enable" | "disable" | "reconnect" | null;
};

/** Satu-satunya sumber salinan untuk tiap keadaan; komponen hanya merender. */
export const PUSH_STATE_COPY: Record<PushState, PushCopy> = {
  insecure: {
    badge: "Perlu HTTPS",
    badgeTone: "warning",
    description: "Buka Paduna Build melalui alamat HTTPS agar perangkat dapat menerima notifikasi.",
    action: null,
  },
  checking: {
    badge: "Memeriksa",
    badgeTone: "neutral",
    description: "Memeriksa dukungan notifikasi pada perangkat ini.",
    action: null,
  },
  enabled: {
    badge: "Aktif",
    badgeTone: "healthy",
    description: "Pembaruan penting dapat muncul saat Paduna Build tidak sedang dibuka.",
    action: "disable",
  },
  disabled: {
    badge: "Nonaktif",
    badgeTone: "neutral",
    description: "Aktifkan untuk menerima pembaruan penting di perangkat ini.",
    action: "enable",
  },
  denied: {
    badge: "Nonaktif",
    badgeTone: "critical",
    description: "Izin diblokir oleh browser. Ubah izin notifikasi pada pengaturan situs.",
    action: null,
  },
  unsupported: {
    badge: "Nonaktif",
    badgeTone: "neutral",
    description: "Browser ini belum mendukung push notification.",
    action: null,
  },
  "ios-install-required": {
    badge: "Perlu dipasang",
    badgeTone: "pending",
    description:
      "Di iPhone, notifikasi hanya aktif setelah Paduna Build dipasang ke Layar Utama: Bagikan, lalu Tambahkan ke Layar Utama, dan buka kembali dari ikon tersebut.",
    action: null,
  },
  unconfigured: {
    badge: "Nonaktif",
    badgeTone: "neutral",
    description: "Pengiriman notifikasi belum disiapkan. Hubungi admin Paduna Build.",
    action: null,
  },
  "sync-required": {
    badge: "Sambung ulang",
    badgeTone: "warning",
    description:
      "Perangkat ini sudah berlangganan, tetapi server belum mencatatnya. Sambungkan ulang agar notifikasi tidak hilang.",
    action: "reconnect",
  },
};
