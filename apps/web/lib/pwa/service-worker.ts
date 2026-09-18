/**
 * Registrasi dan pembacaan state service worker.
 *
 * Modul ini dipakai dari dua lingkungan — komponen klien dan modul yang juga
 * diimpor di server — jadi tidak boleh menyentuh `window` atau `navigator` di
 * top level. Setiap fungsi memeriksa ketersediaan API-nya sendiri dan menyerah
 * dengan tenang: kegagalan registrasi bukan kesalahan aplikasi, hanya fitur
 * yang tidak tersedia.
 */

const SERVICE_WORKER_URL = "/notification-sw.js";

/**
 * Scope `/` berlaku untuk seluruh aplikasi. Nama berkasnya sengaja tidak
 * diganti: mengganti nama berarti setiap pendaftaran yang sudah hidup di
 * peramban pengguna menjadi yatim, dan alur langganan iOS harus dimulai ulang.
 */
const SERVICE_WORKER_SCOPE = "/";

/**
 * Mendaftarkan service worker milik aplikasi.
 *
 * @returns Registrasi yang aktif, atau `null` bila API-nya tidak ada, halaman
 *   berjalan di server, atau pendaftaran gagal. Fungsi ini tidak pernah
 *   melempar — pemanggilnya tidak perlu membungkusnya dengan try/catch.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
    });
    /*
     * Pada kunjungan pertama worker masih dipasang, dan `pushManager` baru bisa
     * dipakai setelah ia aktif. `ready` menunggu tepat kondisi itu untuk scope
     * ini, jadi pemanggil selalu memegang registrasi yang sudah bisa dipakai.
     */
    if (!registration.active) return await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

/**
 * Langganan push yang sudah ada di perangkat ini, tanpa meminta izin baru.
 *
 * @returns Langganan aktif, atau `null` bila tidak ada maupun tidak dapat dibaca.
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  if (!registration) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Mengubah VAPID public key (base64url) menjadi byte key yang diterima
 * `pushManager.subscribe`. Peramban menerima `Uint8Array`, bukan string.
 */
export function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
