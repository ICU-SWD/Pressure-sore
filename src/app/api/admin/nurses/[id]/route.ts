import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPin } from "@/lib/pin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") data.name = body.name.trim();
  if (typeof body?.active === "boolean") data.active = body.active;
  if (typeof body?.pin === "string" && body.pin.length >= 4) data.pinHash = hashPin(body.pin);

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, role: true, active: true },
  });
  return NextResponse.json({ user });
}
