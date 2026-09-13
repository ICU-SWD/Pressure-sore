import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const templates = await prisma.checklistTemplate.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    templates: templates.map((t) => ({
      ...t,
      items: JSON.parse(t.itemsJson),
      rules: JSON.parse(t.rulesJson),
    })),
  });
}

// Publishing a new template deactivates the previous one but keeps it (and
// every Assessment that referenced it) intact for historical accuracy.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const items = Array.isArray(body?.items) ? body.items : null;
  const rules = Array.isArray(body?.rules) ? body.rules : null;

  if (!name || !items || items.length === 0 || !rules || rules.length === 0) {
    return NextResponse.json({ error: "กรุณาระบุชื่อ, รายการประเมิน, และเกณฑ์คะแนนอย่างน้อย 1 รายการ" }, { status: 400 });
  }

  await prisma.checklistTemplate.updateMany({ where: { isActive: true }, data: { isActive: false } });

  const template = await prisma.checklistTemplate.create({
    data: {
      name,
      itemsJson: JSON.stringify(items),
      rulesJson: JSON.stringify(rules),
      isActive: true,
    },
  });

  return NextResponse.json({ template });
}
