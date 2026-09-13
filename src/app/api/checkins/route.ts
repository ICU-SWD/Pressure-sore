import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { matchRiskRule, parseItems, parseRules, scoreAnswers } from "@/lib/checklist";

// Create a new check-in (nurse scans QR at bedside). Either fills a fresh
// assessment ("new") or reuses the bed's latest assessment ("reuse") when
// the patient's condition hasn't changed since last checked.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bedCode = typeof body?.bedCode === "string" ? body.bedCode : null;
  const mode = body?.mode === "reuse" ? "reuse" : "new";
  if (!bedCode) return NextResponse.json({ error: "missing bedCode" }, { status: 400 });

  const bed = await prisma.bed.findUnique({ where: { code: bedCode } });
  if (!bed) return NextResponse.json({ error: "bed_not_found" }, { status: 404 });

  let assessmentId: string;
  let turnIntervalMinutes: number;

  if (mode === "reuse") {
    const reuseId = body?.reuseAssessmentId;
    const assessment = await prisma.assessment.findUnique({ where: { id: reuseId } });
    if (!assessment || assessment.bedId !== bed.id) {
      return NextResponse.json({ error: "assessment_not_found" }, { status: 404 });
    }
    assessmentId = assessment.id;
    turnIntervalMinutes = assessment.turnIntervalMinutes;
  } else {
    const answers = body?.answers ?? {};
    const template = await prisma.checklistTemplate.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (!template) {
      return NextResponse.json({ error: "no_active_template" }, { status: 400 });
    }
    const items = parseItems(template.itemsJson);
    const rules = parseRules(template.rulesJson);
    const totalScore = scoreAnswers(items, answers);
    const rule = matchRiskRule(rules, totalScore);

    const assessment = await prisma.assessment.create({
      data: {
        templateId: template.id,
        bedId: bed.id,
        nurseId: session.userId,
        answersJson: JSON.stringify(answers),
        totalScore,
        riskLevel: rule.label,
        riskColor: rule.color,
        turnIntervalMinutes: rule.turnIntervalMinutes,
      },
    });
    assessmentId = assessment.id;
    turnIntervalMinutes = assessment.turnIntervalMinutes;
  }

  // Handover: superseding any other active check-in on this bed.
  await prisma.checkIn.updateMany({
    where: { bedId: bed.id, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: new Date() },
  });

  const now = new Date();
  const checkIn = await prisma.checkIn.create({
    data: {
      bedId: bed.id,
      nurseId: session.userId,
      assessmentId,
      turnIntervalMinutes,
      startedAt: now,
      lastTurnedAt: now,
      nextDueAt: new Date(now.getTime() + turnIntervalMinutes * 60_000),
    },
    include: { bed: true, assessment: true },
  });

  return NextResponse.json({ checkIn });
}
