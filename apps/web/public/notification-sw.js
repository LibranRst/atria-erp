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
