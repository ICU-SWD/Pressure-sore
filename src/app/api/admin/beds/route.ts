import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const beds = await prisma.bed.findMany({ orderBy: { code: "asc" } });
  return NextResponse.json({ beds });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!code || !label) {
    return NextResponse.json({ error: "กรุณาระบุรหัสเตียงและชื่อเตียง" }, { status: 400 });
  }

  const existing = await prisma.bed.findUnique({ where: { code } });
  if (existing) return NextResponse.json({ error: "รหัสเตียงนี้มีอยู่แล้ว" }, { status: 409 });

  const bed = await prisma.bed.create({
    data: {
      code,
      label,
      ward: body?.ward || null,
      patientName: body?.patientName || null,
      patientHn: body?.patientHn || null,
    },
  });
  return NextResponse.json({ bed });
}
