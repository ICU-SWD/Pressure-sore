"use client";

import { useEffect, useMemo, useState } from "react";
import CountdownBadge, { useSecondsRemaining } from "@/components/CountdownBadge";
import { formatThaiDateTime } from "@/lib/time";

type CheckIn = {
  id: string;
  bed: { code: string; label: string; ward: string | null; patientName: string | null };
  nurse: { id: string; name: string };
  assessment: { totalScore: number; riskLevel: string; riskColor: string } | null;
  turnIntervalMinutes: number;
  lastTurnedAt: string;
  nextDueAt: string;
};

type Bed = { id: string; code: string; label: string; ward: string | null };

export default function DashboardPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [emptyBeds, setEmptyBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [wardFilter, setWardFilter] = useState<string>("all");

  async function load() {
    const res = await fetch("/api/checkins/active");
    const data = await res.json();
    setCheckIns(data.checkIns ?? []);
    setEmptyBeds(data.bedsWithoutCheckIn ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  const wards = useMemo(() => {
    const set = new Set<string>();
    checkIns.forEach((c) => c.bed.ward && set.add(c.bed.ward));
    emptyBeds.forEach((b) => b.ward && set.add(b.ward));
    return Array.from(set);
  }, [checkIns, emptyBeds]);

  const filtered = wardFilter === "all" ? checkIns : checkIns.filter((c) => c.bed.ward === wardFilter);
  const filteredEmpty = wardFilter === "all" ? emptyBeds : emptyBeds.filter((b) => b.ward === wardFilter);

  const overdueCount = filtered.filter((c) => new Date(c.nextDueAt).getTime() <= Date.now()).length;
  const nurseCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((c) => map.set(c.nurse.name, (map.get(c.nurse.name) ?? 0) + 1));
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">แดชบอร์ดกลาง — ติดตามการดูแลผู้ป่วย</h1>
        {wards.length > 0 && (
          <select className="input w-auto" value={wardFilter} onChange={(e) => setWardFilter(e.target.value)}>
            <option value="all">ทุกวอร์ด</option>
            {wards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="กำลังดูแล" value={filtered.length} />
        <StatCard label="เลยเวลาพลิกตัว" value={overdueCount} danger={overdueCount > 0} />
        <StatCard label="เตียงว่าง/ยังไม่ check-in" value={filteredEmpty.length} />
        <StatCard label="พยาบาลออนดิวตี้" value={nurseCounts.length} />
      </div>

      {loading ? (
        <p className="text-slate-500">กำลังโหลด...</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">เตียง</th>
                <th className="px-4 py-3">ผู้ป่วย</th>
                <th className="px-4 py-3">พยาบาลผู้ดูแล</th>
                <th className="px-4 py-3">ความเสี่ยง</th>
                <th className="px-4 py-3">พลิกตัวล่าสุด</th>
                <th className="px-4 py-3">รอบถัดไป</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <CheckInRow key={c.id} c={c} />
              ))}
              {filteredEmpty.map((b) => (
                <tr key={b.id} className="text-slate-400">
                  <td className="px-4 py-3 font-medium">{b.label}</td>
                  <td className="px-4 py-3" colSpan={4}>
                    ยังไม่มีพยาบาล check-in
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && filteredEmpty.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={6}>
                    ไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CheckInRow({ c }: { c: CheckIn }) {
  const seconds = useSecondsRemaining(c.nextDueAt);
  const overdue = seconds <= 0;
  return (
    <tr className={overdue ? "bg-red-50" : ""}>
      <td className="px-4 py-3 font-medium">
        {c.bed.label}
        <div className="text-xs text-slate-400">{c.bed.code}</div>
      </td>
      <td className="px-4 py-3">{c.bed.patientName ?? "-"}</td>
      <td className="px-4 py-3">{c.nurse.name}</td>
      <td className="px-4 py-3">
        {c.assessment ? (
          <span className="badge" style={{ backgroundColor: c.assessment.riskColor }}>
            {c.assessment.riskLevel} ({c.assessment.totalScore})
          </span>
        ) : (
          "-"
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{formatThaiDateTime(c.lastTurnedAt)}</td>
      <td className="px-4 py-3">
        <CountdownBadge nextDueAt={c.nextDueAt} />
      </td>
    </tr>
  );
}

function StatCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
