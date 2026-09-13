// Service worker for Pressure Sore Guard PWA.
// Handles incoming Web Push reminders for turning-schedule due times.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "ถึงเวลาพลิกตัวผู้ป่วย", body: "", url: "/my-beds" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    data.body = event.data ? event.data.text() : "";
  }

  const isOverdue = data.urgency === "OVERDUE";

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.checkInId ? `checkin-${data.checkInId}` : undefined,
    renotify: true,
    requireInteraction: isOverdue,
    vibrate: isOverdue ? [200, 100, 200, 100, 200] : [150],
    data: { url: data.url || "/my-beds" },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/my-beds";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
