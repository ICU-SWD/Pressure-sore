function formatClock(totalSeconds) {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const parts = h > 0 ? [h, m, s] : [m, s];
  return sign + parts.map((p) => String(p).padStart(2, "0")).join(":");
}

function formatThaiDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

// Renders a live-updating countdown badge into `el`, given an ISO due time.
// Plays a short beep (Web Audio, no asset file needed) the moment it first
// goes overdue — this is the "alert while this tab is open" notification
// channel that doesn't depend on LINE/push.
function mountCountdown(el, nextDueAtIso, opts) {
  opts = opts || {};
  let alerted = false;

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      osc.onended = () => ctx.close();
    } catch (e) {
      /* ignore — some browsers block audio until user interaction */
    }
  }

  function tick() {
    const seconds = Math.round((new Date(nextDueAtIso).getTime() - Date.now()) / 1000);
    const overdue = seconds <= 0;
    const soon = !overdue && seconds <= 5 * 60;
    el.textContent = overdue ? `เลยเวลา ${formatClock(seconds)}` : `เหลือ ${formatClock(seconds)}`;
    el.className = "badge " + (overdue ? "badge-severe" : soon ? "badge-high" : "badge-low");
    if (overdue && !alerted) {
      alerted = true;
      if (opts.alertSound !== false) beep();
      if (opts.onOverdue) opts.onOverdue();
    }
  }

  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
