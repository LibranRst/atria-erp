/*
 * Service worker Atria.
 *
 * Berkas ini dilayani apa adanya dari `public/`, jadi ia tidak diperiksa
 * TypeScript dan tidak boleh punya langkah build sendiri. Nama berkasnya
 * dipertahankan: pendaftaran yang sudah hidup di peramban pengguna menunjuk ke
 * alamat ini, dan mengganti nama berarti alur langganan push iOS harus dimulai
 * dari nol.
 */

const CACHE_PREFIX = "atria-";
const CACHE_NAME = `${CACHE_PREFIX}shell-v1`;
const OFFLINE_URL = "/offline";

const ALLOWED_DESTINATION =
  /^\/(approvals|projects|materials|expenses|ledger|notifications|reconciliation)([/?#]|$)/;

function safeDestination(value) {
  if (typeof value !== "string" || !ALLOWED_DESTINATION.test(value)) return "/notifications";
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : "/notifications";
  } catch {
    return "/notifications";
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        /*
         * `cache: "reload"` melewati cache HTTP: isi halaman offline harus
         * datang dari server, bukan dari salinan lama. Kegagalan menyimpan
         * tidak boleh menggagalkan pemasangan — tanpa halaman itu pun ada
         * jawaban 503 di bawah.
         */
        cache.add(new Request(OFFLINE_URL, { cache: "reload" })).catch(() => undefined),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Menyajikan halaman offline cadangan. Tidak ada halaman lain yang dilayani dari
 * cache: satu-satunya salinan di perangkat adalah halaman offline itu sendiri.
 */
async function offlineFallback() {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(OFFLINE_URL);
  if (cached) return cached;
  return new Response("", { status: 503, statusText: "Offline" });
}

/*
 * Kebijakan fetch: ini aplikasi keuangan, jadi kebenaran mengalahkan kemampuan
 * offline. Saldo basi lebih buruk daripada halaman yang tidak muncul.
 *
 * Karena itu hanya navigasi dokumen yang ditangani, dengan urutan network-first
 * dan halaman offline sebagai cadangan saat jaringan putus. Permintaan lain —
 * panggilan API, payload RSC (`?_rsc=`), potongan `_next/static`, gambar, dan
 * seluruh permintaan lintas origin — tidak pernah dipanggil `respondWith`,
 * sehingga tidak ada respons keuangan yang bisa tersaji dari cache lama.
 */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has("_rsc")) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request).catch(() => {
      /*
       * Pengalihan tidak pernah dilayani dari cache — hanya halaman offline,
       * dan tidak pernah `index.html` dari rute lain. Pengguna yang sesinya
       * berakhir tetap diarahkan ke `/login` oleh server ketika jaringan ada.
       */
      return offlineFallback();
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" ? payload.title : "Atria";
  const body = typeof payload.body === "string" ? payload.body : "Ada pembaruan baru.";
  const url = safeDestination(payload.url);
  const tag =
    typeof payload.notificationId === "string"
      ? `atria-${payload.notificationId}`
      : "atria-notification";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      tag,
      renotify: false,
      icon: "/icons/icon-192.png",
      // Android memakai badge sebagai siluet monokrom di status bar.
      badge: "/icons/badge-72.png",
      lang: "id",
      dir: "ltr",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = safeDestination(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const target = new URL(destination, self.location.origin).href;
      const existing = clients.find((client) => client.url === target);
      if (existing) return existing.focus();
      return self.clients.openWindow(destination);
    }),
  );
});
