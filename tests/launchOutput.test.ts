import { describe, expect, it } from "vitest";
import {
  extractNumberedSections,
  getEnglishPlanText,
  getReadablePlanText,
  getRussianPlanText
} from "../src/shared/launchOutput";

describe("Launch output parsing", () => {
  it("extracts marker-based readable plan blocks without showing markers", () => {
    const output = `ENGLISH_PLAN_START
1. Priority plan
Ship the launch in stages.

2. Risk register
Risk: unclear rollback.
ENGLISH_PLAN_END

RUSSIAN_PLAN_START
1. Приоритетный план
Запустить релиз по этапам.

2. Реестр рисков
Риск: неясный rollback.
RUSSIAN_PLAN_END`;

    expect(getEnglishPlanText(output)).toContain("Ship the launch in stages.");
    expect(getEnglishPlanText(output)).not.toContain("ENGLISH_PLAN");
    expect(getRussianPlanText(output)).toContain("Запустить релиз по этапам.");
    expect(getRussianPlanText(output)).not.toContain("RUSSIAN_PLAN");
  });

  it("extracts marked English and Russian readable plan blocks", () => {
    const output = `ENGLISH_PLAN
\`\`\`markdown
1. Priority plan
Ship the launch in stages.

2. Risk register
Risk: unclear rollback.

3. Owner checklist
Engineering Lead: verify rollback.

4. Launch copy
Internal note.

5. Follow-up questions
Who owns support?
\`\`\`

RUSSIAN_PLAN
\`\`\`markdown
1. Приоритетный план
Запустить релиз по этапам.

2. Реестр рисков
Риск: неясный rollback.

3. Чеклист ответственных
Engineering Lead: проверить rollback.

4. Тексты для запуска
Внутреннее сообщение.

5. Уточняющие вопросы
Кто отвечает за поддержку?
\`\`\`

TASK_CARDS_JSON
\`\`\`json
{"tasks":[]}
\`\`\``;

    expect(getEnglishPlanText(output)).toContain("Ship the launch in stages.");
    expect(getRussianPlanText(output)).toContain("Запустить релиз по этапам.");
    expect(getReadablePlanText(output)).toBe("");
  });

  it("cleans code fences from streamed legacy blocks and extracted sections", () => {
    const output = `RUSSIAN_PLAN
\`\`\`markdown
1. Приоритетный план
Запустить релиз.

2. Реестр рисков
Риск: неясный rollback.

3. Чеклист ответственных
Engineering Lead: проверить rollback.
\`\`\``;

    const russianPlan = getRussianPlanText(output);
    const risks = extractNumberedSections(russianPlan, [2, 3]);

    expect(russianPlan).not.toContain("```");
    expect(risks).toContain("2. Реестр рисков");
    expect(risks).toContain("3. Чеклист ответственных");
    expect(risks).not.toContain("```");
  });

  it("falls back to unmarked output and extracts sections 2, 3, and 5", () => {
    const output = `1. Priority plan
Do the launch.

2. Risk register
Risk details.

3. Owner checklist
Owner details.

4. Launch copy
Copy details.

5. Follow-up questions
Question details.`;

    const plan = getEnglishPlanText(output);
    const russianFallback = getRussianPlanText(output);
    const readiness = extractNumberedSections(plan, [2, 3, 5]);

    expect(plan).toContain("4. Launch copy");
    expect(russianFallback).toContain("1. Приоритетный план");
    expect(readiness).toContain("2. Risk register");
    expect(readiness).toContain("3. Owner checklist");
    expect(readiness).toContain("5. Follow-up questions");
    expect(readiness).not.toContain("4. Launch copy");
  });
});
