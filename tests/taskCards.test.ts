import { describe, expect, it } from "vitest";
import {
  parseLaunchTaskCards,
  stripLaunchTaskCardsBlock,
  totalLaunchTaskHours
} from "../src/shared/taskCards";

describe("Launch task card parsing", () => {
  it("extracts bilingual task cards and totals from the LLM output block", () => {
    const output = `Priority plan

TASK_CARDS_JSON
\`\`\`json
{
  "tasks": [
    {
      "id": "T1",
      "titleRu": "Зафиксировать границы релиза",
      "titleEn": "Lock release boundaries",
      "descriptionRu": "Описать v1 ограничения и метрики успеха.",
      "descriptionEn": "Document v1 limits and success metrics.",
      "humanHours": 3,
      "agentHours": 1.5,
      "estimateBasisRu": "Один владелец фиксирует нарратив и метрики.",
      "estimateBasisEn": "One owner locks narrative and metrics."
    },
    {
      "id": "T2",
      "titleRu": "Подготовить запуск",
      "titleEn": "Prepare launch",
      "descriptionRu": "Собрать чеклист владельцев.",
      "descriptionEn": "Assemble the owner checklist.",
      "humanHours": 5,
      "agentHours": 2,
      "estimateBasisRu": "Нужно собрать несколько launch-артефактов.",
      "estimateBasisEn": "Several launch artifacts must be prepared."
    }
  ]
}
\`\`\``;

    const tasks = parseLaunchTaskCards(output);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].titleRu).toContain("границы");
    expect(tasks[0].estimateBasisEn).toContain("narrative");
    expect(tasks[1].titleEn).toBe("Prepare launch");
    expect(totalLaunchTaskHours(tasks)).toEqual({ humanHours: 8, agentHours: 3.5 });
    expect(stripLaunchTaskCardsBlock(output)).toBe("Priority plan");
  });

  it("returns an empty task list when the block is missing or malformed", () => {
    expect(parseLaunchTaskCards("Priority plan only")).toEqual([]);
    expect(parseLaunchTaskCards("TASK_CARDS_JSON\n```json\nnot json\n```")).toEqual([]);
  });
});
