import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPin } from "@/lib/pin";

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, active: true, createdAt: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = body?.role === "ADMIN" ? "ADMIN" : "NURSE";
  const pin = typeof body?.pin === "string" && body.pin.length >= 4 ? body.pin : null;

  if (!name || !pin) {
    return NextResponse.json({ error: "กรุณาระบุชื่อและ PIN อย่างน้อย 4 หลัก" }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: { name, role, pinHash: hashPin(pin) },
    select: { id: true, name: true, role: true, active: true },
  });
  return NextResponse.json({ user });
}
