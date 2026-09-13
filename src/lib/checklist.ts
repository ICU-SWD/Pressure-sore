// Shared types + scoring logic for the admin-configurable pressure-injury
// risk checklist. Stored as JSON on ChecklistTemplate so admins can redesign
// items and the score->turn-interval mapping without a schema migration.

export type ChecklistOption = {
  label: string;
  score: number;
};

export type ChecklistItem = {
  id: string;
  question: string;
  options: ChecklistOption[];
};

export type RiskRule = {
  minScore: number;
  maxScore: number;
  label: string;
  color: string; // tailwind-safe hex, matches risk.* palette
  turnIntervalMinutes: number;
};

export type ChecklistItems = ChecklistItem[];
export type RiskRules = RiskRule[];

export function parseItems(itemsJson: string): ChecklistItems {
  return JSON.parse(itemsJson);
}

export function parseRules(rulesJson: string): RiskRules {
  return JSON.parse(rulesJson);
}

export type Answers = Record<string, number>; // itemId -> option index

export function scoreAnswers(items: ChecklistItems, answers: Answers): number {
  return items.reduce((sum, item) => {
    const optionIndex = answers[item.id];
    const option = item.options[optionIndex];
    return sum + (option?.score ?? 0);
  }, 0);
}

export function matchRiskRule(rules: RiskRules, totalScore: number): RiskRule {
  const match = rules.find((r) => totalScore >= r.minScore && totalScore <= r.maxScore);
  if (match) return match;
  // Fall back to the most conservative (lowest interval) rule if score is
  // outside every configured range, so we never silently skip monitoring.
  return rules.reduce((most, r) => (r.turnIntervalMinutes < most.turnIntervalMinutes ? r : most), rules[0]);
}

export const DEFAULT_TEMPLATE_NAME = "แบบประเมินความเสี่ยงแผลกดทับ (ตัวอย่าง)";

export const DEFAULT_ITEMS: ChecklistItems = [
  {
    id: "sensory",
    question: "การรับรู้ความรู้สึก (Sensory perception)",
    options: [
      { label: "ไม่รับรู้ความรู้สึกเลย", score: 1 },
      { label: "รับรู้ได้บางส่วน", score: 2 },
      { label: "รับรู้ได้เล็กน้อย", score: 3 },
      { label: "รับรู้ได้ปกติ", score: 4 },
    ],
  },
  {
    id: "moisture",
    question: "ความชื้นของผิวหนัง (Moisture)",
    options: [
      { label: "ชื้นตลอดเวลา", score: 1 },
      { label: "ชื้นบ่อยมาก", score: 2 },
      { label: "ชื้นเป็นครั้งคราว", score: 3 },
      { label: "แทบไม่ชื้น", score: 4 },
    ],
  },
  {
    id: "mobility",
    question: "การเคลื่อนไหวร่างกาย (Mobility)",
    options: [
      { label: "เคลื่อนไหวเองไม่ได้เลย", score: 1 },
      { label: "เคลื่อนไหวได้จำกัดมาก", score: 2 },
      { label: "เคลื่อนไหวได้จำกัดเล็กน้อย", score: 3 },
      { label: "เคลื่อนไหวได้ปกติ", score: 4 },
    ],
  },
  {
    id: "activity",
    question: "ระดับกิจกรรม (Activity)",
    options: [
      { label: "นอนติดเตียงตลอด", score: 1 },
      { label: "นั่งได้เฉพาะบนเก้าอี้", score: 2 },
      { label: "เดินได้เป็นครั้งคราว", score: 3 },
      { label: "เดินได้บ่อย", score: 4 },
    ],
  },
];

export const DEFAULT_RULES: RiskRules = [
  { minScore: 4, maxScore: 8, label: "เสี่ยงสูงมาก", color: "#dc2626", turnIntervalMinutes: 60 },
  { minScore: 9, maxScore: 12, label: "เสี่ยงสูง", color: "#ea580c", turnIntervalMinutes: 120 },
  { minScore: 13, maxScore: 15, label: "เสี่ยงปานกลาง", color: "#ca8a04", turnIntervalMinutes: 180 },
  { minScore: 16, maxScore: 16, label: "เสี่ยงต่ำ", color: "#16a34a", turnIntervalMinutes: 240 },
];
