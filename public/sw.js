// Mir Motors CRM bildirim servis çalışanı (Web Push).
// Bilerek fetch/önbellek işleyicisi YOKTUR: CRM yanıtları, belgeler ve kişisel veriler hiçbir zaman önbelleğe alınmaz.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Mir Motors";
  // Yalnızca aynı sitedeki CRM adreslerine gidilir.
  const url = typeof data.url === "string" && data.url.startsWith("/crm") ? data.url : "/crm";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/pwa/crm-icon-192.png",
      badge: "/pwa/crm-icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/crm", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url === target && "focus" in w) return w.focus();
      }
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "navigate" in w) {
          return w.focus().then(() => w.navigate(target));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
