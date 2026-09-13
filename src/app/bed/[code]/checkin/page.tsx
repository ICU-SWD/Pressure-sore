"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CountdownBadge from "@/components/CountdownBadge";
import NotificationSetup from "@/components/NotificationSetup";
import { matchRiskRule, type ChecklistItem, type RiskRule } from "@/lib/checklist";
import { formatThaiDateTime } from "@/lib/time";

type Bed = {
  id: string;
  code: string;
  label: string;
  ward: string | null;
  patientName: string | null;
  patientHn: string | null;
};

type Assessment = {
  id: string;
  totalScore: number;
  riskLevel: string;
  riskColor: string;
  turnIntervalMinutes: number;
  createdAt: string;
  nurse?: { name: string };
};

type ActiveCheckIn = {
  id: string;
  nextDueAt: string;
  turnIntervalMinutes: number;
  nurse: { id: string; name: string };
  assessment: Assessment | null;
};

export default function BedCheckInPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code;

  const [bed, setBed] = useState<Bed | null>(null);
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null);
  const [latestAssessment, setLatestAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"choose" | "form">("choose");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/beds/${code}`);
    if (res.ok) {
      const data = await res.json();
      setBed(data.bed);
      setActiveCheckIn(data.activeCheckIn);
      setLatestAssessment(data.latestAssessment);
    } else {
      setError("ไม่พบเตียงนี้ในระบบ");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/templates/active")
      .then((r) => r.json())
      .then((data) => {
        if (data.template) {
          setItems(data.template.items);
          setRules(data.template.rules);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const preview = useMemo(() => {
    if (items.length === 0) return null;
    const total = items.reduce((sum, item) => {
      const idx = answers[item.id];
      const opt = item.options[idx];
      return sum + (opt?.score ?? 0);
    }, 0);
    const answeredAll = items.every((i) => answers[i.id] !== undefined);
    const rule = answeredAll && rules.length > 0 ? matchRiskRule(rules, total) : null;
    return { total, rule, answeredAll };
  }, [answers, items, rules]);

  async function submitCheckIn(payload: { mode: "new" | "reuse"; answers?: Record<string, number>; reuseAssessmentId?: string }) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedCode: code, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      router.push("/my-beds");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTurnNow() {
    if (!activeCheckIn) return;
    await fetch(`/api/checkins/${activeCheckIn.id}/turn`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    load();
  }

  if (loading) return <p className="text-slate-500">กำลังโหลด...</p>;
  if (!bed) return <p className="text-red-600">{error ?? "ไม่พบเตียง"}</p>;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{bed.label}</h1>
            <p className="text-sm text-slate-500">
              รหัสเตียง {bed.code} {bed.ward ? `· ${bed.ward}` : ""}
            </p>
            {bed.patientName && (
              <p className="mt-1 text-sm">
                ผู้ป่วย: <span className="font-medium">{bed.patientName}</span>{" "}
                {bed.patientHn && <span className="text-slate-500">({bed.patientHn})</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {activeCheckIn && (
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">กำลังดูแลอยู่โดย {activeCheckIn.nurse.name}</h2>
          <div className="flex items-center gap-2">
            <CountdownBadge nextDueAt={activeCheckIn.nextDueAt} />
            <span className="text-sm text-slate-500">
              ทุก {activeCheckIn.turnIntervalMinutes} นาที
            </span>
          </div>
          {activeCheckIn.assessment && (
            <RiskBadge assessment={activeCheckIn.assessment} />
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <button className="btn-primary" onClick={handleTurnNow}>
              ✅ พลิกตัวแล้ว (รีเซ็ตเวลา)
            </button>
            <button
              className="btn-secondary"
              onClick={async () => {
                await fetch(`/api/checkins/${activeCheckIn.id}/end`, { method: "POST" });
                load();
              }}
            >
              สิ้นสุดการดูแล
            </button>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-1 text-xs text-slate-500">มาสแกนต่อ / เปลี่ยนเวร? เริ่มดูแลใหม่ได้ด้านล่าง</p>
          </div>
        </div>
      )}

      {!activeCheckIn && mode === "choose" && (
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">Check in เริ่มดูแลเตียงนี้</h2>
          {latestAssessment ? (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm">ผลประเมินล่าสุด:</p>
              <RiskBadge assessment={latestAssessment} />
              <p className="mt-1 text-xs text-slate-500">
                ประเมินโดย {latestAssessment.nurse?.name} เมื่อ {formatThaiDateTime(latestAssessment.createdAt)}
              </p>
              <button
                className="btn-primary mt-3"
                disabled={submitting}
                onClick={() => submitCheckIn({ mode: "reuse", reuseAssessmentId: latestAssessment.id })}
              >
                ใช้ผลประเมินนี้ &amp; Check in
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">ยังไม่มีผลประเมินก่อนหน้าสำหรับเตียงนี้</p>
          )}
          <button className="btn-secondary" onClick={() => setMode("form")}>
            📋 ทำแบบประเมินใหม่
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {!activeCheckIn && mode === "form" && (
        <div className="card space-y-5 p-5">
          <h2 className="font-semibold">แบบประเมินความเสี่ยงแผลกดทับ</h2>
          {items.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีแบบประเมินที่ Admin ตั้งค่าไว้</p>}
          {items.map((item) => (
            <fieldset key={item.id} className="space-y-2">
              <legend className="text-sm font-medium">{item.question}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {item.options.map((opt, idx) => (
                  <label
                    key={idx}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                      answers[item.id] === idx ? "border-brand-500 bg-brand-50" : "border-slate-200"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <input
                      type="radio"
                      className="sr-only"
                      name={item.id}
                      checked={answers[item.id] === idx}
                      onChange={() => setAnswers((a) => ({ ...a, [item.id]: idx }))}
                    />
                    <span className="ml-2 text-xs text-slate-400">{opt.score}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {preview && preview.answeredAll && preview.rule && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              คะแนนรวม {preview.total} →{" "}
              <span className="badge" style={{ backgroundColor: preview.rule.color }}>
                {preview.rule.label}
              </span>{" "}
              (พลิกตัวทุก {preview.rule.turnIntervalMinutes} นาที)
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setMode("choose")}>
              ย้อนกลับ
            </button>
            <button
              className="btn-primary"
              disabled={!preview?.answeredAll || submitting}
              onClick={() => submitCheckIn({ mode: "new", answers })}
            >
              บันทึก &amp; Check in
            </button>
          </div>
        </div>
      )}

      <div className="card p-5">
        <NotificationSetup />
      </div>
    </div>
  );
}

function RiskBadge({ assessment }: { assessment: Assessment }) {
  return (
    <span className="badge" style={{ backgroundColor: assessment.riskColor }}>
      คะแนน {assessment.totalScore} · {assessment.riskLevel} · ทุก {assessment.turnIntervalMinutes} นาที
    </span>
  );
}
