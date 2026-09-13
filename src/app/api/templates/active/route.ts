import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const template = await prisma.checklistTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!template) return NextResponse.json({ template: null });

  return NextResponse.json({
    template: {
      id: template.id,
      name: template.name,
      items: JSON.parse(template.itemsJson),
      rules: JSON.parse(template.rulesJson),
    },
  });
}
