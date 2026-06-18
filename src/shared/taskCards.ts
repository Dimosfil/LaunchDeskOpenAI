export type LaunchTaskCard = {
  id: string;
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  humanHours: number;
  agentHours: number;
  estimateBasisRu: string;
  estimateBasisEn: string;
};

export type LaunchTaskTotals = {
  humanHours: number;
  agentHours: number;
};

const taskCardsBlockPattern = /(?:^|\n)TASK_CARDS_JSON\s*```(?:json)?\s*([\s\S]*?)\s*```/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hourValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function parseLaunchTaskCards(output: string): LaunchTaskCard[] {
  const match = output.match(taskCardsBlockPattern);
  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[1]) as unknown;
    const source = isRecord(parsed) && Array.isArray(parsed.tasks) ? parsed.tasks : [];
    return source
      .filter(isRecord)
      .map((task, index) => ({
        id: textValue(task.id) || `T${index + 1}`,
        titleRu: textValue(task.titleRu),
        titleEn: textValue(task.titleEn),
        descriptionRu: textValue(task.descriptionRu),
        descriptionEn: textValue(task.descriptionEn),
        humanHours: hourValue(task.humanHours),
        agentHours: hourValue(task.agentHours),
        estimateBasisRu: textValue(task.estimateBasisRu),
        estimateBasisEn: textValue(task.estimateBasisEn)
      }))
      .filter((task) => task.titleRu || task.titleEn || task.descriptionRu || task.descriptionEn);
  } catch {
    return [];
  }
}

export function stripLaunchTaskCardsBlock(output: string) {
  return output.replace(taskCardsBlockPattern, "").trim();
}

export function totalLaunchTaskHours(tasks: LaunchTaskCard[]): LaunchTaskTotals {
  return tasks.reduce(
    (totals, task) => ({
      humanHours: totals.humanHours + task.humanHours,
      agentHours: totals.agentHours + task.agentHours
    }),
    { humanHours: 0, agentHours: 0 }
  );
}
