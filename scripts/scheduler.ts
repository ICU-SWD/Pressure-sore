// Background worker: polls for check-ins whose turning time is due and
// pushes a Web Push reminder to the assigned nurse's device(s).
//
// Run alongside `npm run dev` / `npm run start`:
//   npm run scheduler
//
// In production this would run as a long-lived worker process or a
// scheduled job (e.g. every 20-30s) triggered by your infra's cron/queue.

import { PrismaClient } from "@prisma/client";
import webpush from "web-push";

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = 20_000;
const OVERDUE_GRACE_MS = 10 * 60_000; // escalate 10 min after due time

type NotificationType = "DUE" | "OVERDUE";

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    console.warn(
      "[scheduler] VAPID keys are not set. Run `npm run generate:vapid` and add the keys to .env. " +
        "Push notifications will be skipped until then."
    );
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function notifyNurse(userId: string, payload: Record<string, unknown>) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        // Subscription expired/unsubscribed — clean it up.
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error("[scheduler] push send failed:", err?.message ?? err);
      }
    }
  }
}

async function tick(pushEnabled: boolean) {
  const now = new Date();

  const dueCheckIns = await prisma.checkIn.findMany({
    where: { status: "ACTIVE", nextDueAt: { lte: now } },
    include: {
      bed: true,
      nurse: true,
      notificationLogs: { orderBy: { sentAt: "desc" }, take: 5 },
    },
  });

  for (const checkIn of dueCheckIns) {
    const logsSinceLastTurn = checkIn.notificationLogs.filter(
      (l) => l.sentAt >= checkIn.lastTurnedAt
    );
    const dueSent = logsSinceLastTurn.some((l) => l.type === "DUE");
    const overdueSent = logsSinceLastTurn.some((l) => l.type === "OVERDUE");
    const msPastDue = now.getTime() - checkIn.nextDueAt.getTime();

    let typeToSend: NotificationType | null = null;
    if (!dueSent) {
      typeToSend = "DUE";
    } else if (!overdueSent && msPastDue >= OVERDUE_GRACE_MS) {
      typeToSend = "OVERDUE";
    }

    if (!typeToSend) continue;

    console.log(
      `[scheduler] ${typeToSend} reminder -> ${checkIn.nurse.name} for ${checkIn.bed.label} (${checkIn.bed.code})`
    );

    if (pushEnabled) {
      const title =
        typeToSend === "OVERDUE"
          ? `เลยเวลาพลิกตัว! ${checkIn.bed.label}`
          : `ถึงเวลาพลิกตัวผู้ป่วย ${checkIn.bed.label}`;
      await notifyNurse(checkIn.nurseId, {
        title,
        body: checkIn.bed.patientName
          ? `ผู้ป่วย: ${checkIn.bed.patientName} (${checkIn.bed.ward ?? ""})`
          : `เตียง ${checkIn.bed.code}`,
        url: "/my-beds",
        checkInId: checkIn.id,
        urgency: typeToSend,
      });
    }

    await prisma.notificationLog.create({
      data: { checkInId: checkIn.id, type: typeToSend },
    });
  }
}

async function main() {
  const pushEnabled = configureWebPush();
  console.log(`[scheduler] started, polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Run once immediately, then on an interval.
  await tick(pushEnabled).catch((e) => console.error("[scheduler] tick failed:", e));
  setInterval(() => {
    tick(pushEnabled).catch((e) => console.error("[scheduler] tick failed:", e));
  }, POLL_INTERVAL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
