import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// End a check-in (end of shift / patient discharged / handover elsewhere).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const checkIn = await prisma.checkIn.findUnique({ where: { id: params.id } });
  if (!checkIn || checkIn.status !== "ACTIVE") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await prisma.checkIn.update({
    where: { id: checkIn.id },
    data: { status: "ENDED", endedAt: new Date() },
  });

  return NextResponse.json({ checkIn: updated });
}
