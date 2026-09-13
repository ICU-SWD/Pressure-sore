// Thin client for the Google Apps Script backend.
//
// Important: Apps Script Web Apps don't support CORS preflight (OPTIONS)
// requests, so every POST here is sent with Content-Type: text/plain to
// keep it a "simple request" that browsers don't preflight. The Apps
// Script side (doPost) just JSON.parses the raw body regardless of the
// declared content type.

const Api = (() => {
  const SESSION_KEY = "psg_session";

  function apiUrl() {
    const url = window.APP_CONFIG && window.APP_CONFIG.API_URL;
    if (!url || url.indexOf("PASTE_YOUR") === 0) {
      throw new Error("ยังไม่ได้ตั้งค่า API_URL ใน assets/config.js (ดู GAS_SYSTEM.md)");
    }
    return url;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getToken() {
    const s = getSession();
    return s ? s.token : null;
  }

  function getUser() {
    const s = getSession();
    return s ? s.user : null;
  }

  function requireLogin() {
    if (!getSession()) {
      const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
      location.href = `index.html?next=${next}`;
    }
  }

  function requireAdmin() {
    requireLogin();
    const user = getUser();
    if (user && user.role !== "ADMIN") {
      location.href = "my-beds.html";
    }
  }

  async function get(action, params) {
    const usp = new URLSearchParams({ action, ...(params || {}) });
    const token = getToken();
    if (token) usp.set("token", token);
    const res = await fetch(`${apiUrl()}?${usp.toString()}`, { method: "GET" });
    const data = await res.json();
    if (!res.ok || data.error) throw new ApiError(data.error || "request_failed", res.status);
    return data;
  }

  async function post(action, payload) {
    const token = getToken();
    const body = JSON.stringify({ action, token, ...(payload || {}) });
    const res = await fetch(apiUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new ApiError(data.error || "request_failed", res.status);
    return data;
  }

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  return { get, post, getSession, setSession, clearSession, getToken, getUser, requireLogin, requireAdmin, ApiError };
})();
