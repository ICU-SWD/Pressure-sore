// Browser push notifications via Firebase Cloud Messaging.
// Requires firebase-app-compat.js + firebase-messaging-compat.js + config.js
// to be loaded (as <script> tags) before this file.

function fcmConfigured_() {
  const cfg = self.APP_CONFIG;
  return !!(cfg && cfg.firebaseConfig && cfg.firebaseConfig.apiKey && cfg.firebaseConfig.apiKey.indexOf("PASTE_") !== 0 && cfg.FIREBASE_VAPID_KEY && cfg.FIREBASE_VAPID_KEY.indexOf("PASTE_") !== 0);
}

function getMessaging_() {
  if (!fcmConfigured_()) return null;
  if (!firebase.apps.length) firebase.initializeApp(self.APP_CONFIG.firebaseConfig);
  return firebase.messaging();
}

// Requests notification permission, registers the FCM service worker, gets
// a device token, and saves it against the logged-in nurse on the backend.
async function enableNotifications() {
  if (!fcmConfigured_()) return "no-config";
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.register("firebase-messaging-sw.js");
  const messaging = getMessaging_();
  try {
    const token = await messaging.getToken({
      vapidKey: self.APP_CONFIG.FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return "no-token";
    await Api.post("fcmTokenSave", { fcmToken: token });
    return "subscribed";
  } catch (e) {
    console.error(e);
    return "error";
  }
}

// While this tab is focused, FCM delivers messages here instead of to the
// service worker — show a manual notification so the nurse still notices.
function listenForegroundMessages() {
  const messaging = getMessaging_();
  if (!messaging) return;
  messaging.onMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || "Pressure Sore Guard";
    const body = (payload.notification && payload.notification.body) || "";
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "icons/icon-192.png" });
    }
  });
}

// Renders a "enable notifications" button + status line into `el`.
function mountNotificationSetup(el) {
  if (!fcmConfigured_()) {
    el.innerHTML = '<p class="text-xs text-muted">ยังไม่ได้ตั้งค่า Firebase (ดู GAS_SYSTEM.md) — การแจ้งเตือนผ่านเบราว์เซอร์ยังใช้งานไม่ได้</p>';
    return;
  }
  el.innerHTML = '<button id="enableNotifBtn" class="btn btn-secondary">🔔 เปิดการแจ้งเตือนเมื่อครบเวลาพลิกตัว</button><p id="notifStatus" class="text-xs" style="margin-top:6px"></p>';
  const statusEl = el.querySelector("#notifStatus");
  el.querySelector("#enableNotifBtn").addEventListener("click", async (e) => {
    e.target.disabled = true;
    const result = await enableNotifications();
    e.target.disabled = false;
    if (result === "subscribed") {
      e.target.style.display = "none";
      statusEl.className = "text-xs";
      statusEl.style.color = "var(--risk-low)";
      statusEl.textContent = "✓ เปิดการแจ้งเตือนแล้ว";
    } else if (result === "denied") {
      statusEl.textContent = "เบราว์เซอร์/ระบบปฏิเสธการแจ้งเตือน กรุณาอนุญาตในตั้งค่า";
    } else if (result === "unsupported") {
      statusEl.textContent = "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Push";
    } else if (result === "no-config") {
      statusEl.textContent = "ยังไม่ได้ตั้งค่า Firebase ใน assets/config.js";
    } else {
      statusEl.textContent = "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    }
  });
}
