import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bed = await prisma.bed.findUnique({ where: { code: params.code } });
  if (!bed) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const activeCheckIn = await prisma.checkIn.findFirst({
    where: { bedId: bed.id, status: "ACTIVE" },
    include: { nurse: { select: { id: true, name: true } }, assessment: true },
    orderBy: { startedAt: "desc" },
  });

  const latestAssessment = await prisma.assessment.findFirst({
    where: { bedId: bed.id },
    orderBy: { createdAt: "desc" },
    include: { nurse: { select: { name: true } } },
  });

  return NextResponse.json({
    bed,
    activeCheckIn,
    latestAssessment,
  });
}
