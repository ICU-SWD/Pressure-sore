import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const key of ["label", "ward", "patientName", "patientHn", "active"] as const) {
    if (key in body) data[key] = body[key];
  }
  const bed = await prisma.bed.update({ where: { id: params.id }, data });
  return NextResponse.json({ bed });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.bed.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
