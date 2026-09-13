// Paste the Web App URL you get from Apps Script > Deploy > New deployment
// here after following GAS_SYSTEM.md. Looks like:
//   https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXX/exec
//
// firebaseConfig / FIREBASE_VAPID_KEY are for browser push notifications
// (Firebase Cloud Messaging) — both come from the Firebase Console after
// following the "Firebase Cloud Messaging" section of GAS_SYSTEM.md.
// These are public client identifiers (not secrets) — safe to publish.
//
// Assigned on `self` rather than `window` so this same file can be loaded
// both by regular pages (where self === window) and by
// firebase-messaging-sw.js (a service worker, which has no `window`) via
// importScripts — one config, no risk of the two copies drifting apart.
self.APP_CONFIG = {
  API_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",
  firebaseConfig: {
    apiKey: "PASTE_FROM_FIREBASE_CONSOLE",
    authDomain: "PASTE_FROM_FIREBASE_CONSOLE",
    projectId: "PASTE_FROM_FIREBASE_CONSOLE",
    storageBucket: "PASTE_FROM_FIREBASE_CONSOLE",
    messagingSenderId: "PASTE_FROM_FIREBASE_CONSOLE",
    appId: "PASTE_FROM_FIREBASE_CONSOLE",
  },
  FIREBASE_VAPID_KEY: "PASTE_WEB_PUSH_CERTIFICATE_KEY_FROM_FIREBASE_CONSOLE",
};
