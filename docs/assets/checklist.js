// Client-side mirror of the scoring logic in backend/Code.gs (scoreAnswers_ /
// matchRiskRule_), used only to preview the score/risk while a nurse is
// filling the form. The server recomputes and stores the authoritative value.

function scoreAnswers(items, answers) {
  return items.reduce((sum, item) => {
    const opt = item.options[answers[item.id]];
    return sum + (opt ? Number(opt.score) || 0 : 0);
  }, 0);
}

function matchRiskRule(rules, totalScore) {
  const match = rules.find((r) => totalScore >= r.minScore && totalScore <= r.maxScore);
  if (match) return match;
  return rules.reduce((most, r) => (r.turnIntervalMinutes < most.turnIntervalMinutes ? r : most), rules[0]);
}
