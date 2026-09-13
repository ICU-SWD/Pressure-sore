import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Active check-ins for the logged-in nurse — one nurse can be checked in
// at several beds simultaneously (1:2+ nurse-to-patient ratio).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const checkIns = await prisma.checkIn.findMany({
    where: { nurseId: session.userId, status: "ACTIVE" },
    include: { bed: true, assessment: true },
    orderBy: { nextDueAt: "asc" },
  });

  return NextResponse.json({ checkIns });
}
