"use client";

import { useState } from "react";
import { subscribeToPush } from "@/lib/push-client";

export default function NotificationSetup() {
  const [status, setStatus] = useState<
    "idle" | "subscribed" | "unsupported" | "denied" | "no-key" | "loading"
  >("idle");

  async function handleEnable() {
    setStatus("loading");
    const result = await subscribeToPush();
    setStatus(result);
  }

  if (status === "subscribed") {
    return <p className="text-sm text-risk-low">✓ เปิดการแจ้งเตือนแล้ว จะแจ้งเตือนเมื่อถึงเวลาพลิกตัว</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={handleEnable} disabled={status === "loading"} className="btn-secondary">
        🔔 เปิดการแจ้งเตือนเมื่อครบเวลาพลิกตัว
      </button>
      {status === "denied" && (
        <span className="text-xs text-red-600">
          เบราว์เซอร์ปฏิเสธการแจ้งเตือน กรุณาอนุญาตในตั้งค่าเบราว์เซอร์
        </span>
      )}
      {status === "unsupported" && (
        <span className="text-xs text-slate-500">เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Push</span>
      )}
      {status === "no-key" && (
        <span className="text-xs text-slate-500">ยังไม่ได้ตั้งค่า VAPID key (ดู README)</span>
      )}
    </div>
  );
}
