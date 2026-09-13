import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// All active check-ins across every bed — powers the central monitoring
// dashboard (head nurse / charge nurse view).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const checkIns = await prisma.checkIn.findMany({
    where: { status: "ACTIVE" },
    include: {
      bed: true,
      nurse: { select: { id: true, name: true } },
      assessment: true,
    },
    orderBy: { nextDueAt: "asc" },
  });

  const bedsWithoutCheckIn = await prisma.bed.findMany({
    where: { active: true, checkIns: { none: { status: "ACTIVE" } } },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({ checkIns, bedsWithoutCheckIn });
}
