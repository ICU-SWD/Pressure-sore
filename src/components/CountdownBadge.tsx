"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/time";

export function useSecondsRemaining(nextDueAtIso: string): number {
  const [seconds, setSeconds] = useState(() =>
    Math.round((new Date(nextDueAtIso).getTime() - Date.now()) / 1000)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(Math.round((new Date(nextDueAtIso).getTime() - Date.now()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [nextDueAtIso]);

  return seconds;
}

export default function CountdownBadge({ nextDueAt }: { nextDueAt: string }) {
  const seconds = useSecondsRemaining(nextDueAt);
  const overdue = seconds <= 0;
  const soon = !overdue && seconds <= 5 * 60;

  const color = overdue ? "bg-risk-severe" : soon ? "bg-risk-high" : "bg-risk-low";
  const label = overdue ? `เลยเวลา ${formatClock(seconds)}` : `เหลือ ${formatClock(seconds)}`;

  return <span className={`badge ${color}`}>{label}</span>;
}
