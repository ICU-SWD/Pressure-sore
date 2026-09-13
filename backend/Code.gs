/**
 * Pressure Sore Guard — Google Apps Script backend.
 *
 * Bind this script to a Google Sheet (Extensions > Apps Script from inside
 * the Sheet). It exposes a Web App (doGet/doPost) that the static frontend
 * in /docs calls, uses the Sheet itself as the database, and a time-driven
 * trigger to push browser (Firebase Cloud Messaging) reminders when a
 * patient's turning time is due.
 *
 * See ../GAS_SYSTEM.md for full setup instructions.
 */

// ----------------------------------------------------------------------
// Config / sheet schema
// ----------------------------------------------------------------------

var SHEETS = {
  USERS: { name: "Users", headers: ["id", "name", "role", "pin_hash", "pin_salt", "active", "created_at"] },
  BEDS: { name: "Beds", headers: ["id", "code", "label", "ward", "patient_name", "patient_hn", "active", "created_at"] },
  TEMPLATES: { name: "Templates", headers: ["id", "name", "items_json", "rules_json", "is_active", "created_at"] },
  ASSESSMENTS: { name: "Assessments", headers: ["id", "template_id", "bed_id", "nurse_id", "answers_json", "total_score", "risk_level", "risk_color", "turn_interval_minutes", "created_at"] },
  CHECKINS: { name: "CheckIns", headers: ["id", "bed_id", "nurse_id", "assessment_id", "turn_interval_minutes", "started_at", "last_turned_at", "next_due_at", "status", "ended_at"] },
  TURNLOGS: { name: "TurnLogs", headers: ["id", "checkin_id", "nurse_id", "turned_at", "note"] },
  NOTIFICATIONLOGS: { name: "NotificationLogs", headers: ["id", "checkin_id", "type", "sent_at"] },
  FCMTOKENS: { name: "FcmTokens", headers: ["id", "user_id", "token", "created_at"] }
};

var TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h shift
var OVERDUE_GRACE_MS = 10 * 60 * 1000; // escalate 10 min after due time

// ----------------------------------------------------------------------
// Generic sheet helpers (each "table" is a tab; row 1 = headers; column
// "id" is the primary key)
// ----------------------------------------------------------------------

function getSheet_(tableKey) {
  var def = SHEETS[tableKey];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.appendRow(def.headers);
  }
  return sheet;
}

function sheetHeaders_(tableKey) {
  return SHEETS[tableKey].headers;
}

function sheetToObjects_(tableKey) {
  var sheet = getSheet_(tableKey);
  var headers = sheetHeaders_(tableKey);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue; // skip blank rows
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    obj._row = i + 2; // 1-based sheet row number, for updates
    out.push(obj);
  }
  return out;
}

function findById_(tableKey, id) {
  var rows = sheetToObjects_(tableKey);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function appendObject_(tableKey, obj) {
  var sheet = getSheet_(tableKey);
  var headers = sheetHeaders_(tableKey);
  var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ""; });
  sheet.appendRow(row);
  return obj;
}

function updateById_(tableKey, id, patch) {
  var sheet = getSheet_(tableKey);
  var headers = sheetHeaders_(tableKey);
  var existing = findById_(tableKey, id);
  if (!existing) return null;
  var merged = {};
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    merged[h] = patch.hasOwnProperty(h) ? patch[h] : existing[h];
  }
  var row = headers.map(function (h) { return merged[h] !== undefined ? merged[h] : ""; });
  sheet.getRange(existing._row, 1, 1, headers.length).setValues([row]);
  return merged;
}

// ----------------------------------------------------------------------
// Small utilities
// ----------------------------------------------------------------------

function uuid_() {
  return Utilities.getUuid();
}

function nowIso_() {
  return new Date().toISOString();
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorOut_(message, code) {
  return jsonOut_({ error: message || "error", code: code || 400 });
}

function parsePostBody_(e) {
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

// ----------------------------------------------------------------------
// PIN hashing (SHA-256 + per-user salt — Apps Script has no scrypt/bcrypt;
// adequate for this internal-tool threat model, not for public-internet auth)
// ----------------------------------------------------------------------

function hashPin_(pin, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pin + ":" + salt);
  return bytes.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}

function makePinHash_(pin) {
  var salt = uuid_();
  return { salt: salt, hash: hashPin_(pin, salt) };
}

function verifyPin_(pin, salt, hash) {
  return hashPin_(pin, salt) === hash;
}

// ----------------------------------------------------------------------
// Session tokens (HMAC-signed, no cookies — the frontend lives on a
// different origin (GitHub Pages) than this Web App, so a bearer token
// passed as a request parameter is used instead of a cookie session)
// ----------------------------------------------------------------------

function authSecret_() {
  var secret = PropertiesService.getScriptProperties().getProperty("AUTH_SECRET");
  if (!secret) throw new Error("AUTH_SECRET script property is not set. See GAS_SYSTEM.md.");
  return secret;
}

function makeToken_(user) {
  var payload = { u: user.id, r: user.role, n: user.name, e: Date.now() + TOKEN_TTL_MS };
  var payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var sig = Utilities.computeHmacSha256Signature(payloadB64, authSecret_());
  var sigB64 = Utilities.base64EncodeWebSafe(sig);
  return payloadB64 + "." + sigB64;
}

function verifyToken_(token) {
  if (!token || token.indexOf(".") === -1) return null;
  var parts = token.split(".");
  var payloadB64 = parts[0];
  var sigB64 = parts[1];
  var expectedSig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payloadB64, authSecret_()));
  if (expectedSig !== sigB64) return null;
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString());
  } catch (err) {
    return null;
  }
  if (!payload.e || payload.e < Date.now()) return null;
  return { userId: payload.u, role: payload.r, name: payload.n };
}

function requireSession_(token) {
  var session = verifyToken_(token);
  if (!session) throw new AuthError_("unauthorized", 401);
  return session;
}

function requireAdmin_(token) {
  var session = requireSession_(token);
  if (session.role !== "ADMIN") throw new AuthError_("forbidden", 403);
  return session;
}

function AuthError_(message, code) {
  this.message = message;
  this.code = code;
}
AuthError_.prototype = Object.create(Error.prototype);

// ----------------------------------------------------------------------
// Checklist scoring (mirrors src/lib/checklist.ts in the Next.js prototype)
// ----------------------------------------------------------------------

function scoreAnswers_(items, answers) {
  var total = 0;
  items.forEach(function (item) {
    var idx = answers[item.id];
    var opt = item.options[idx];
    if (opt) total += Number(opt.score) || 0;
  });
  return total;
}

function matchRiskRule_(rules, totalScore) {
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (totalScore >= r.minScore && totalScore <= r.maxScore) return r;
  }
  // fall back to the most conservative (shortest interval) rule
  var most = rules[0];
  rules.forEach(function (r) {
    if (r.turnIntervalMinutes < most.turnIntervalMinutes) most = r;
  });
  return most;
}

// ----------------------------------------------------------------------
// HTTP entry points
// ----------------------------------------------------------------------

function doGet(e) {
  try {
    var action = e.parameter.action;
    switch (action) {
      case "authUsers":
        return jsonOut_({ users: publicUserList_() });
      case "templateActive":
        return jsonOut_({ template: activeTemplatePublic_() });
      case "bedInfo":
        return jsonOut_(bedInfo_(e.parameter.code));
      case "checkinsMine":
        return jsonOut_({ checkIns: checkInsForNurse_(requireSession_(e.parameter.token).userId) });
      case "checkinsActive":
        requireSession_(e.parameter.token);
        return jsonOut_(activeCheckInsForDashboard_());
      case "adminBeds":
        requireAdmin_(e.parameter.token);
        return jsonOut_({ beds: sheetToObjects_("BEDS").map(stripRow_) });
      case "adminNurses":
        requireAdmin_(e.parameter.token);
        return jsonOut_({ users: sheetToObjects_("USERS").map(adminUserView_) });
      case "adminTemplates":
        requireAdmin_(e.parameter.token);
        return jsonOut_({ templates: sheetToObjects_("TEMPLATES").map(templatePublic_) });
      default:
        return errorOut_("unknown action", 404);
    }
  } catch (err) {
    return handleError_(err);
  }
}

function doPost(e) {
  try {
    var body = parsePostBody_(e);
    var action = body.action;
    switch (action) {
      case "login":
        return jsonOut_(login_(body.userId, body.pin));
      case "checkinCreate":
        return jsonOut_({ checkIn: createCheckIn_(requireSession_(body.token), body) });
      case "checkinTurn":
        return jsonOut_({ checkIn: turnCheckIn_(requireSession_(body.token), body.checkInId, body.note) });
      case "checkinEnd":
        return jsonOut_({ checkIn: endCheckIn_(requireSession_(body.token), body.checkInId) });
      case "fcmTokenSave":
        return jsonOut_({ ok: saveFcmToken_(requireSession_(body.token), body.fcmToken) });
      case "adminBedCreate":
        requireAdmin_(body.token);
        return jsonOut_({ bed: adminCreateBed_(body) });
      case "adminBedUpdate":
        requireAdmin_(body.token);
        return jsonOut_({ bed: adminUpdateBed_(body) });
      case "adminNurseCreate":
        requireAdmin_(body.token);
        return jsonOut_({ user: adminCreateNurse_(body) });
      case "adminNurseUpdate":
        requireAdmin_(body.token);
        return jsonOut_({ user: adminUpdateNurse_(body) });
      case "adminTemplateCreate":
        requireAdmin_(body.token);
        return jsonOut_({ template: adminCreateTemplate_(body) });
      default:
        return errorOut_("unknown action", 404);
    }
  } catch (err) {
    return handleError_(err);
  }
}

function handleError_(err) {
  if (err instanceof AuthError_) return errorOut_(err.message, err.code);
  console.error(err);
  return errorOut_(String(err && err.message ? err.message : err), 500);
}

// ----------------------------------------------------------------------
// Public read helpers
// ----------------------------------------------------------------------

function publicUser_(u) {
  return { id: u.id, name: u.name, role: u.role, active: u.active === true || u.active === "TRUE" };
}

// Same as publicUser_ for now — kept as a separate function so the admin
// nurses page has a stable place to hang admin-only fields in the future.
function adminUserView_(u) {
  return publicUser_(u);
}

function publicUserList_() {
  return sheetToObjects_("USERS")
    .filter(function (u) { return u.active === true || u.active === "TRUE"; })
    .map(publicUser_);
}

function templatePublic_(t) {
  return {
    id: t.id,
    name: t.name,
    items: JSON.parse(t.items_json || "[]"),
    rules: JSON.parse(t.rules_json || "[]"),
    isActive: t.is_active === true || t.is_active === "TRUE",
    createdAt: t.created_at
  };
}

function activeTemplateRaw_() {
  var templates = sheetToObjects_("TEMPLATES").filter(function (t) { return t.is_active === true || t.is_active === "TRUE"; });
  if (templates.length === 0) return null;
  templates.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  return templates[0];
}

function activeTemplatePublic_() {
  var t = activeTemplateRaw_();
  return t ? templatePublic_(t) : null;
}

function stripRow_(obj) {
  var copy = {};
  for (var k in obj) if (k !== "_row") copy[k] = obj[k];
  return copy;
}

function bedByCode_(code) {
  var beds = sheetToObjects_("BEDS");
  for (var i = 0; i < beds.length; i++) if (beds[i].code === code) return beds[i];
  return null;
}

function assessmentPublic_(a) {
  if (!a) return null;
  return {
    id: a.id,
    totalScore: a.total_score,
    riskLevel: a.risk_level,
    riskColor: a.risk_color,
    turnIntervalMinutes: a.turn_interval_minutes,
    createdAt: a.created_at
  };
}

function checkInPublic_(c) {
  var bed = findById_("BEDS", c.bed_id);
  var nurse = findById_("USERS", c.nurse_id);
  var assessment = c.assessment_id ? findById_("ASSESSMENTS", c.assessment_id) : null;
  return {
    id: c.id,
    bed: bed ? stripRow_(bed) : null,
    nurse: nurse ? { id: nurse.id, name: nurse.name } : null,
    assessment: assessmentPublic_(assessment),
    turnIntervalMinutes: c.turn_interval_minutes,
    startedAt: c.started_at,
    lastTurnedAt: c.last_turned_at,
    nextDueAt: c.next_due_at,
    status: c.status
  };
}

function bedInfo_(code) {
  var bed = bedByCode_(code);
  if (!bed) throw new AuthError_("bed_not_found", 404);
  var checkIns = sheetToObjects_("CHECKINS").filter(function (c) { return c.bed_id === bed.id && c.status === "ACTIVE"; });
  var activeCheckIn = checkIns.length ? checkInPublic_(checkIns[0]) : null;

  var assessments = sheetToObjects_("ASSESSMENTS").filter(function (a) { return a.bed_id === bed.id; });
  assessments.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  var latest = assessments[0];
  var latestAssessment = latest ? assessmentPublic_(latest) : null;
  if (latestAssessment && latest) {
    var nurse = findById_("USERS", latest.nurse_id);
    latestAssessment.nurse = nurse ? { name: nurse.name } : null;
  }

  return { bed: stripRow_(bed), activeCheckIn: activeCheckIn, latestAssessment: latestAssessment };
}

function checkInsForNurse_(nurseId) {
  return sheetToObjects_("CHECKINS")
    .filter(function (c) { return c.nurse_id === nurseId && c.status === "ACTIVE"; })
    .map(checkInPublic_)
    .sort(function (a, b) { return new Date(a.nextDueAt) - new Date(b.nextDueAt); });
}

function activeCheckInsForDashboard_() {
  var checkIns = sheetToObjects_("CHECKINS")
    .filter(function (c) { return c.status === "ACTIVE"; })
    .map(checkInPublic_)
    .sort(function (a, b) { return new Date(a.nextDueAt) - new Date(b.nextDueAt); });

  var activeBedIds = {};
  sheetToObjects_("CHECKINS").forEach(function (c) {
    if (c.status === "ACTIVE") activeBedIds[c.bed_id] = true;
  });
  var bedsWithoutCheckIn = sheetToObjects_("BEDS")
    .filter(function (b) { return (b.active === true || b.active === "TRUE") && !activeBedIds[b.id]; })
    .map(stripRow_);

  return { checkIns: checkIns, bedsWithoutCheckIn: bedsWithoutCheckIn };
}

// ----------------------------------------------------------------------
// Auth
// ----------------------------------------------------------------------

function login_(userId, pin) {
  if (!userId || !pin) throw new AuthError_("กรุณาเลือกชื่อและกรอกรหัส PIN", 400);
  var user = findById_("USERS", userId);
  var active = user && (user.active === true || user.active === "TRUE");
  if (!user || !active || !verifyPin_(pin, user.pin_salt, user.pin_hash)) {
    throw new AuthError_("รหัส PIN ไม่ถูกต้อง", 401);
  }
  var token = makeToken_(user);
  return { token: token, user: publicUser_(user) };
}

// ----------------------------------------------------------------------
// Check-in workflow
// ----------------------------------------------------------------------

function createCheckIn_(session, body) {
  var bed = bedByCode_(body.bedCode);
  if (!bed) throw new AuthError_("bed_not_found", 404);

  var assessmentId, turnIntervalMinutes;

  if (body.mode === "reuse") {
    var reused = findById_("ASSESSMENTS", body.reuseAssessmentId);
    if (!reused || reused.bed_id !== bed.id) throw new AuthError_("assessment_not_found", 404);
    assessmentId = reused.id;
    turnIntervalMinutes = reused.turn_interval_minutes;
  } else {
    var template = activeTemplateRaw_();
    if (!template) throw new AuthError_("no_active_template", 400);
    var items = JSON.parse(template.items_json);
    var rules = JSON.parse(template.rules_json);
    var answers = body.answers || {};
    var totalScore = scoreAnswers_(items, answers);
    var rule = matchRiskRule_(rules, totalScore);

    var assessment = {
      id: uuid_(),
      template_id: template.id,
      bed_id: bed.id,
      nurse_id: session.userId,
      answers_json: JSON.stringify(answers),
      total_score: totalScore,
      risk_level: rule.label,
      risk_color: rule.color,
      turn_interval_minutes: rule.turnIntervalMinutes,
      created_at: nowIso_()
    };
    appendObject_("ASSESSMENTS", assessment);
    assessmentId = assessment.id;
    turnIntervalMinutes = rule.turnIntervalMinutes;
  }

  // Handover: end any other active check-in on this bed.
  sheetToObjects_("CHECKINS").forEach(function (c) {
    if (c.bed_id === bed.id && c.status === "ACTIVE") {
      updateById_("CHECKINS", c.id, { status: "ENDED", ended_at: nowIso_() });
    }
  });

  var now = new Date();
  var nextDue = new Date(now.getTime() + turnIntervalMinutes * 60000);
  var checkIn = {
    id: uuid_(),
    bed_id: bed.id,
    nurse_id: session.userId,
    assessment_id: assessmentId,
    turn_interval_minutes: turnIntervalMinutes,
    started_at: now.toISOString(),
    last_turned_at: now.toISOString(),
    next_due_at: nextDue.toISOString(),
    status: "ACTIVE",
    ended_at: ""
  };
  appendObject_("CHECKINS", checkIn);
  return checkInPublic_(checkIn);
}

function turnCheckIn_(session, checkInId, note) {
  var checkIn = findById_("CHECKINS", checkInId);
  if (!checkIn || checkIn.status !== "ACTIVE") throw new AuthError_("not_found", 404);

  var now = new Date();
  appendObject_("TURNLOGS", {
    id: uuid_(),
    checkin_id: checkIn.id,
    nurse_id: session.userId,
    turned_at: now.toISOString(),
    note: note || ""
  });

  var nextDue = new Date(now.getTime() + Number(checkIn.turn_interval_minutes) * 60000);
  var updated = updateById_("CHECKINS", checkIn.id, {
    last_turned_at: now.toISOString(),
    next_due_at: nextDue.toISOString()
  });
  return checkInPublic_(updated);
}

function endCheckIn_(session, checkInId) {
  var checkIn = findById_("CHECKINS", checkInId);
  if (!checkIn || checkIn.status !== "ACTIVE") throw new AuthError_("not_found", 404);
  var updated = updateById_("CHECKINS", checkIn.id, { status: "ENDED", ended_at: nowIso_() });
  return checkInPublic_(updated);
}

// ----------------------------------------------------------------------
// Admin actions
// ----------------------------------------------------------------------

function adminCreateBed_(body) {
  var code = (body.code || "").trim();
  var label = (body.label || "").trim();
  if (!code || !label) throw new AuthError_("กรุณาระบุรหัสเตียงและชื่อเตียง", 400);
  if (bedByCode_(code)) throw new AuthError_("รหัสเตียงนี้มีอยู่แล้ว", 409);
  var bed = {
    id: uuid_(),
    code: code,
    label: label,
    ward: body.ward || "",
    patient_name: body.patientName || "",
    patient_hn: body.patientHn || "",
    active: true,
    created_at: nowIso_()
  };
  appendObject_("BEDS", bed);
  return stripRow_(bed);
}

function adminUpdateBed_(body) {
  var patch = {};
  ["label", "ward", "active"].forEach(function (k) { if (body[k] !== undefined) patch[k] = body[k]; });
  if (body.patientName !== undefined) patch.patient_name = body.patientName;
  if (body.patientHn !== undefined) patch.patient_hn = body.patientHn;
  var updated = updateById_("BEDS", body.id, patch);
  if (!updated) throw new AuthError_("not_found", 404);
  return stripRow_(updated);
}

function adminCreateNurse_(body) {
  var name = (body.name || "").trim();
  var pin = body.pin || "";
  if (!name || pin.length < 4) throw new AuthError_("กรุณาระบุชื่อและ PIN อย่างน้อย 4 หลัก", 400);
  var ph = makePinHash_(pin);
  var user = {
    id: uuid_(),
    name: name,
    role: body.role === "ADMIN" ? "ADMIN" : "NURSE",
    pin_hash: ph.hash,
    pin_salt: ph.salt,
    active: true,
    created_at: nowIso_()
  };
  appendObject_("USERS", user);
  return adminUserView_(user);
}

function adminUpdateNurse_(body) {
  var patch = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.active !== undefined) patch.active = body.active;
  if (body.pin) {
    var ph = makePinHash_(body.pin);
    patch.pin_hash = ph.hash;
    patch.pin_salt = ph.salt;
  }
  var updated = updateById_("USERS", body.id, patch);
  if (!updated) throw new AuthError_("not_found", 404);
  return adminUserView_(updated);
}

function adminCreateTemplate_(body) {
  var name = (body.name || "").trim();
  var items = body.items;
  var rules = body.rules;
  if (!name || !items || !items.length || !rules || !rules.length) {
    throw new AuthError_("กรุณาระบุชื่อ, รายการประเมิน, และเกณฑ์คะแนนอย่างน้อย 1 รายการ", 400);
  }
  // deactivate previous active template(s)
  sheetToObjects_("TEMPLATES").forEach(function (t) {
    if (t.is_active === true || t.is_active === "TRUE") updateById_("TEMPLATES", t.id, { is_active: false });
  });
  var template = {
    id: uuid_(),
    name: name,
    items_json: JSON.stringify(items),
    rules_json: JSON.stringify(rules),
    is_active: true,
    created_at: nowIso_()
  };
  appendObject_("TEMPLATES", template);
  return templatePublic_(template);
}

// ----------------------------------------------------------------------
// Firebase Cloud Messaging (FCM) integration
//
// Reminders go out as real browser push notifications (work even with the
// screen locked/app backgrounded, as long as the site was added to the
// Home Screen on iOS — see GAS_SYSTEM.md) via FCM's HTTP v1 API. Apps
// Script has no VAPID/ECDSA signing, so instead of raw Web Push we go
// through Firebase: the browser registers for a token using Firebase's own
// (Google-hosted) VAPID key, and this backend authenticates to FCM as a
// service account using RS256-signed JWTs — Utilities.computeRsaSha256Signature
// is something Apps Script *can* do natively.
// ----------------------------------------------------------------------

function serviceAccount_() {
  var raw = PropertiesService.getScriptProperties().getProperty("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

// Utilities.base64EncodeWebSafe accepts either a string or a byte array.
function base64UrlNoPad_(bytesOrString) {
  return Utilities.base64EncodeWebSafe(bytesOrString).replace(/=+$/, "");
}

function fcmAccessToken_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("fcm_access_token");
  if (cached) return cached;

  var sa = serviceAccount_();
  if (!sa) throw new Error("FCM_SERVICE_ACCOUNT_JSON script property is not set. See GAS_SYSTEM.md.");

  var nowSec = Math.floor(Date.now() / 1000);
  var header = { alg: "RS256", typ: "JWT" };
  var claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600
  };
  var signingInput = base64UrlNoPad_(JSON.stringify(header)) + "." + base64UrlNoPad_(JSON.stringify(claim));
  var signature = Utilities.computeRsaSha256Signature(signingInput, sa.private_key);
  var jwt = signingInput + "." + base64UrlNoPad_(signature);

  var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    },
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error("FCM auth failed: " + res.getContentText());

  cache.put("fcm_access_token", data.access_token, 3300); // cache ~55 min (tokens last 1h)
  return data.access_token;
}

function saveFcmToken_(session, fcmToken) {
  if (!fcmToken) return false;
  var existing = sheetToObjects_("FCMTOKENS").filter(function (r) { return r.token === fcmToken; })[0];
  if (existing) {
    updateById_("FCMTOKENS", existing.id, { user_id: session.userId, created_at: nowIso_() });
  } else {
    appendObject_("FCMTOKENS", { id: uuid_(), user_id: session.userId, token: fcmToken, created_at: nowIso_() });
  }
  return true;
}

function sendFcmPush_(fcmToken, title, body, data) {
  var sa = serviceAccount_();
  if (!sa) return;
  var accessToken;
  try {
    accessToken = fcmAccessToken_();
  } catch (err) {
    console.error(err);
    return;
  }

  var res = UrlFetchApp.fetch(
    "https://fcm.googleapis.com/v1/projects/" + sa.project_id + "/messages:send",
    {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + accessToken },
      payload: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title: title, body: body },
          data: data || {},
          webpush: { fcm_options: { link: (data && data.url) || "/" } }
        }
      }),
      muteHttpExceptions: true
    }
  );

  if (res.getResponseCode() >= 400) {
    var text = res.getContentText();
    // Token is no longer valid (uninstalled, permission revoked, etc.) — remove it.
    if (text.indexOf("UNREGISTERED") !== -1 || text.indexOf("NOT_FOUND") !== -1 || text.indexOf("INVALID_ARGUMENT") !== -1) {
      var row = sheetToObjects_("FCMTOKENS").filter(function (r) { return r.token === fcmToken; })[0];
      if (row) getSheet_("FCMTOKENS").deleteRow(row._row);
    } else {
      console.error("FCM send failed: " + text);
    }
  }
}

function sendReminderToNurse_(nurseId, title, body, data) {
  var tokens = sheetToObjects_("FCMTOKENS").filter(function (r) { return r.user_id === nurseId; });
  tokens.forEach(function (row) { sendFcmPush_(row.token, title, body, data); });
}

// ----------------------------------------------------------------------
// Reminder scheduler — run every minute by an installable time trigger
// (see createTimeTrigger_ / setup()).
// ----------------------------------------------------------------------

function checkOverdueAndNotify() {
  var now = new Date();
  var checkIns = sheetToObjects_("CHECKINS").filter(function (c) {
    return c.status === "ACTIVE" && new Date(c.next_due_at) <= now;
  });
  if (checkIns.length === 0) return;

  var allLogs = sheetToObjects_("NOTIFICATIONLOGS");

  checkIns.forEach(function (checkIn) {
    var lastTurnedAt = new Date(checkIn.last_turned_at);
    var logsSinceTurn = allLogs.filter(function (l) {
      return l.checkin_id === checkIn.id && new Date(l.sent_at) >= lastTurnedAt;
    });
    var dueSent = logsSinceTurn.some(function (l) { return l.type === "DUE"; });
    var overdueSent = logsSinceTurn.some(function (l) { return l.type === "OVERDUE"; });
    var msPastDue = now.getTime() - new Date(checkIn.next_due_at).getTime();

    var typeToSend = null;
    if (!dueSent) typeToSend = "DUE";
    else if (!overdueSent && msPastDue >= OVERDUE_GRACE_MS) typeToSend = "OVERDUE";
    if (!typeToSend) return;

    var bed = findById_("BEDS", checkIn.bed_id);
    var title = typeToSend === "OVERDUE" ? "⚠️ เลยเวลาพลิกตัว!" : "🔔 ถึงเวลาพลิกตัวผู้ป่วย";
    var body = (bed ? bed.label + " (" + bed.code + ")" : "") + (bed && bed.patient_name ? " · " + bed.patient_name : "");
    sendReminderToNurse_(checkIn.nurse_id, title, body, { checkInId: checkIn.id, url: "my-beds.html" });

    appendObject_("NOTIFICATIONLOGS", { id: uuid_(), checkin_id: checkIn.id, type: typeToSend, sent_at: now.toISOString() });
  });
}

// ----------------------------------------------------------------------
// One-time setup — run manually from the Apps Script editor
// (select `setup` in the function dropdown, then Run).
// ----------------------------------------------------------------------

function setup() {
  ensureAuthSecret();
  initializeSheets_();
  seedDemoData_();
  createTimeTrigger_();
  Logger.log("Setup complete. Deploy this project as a Web App (Deploy > New deployment) if you haven't yet.");
}

function initializeSheets_() {
  Object.keys(SHEETS).forEach(function (key) { getSheet_(key); });
}

function seedDemoData_() {
  if (sheetToObjects_("USERS").length > 0) {
    Logger.log("Users sheet already has data — skipping seed.");
    return;
  }

  var adminPin = makePinHash_("0000");
  appendObject_("USERS", {
    id: "seed-admin", name: "หัวหน้าพยาบาล (Admin)", role: "ADMIN",
    pin_hash: adminPin.hash, pin_salt: adminPin.salt,
    active: true, created_at: nowIso_()
  });

  var nurseNames = ["พยาบาลสมศรี", "พยาบาลอรทัย", "พยาบาลวิภา"];
  nurseNames.forEach(function (name, i) {
    var p = makePinHash_("1234");
    appendObject_("USERS", {
      id: "seed-nurse-" + (i + 1), name: name, role: "NURSE",
      pin_hash: p.hash, pin_salt: p.salt,
      active: true, created_at: nowIso_()
    });
  });

  var items = [
    { id: "sensory", question: "การรับรู้ความรู้สึก (Sensory perception)", options: [
      { label: "ไม่รับรู้ความรู้สึกเลย", score: 1 }, { label: "รับรู้ได้บางส่วน", score: 2 },
      { label: "รับรู้ได้เล็กน้อย", score: 3 }, { label: "รับรู้ได้ปกติ", score: 4 }
    ] },
    { id: "moisture", question: "ความชื้นของผิวหนัง (Moisture)", options: [
      { label: "ชื้นตลอดเวลา", score: 1 }, { label: "ชื้นบ่อยมาก", score: 2 },
      { label: "ชื้นเป็นครั้งคราว", score: 3 }, { label: "แทบไม่ชื้น", score: 4 }
    ] },
    { id: "mobility", question: "การเคลื่อนไหวร่างกาย (Mobility)", options: [
      { label: "เคลื่อนไหวเองไม่ได้เลย", score: 1 }, { label: "เคลื่อนไหวได้จำกัดมาก", score: 2 },
      { label: "เคลื่อนไหวได้จำกัดเล็กน้อย", score: 3 }, { label: "เคลื่อนไหวได้ปกติ", score: 4 }
    ] },
    { id: "activity", question: "ระดับกิจกรรม (Activity)", options: [
      { label: "นอนติดเตียงตลอด", score: 1 }, { label: "นั่งได้เฉพาะบนเก้าอี้", score: 2 },
      { label: "เดินได้เป็นครั้งคราว", score: 3 }, { label: "เดินได้บ่อย", score: 4 }
    ] }
  ];
  var rules = [
    { minScore: 4, maxScore: 8, label: "เสี่ยงสูงมาก", color: "#dc2626", turnIntervalMinutes: 60 },
    { minScore: 9, maxScore: 12, label: "เสี่ยงสูง", color: "#ea580c", turnIntervalMinutes: 120 },
    { minScore: 13, maxScore: 15, label: "เสี่ยงปานกลาง", color: "#ca8a04", turnIntervalMinutes: 180 },
    { minScore: 16, maxScore: 16, label: "เสี่ยงต่ำ", color: "#16a34a", turnIntervalMinutes: 240 }
  ];
  appendObject_("TEMPLATES", {
    id: "seed-template-1", name: "แบบประเมินความเสี่ยงแผลกดทับ (ตัวอย่าง)",
    items_json: JSON.stringify(items), rules_json: JSON.stringify(rules),
    is_active: true, created_at: nowIso_()
  });

  var bedDefs = [
    ["ICU-01", "เตียง 1", "นายทดสอบ หนึ่ง", "HN00001"],
    ["ICU-02", "เตียง 2", "นางทดสอบ สอง", "HN00002"],
    ["ICU-03", "เตียง 3", "นายทดสอบ สาม", "HN00003"],
    ["ICU-04", "เตียง 4", "", ""],
    ["ICU-05", "เตียง 5", "", ""],
    ["ICU-06", "เตียง 6", "", ""]
  ];
  bedDefs.forEach(function (b) {
    appendObject_("BEDS", {
      id: uuid_(), code: b[0], label: b[1], ward: "ICU",
      patient_name: b[2], patient_hn: b[3], active: true, created_at: nowIso_()
    });
  });

  Logger.log("Seeded demo data. Login PINs -> admin: 0000, nurses: 1234");
}

function createTimeTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "checkOverdueAndNotify") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("checkOverdueAndNotify").timeBased().everyMinutes(1).create();
}

/** Generates AUTH_SECRET if it isn't already set. Run once, or set it
 * manually under Project Settings > Script Properties. */
function ensureAuthSecret() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty("AUTH_SECRET")) {
    props.setProperty("AUTH_SECRET", Utilities.getUuid() + Utilities.getUuid());
    Logger.log("Generated AUTH_SECRET script property.");
  } else {
    Logger.log("AUTH_SECRET already set.");
  }
}
