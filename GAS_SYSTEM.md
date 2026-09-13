# Pressure Sore Guard — GitHub Pages + Google Sheets edition

ระบบเดียวกับ workflow ที่ต้องการ (check-in ด้วย QR, แบบประเมินความเสี่ยง, แจ้งเตือนเมื่อครบเวลา
พลิกตัว, แดชบอร์ดกลาง) แต่สร้างด้วยสถาปัตยกรรมที่**ไม่ต้องมีเซิร์ฟเวอร์ของตัวเอง**:

- **หน้าเว็บ** — ไฟล์ static ล้วนๆ ใน `docs/` โฮสต์ฟรีผ่าน **GitHub Pages**
- **หลังบ้าน/ฐานข้อมูล** — **Google Sheets** ผ่าน **Google Apps Script Web App** (`backend/Code.gs`)
  ทำหน้าที่เป็น API ให้หน้าเว็บเรียก
- **แจ้งเตือน** — **Push notification ในเบราว์เซอร์** (ไม่ใช้ LINE) ผ่าน **Firebase Cloud
  Messaging (FCM)** ของ Google — Apps Script ตั้งเวลาเช็คทุก 1 นาที แล้วสั่ง FCM ส่งแจ้งเตือนไปยัง
  อุปกรณ์ของพยาบาลที่ดูแลอยู่ + มีเสียง/ไฮไลต์แจ้งเตือนในหน้าเว็บเองด้วยขณะเปิดแท็บค้างไว้
  (สองช่องทางพร้อมกัน)

> **ข้อจำกัดสำคัญที่ควรรู้ก่อนเริ่ม:** Push notification จะทำงานได้แม้ล็อกหน้าจอ/ปิดแอปไปแล้ว
> บน **Android และคอมพิวเตอร์** ได้ทันทีหลังกดอนุญาต แต่บน **iPhone (iOS Safari)** ต้อง**เพิ่มเว็บนี้
> ไปที่หน้าจอหลัก (Add to Home Screen) ก่อน** — เปิดผ่าน Safari ธรรมดาแล้วกดอนุญาตจะยังไม่ได้รับ
> แจ้งเตือนตอนล็อกหน้าจอ เป็นข้อจำกัดของ Apple เอง ไม่ใช่ของระบบนี้ ควรแจ้งพยาบาลที่ใช้ iPhone ให้
> เพิ่มไปหน้าจอหลักตั้งแต่ต้น (ขั้นตอนอยู่ด้านล่าง)

ระบบนี้อยู่แยกจากต้นแบบ Next.js เดิม (โฟลเดอร์ `src/`, `prisma/` ฯลฯ) — ทั้งสองระบบอยู่ใน repo
เดียวกันได้โดยไม่ชนกัน เลือกใช้ระบบไหนก็ได้ตามความเหมาะสม

---

## ภาพรวมสถาปัตยกรรม

```
[เบราว์เซอร์/มือถือพยาบาล]
        │  fetch (GET/POST)
        ▼
[GitHub Pages: docs/*.html]  ← โค้ด static, deploy อัตโนมัติจาก repo
        │  fetch → Apps Script Web App URL
        ▼
[Google Apps Script: backend/Code.gs]  ← ทำหน้าที่เป็น API server
        │  อ่าน/เขียน
        ▼
[Google Sheet]  ← ฐานข้อมูล (แต่ละแท็บ = 1 ตาราง)
        │
        │  time-driven trigger ทุก 1 นาที
        ▼
[Firebase Cloud Messaging]  → พุชแจ้งเตือนไปเบราว์เซอร์/มือถือพยาบาลโดยตรง
```

Apps Script เองเข้ารหัสแบบ VAPID (ที่ Web Push มาตรฐานต้องใช้) ไม่ได้ จึงให้ Firebase เป็นตัวกลาง
จัดการเรื่องนี้แทน: ฝั่งเบราว์เซอร์ขอ "token อุปกรณ์" จาก Firebase โดยตรง ส่วน Apps Script ยืนยันตัวตน
กับ FCM ด้วยกุญแจแบบ Service Account (เซ็นด้วย RSA ซึ่ง Apps Script ทำได้) แล้วสั่งส่งข้อความผ่าน
FCM's HTTP v1 API

---

## ขั้นตอนที่ 1 — สร้าง Google Sheet + Apps Script

1. ไปที่ [sheets.google.com](https://sheets.google.com) → สร้างสเปรดชีตใหม่ ตั้งชื่อเช่น
   "Pressure Sore Guard - Database"
2. เมนู **ส่วนขยาย (Extensions) → Apps Script** — จะเปิดโปรเจกต์ Apps Script ที่ผูกกับชีตนี้
   (bound script) ให้อัตโนมัติ
3. ลบโค้ดเริ่มต้นในไฟล์ `Code.gs` ออกทั้งหมด แล้ว copy เนื้อหาทั้งหมดจากไฟล์
   [`backend/Code.gs`](backend/Code.gs) ในโปรเจกต์นี้ไปวาง
4. เมนูซ้าย ⚙️ **Project Settings** → ติ๊ก "Show appsscript.json manifest file in editor" →
   จะมีไฟล์ `appsscript.json` โผล่มา → เปิดแล้ว copy เนื้อหาจาก
   [`backend/appsscript.json`](backend/appsscript.json) ไปวางทับ → กด บันทึก (Ctrl+S)

## ขั้นตอนที่ 2 — รัน setup ครั้งแรก

1. ที่แถบด้านบนของ Apps Script editor เลือกฟังก์ชัน `setup` จาก dropdown แล้วกด **Run** (▶️)
2. ครั้งแรกจะมีหน้าต่างขอสิทธิ์ (authorize) — เลือกบัญชี Google ของคุณ → กด "Advanced" →
   "Go to (โปรเจกต์) (unsafe)" → Allow (ปกติของสคริปต์ที่เขียนเอง ไม่ใช่ของบุคคลที่สาม)
3. เปิดแท็บ **Executions** (ไอคอนนาฬิกาด้านซ้าย) เพื่อดู log — ควรเห็น "Setup complete..."
4. กลับไปที่ Google Sheet จะเห็นแท็บใหม่ถูกสร้างอัตโนมัติ (Users, Beds, Templates, Assessments,
   CheckIns, TurnLogs, NotificationLogs, FcmTokens) พร้อมข้อมูลตัวอย่าง (admin PIN `0000`, พยาบาล
   PIN `1234`, เตียง ICU-01–06)

`setup()` ทำ 3 อย่าง: สร้างชีตที่จำเป็นทั้งหมด, ใส่ข้อมูลตัวอย่าง (เฉพาะตอนที่ชีต Users ว่างอยู่),
และตั้ง trigger ให้รันฟังก์ชัน `checkOverdueAndNotify` ทุก 1 นาที

## ขั้นตอนที่ 3 — Deploy เป็น Web App

1. มุมขวาบนของ Apps Script editor กด **Deploy → New deployment**
2. คลิกไอคอนเฟือง ข้างคำว่า "Select type" → เลือก **Web app**
3. ตั้งค่า:
   - Execute as: **Me** (บัญชีของคุณ)
   - Who has access: **Anyone**
4. กด **Deploy** → คัดลอก **Web app URL** ที่ได้ (รูปแบบ
   `https://script.google.com/macros/s/XXXXXXXX/exec`) — จะใช้ในขั้นตอนถัดไป

> ทุกครั้งที่แก้โค้ดใน Code.gs แล้วอยากให้ Web App URL เดิมใช้โค้ดใหม่ ต้องทำ
> **Deploy → Manage deployments → แก้ไข (ไอคอนดินสอ) → Version: New version → Deploy** ใหม่ทุกครั้ง
> (แก้โค้ดอย่างเดียวไม่พอ ต้อง deploy version ใหม่ด้วย)

## ขั้นตอนที่ 4 — สร้าง Firebase project (สำหรับ Push notification)

1. ไปที่ [console.firebase.google.com](https://console.firebase.google.com/) → **Add project** →
   ตั้งชื่อ เช่น "pressure-sore-guard" → ปิด Google Analytics ได้ (ไม่จำเป็น) → Create project
2. ในหน้าโปรเจกต์ กดไอคอน **</> (Web)** เพื่อเพิ่มเว็บแอป → ตั้งชื่อ เช่น "PS Guard Web" → Register
   app → จะเห็นโค้ด `firebaseConfig = { apiKey: ..., authDomain: ..., ... }` → **คัดลอกค่าทั้งหมด
   ไว้** (ใช้ในขั้นตอนที่ 5)
3. เมนูซ้าย ⚙️ (Project settings) → แท็บ **Cloud Messaging** → เลื่อนไปที่ "Web configuration" →
   ถ้ายังไม่มี "Web Push certificates" ให้กด **Generate key pair** → คัดลอกค่า **Key pair**
   (เป็นสตริงยาวๆ นี่คือ `FIREBASE_VAPID_KEY`)
4. แท็บ **Service accounts** (อยู่ในหน้า Project settings เดียวกัน) → กด **Generate new private
   key** → ยืนยัน → จะได้ไฟล์ `.json` ดาวน์โหลดลงเครื่อง (เก็บไฟล์นี้ให้ดี ห้ามเผยแพร่/commit ขึ้น
   GitHub เด็ดขาด เพราะเป็นกุญแจลับที่ใช้ยืนยันตัวตนกับ Google)

## ขั้นตอนที่ 5 — ตั้งค่าหน้าเว็บและ Apps Script ให้ใช้ Firebase

**5.1 หน้าเว็บ** — เปิดไฟล์ `docs/assets/config.js` แก้ให้ครบทั้ง 3 ส่วน:

```js
self.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec", // จากขั้นตอนที่ 3
  firebaseConfig: {
    apiKey: "...",            // จากขั้นตอนที่ 4.2 (firebaseConfig)
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "...",
  },
  FIREBASE_VAPID_KEY: "...",  // จากขั้นตอนที่ 4.3 (Key pair)
};
```

เปิดไฟล์ `docs/firebase-messaging-sw.js` — ไม่ต้องแก้อะไร (มันโหลดค่าเดียวกันจาก `config.js`
อัตโนมัติผ่าน `importScripts`)

**5.2 Apps Script** — เปิดไฟล์ `.json` ที่ดาวน์โหลดมาจากขั้นตอนที่ 4.4 ด้วยโปรแกรมแก้ไขข้อความ
(Notepad, TextEdit ฯลฯ) → เลือกทั้งหมด → คัดลอก → ไปที่ Apps Script editor → ⚙️ **Project
Settings → Script Properties** → Add script property:

- Property: `FCM_SERVICE_ACCOUNT_JSON`
- Value: (วางเนื้อหาไฟล์ JSON ทั้งไฟล์ที่คัดลอกมา)
- กด Save script properties

จากนั้น commit และ push ไฟล์ `docs/assets/config.js` ที่แก้แล้วขึ้น GitHub (**อย่า** commit ไฟล์
service account `.json` ขึ้น GitHub เด็ดขาด — ใส่เฉพาะใน Apps Script Script Properties เท่านั้น)

## ขั้นตอนที่ 6 — เปิดใช้งาน GitHub Pages

1. ไปที่ repo บน GitHub → **Settings → Pages**
2. หัวข้อ "Build and deployment" → Source: **Deploy from a branch**
3. Branch: เลือก branch ที่มีโฟลเดอร์ `docs/` (เช่น `claude/upbeat-johnson-9iausy` หรือ branch
   หลักของ repo) และเลือกโฟลเดอร์ **`/docs`**
4. กด **Save** — รอ 1-2 นาที จะได้ลิงก์เว็บไซต์รูปแบบ `https://<org>.github.io/<repo>/`
5. เปิดลิงก์นั้น ควรเจอหน้า login ของระบบ

## ขั้นตอนที่ 7 — ให้พยาบาลเปิดการแจ้งเตือน

ไม่ต้องมีขั้นตอนลงทะเบียนจาก Admin — แต่ละคนเปิดเองจากอุปกรณ์ตัวเอง:

1. ล็อกอินเข้าเว็บ → ไปหน้า **"เตียงของฉัน"** (หรือหน้า check-in ก็มีปุ่มเดียวกัน)
2. กดปุ่ม **"🔔 เปิดการแจ้งเตือนเมื่อครบเวลาพลิกตัว"** → อนุญาต (Allow) เมื่อเบราว์เซอร์ถาม
3. **สำคัญสำหรับ iPhone**: ก่อนกดปุ่มข้อ 2 ต้องเพิ่มเว็บไปหน้าจอหลักก่อน — เปิดเว็บด้วย **Safari**
   → กดปุ่ม Share (ไอคอนสี่เหลี่ยมมีลูกศรชี้ขึ้น) → เลื่อนหาแล้วกด **"Add to Home Screen"** → เปิด
   แอปจากไอคอนที่หน้าจอหลัก (ไม่ใช่จาก Safari) → ค่อยกดปุ่มเปิดการแจ้งเตือนในข้อ 2

## ขั้นตอนที่ 8 — ทดสอบระบบ

1. เปิดเว็บ GitHub Pages → ล็อกอิน admin (PIN `0000`) → ตั้งค่าเตียง/แบบประเมิน/บัญชีพยาบาลจริง
   ที่เมนู "จัดการระบบ" → พิมพ์ QR ที่หน้า "เตียง & QR Code" ไปติดหัวเตียง
2. ล็อกอินด้วยบัญชีพยาบาล (PIN `1234` สำหรับบัญชีตัวอย่าง) → เปิดลิงก์ QR (หรือ
   `checkin.html?bed=ICU-01`) → ทำแบบประเมิน → Check-in → เปิดการแจ้งเตือนตามขั้นตอนที่ 7
3. ล็อกหน้าจอ (หรือสลับไปแอปอื่น) รอถึงเวลาพลิกตัว (หรือแก้ค่า `turnIntervalMinutes` ในแบบประเมิน
   ให้สั้นๆ เช่น 1-2 นาทีเพื่อทดสอบ) → ควรได้รับแจ้งเตือนขึ้นที่หน้าจอแม้ล็อกอยู่ และถ้าเปิดแท็บ
   "เตียงของฉัน"/"แดชบอร์ด" ค้างไว้จะมีเสียงเตือน + ป้ายสีแดงขึ้นทันทีที่เลยเวลาด้วย

---

## ข้อจำกัด / สิ่งที่ควรรู้

- **iPhone ต้อง Add to Home Screen ก่อน** ถึงจะได้รับแจ้งเตือนตอนล็อกหน้าจอ/ปิดแอป (ข้อจำกัดของ
  iOS Safari เอง) — ถ้าพยาบาลเปิดผ่าน Safari ธรรมดาไว้ จะได้รับแจ้งเตือนเฉพาะตอนแอปเปิดอยู่หน้าจอ
  เท่านั้น
- **ความถี่การเช็คแจ้งเตือน**: Apps Script time-driven trigger ละเอียดสุดคือทุก 1 นาที (ตั้งไว้
  แล้วใน `setup()`) จึงอาจคลาดเคลื่อนได้ไม่เกิน ~1 นาทีจากเวลาที่กำหนดจริง
- **Apps Script quota**: บัญชี Google ส่วนบุคคล/Workspace ฟรี มีโควต้าการรันสคริปต์และ URL Fetch
  ต่อวันจำกัด (ปกติเพียงพอสำหรับหน่วยงานขนาดเล็ก-กลาง) — ถ้าจำนวนเตียง/การแจ้งเตือนต่อวันสูงมาก
  ควรพิจารณาอัปเกรด Google Workspace หรือย้ายไประบบที่มีเซิร์ฟเวอร์ของตัวเอง (เช่นระบบ Next.js ใน
  โฟลเดอร์ `src/`)
- **ห้าม commit ไฟล์ service account `.json` ขึ้น GitHub**: เป็นกุญแจลับที่ใครก็ตามที่มีไฟล์นี้
  สามารถส่ง push notification ปลอมผ่านโปรเจกต์ Firebase ของคุณได้ — เก็บไว้เฉพาะใน Apps Script
  Script Properties (ซึ่งไม่ถูก commit ขึ้น GitHub อยู่แล้วโดยธรรมชาติ) ค่าที่อยู่ใน
  `docs/assets/config.js` (firebaseConfig, VAPID key) ปลอดภัยที่จะเผยแพร่ได้ตามปกติ — เป็นค่า
  สาธารณะสำหรับระบุตัวโปรเจกต์ ไม่ใช่กุญแจลับ
- **Token ใน URL**: เพื่อเลี่ยงปัญหา CORS preflight ของ Apps Script Web App คำขอ GET จะแนบ
  session token เป็น query parameter (ไม่ใช่ cookie) — เหมาะกับการใช้งานภายในหน่วยงานที่เข้าถึง
  ผ่าน HTTPS อยู่แล้ว แต่ไม่ควรถือเป็นระดับความปลอดภัยเดียวกับระบบที่มี backend เต็มรูปแบบ
- **การเข้ารหัส PIN**: ใช้ SHA-256 + salt ต่อผู้ใช้ (Apps Script ไม่มี scrypt/bcrypt ในตัว)
  เพียงพอสำหรับเครื่องมือใช้ภายในหน่วยงาน แต่ไม่แนะนำสำหรับระบบที่เปิดสู่อินเทอร์เน็ตสาธารณะ
- **แบบประเมินตัวอย่าง**: เนื้อหาคำถาม/คะแนนที่ seed มาให้เป็นตัวอย่างสาธิตการให้คะแนนเท่านั้น
  ควรให้ทีมพยาบาล/แพทย์ทบทวนและปรับให้ตรงมาตรฐานที่หน่วยงานใช้จริงก่อนใช้งานจริง (แก้ได้ที่เมนู
  "จัดการระบบ → แบบประเมิน" โดยไม่ต้องแก้โค้ด)
- **แก้โค้ด backend แล้วต้อง deploy ใหม่เสมอ** ตามที่ระบุในขั้นตอนที่ 3 — เป็นเรื่องปกติของ
  Apps Script Web App (ไม่เหมือนเซิร์ฟเวอร์ทั่วไปที่รีสตาร์ทอัตโนมัติ)
