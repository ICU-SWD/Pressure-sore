"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CountdownBadge from "@/components/CountdownBadge";
import NotificationSetup from "@/components/NotificationSetup";
import { formatThaiDateTime } from "@/lib/time";

type Bed = { code: string; label: string; ward: string | null; patientName: string | null };
type Assessment = { totalScore: number; riskLevel: string; riskColor: string };
type CheckIn = {
  id: string;
  bed: Bed;
  assessment: Assessment | null;
  turnIntervalMinutes: number;
  startedAt: string;
  lastTurnedAt: string;
  nextDueAt: string;
};

export default function MyBedsPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/checkins/mine");
    const data = await res.json();
    setCheckIns(data.checkIns ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  async function turnNow(id: string) {
    await fetch(`/api/checkins/${id}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    load();
  }

  async function endCheckIn(id: string) {
    await fetch(`/api/checkins/${id}/end`, { method: "POST" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">เตียงที่ฉันกำลังดูแล</h1>
        <span className="text-sm text-slate-500">{checkIns.length} เตียง</span>
      </div>

      <div className="card p-4">
        <NotificationSetup />
      </div>

      {loading && <p className="text-slate-500">กำลังโหลด...</p>}
      {!loading && checkIns.length === 0 && (
        <div className="card p-6 text-center text-slate-500">
          ยังไม่มีเตียงที่ Check in อยู่ — สแกน QR code ที่หัวเตียงเพื่อเริ่มดูแล
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {checkIns.map((c) => (
          <div key={c.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{c.bed.label}</h2>
                <p className="text-xs text-slate-500">
                  {c.bed.code} {c.bed.ward ? `· ${c.bed.ward}` : ""}
                </p>
                {c.bed.patientName && <p className="text-sm">{c.bed.patientName}</p>}
              </div>
              <CountdownBadge nextDueAt={c.nextDueAt} />
            </div>
            {c.assessment && (
              <span className="badge" style={{ backgroundColor: c.assessment.riskColor }}>
                {c.assessment.riskLevel} · ทุก {c.turnIntervalMinutes} นาที
              </span>
            )}
            <p className="text-xs text-slate-400">พลิกตัวล่าสุด {formatThaiDateTime(c.lastTurnedAt)}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-primary" onClick={() => turnNow(c.id)}>
                ✅ พลิกตัวแล้ว
              </button>
              <Link href={`/bed/${c.bed.code}/checkin`} className="btn-secondary">
                ดูรายละเอียด
              </Link>
              <button className="btn-secondary" onClick={() => endCheckIn(c.id)}>
                สิ้นสุด
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
