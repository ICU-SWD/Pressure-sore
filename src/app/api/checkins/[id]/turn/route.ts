import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Nurse confirms the patient has been turned/repositioned: logs the turn
// and resets the countdown to the next due time.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const checkIn = await prisma.checkIn.findUnique({ where: { id: params.id } });
  if (!checkIn || checkIn.status !== "ACTIVE") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : undefined;

  const now = new Date();
  const [, updated] = await prisma.$transaction([
    prisma.turnLog.create({
      data: { checkInId: checkIn.id, nurseId: session.userId, note, turnedAt: now },
    }),
    prisma.checkIn.update({
      where: { id: checkIn.id },
      data: {
        lastTurnedAt: now,
        nextDueAt: new Date(now.getTime() + checkIn.turnIntervalMinutes * 60_000),
      },
    }),
  ]);

  return NextResponse.json({ checkIn: updated });
}
