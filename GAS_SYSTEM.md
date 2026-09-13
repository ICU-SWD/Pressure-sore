# Pressure Sore Guard — GitHub Pages + Google Sheets edition

ระบบเดียวกับ workflow ที่ต้องการ (check-in ด้วย QR, แบบประเมินความเสี่ยง, แจ้งเตือนเมื่อครบเวลา
พลิกตัว, แดชบอร์ดกลาง) แต่สร้างด้วยสถาปัตยกรรมที่**ไม่ต้องมีเซิร์ฟเวอร์ของตัวเอง**:

- **หน้าเว็บ** — ไฟล์ static ล้วนๆ ใน `docs/` โฮสต์ฟรีผ่าน **GitHub Pages**
- **หลังบ้าน/ฐานข้อมูล** — **Google Sheets** ผ่าน **Google Apps Script Web App** (`backend/Code.gs`)
  ทำหน้าที่เป็น API ให้หน้าเว็บเรียก
- **แจ้งเตือน** — Apps Script ตั้งเวลาเช็คทุก 1 นาที แล้วส่งข้อความแจ้งเตือนผ่าน **LINE Official
  Account (Messaging API)** ไปยังพยาบาลที่ดูแลอยู่ + มีเสียง/ไฮไลต์แจ้งเตือนในหน้าเว็บเองด้วย
  ขณะเปิดแท็บค้างไว้ (สองช่องทางพร้อมกันตามที่ขอ)

> **หมายเหตุสำคัญ:** LINE ได้ยกเลิกบริการ **LINE Notify** ไปแล้วตั้งแต่ปี 2025 ระบบนี้จึงใช้
> **LINE Official Account + Messaging API** แทน ซึ่งเป็นวิธีที่ LINE ยังรองรับอยู่ในปัจจุบัน
> การตั้งค่าจะมีขั้นตอนมากกว่า LINE Notify เดิมเล็กน้อย (ต้องสร้าง OA + เปิด Messaging API)
> แต่ทำครั้งเดียวจบ

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
[LINE Messaging API]  → พุชข้อความแจ้งเตือนไปมือถือพยาบาล
```

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
   CheckIns, TurnLogs, NotificationLogs) พร้อมข้อมูลตัวอย่าง (admin PIN `0000`, พยาบาล PIN `1234`,
   เตียง ICU-01–06)

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

## ขั้นตอนที่ 4 — ตั้งค่าหน้าเว็บให้ชี้ไปที่ Apps Script

เปิดไฟล์ `docs/assets/config.js` ในโปรเจกต์นี้ แก้บรรทัด `API_URL` ให้เป็น Web App URL ที่ได้จาก
ขั้นตอนที่ 3:

```js
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
};
```

จากนั้น commit และ push ไฟล์นี้ขึ้น GitHub

## ขั้นตอนที่ 5 — เปิดใช้งาน GitHub Pages

1. ไปที่ repo บน GitHub → **Settings → Pages**
2. หัวข้อ "Build and deployment" → Source: **Deploy from a branch**
3. Branch: เลือก branch ที่มีโฟลเดอร์ `docs/` (เช่น `claude/upbeat-johnson-9iausy` หรือ branch
   หลักของ repo) และเลือกโฟลเดอร์ **`/docs`**
4. กด **Save** — รอ 1-2 นาที จะได้ลิงก์เว็บไซต์รูปแบบ `https://<org>.github.io/<repo>/`
5. เปิดลิงก์นั้น ควรเจอหน้า login ของระบบ

## ขั้นตอนที่ 6 — ตั้งค่า LINE Official Account (Messaging API)

1. ไปที่ [LINE Official Account Manager](https://manager.line.biz/) → สร้าง OA ใหม่ (ฟรี) เช่น
   ชื่อ "ICU แจ้งเตือนพลิกตัว"
2. ไปที่ [LINE Developers Console](https://developers.line.biz/console/) → เลือก provider →
   จะเห็น Channel ของ OA ที่สร้างไว้ (ประเภท Messaging API) — ถ้ายังไม่มีให้เปิดใช้งาน Messaging
   API จากหน้า OA Manager ก่อน (Settings → Messaging API → Enable)
3. ในหน้า Channel (LINE Developers Console) แท็บ **Messaging API**:
   - คัดลอก **Channel access token** (กด Issue ถ้ายังไม่มี) → เก็บไว้ใช้ขั้นตอนถัดไป
   - ตั้ง **Webhook URL** เป็น Web App URL เดียวกับขั้นตอนที่ 3 (ลงท้ายด้วย `/exec`) → กด Verify
     (ควรขึ้นสำเร็จ) → เปิดสวิตช์ **Use webhook**
   - ปิดสวิตช์ **Auto-reply messages** และ **Greeting messages** ได้ (ไม่จำเป็นสำหรับระบบนี้)
4. กลับไปที่ Apps Script editor → เมนูซ้าย ⚙️ **Project Settings** → เลื่อนลงไปที่
   **Script Properties** → Add script property:
   - Property: `LINE_CHANNEL_ACCESS_TOKEN`
   - Value: (วาง Channel access token ที่คัดลอกไว้)
   - กด Save script properties

## ขั้นตอนที่ 7 — ให้พยาบาลเชื่อมบัญชี LINE

1. Admin ล็อกอินเข้าเว็บ (`index.html`) → เมนู **จัดการระบบ → บัญชีผู้ใช้งาน**
2. แต่ละคนที่ยังไม่เชื่อม LINE จะเห็น "รหัส: XXXXXX" (6 หลัก) ในตาราง
3. บอกพยาบาลให้:
   - สแกน QR code เพิ่มเพื่อนของ LINE OA (หาได้จาก LINE Official Account Manager →
     Home → QR code) หรือแอดมินแชร์ลิงก์เพิ่มเพื่อนให้
   - พิมพ์ส่งรหัส 6 หลักของตัวเองเป็นข้อความคุยกับ OA
   - LINE OA จะตอบกลับยืนยันทันทีว่าเชื่อมบัญชีสำเร็จ และสถานะในตาราง admin จะเปลี่ยนเป็น
     "เชื่อมแล้ว"

## ขั้นตอนที่ 8 — ทดสอบระบบ

1. เปิดเว็บ GitHub Pages → ล็อกอิน admin (PIN `0000`) → ตั้งค่าเตียง/แบบประเมิน/บัญชีพยาบาลจริง
   ที่เมนู "จัดการระบบ" → พิมพ์ QR ที่หน้า "เตียง & QR Code" ไปติดหัวเตียง
2. ล็อกอินด้วยบัญชีพยาบาล (PIN `1234` สำหรับบัญชีตัวอย่าง) → เปิดลิงก์ QR (หรือ
   `checkin.html?bed=ICU-01`) → ทำแบบประเมิน → Check-in
3. รอถึงเวลาพลิกตัว (หรือแก้ค่า `turnIntervalMinutes` ในแบบประเมินให้สั้นๆ เช่น 1-2 นาทีเพื่อ
   ทดสอบ) → ควรได้รับข้อความ LINE แจ้งเตือน และถ้าเปิดแท็บ "เตียงของฉัน"/"แดชบอร์ด" ค้างไว้จะมี
   เสียงเตือน + ป้ายสีแดงขึ้นทันทีที่เลยเวลา

---

## ข้อจำกัด / สิ่งที่ควรรู้

- **ความถี่การเช็คแจ้งเตือน**: Apps Script time-driven trigger ละเอียดสุดคือทุก 1 นาที (ตั้งไว้
  แล้วใน `setup()`) จึงอาจคลาดเคลื่อนได้ไม่เกิน ~1 นาทีจากเวลาที่กำหนดจริง
- **Apps Script quota**: บัญชี Google ส่วนบุคคล/Workspace ฟรี มีโควต้าการรันสคริปต์ต่อวันจำกัด
  (ปกติเพียงพอสำหรับหน่วยงานขนาดเล็ก-กลาง) และ URL Fetch (เรียก LINE API) มีโควต้าต่อวันเช่นกัน —
  ถ้าจำนวนเตียง/การแจ้งเตือนต่อวันสูงมาก ควรพิจารณาอัปเกรด Google Workspace หรือย้ายไประบบที่มี
  เซิร์ฟเวอร์ของตัวเอง (เช่นระบบ Next.js ในโฟลเดอร์ `src/`)
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
