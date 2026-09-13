import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { verifyPin } from "@/lib/pin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const pin = typeof body?.pin === "string" ? body.pin : null;

  if (!userId || !pin) {
    return NextResponse.json({ error: "กรุณาเลือกชื่อและกรอกรหัส PIN" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (
    !user ||
    !user.active ||
    !verifyPin(pin, user.pinHash) ||
    (user.role !== "ADMIN" && user.role !== "NURSE")
  ) {
    return NextResponse.json({ error: "รหัส PIN ไม่ถูกต้อง" }, { status: 401 });
  }

  const token = await createSessionToken({ userId: user.id, name: user.name, role: user.role });

  const res = NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
