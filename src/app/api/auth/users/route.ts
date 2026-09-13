import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public (pre-login) list of active staff for the login screen's name picker.
// Only exposes id/name/role — never PIN hashes.
export async function GET() {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ users });
}
