import { stripLaunchTaskCardsBlock } from "./taskCards";

type OutputBlockName = "ENGLISH_PLAN" | "RUSSIAN_PLAN";

const blockNames: OutputBlockName[] = ["ENGLISH_PLAN", "RUSSIAN_PLAN"];
const taskCardsMarker = "TASK_CARDS_JSON";
const markerLinePattern = /^(ENGLISH_PLAN|RUSSIAN_PLAN)(?:_(?:START|END))?\s*$/i;
const fenceLinePattern = /^```(?:markdown|md)?\s*$/i;

const sectionHeadingPattern =
  /^(?<prefix>\s{0,3}(?:#{1,6}\s*)?(?:\*\*)?)(?<number>[1-5])\.\s*(?<title>[^*\n]+?)(?:\*\*)?\s*$/gm;

const russianHeadingMap: Record<string, string> = {
  "Priority plan": "Приоритетный план",
  "Prioritized Plan": "Приоритетный план",
  "Risk register": "Реестр рисков",
  "Risk Register": "Реестр рисков",
  "Owner checklist": "Чеклист ответственных",
  "Owner Checklist": "Чеклист ответственных",
  "Launch copy": "Тексты для запуска",
  "Launch Copy": "Тексты для запуска",
  "Launch Copy Suggestions": "Тексты для запуска",
  "Follow-up questions": "Уточняющие вопросы",
  "Follow-Up Questions": "Уточняющие вопросы",
  "Followup Questions": "Уточняющие вопросы"
};

export function extractMarkedOutputBlock(output: string, name: OutputBlockName) {
  const explicit = extractBetweenMarkers(output, `${name}_START`, `${name}_END`);
  if (explicit) {
    return cleanReadableBlock(explicit);
  }

  const legacy = extractAfterMarker(output, name);
  return legacy ? cleanReadableBlock(legacy) : "";
}

export function stripReadableOutputBlocks(output: string) {
  let stripped = output;
  for (const name of blockNames) {
    stripped = stripBlock(stripped, `${name}_START`, `${name}_END`);
    stripped = stripLegacyBlock(stripped, name);
  }
  return cleanReadableBlock(stripped);
}

export function getReadablePlanText(output: string) {
  return stripReadableOutputBlocks(stripLaunchTaskCardsBlock(output));
}

export function getEnglishPlanText(output: string) {
  return extractMarkedOutputBlock(output, "ENGLISH_PLAN") || getReadablePlanText(output);
}

export function getRussianPlanText(output: string) {
  return extractMarkedOutputBlock(output, "RUSSIAN_PLAN") || localizePlanHeadings(getReadablePlanText(output));
}

export function localizePlanHeadings(text: string) {
  return text.replace(sectionHeadingPattern, (heading, prefix: string, number: string, title: string) => {
    const cleanTitle = title.trim();
    const translated = russianHeadingMap[cleanTitle];
    return translated ? `${prefix}${number}. ${translated}` : heading;
  });
}

export function extractNumberedSections(text: string, sectionNumbers: number[]) {
  const cleanText = cleanReadableBlock(text);
  const matches = [...cleanText.matchAll(sectionHeadingPattern)];
  const selected = matches
    .map((match, index) => {
      const number = Number(match.groups?.number);
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? cleanText.length;
      return { number, content: cleanReadableBlock(cleanText.slice(start, end)) };
    })
    .filter((section) => sectionNumbers.includes(section.number))
    .map((section) => section.content);

  return selected.join("\n\n").trim();
}

function cleanReadableBlock(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => !markerLinePattern.test(line.trim()))
    .filter((line) => !fenceLinePattern.test(line.trim()))
    .join("\n")
    .replace(/(?:^|\n)TASK_CARDS_JSON\s*```(?:json)?[\s\S]*$/i, "")
    .trim();
}

function markerIndex(output: string, marker: string, startAt = 0) {
  const pattern = new RegExp(`(?:^|\\n)${escapeRegExp(marker)}\\s*(?:\\n|$)`, "i");
  const slice = output.slice(startAt);
  const match = slice.match(pattern);
  if (!match || match.index === undefined) {
    return -1;
  }
  return startAt + match.index + (match[0].startsWith("\n") ? 1 : 0);
}

function markerContentStart(output: string, markerStart: number) {
  const lineEnd = output.indexOf("\n", markerStart);
  return lineEnd === -1 ? output.length : lineEnd + 1;
}

function nextKnownMarkerIndex(output: string, startAt: number) {
  const markers = [
    "ENGLISH_PLAN_START",
    "ENGLISH_PLAN_END",
    "RUSSIAN_PLAN_START",
    "RUSSIAN_PLAN_END",
    "ENGLISH_PLAN",
    "RUSSIAN_PLAN",
    taskCardsMarker
  ];
  return markers
    .map((marker) => markerIndex(output, marker, startAt))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
}

function extractBetweenMarkers(output: string, startMarker: string, endMarker: string) {
  const start = markerIndex(output, startMarker);
  if (start < 0) {
    return "";
  }
  const contentStart = markerContentStart(output, start);
  const end = markerIndex(output, endMarker, contentStart);
  if (end >= 0) {
    return output.slice(contentStart, end);
  }
  const next = nextKnownMarkerIndex(output, contentStart);
  return output.slice(contentStart, next >= 0 ? next : output.length);
}

function extractAfterMarker(output: string, marker: OutputBlockName) {
  const start = markerIndex(output, marker);
  if (start < 0) {
    return "";
  }
  const contentStart = markerContentStart(output, start);
  const next = nextKnownMarkerIndex(output, contentStart);
  return output.slice(contentStart, next >= 0 ? next : output.length);
}

function stripBlock(output: string, startMarker: string, endMarker: string) {
  const start = markerIndex(output, startMarker);
  if (start < 0) {
    return output;
  }
  const contentStart = markerContentStart(output, start);
  const end = markerIndex(output, endMarker, contentStart);
  if (end < 0) {
    return output.slice(0, start).trim();
  }
  return `${output.slice(0, start)}${output.slice(markerContentStart(output, end))}`.trim();
}

function stripLegacyBlock(output: string, marker: OutputBlockName) {
  const start = markerIndex(output, marker);
  if (start < 0) {
    return output;
  }
  const contentStart = markerContentStart(output, start);
  const next = nextKnownMarkerIndex(output, contentStart);
  return `${output.slice(0, start)}${next >= 0 ? output.slice(next) : ""}`.trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
