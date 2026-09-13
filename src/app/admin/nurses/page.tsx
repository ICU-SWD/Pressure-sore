"use client";

import { useEffect, useState } from "react";
import AdminTabs from "@/components/AdminTabs";

type StaffUser = { id: string; name: string; role: "ADMIN" | "NURSE"; active: boolean };

export default function AdminNursesPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", role: "NURSE" as "NURSE" | "ADMIN", pin: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/nurses");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/nurses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setForm({ name: "", role: "NURSE", pin: "" });
    load();
  }

  async function toggleActive(u: StaffUser) {
    await fetch(`/api/admin/nurses/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    load();
  }

  async function resetPin(u: StaffUser) {
    const pin = prompt(`ตั้งรหัส PIN ใหม่สำหรับ ${u.name} (อย่างน้อย 4 หลัก)`);
    if (!pin || pin.length < 4) return;
    await fetch(`/api/admin/nurses/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">จัดการระบบ</h1>
      <AdminTabs active="nurses" />

      <form onSubmit={addUser} className="card grid gap-3 p-5 sm:grid-cols-4">
        <input
          className="input"
          placeholder="ชื่อ-นามสกุล"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <select
          className="input"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "NURSE" | "ADMIN" }))}
        >
          <option value="NURSE">พยาบาล</option>
          <option value="ADMIN">ผู้ดูแลระบบ</option>
        </select>
        <input
          className="input"
          placeholder="PIN (อย่างน้อย 4 หลัก)"
          value={form.pin}
          onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
        />
        <button className="btn-primary" type="submit">
          + เพิ่มผู้ใช้งาน
        </button>
        {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      </form>

      {loading ? (
        <p className="text-slate-500">กำลังโหลด...</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">ชื่อ</th>
                <th className="px-4 py-3">บทบาท</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3">{u.role === "ADMIN" ? "ผู้ดูแลระบบ" : "พยาบาล"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.active ? "bg-risk-low" : "bg-slate-400"}`}>
                      {u.active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button className="text-brand-600 hover:underline" onClick={() => resetPin(u)}>
                      ตั้ง PIN ใหม่
                    </button>
                    <button className="text-slate-500 hover:underline" onClick={() => toggleActive(u)}>
                      {u.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
