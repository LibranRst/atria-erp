/**
 * Lingkungan pemasangan PWA: apa yang sedang dipakai pengguna, apakah aplikasi
 * sudah terpasang, dan apakah peramban ini bisa diminta memasang.
 *
 * Pemisahan ini disengaja. `resolveInstallEnvironment` adalah fungsi murni yang
 * memetakan data mentah peramban menjadi keputusan, sehingga aturan yang mahal
 * untuk salah — iOS mengunci push di balik pemasangan, iPadOS menyamar sebagai
 * macOS — bisa diuji tanpa peramban sungguhan. `readInstallEnvironment`
 * hanyalah pembaca global yang memanggilnya.
 */

export type InstallPlatform = "ios" | "android" | "desktop" | "other";
export type InstallBrowser = "safari" | "chrome" | "firefox" | "edge" | "samsung" | "other";

export type InstallEnvironment = {
  readonly platform: InstallPlatform;
  readonly browser: InstallBrowser;
  readonly standalone: boolean;
  readonly pushSupported: boolean;
  readonly canPromptInstall: boolean;
};

/** Data mentah peramban yang dibutuhkan pemetaan environment. */
export type InstallEnvironmentInput = {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  readonly standalone: boolean;
  readonly pushSupported: boolean;
  readonly canPromptInstall: boolean;
};

/**
 * Tampilan `display-mode` yang berarti "berjalan sebagai aplikasi terpasang".
 * `minimal-ui` dipakai sebagian peramban Android dan `window-controls-overlay`
 * hanya muncul pada jendela PWA desktop; keduanya tetap instalasi, bukan tab.
 */
const STANDALONE_MEDIA_QUERIES = [
  "(display-mode: standalone)",
  "(display-mode: minimal-ui)",
  "(display-mode: window-controls-overlay)",
] as const;

/**
 * `beforeinstallprompt` belum ada di tipe DOM, jadi bentuknya dideklarasikan di
 * sini — satu-satunya batas tak bertipe pada modul ini.
 */
type BeforeInstallPromptEvent = Event & {
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
};

export type InstallSurfaceState =
  "installed" | "prompt" | "ios-steps" | "browser-menu" | "unavailable";

function detectPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  if (/iPhone|iPod|iPad/.test(userAgent)) return "ios";
  /*
   * iPadOS 13+ melaporkan dirinya sebagai "Macintosh". Yang membedakannya dari
   * Mac sungguhan adalah titik sentuh; tanpa pemeriksaan ini tablet Apple
   * dianggap desktop dan kehilangan instruksi Layar Utama.
   */
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/.test(userAgent)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/.test(userAgent)) return "desktop";
  return "other";
}

/**
 * Urutan pemeriksaan penting: Samsung Internet, Edge, Chrome iOS, dan Firefox
 * iOS semuanya menyertakan token "Chrome" atau "Safari" pada UA-nya, jadi
 * merek yang lebih spesifik harus diperiksa lebih dulu.
 */
function detectBrowser(userAgent: string): InstallBrowser {
  if (/SamsungBrowser/.test(userAgent)) return "samsung";
  if (/Edg[A-Z]?\//.test(userAgent)) return "edge";
  if (/OPR\/|Opera/.test(userAgent)) return "other";
  if (/CriOS|Chrome|Chromium/.test(userAgent)) return "chrome";
  if (/FxiOS|Firefox/.test(userAgent)) return "firefox";
  if (/Safari/.test(userAgent)) return "safari";
  return "other";
}

/**
 * Memetakan data mentah peramban menjadi lingkungan yang bisa diuji. `standalone`
 * dan `pushSupported` sengaja menjadi input, bukan hasil tebakan dari UA: hanya
 * peramban yang tahu jawabannya.
 */
export function resolveInstallEnvironment(input: InstallEnvironmentInput): InstallEnvironment {
  return {
    platform: detectPlatform(input.userAgent, input.maxTouchPoints),
    browser: detectBrowser(input.userAgent),
    standalone: input.standalone,
    pushSupported: input.pushSupported,
    canPromptInstall: input.canPromptInstall,
  };
}

/**
 * Menjawab apakah push dapat dipakai tanpa menuntut pengguna memasang aplikasi
 * lebih dulu. iOS satu-satunya platform yang mengunci `PushManager` di balik
 * pemasangan ke Layar Utama, sehingga Safari iOS yang belum terpasang bernilai
 * `false`; iOS yang sudah terpasang dan seluruh platform lain bernilai `true`.
 */
export function isIosPushAvailableWithoutInstall(environment: InstallEnvironment): boolean {
  return environment.platform !== "ios" || environment.standalone;
}

/**
 * Satu-satunya percabangan tampilan pemasangan. `prompt` hanya benar-benar
 * berarti ketika peramban sudah menyiapkan prompt; `ios-steps` adalah jalur
 * manual karena iOS tidak menyediakan pemasangan terprogram sama sekali.
 *
 * `browser-menu` menutup celah yang paling mudah salah: setelah prompt ditahan
 * sekali dipakai — atau ketika peramban menolak menawarkannya karena aplikasi
 * sudah pernah dipasang lalu dihapus — `beforeinstallprompt` tidak datang lagi
 * pada kunjungan itu, padahal aplikasinya tetap bisa dipasang lewat menu
 * peramban. Menghilangkan permukaannya di situ akan menyembunyikan satu-satunya
 * cara memasang, jadi jalur itu diberi instruksi manual, bukan disembunyikan.
 */
export function resolveInstallSurface(environment: InstallEnvironment): InstallSurfaceState {
  if (environment.standalone) return "installed";
  if (environment.canPromptInstall) return "prompt";
  if (environment.platform === "ios" && environment.browser === "safari") return "ios-steps";
  if (environment.platform === "android" || environment.platform === "desktop") {
    return "browser-menu";
  }
  return "unavailable";
}

function readStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone =
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { readonly standalone?: boolean }).standalone === true;
  if (iosStandalone) return true;
  if (typeof window.matchMedia !== "function") return false;
  return STANDALONE_MEDIA_QUERIES.some((query) => window.matchMedia(query).matches);
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const installPromptListeners = new Set<(canPromptInstall: boolean) => void>();
let installPromptCaptureStarted = false;

function notifyInstallPromptListeners(): void {
  for (const listener of installPromptListeners) listener(deferredInstallPrompt !== null);
}

/**
 * Menangkap `beforeinstallprompt` sedini mungkin. Peramban hanya mengirim event
 * ini sekali per kunjungan, dan setelah terlewat tidak ada cara memintanya
 * kembali selain memuat ulang halaman — karena itu `PwaRegistrar` memasang
 * penangkapnya saat aplikasi dimuat, bukan saat halaman Notifikasi dibuka.
 *
 * Aman dipanggil berulang kali dan aman dipanggil di server.
 */
export function captureInstallPrompt(): void {
  if (installPromptCaptureStarted || typeof window === "undefined") return;
  installPromptCaptureStarted = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Tanpa `preventDefault` prompt bawaan langsung tampil dan tidak bisa
    // dipanggil lagi dari tombol kita.
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifyInstallPromptListeners();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notifyInstallPromptListeners();
  });
}

/**
 * Langganan perubahan ketersediaan prompt pemasangan. Listener langsung dipanggil
 * dengan keadaan saat ini supaya pemanggil tidak perlu membaca dua kali.
 *
 * @returns Fungsi berhenti berlangganan.
 */
export function watchInstallPrompt(listener: (canPromptInstall: boolean) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  captureInstallPrompt();
  installPromptListeners.add(listener);
  listener(deferredInstallPrompt !== null);
  return () => {
    installPromptListeners.delete(listener);
  };
}

/**
 * Meminta peramban menampilkan dialog pemasangan yang sudah ditahan.
 *
 * @returns `"accepted"` bila pengguna memasang, `"dismissed"` bila menolak, dan
 *   `"unavailable"` bila tidak ada prompt yang bisa dipakai — Safari iOS tidak
 *   pernah mengirim `beforeinstallprompt`.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  captureInstallPrompt();
  const event = deferredInstallPrompt;
  if (!event) return "unavailable";
  /*
   * Prompt hanya boleh dipakai sekali; menahannya setelah dipanggil membuat
   * pemanggilan berikutnya gagal tanpa sebab yang jelas bagi pengguna.
   */
  deferredInstallPrompt = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "unavailable";
  } finally {
    notifyInstallPromptListeners();
  }
}

/**
 * Langganan perubahan mode terpasang. Di Android pergantian `display-mode`
 * terdeteksi lewat media query; di iOS banner pemasangan tidak mengubah
 * `navigator.standalone` sampai aplikasi dibuka ulang dari Layar Utama.
 */
export function watchStandaloneChange(listener: (standalone: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const queries = STANDALONE_MEDIA_QUERIES.map((query) => window.matchMedia(query));
  const update = (): void => listener(readStandalone());
  for (const query of queries) query.addEventListener("change", update);
  update();
  return () => {
    for (const query of queries) query.removeEventListener("change", update);
  };
}

/**
 * Membaca lingkungan pemasangan dari peramban saat ini.
 *
 * @param canPromptInstall Ketersediaan prompt yang ditahan, berasal dari
 *   `watchInstallPrompt` karena hanya event itu yang tahu jawabannya.
 */
export function readInstallEnvironment(canPromptInstall: boolean): InstallEnvironment {
  if (typeof window === "undefined") {
    return {
      platform: "other",
      browser: "other",
      standalone: false,
      pushSupported: false,
      canPromptInstall: false,
    };
  }
  return resolveInstallEnvironment({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: readStandalone(),
    /*
     * Hanya keberadaan API, bukan izin: `pushSupported` tidak pernah berarti
     * pengguna sudah mengizinkan notifikasi.
     */
    pushSupported: "PushManager" in window && "Notification" in window,
    canPromptInstall,
  });
}
