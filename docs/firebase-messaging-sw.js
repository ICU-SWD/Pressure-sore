// Firebase Cloud Messaging service worker — receives push notifications
// while this site isn't the active tab (or, on Android/desktop, even while
// closed; on iOS Safari this requires the site to be added to the Home
// Screen first — see GAS_SYSTEM.md).
//
// Must be served from the site root (not /assets) so its default scope
// covers every page that calls messaging().getToken().

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");
importScripts("assets/config.js");

firebase.initializeApp(self.APP_CONFIG.firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "Pressure Sore Guard";
  const body = (payload.notification && payload.notification.body) || "";
  const url = (payload.fcmOptions && payload.fcmOptions.link) || (payload.data && payload.data.url) || "my-beds.html";

  self.registration.showNotification(title, {
    body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: payload.data && payload.data.checkInId ? `checkin-${payload.data.checkInId}` : undefined,
    data: { url },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "my-beds.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
