"use client";

import { useEffect, useState } from "react";
import AdminTabs from "@/components/AdminTabs";
import type { ChecklistItem, RiskRule } from "@/lib/checklist";

type Template = {
  id: string;
  name: string;
  items: ChecklistItem[];
  rules: RiskRule[];
  isActive: boolean;
  createdAt: string;
};

let uid = 0;
function nextId(prefix: string) {
  uid += 1;
  return `${prefix}-${Date.now()}-${uid}`;
}

export default function AdminChecklistPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("แบบประเมินความเสี่ยงแผลกดทับ");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/templates");
    const data = await res.json();
    setTemplates(data.templates ?? []);
    const active = (data.templates ?? []).find((t: Template) => t.isActive);
    if (active) {
      setName(active.name);
      setItems(active.items);
      setRules(active.rules);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: nextId("item"), question: "", options: [{ label: "", score: 1 }, { label: "", score: 4 }] },
    ]);
  }

  function updateItem(idx: number, patch: Partial<ChecklistItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function updateOption(itemIdx: number, optIdx: number, patch: Partial<{ label: string; score: number }>) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === itemIdx
          ? { ...it, options: it.options.map((o, j) => (j === optIdx ? { ...o, ...patch } : o)) }
          : it
      )
    );
  }

  function addOption(itemIdx: number) {
    setItems((prev) =>
      prev.map((it, i) => (i === itemIdx ? { ...it, options: [...it.options, { label: "", score: 1 }] } : it))
    );
  }

  function removeOption(itemIdx: number, optIdx: number) {
    setItems((prev) =>
      prev.map((it, i) => (i === itemIdx ? { ...it, options: it.options.filter((_, j) => j !== optIdx) } : it))
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRule() {
    setRules((prev) => [
      ...prev,
      { minScore: 0, maxScore: 0, label: "", color: "#2f6fed", turnIntervalMinutes: 120 },
    ]);
  }

  function updateRule(idx: number, patch: Partial<RiskRule>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRule(idx: number) {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  }

  async function publish() {
    setError(null);
    if (items.some((i) => !i.question.trim() || i.options.some((o) => !o.label.trim()))) {
      setError("กรุณากรอกคำถามและตัวเลือกให้ครบทุกช่อง");
      return;
    }
    if (rules.some((r) => !r.label.trim())) {
      setError("กรุณากรอกชื่อระดับความเสี่ยงให้ครบทุกเกณฑ์");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items, rules }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">กำลังโหลด...</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">จัดการระบบ</h1>
      <AdminTabs active="checklist" />

      <p className="text-sm text-slate-500">
        กำหนดรายการประเมิน (Checklist) และคะแนนเพื่อจัดระดับความเสี่ยง → กำหนดรอบเวลาพลิกตัวอัตโนมัติ
        การบันทึกจะสร้างเวอร์ชันใหม่และตั้งเป็นแบบประเมินที่ใช้งานอยู่ (แบบเดิมยังเก็บประวัติไว้)
      </p>

      <div className="card space-y-4 p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">ชื่อแบบประเมิน</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold">รายการประเมิน</h2>
          {items.map((item, idx) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  placeholder="คำถาม เช่น การเคลื่อนไหวร่างกาย"
                  value={item.question}
                  onChange={(e) => updateItem(idx, { question: e.target.value })}
                />
                <button className="text-xs text-red-500" onClick={() => removeItem(idx)}>
                  ลบ
                </button>
              </div>
              <div className="space-y-1">
                {item.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <input
                      className="input"
                      placeholder="ข้อความตัวเลือก"
                      value={opt.label}
                      onChange={(e) => updateOption(idx, optIdx, { label: e.target.value })}
                    />
                    <input
                      className="input w-20"
                      type="number"
                      value={opt.score}
                      onChange={(e) => updateOption(idx, optIdx, { score: Number(e.target.value) })}
                    />
                    <button className="text-xs text-red-500" onClick={() => removeOption(idx, optIdx)}>
                      ลบ
                    </button>
                  </div>
                ))}
                <button className="text-xs text-brand-600" onClick={() => addOption(idx)}>
                  + เพิ่มตัวเลือก
                </button>
              </div>
            </div>
          ))}
          <button className="btn-secondary" onClick={addItem}>
            + เพิ่มรายการประเมิน
          </button>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold">เกณฑ์คะแนน → ระดับความเสี่ยง → รอบเวลาพลิกตัว</h2>
          {rules.map((rule, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-6">
              <input
                className="input"
                type="number"
                placeholder="คะแนนต่ำสุด"
                value={rule.minScore}
                onChange={(e) => updateRule(idx, { minScore: Number(e.target.value) })}
              />
              <input
                className="input"
                type="number"
                placeholder="คะแนนสูงสุด"
                value={rule.maxScore}
                onChange={(e) => updateRule(idx, { maxScore: Number(e.target.value) })}
              />
              <input
                className="input"
                placeholder="ชื่อระดับ"
                value={rule.label}
                onChange={(e) => updateRule(idx, { label: e.target.value })}
              />
              <input
                className="input"
                type="color"
                value={rule.color}
                onChange={(e) => updateRule(idx, { color: e.target.value })}
              />
              <input
                className="input"
                type="number"
                placeholder="ทุกกี่นาที"
                value={rule.turnIntervalMinutes}
                onChange={(e) => updateRule(idx, { turnIntervalMinutes: Number(e.target.value) })}
              />
              <button className="text-xs text-red-500" onClick={() => removeRule(idx)}>
                ลบ
              </button>
            </div>
          ))}
          <button className="btn-secondary" onClick={addRule}>
            + เพิ่มเกณฑ์
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary" disabled={saving} onClick={publish}>
          {saving ? "กำลังบันทึก..." : "บันทึก & เผยแพร่แบบประเมินนี้"}
        </button>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 font-semibold">ประวัติแบบประเมิน</h2>
        <ul className="space-y-1 text-sm">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              {t.isActive && <span className="badge bg-brand-500">ใช้งานอยู่</span>}
              <span>{t.name}</span>
              <span className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleString("th-TH")}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
