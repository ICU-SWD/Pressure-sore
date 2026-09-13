"use client";

import { useEffect, useState } from "react";
import AdminTabs from "@/components/AdminTabs";

type Bed = {
  id: string;
  code: string;
  label: string;
  ward: string | null;
  patientName: string | null;
  patientHn: string | null;
  active: boolean;
};

export default function AdminBedsPage() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", label: "", ward: "ICU" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/beds");
    const data = await res.json();
    setBeds(data.beds ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addBed(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/beds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setForm({ code: "", label: "", ward: form.ward });
    load();
  }

  async function updatePatient(bed: Bed, patientName: string, patientHn: string) {
    await fetch(`/api/admin/beds/${bed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientName: patientName || null, patientHn: patientHn || null }),
    });
    load();
  }

  async function deactivate(bed: Bed) {
    await fetch(`/api/admin/beds/${bed.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">จัดการระบบ</h1>
      <AdminTabs active="beds" />

      <form onSubmit={addBed} className="card grid gap-3 p-5 sm:grid-cols-4">
        <input
          className="input"
          placeholder="รหัสเตียง เช่น ICU-07"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <input
          className="input"
          placeholder="ชื่อเตียง เช่น เตียง 7"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
        />
        <input
          className="input"
          placeholder="วอร์ด"
          value={form.ward}
          onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
        />
        <button className="btn-primary" type="submit">
          + เพิ่มเตียง
        </button>
        {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      </form>

      {loading ? (
        <p className="text-slate-500">กำลังโหลด...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {beds.map((bed) => (
            <BedCard key={bed.id} bed={bed} onSavePatient={updatePatient} onDeactivate={deactivate} />
          ))}
        </div>
      )}
    </div>
  );
}

function BedCard({
  bed,
  onSavePatient,
  onDeactivate,
}: {
  bed: Bed;
  onSavePatient: (bed: Bed, name: string, hn: string) => void;
  onDeactivate: (bed: Bed) => void;
}) {
  const [name, setName] = useState(bed.patientName ?? "");
  const [hn, setHn] = useState(bed.patientHn ?? "");

  return (
    <div className={`card space-y-3 p-4 ${!bed.active ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{bed.label}</h3>
          <p className="text-xs text-slate-500">
            {bed.code} {bed.ward ? `· ${bed.ward}` : ""}
          </p>
        </div>
        {bed.active && (
          <button className="text-xs text-red-500" onClick={() => onDeactivate(bed)}>
            ปิดใช้งาน
          </button>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/qrcode?code=${encodeURIComponent(bed.code)}`} alt={`QR ${bed.code}`} className="mx-auto h-40 w-40" />
      <div className="space-y-2">
        <input className="input" placeholder="ชื่อผู้ป่วย" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="HN" value={hn} onChange={(e) => setHn(e.target.value)} />
        <button className="btn-secondary w-full" onClick={() => onSavePatient(bed, name, hn)}>
          บันทึกข้อมูลผู้ป่วย
        </button>
        <a
          className="btn-secondary block w-full text-center"
          href={`/api/qrcode?code=${encodeURIComponent(bed.code)}`}
          target="_blank"
          rel="noreferrer"
        >
          🖨️ เปิดเพื่อพิมพ์
        </a>
      </div>
    </div>
  );
}
