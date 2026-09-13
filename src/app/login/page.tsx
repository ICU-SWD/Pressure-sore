"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type StaffUser = { id: string; name: string; role: "ADMIN" | "NURSE" };

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!userId) {
      setError("กรุณาเลือกชื่อผู้ใช้งาน");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-2">
      <div className="mb-6 text-center">
        <div className="text-4xl">🛡️</div>
        <h1 className="mt-2 text-xl font-bold">Pressure Sore Guard</h1>
        <p className="text-sm text-slate-500">ระบบป้องกันแผลกดทับ ICU</p>
      </div>
      <form onSubmit={handleSubmit} className="card space-y-4 p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">ชื่อผู้ใช้งาน</label>
          <select
            className="input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">-- เลือกชื่อ --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.role === "ADMIN" ? "(ผู้ดูแลระบบ)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">รหัส PIN</label>
          <input
            className="input tracking-[0.5em]"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-400">
        บัญชีตัวอย่าง (seed): พยาบาล PIN 1234 · admin PIN 0000
      </p>
    </div>
  );
}
