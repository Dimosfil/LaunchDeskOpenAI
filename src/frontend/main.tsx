import React from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  ListChecks,
  Paperclip,
  Radio,
  Rocket,
  Send,
  Sparkles,
  X,
  Users,
  Wallet
} from "lucide-react";
import "./styles.css";
import {
  extractNumberedSections,
  getEnglishPlanText,
  getRussianPlanText
} from "../shared/launchOutput";
import type { LaunchAttachment, StreamMessage } from "../shared/launchSchema";
import { parseLaunchTaskCards, totalLaunchTaskHours } from "../shared/taskCards";

type FormState = {
  productBrief: string;
  audience: string;
  launchDate: string;
  constraints: string;
  assets: string;
  humanHourlyRate: string;
  agentHourlyRate: string;
};

type OutputTab = "plan" | "planRu" | "readiness" | "readinessRu" | "tasks";
type ExportFormat = "html" | "md" | "json" | "txt";
type ExportLanguage = "auto" | "ru" | "en" | "both";
type MetricKey =
  | "humanHours"
  | "agentHours"
  | "hybridHumanHours"
  | "savedHours"
  | "humanCost"
  | "agentCost"
  | "hybridCost";
type MetricSelection = Record<MetricKey, boolean>;

const hybridDelegationRate = 0.45;
const hybridReviewRate = 0.25;
const storageKey = "launch-desk-ui-state-v1";
const maxAttachmentTextBytes = 1024 * 1024;
const defaultMetricSelection: MetricSelection = {
  humanHours: true,
  agentHours: true,
  hybridHumanHours: true,
  savedHours: true,
  humanCost: true,
  agentCost: true,
  hybridCost: true
};

const initialForm: FormState = {
  productBrief:
    "Нужно составить максимально точный план работ по входящим пользовательским инпутам: разложить проект на этапы и задачи, оценить сроки, зависимости, риски, стоимость и результат каждого этапа. План должен отдельно показывать работу человека, работу AI-бота и гибридный режим разработки, где человек принимает решения и проверяет качество, а бот готовит черновики, код, тесты, документацию и аналитические артефакты.",
  audience: "Владелец продукта, технический лид, проектный менеджер и заказчик, которым нужно понять бюджет, сроки и состав работ до старта разработки.",
  launchDate: "2026-07-15",
  constraints:
    "Оценивать только по входящим инпутам и явно фиксировать допущения. Для каждой задачи указать человеко-часы, бот-часы, гибридный сценарий, календарную длительность, владельца, зависимости, критерий готовности и риск. Стоимость считать по ставке человека в час; стоимость бота не выдумывать, если отдельный тариф не задан. Отдельно показать MVP, полный релиз и необязательные улучшения.",
  assets:
    "Описание продукта или идеи, список функций, ограничения, желаемые сроки, доступные материалы, текущий код или дизайн, требования заказчика, приоритеты, интеграции, роли участников, ставка человека в час.",
  humanHourlyRate: "2500",
  agentHourlyRate: "300"
};

function calculateHybridHumanHours(humanHours: number, agentHours: number) {
  if (agentHours <= 0) {
    return humanHours;
  }
  const retainedHumanHours = humanHours * (1 - hybridDelegationRate);
  const reviewHours = agentHours * hybridReviewRate;
  return Math.min(humanHours, retainedHumanHours + reviewHours);
}

type PersistedState = {
  form?: Partial<FormState>;
  text?: string;
  finalOutput?: string;
  events?: StreamMessage[];
  error?: string;
  activeTab?: OutputTab;
  exportFormat?: ExportFormat;
  exportLanguage?: ExportLanguage;
  metricSelection?: Partial<MetricSelection>;
};

const textAttachmentExtensions = /\.(txt|md|markdown|csv|json|jsonl|xml|html|css|js|jsx|ts|tsx|yml|yaml|log|sql)$/i;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isTextAttachment(file: File) {
  return file.type.startsWith("text/") || /json|xml|javascript|typescript|yaml|csv/i.test(file.type) || textAttachmentExtensions.test(file.name);
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function fileToAttachment(file: File): Promise<LaunchAttachment> {
  const id = window.crypto?.randomUUID?.() || `${file.name}-${file.size}-${file.lastModified}`;
  const text = isTextAttachment(file) ? await file.slice(0, maxAttachmentTextBytes).text() : "";

  return {
    id,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    text
  };
}

function loadPersistedState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
}

function App() {
  const persisted = React.useMemo(loadPersistedState, []);
  const [form, setForm] = React.useState<FormState>({ ...initialForm, ...persisted.form });
  const [text, setText] = React.useState(persisted.text || "");
  const [finalOutput, setFinalOutput] = React.useState(persisted.finalOutput || "");
  const [events, setEvents] = React.useState<StreamMessage[]>(persisted.events || []);
  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState(persisted.error || "");
  const [activeTab, setActiveTab] = React.useState<OutputTab>(persisted.activeTab || "plan");
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>(persisted.exportFormat || "html");
  const [exportLanguage, setExportLanguage] = React.useState<ExportLanguage>(persisted.exportLanguage || "auto");
  const [metricSelection, setMetricSelection] = React.useState<MetricSelection>({
    ...defaultMetricSelection,
    ...persisted.metricSelection
  });
  const [attachments, setAttachments] = React.useState<LaunchAttachment[]>([]);

  React.useEffect(() => {
    const state: PersistedState = {
      form,
      text,
      finalOutput,
      events,
      error,
      activeTab,
      exportFormat,
      exportLanguage,
      metricSelection
    };
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [activeTab, error, events, exportFormat, exportLanguage, finalOutput, form, metricSelection, text]);

  const update = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  async function addAttachments(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const nextAttachments = await Promise.all(files.map(fileToAttachment));
    setAttachments((current) => [...current, ...nextAttachments]);
    event.target.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  function toggleMetric(metric: MetricKey) {
    setMetricSelection((current) => ({ ...current, [metric]: !current[metric] }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsRunning(true);
    setText("");
    setFinalOutput("");
    setEvents([]);
    setError("");
    setActiveTab("plan");

    try {
      const response = await fetch("/api/launch-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, attachments })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const line = chunk.split("\n").find((entry) => entry.startsWith("data: "));
          if (!line) continue;
          const message = JSON.parse(line.slice(6)) as StreamMessage;
          setEvents((current) => [...current, message]);
          if (message.type === "text_delta") {
            setText((current) => current + message.delta);
          }
          if (message.type === "final") {
            setFinalOutput(message.output);
          }
          if (message.type === "error") {
            setError(message.message);
          }
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to run Launch Desk.");
    } finally {
      setIsRunning(false);
    }
  }

  const toolEvents = events.filter((event) => event.type === "tool_progress");
  const status = [...events].reverse().find((event: StreamMessage) => event.type === "status");
  const outputText = finalOutput || text;
  const planText = getEnglishPlanText(outputText);
  const russianPlanText = getRussianPlanText(outputText);
  const readinessText = extractNumberedSections(planText, [2, 3, 5]);
  const russianReadinessText = extractNumberedSections(russianPlanText, [2, 3, 5]);
  const taskCards = parseLaunchTaskCards(outputText);
  const taskTotals = totalLaunchTaskHours(taskCards);
  const humanHourlyRate = Number(form.humanHourlyRate) || 0;
  const agentHourlyRate = Number(form.agentHourlyRate) || 0;
  const hybridHumanHours = calculateHybridHumanHours(taskTotals.humanHours, taskTotals.agentHours);
  const savedHumanHours = Math.max(0, taskTotals.humanHours - hybridHumanHours);
  const humanCost = taskTotals.humanHours * humanHourlyRate;
  const agentCost = taskTotals.agentHours * agentHourlyRate;
  const hybridCost = hybridHumanHours * humanHourlyRate + agentCost;
  const formatHours = (hours: number) => (Number.isInteger(hours) ? hours.toString() : hours.toFixed(1));
  const formatMoney = (value: number) =>
    value.toLocaleString("ru-RU", {
      maximumFractionDigits: 0
    });
  const selectedMetricCount = Object.values(metricSelection).filter(Boolean).length;
  const totalMetricItems = [
    { key: "humanHours" as const, label: "Human hours", value: `${formatHours(taskTotals.humanHours)} human h` },
    { key: "agentHours" as const, label: "Agent hours", value: `${formatHours(taskTotals.agentHours)} agent h` },
    {
      key: "hybridHumanHours" as const,
      label: "Hybrid human hours",
      value: `${formatHours(hybridHumanHours)} hybrid human h`
    },
    { key: "savedHours" as const, label: "Saved hours", value: `${formatHours(savedHumanHours)} saved h` },
    {
      key: "humanCost" as const,
      label: "Human cost",
      value: humanHourlyRate ? `${formatMoney(humanCost)} human cost` : "human rate not set"
    },
    {
      key: "agentCost" as const,
      label: "Agent cost",
      value: agentHourlyRate ? `${formatMoney(agentCost)} agent cost` : "agent rate not set"
    },
    {
      key: "hybridCost" as const,
      label: "Hybrid cost",
      value: humanHourlyRate ? `${formatMoney(hybridCost)} hybrid cost` : "rate not set"
    }
  ];
  const visibleTotalMetricItems = totalMetricItems.filter((metric) => metricSelection[metric.key]);
  const activeTabLabel =
    activeTab === "plan"
      ? "Plan"
      : activeTab === "planRu"
        ? "Plan RU"
        : activeTab === "readiness"
          ? "Risks"
          : activeTab === "readinessRu"
            ? "Risks RU"
            : "Tasks";

  function resolvedExportLanguage(): Exclude<ExportLanguage, "auto"> {
    if (exportLanguage !== "auto") {
      return exportLanguage;
    }
    if (activeTab === "planRu" || activeTab === "readinessRu") {
      return "ru";
    }
    if (activeTab === "tasks") {
      return "both";
    }
    return "en";
  }

  function languageMatches(language: "ru" | "en") {
    const resolved = resolvedExportLanguage();
    return resolved === "both" || resolved === language;
  }

  const taskIncludeRu = languageMatches("ru");
  const taskIncludeEn = languageMatches("en");

  function buildTasksMarkdown() {
    if (!taskCards.length) {
      return "";
    }

    const totals =
      visibleTotalMetricItems.length > 0
        ? visibleTotalMetricItems.map((metric) => `| ${metric.label} | ${metric.value} |`).join("\n")
        : "| Metrics | No metrics selected for export. |";

    const tasks = taskCards
      .map((task) => {
        const taskHybridHours = calculateHybridHumanHours(task.humanHours, task.agentHours);
        const taskSavedHours = Math.max(0, task.humanHours - taskHybridHours);
        const taskHumanCost = task.humanHours * humanHourlyRate;
        const taskAgentCost = task.agentHours * agentHourlyRate;
        const taskHybridCost = taskHybridHours * humanHourlyRate + task.agentHours * agentHourlyRate;
        const taskMetrics = [
          metricSelection.humanHours && `- Human hours: ${formatHours(task.humanHours)}`,
          metricSelection.agentHours && `- Agent hours: ${formatHours(task.agentHours)}`,
          metricSelection.hybridHumanHours && `- Hybrid human hours: ${formatHours(taskHybridHours)}`,
          metricSelection.savedHours && `- Saved hours: ${formatHours(taskSavedHours)}`,
          metricSelection.humanCost &&
            `- Human cost: ${humanHourlyRate ? formatMoney(taskHumanCost) : "human rate not set"}`,
          metricSelection.agentCost &&
            `- Agent cost: ${agentHourlyRate ? formatMoney(taskAgentCost) : "agent rate not set"}`,
          metricSelection.hybridCost &&
            `- Hybrid cost: ${humanHourlyRate ? formatMoney(taskHybridCost) : "rate not set"}`
        ]
          .filter((metric): metric is string => Boolean(metric))
          .join("\n");
        const ruBlock =
          taskIncludeRu && (task.titleRu || task.descriptionRu)
            ? `#### RU

**${task.titleRu || task.titleEn}**

${task.descriptionRu || task.descriptionEn}
`
            : "";
        const enBlock =
          taskIncludeEn && (task.titleEn || task.descriptionEn)
            ? `#### EN

**${task.titleEn || task.titleRu}**

${task.descriptionEn || task.descriptionRu}
`
            : "";
        const estimateBlocks = [
          taskIncludeRu && task.estimateBasisRu && `**Estimate basis RU:** ${task.estimateBasisRu}`,
          taskIncludeEn && task.estimateBasisEn && `**Estimate basis EN:** ${task.estimateBasisEn}`
        ]
          .filter(Boolean)
          .join("\n\n");
        const taskTitle = taskIncludeEn && !taskIncludeRu ? task.titleEn || task.titleRu : task.titleRu || task.titleEn;
        return `### ${task.id}: ${taskTitle}

${taskMetrics || "No metrics selected for export."}

${ruBlock}${enBlock}${estimateBlocks}`;
      })
      .join("\n\n---\n\n");

    return `# Launch Desk Task Cards

**Export language:** ${resolvedExportLanguage().toUpperCase()}

## Selected Metrics

| Metric | Value |
| --- | --- |
${totals}

## Cards

${tasks}`;
  }

  function buildTasksHtml() {
    if (!taskCards.length) {
      return "";
    }

    const totals =
      visibleTotalMetricItems.length > 0
        ? visibleTotalMetricItems
            .map((metric) => `<div class="metric"><strong>${escapeHtml(metric.label)}</strong><span>${escapeHtml(metric.value)}</span></div>`)
            .join("")
        : `<div class="metric muted">No metrics selected for export.</div>`;

    const tasks = taskCards
      .map((task) => {
        const taskHybridHours = calculateHybridHumanHours(task.humanHours, task.agentHours);
        const taskSavedHours = Math.max(0, task.humanHours - taskHybridHours);
        const taskHumanCost = task.humanHours * humanHourlyRate;
        const taskAgentCost = task.agentHours * agentHourlyRate;
        const taskHybridCost = taskHybridHours * humanHourlyRate + task.agentHours * agentHourlyRate;
        const taskMetrics = [
          metricSelection.humanHours && `Human h: ${formatHours(task.humanHours)}`,
          metricSelection.agentHours && `Agent h: ${formatHours(task.agentHours)}`,
          metricSelection.hybridHumanHours && `Hybrid h: ${formatHours(taskHybridHours)}`,
          metricSelection.savedHours && `Saved h: ${formatHours(taskSavedHours)}`,
          metricSelection.humanCost &&
            `Human cost: ${humanHourlyRate ? formatMoney(taskHumanCost) : "rate not set"}`,
          metricSelection.agentCost &&
            `Agent cost: ${agentHourlyRate ? formatMoney(taskAgentCost) : "rate not set"}`,
          metricSelection.hybridCost && `Hybrid cost: ${humanHourlyRate ? formatMoney(taskHybridCost) : "rate not set"}`
        ]
          .filter((estimate): estimate is string => Boolean(estimate))
          .map(
            (metric) =>
              `<span class="pill">${escapeHtml(metric)}</span>`
          )
          .join("");
        const ruBlock =
          taskIncludeRu && (task.titleRu || task.descriptionRu)
            ? `<div class="language-block">
  <strong>RU</strong>
  <div>
    <h3>${escapeHtml(task.titleRu || task.titleEn)}</h3>
    <p>${escapeHtml(task.descriptionRu || task.descriptionEn)}</p>
  </div>
</div>`
            : "";
        const enBlock =
          taskIncludeEn && (task.titleEn || task.descriptionEn)
            ? `<div class="language-block">
  <strong>EN</strong>
  <div>
    <h3>${escapeHtml(task.titleEn || task.titleRu)}</h3>
    <p>${escapeHtml(task.descriptionEn || task.descriptionRu)}</p>
  </div>
</div>`
            : "";
        const estimateBlocks = [
          taskIncludeRu && task.estimateBasisRu && `<p><strong>RU:</strong> ${escapeHtml(task.estimateBasisRu)}</p>`,
          taskIncludeEn && task.estimateBasisEn && `<p><strong>EN:</strong> ${escapeHtml(task.estimateBasisEn)}</p>`
        ]
          .filter(Boolean)
          .join("");
        return `<article class="card">
  <div class="card-top">
    <strong class="task-id">${escapeHtml(task.id)}</strong>
    <div class="pills">${taskMetrics || `<span class="muted">No metrics selected</span>`}</div>
  </div>
  ${ruBlock}
  ${enBlock}
  ${
    estimateBlocks
      ? `<div class="estimate">
  ${estimateBlocks}
</div>`
      : ""
  }
</article>`;
      })
      .join("\n\n");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Launch Desk Task Cards</title>
  <style>
    body { margin: 0; background: #f4f7f6; color: #16201d; font-family: Inter, Segoe UI, Arial, sans-serif; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    h2 { margin: 24px 0 12px; font-size: 18px; }
    .subtle, .muted { color: #667771; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
    .metric { border: 1px solid #d8e4e0; border-radius: 8px; background: #fff; padding: 10px 12px; }
    .metric strong, .metric span { display: block; }
    .metric span { margin-top: 4px; color: #174c45; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
    .card { border: 1px solid #d8e4e0; border-radius: 8px; background: #fff; padding: 14px; }
    .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .task-id { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 26px; border-radius: 6px; padding: 0 8px; background: #174c45; color: #fff; font-size: 12px; }
    .pills { text-align: right; }
    .pill { display: inline-block; border: 1px solid #dce7e3; border-radius: 6px; padding: 3px 7px; margin: 0 0 5px 5px; background: #f7faf9; color: #174c45; font-size: 12px; font-weight: 700; }
    .language-block { display: grid; grid-template-columns: 32px 1fr; gap: 6px 10px; margin-top: 12px; }
    .language-block > strong { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 22px; border-radius: 6px; background: #fff1f2; color: #7b4248; font-size: 12px; }
    .language-block h3 { margin: 0 0 5px; font-size: 16px; }
    .language-block p { margin: 0; color: #4f5f5a; line-height: 1.45; }
    .estimate { border-top: 1px solid #edf2f0; margin-top: 14px; padding-top: 10px; color: #5d6c67; }
    .estimate p { margin: 4px 0; }
  </style>
</head>
<body>
  <main>
    <h1>Launch Desk Task Cards</h1>
    <p class="subtle">Export language: ${escapeHtml(resolvedExportLanguage().toUpperCase())}</p>
    <h2>Selected Metrics</h2>
    <section class="metrics">${totals}</section>
    <h2>Cards</h2>
    <section class="grid">${tasks}</section>
  </main>
</body>
</html>`;
  }

  function buildPlainHtml(title: string, content: string) {
    if (!content.trim()) {
      return "";
    }

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; background: #f7f8f8; color: #16201d; font-family: Inter, Segoe UI, Arial, sans-serif; }
    main { max-width: 980px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 18px; font-size: 28px; }
    pre { white-space: pre-wrap; line-height: 1.55; border: 1px solid #d8e4e0; border-radius: 8px; background: #fff; padding: 18px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <pre>${escapeHtml(content)}</pre>
  </main>
</body>
</html>`;
  }

  function plainTextFromMarkdown(markdown: string) {
    return markdown
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, "\"")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .replace(/^#+\s/gm, "")
      .replace(/\n{3,}/g, "\n\n");
  }

  function activeMarkdownContent() {
    const language = resolvedExportLanguage();
    if (activeTab === "tasks") {
      return buildTasksMarkdown();
    }
    if (activeTab === "plan" || activeTab === "planRu") {
      if (language === "ru") return russianPlanText;
      if (language === "en") return planText;
      return `# Plan

${planText}

# План

${russianPlanText}`;
    }
    if (language === "ru") return russianReadinessText;
    if (language === "en") return readinessText;
    return `# Risks

${readinessText}

# Риски

${russianReadinessText}`;
  }

  function activeJsonContent() {
    const language = resolvedExportLanguage();
    if (activeTab === "tasks") {
      if (!taskCards.length) {
        return "";
      }

      return JSON.stringify(
        {
          tab: activeTab,
          language,
          metrics: visibleTotalMetricItems.map((metric) => ({
            key: metric.key,
            label: metric.label,
            value: metric.value
          })),
          tasks: taskCards.map((task) => {
            const taskHybridHours = calculateHybridHumanHours(task.humanHours, task.agentHours);
            const taskSavedHours = Math.max(0, task.humanHours - taskHybridHours);
            const taskHumanCost = task.humanHours * humanHourlyRate;
            const taskAgentCost = task.agentHours * agentHourlyRate;
            const taskHybridCost = taskHybridHours * humanHourlyRate + task.agentHours * agentHourlyRate;
            const metrics = {
              ...(metricSelection.humanHours ? { humanHours: task.humanHours } : {}),
              ...(metricSelection.agentHours ? { agentHours: task.agentHours } : {}),
              ...(metricSelection.hybridHumanHours ? { hybridHumanHours: taskHybridHours } : {}),
              ...(metricSelection.savedHours ? { savedHours: taskSavedHours } : {}),
              ...(metricSelection.humanCost ? { humanCost: humanHourlyRate ? taskHumanCost : null } : {}),
              ...(metricSelection.agentCost ? { agentCost: agentHourlyRate ? taskAgentCost : null } : {}),
              ...(metricSelection.hybridCost ? { hybridCost: humanHourlyRate ? taskHybridCost : null } : {})
            };

            return {
              id: task.id,
              languages: {
                ...(taskIncludeRu
                  ? {
                      ru: {
                        title: task.titleRu || task.titleEn,
                        description: task.descriptionRu || task.descriptionEn,
                        estimateBasis: task.estimateBasisRu
                      }
                    }
                  : {}),
                ...(taskIncludeEn
                  ? {
                      en: {
                        title: task.titleEn || task.titleRu,
                        description: task.descriptionEn || task.descriptionRu,
                        estimateBasis: task.estimateBasisEn
                      }
                    }
                  : {})
              },
              metrics
            };
          })
        },
        null,
        2
      );
    }

    const content = activeMarkdownContent().trim();
    if (!content) {
      return "";
    }
    return JSON.stringify({ tab: activeTab, language, content }, null, 2);
  }

  function activeHtmlContent() {
    if (activeTab === "tasks") {
      return buildTasksHtml();
    }

    return buildPlainHtml(activeTabLabel, plainTextFromMarkdown(activeMarkdownContent()));
  }

  function activeExportContent(format: ExportFormat = exportFormat) {
    if (format === "html") {
      return activeHtmlContent();
    }
    if (format === "json") {
      return activeJsonContent();
    }
    if (format === "txt") {
      return plainTextFromMarkdown(activeMarkdownContent());
    }
    return activeMarkdownContent();
  }

  function downloadActiveTab() {
    const content = activeExportContent().trim();
    if (!content) {
      return;
    }

    const fileTypes: Record<ExportFormat, { extension: string; mime: string }> = {
      html: { extension: "html", mime: "text/html;charset=utf-8" },
      md: { extension: "md", mime: "text/markdown;charset=utf-8" },
      json: { extension: "json", mime: "application/json;charset=utf-8" },
      txt: { extension: "txt", mime: "text/plain;charset=utf-8" }
    };
    const { extension, mime } = fileTypes[exportFormat];
    const body = content;
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `launch-desk-${activeTab}-${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const canExportActiveTab = Boolean(activeExportContent(exportFormat).trim());

  return (
    <main className="appShell">
      <section className="workspace">
        <form className="inputPanel" onSubmit={submit}>
          <div className="brandRow">
            <div className="brandMark">
              <Rocket size={22} aria-hidden />
            </div>
            <div>
              <h1>Launch Desk</h1>
              <p>Rough idea to release plan, with agent tools in the loop.</p>
            </div>
          </div>

          <label>
            <span>
              <ClipboardList size={16} aria-hidden /> Product brief
            </span>
            <textarea value={form.productBrief} onChange={update("productBrief")} rows={7} />
          </label>

          <div className="attachmentPanel">
            <div className="attachmentHeader">
              <span>
                <Paperclip size={16} aria-hidden /> Documents
              </span>
              <label className="attachButton" htmlFor="launch-documents">
                <Paperclip size={15} aria-hidden />
                Attach
              </label>
              <input id="launch-documents" type="file" multiple onChange={addAttachments} />
            </div>
            {attachments.length ? (
              <div className="attachmentList">
                {attachments.map((attachment) => (
                  <div className="attachmentItem" key={attachment.id}>
                    <FileText size={16} aria-hidden />
                    <div>
                      <strong>{attachment.name}</strong>
                      <span>
                        {formatBytes(attachment.size)}
                        {attachment.text ? " · text extracted" : " · metadata only"}
                      </span>
                    </div>
                    <button
                      aria-label={`Remove ${attachment.name}`}
                      className="removeAttachment"
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                    >
                      <X size={15} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="attachmentHint">Attach files when the brief text is empty or supporting docs should guide the plan.</p>
            )}
          </div>

          <div className="twoColumn">
            <label>
              <span>
                <Users size={16} aria-hidden /> Audience
              </span>
              <input value={form.audience} onChange={update("audience")} />
            </label>
            <label>
              <span>
                <CalendarDays size={16} aria-hidden /> Launch date
              </span>
              <input value={form.launchDate} onChange={update("launchDate")} placeholder="2026-07-15" />
            </label>
          </div>

          <div className="twoColumn">
            <label>
              <span>
                <Wallet size={16} aria-hidden /> Human hourly rate
              </span>
              <input
                type="number"
                min="0"
                step="100"
                value={form.humanHourlyRate}
                onChange={update("humanHourlyRate")}
                placeholder="2500"
              />
            </label>
            <label>
              <span>
                <Bot size={16} aria-hidden /> Agent hourly rate
              </span>
              <input
                type="number"
                min="0"
                step="50"
                value={form.agentHourlyRate}
                onChange={update("agentHourlyRate")}
                placeholder="300"
              />
            </label>
          </div>

          <label>
            <span>
              <AlertCircle size={16} aria-hidden /> Constraints
            </span>
            <textarea value={form.constraints} onChange={update("constraints")} rows={4} />
          </label>

          <label>
            <span>
              <Sparkles size={16} aria-hidden /> Available assets
            </span>
            <textarea value={form.assets} onChange={update("assets")} rows={4} />
          </label>

          <button className="submitButton" type="submit" disabled={isRunning}>
            <Send size={17} aria-hidden />
            {isRunning ? "Planning..." : "Generate plan"}
          </button>
        </form>

        <section className="outputPanel" aria-live="polite">
          <div className="outputHeader">
            <div>
              <h2>Agent output</h2>
              <p>{status && status.type === "status" ? status.message : "Ready for a streamed planning run."}</p>
            </div>
            <div className={isRunning ? "liveBadge running" : "liveBadge"}>
              <Radio size={15} aria-hidden />
              {isRunning ? "Streaming" : "Idle"}
            </div>
          </div>

          <div className="eventRail">
            {toolEvents.length === 0 ? (
              <div className="eventItem muted">Tool progress will appear here.</div>
            ) : (
              toolEvents.map((event, index) =>
                event.type === "tool_progress" ? (
                  <div className="eventItem" key={`${event.tool}-${index}`}>
                    <CheckCircle2 size={15} aria-hidden />
                    <span>{event.tool}</span>
                    <strong>{event.stage}</strong>
                  </div>
                ) : null
              )
            )}
          </div>

          {error ? <div className="errorBox">{error}</div> : null}

          <div className="outputControls">
            <div className="outputTabs" role="tablist" aria-label="Agent output views">
            <button
              className={activeTab === "plan" ? "tabButton active" : "tabButton"}
              type="button"
              role="tab"
              aria-selected={activeTab === "plan"}
              onClick={() => setActiveTab("plan")}
            >
              <FileText size={16} aria-hidden />
              Plan
            </button>
            <button
              className={activeTab === "planRu" ? "tabButton active" : "tabButton"}
              type="button"
              role="tab"
              aria-selected={activeTab === "planRu"}
              onClick={() => setActiveTab("planRu")}
            >
              <FileText size={16} aria-hidden />
              План
            </button>
            <button
              className={activeTab === "readiness" ? "tabButton active" : "tabButton"}
              type="button"
              role="tab"
              aria-selected={activeTab === "readiness"}
              onClick={() => setActiveTab("readiness")}
            >
              <AlertCircle size={16} aria-hidden />
              Risks
            </button>
            <button
              className={activeTab === "readinessRu" ? "tabButton active" : "tabButton"}
              type="button"
              role="tab"
              aria-selected={activeTab === "readinessRu"}
              onClick={() => setActiveTab("readinessRu")}
            >
              <AlertCircle size={16} aria-hidden />
              Риски
            </button>
            <button
              className={activeTab === "tasks" ? "tabButton active" : "tabButton"}
              type="button"
              role="tab"
              aria-selected={activeTab === "tasks"}
              onClick={() => setActiveTab("tasks")}
            >
              <ListChecks size={16} aria-hidden />
              Tasks
            </button>
            </div>

            <div className="exportControls" aria-label={`Export ${activeTabLabel}`}>
              {activeTab === "tasks" ? (
                <div className="metricChecks" aria-label="Task metrics to export">
                  {totalMetricItems.map((metric) => (
                    <label className="metricCheck" key={metric.key}>
                      <input
                        checked={metricSelection[metric.key]}
                        type="checkbox"
                        onChange={() => toggleMetric(metric.key)}
                      />
                      <span>{metric.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              <select
                aria-label="Export language"
                className="exportSelect"
                value={exportLanguage}
                onChange={(event) => setExportLanguage(event.target.value as ExportLanguage)}
              >
                <option value="auto">Auto language</option>
                <option value="ru">Russian</option>
                <option value="en">English</option>
                <option value="both">Both languages</option>
              </select>
              <select
                aria-label="Export file format"
                className="exportSelect"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
              >
                <option value="html">HTML</option>
                <option value="md">Markdown</option>
                <option value="json">JSON</option>
                <option value="txt">Text</option>
              </select>
              <button className="downloadButton" type="button" disabled={!canExportActiveTab} onClick={downloadActiveTab}>
                <Download size={16} aria-hidden />
                Export
              </button>
            </div>
          </div>

          {activeTab === "plan" ? (
            <article className="planOutput">
              {planText ? (
                <pre>{planText}</pre>
              ) : (
                <div className="emptyState">Your prioritized plan, risks, owner checklist, copy, and follow-up questions will stream here.</div>
              )}
            </article>
          ) : activeTab === "planRu" ? (
            <article className="planOutput">
              {russianPlanText ? (
                <pre>{russianPlanText}</pre>
              ) : (
                <div className="emptyState">Русская версия плана появится здесь.</div>
              )}
            </article>
          ) : activeTab === "readiness" ? (
            <article className="planOutput">
              {readinessText ? (
                <pre>{readinessText}</pre>
              ) : (
                <div className="emptyState">Risk register, owner checklist, and follow-up questions will appear here.</div>
              )}
            </article>
          ) : activeTab === "readinessRu" ? (
            <article className="planOutput">
              {russianReadinessText ? (
                <pre>{russianReadinessText}</pre>
              ) : (
                <div className="emptyState">Риски, чеклист ответственных и уточняющие вопросы появятся здесь.</div>
              )}
            </article>
          ) : (
            <section className="tasksOutput">
              <div className="tasksHeader">
                <div>
                  <h3>Task cards</h3>
                  <p>{taskCards.length ? `${taskCards.length} scoped tasks from the generated plan.` : "Task cards will appear after the final plan."}</p>
                </div>
                <div className="totalMetrics" aria-label="Task estimate totals">
                  {visibleTotalMetricItems.length ? (
                    visibleTotalMetricItems.map((metric) => (
                      <div className="metricPill" key={metric.key}>
                        {metric.key === "humanHours" || metric.key === "humanCost" ? (
                          <Users size={15} aria-hidden />
                        ) : metric.key === "agentHours" || metric.key === "agentCost" ? (
                          <Bot size={15} aria-hidden />
                        ) : metric.key === "hybridHumanHours" ? (
                          <Clock3 size={15} aria-hidden />
                        ) : (
                          <Sparkles size={15} aria-hidden />
                        )}
                        <span>{metric.value}</span>
                      </div>
                    ))
                  ) : (
                    <div className="metricPill muted">No metrics selected</div>
                  )}
                </div>
              </div>

              {taskCards.length ? (
                <div className="taskGrid">
                  {taskCards.map((task) => {
                    const taskHybridHours = calculateHybridHumanHours(task.humanHours, task.agentHours);
                    const taskSavedHours = Math.max(0, task.humanHours - taskHybridHours);
                    const taskHumanCost = task.humanHours * humanHourlyRate;
                    const taskAgentCost = task.agentHours * agentHourlyRate;
                    const taskHybridCost = taskHybridHours * humanHourlyRate + task.agentHours * agentHourlyRate;
                    const taskMetricItems = [
                      {
                        key: "humanHours" as const,
                        title: "Human hours",
                        value: `${formatHours(task.humanHours)}h`
                      },
                      {
                        key: "agentHours" as const,
                        title: "Agent hours",
                        value: `${formatHours(task.agentHours)}h`
                      },
                      {
                        key: "hybridHumanHours" as const,
                        title: "Hybrid human hours",
                        value: `${formatHours(taskHybridHours)}h`
                      },
                      {
                        key: "savedHours" as const,
                        title: "Saved hours",
                        value: `${formatHours(taskSavedHours)}h`
                      },
                      {
                        key: "humanCost" as const,
                        title: "Human cost",
                        value: humanHourlyRate ? formatMoney(taskHumanCost) : "0"
                      },
                      {
                        key: "agentCost" as const,
                        title: "Agent cost",
                        value: agentHourlyRate ? formatMoney(taskAgentCost) : "0"
                      },
                      {
                        key: "hybridCost" as const,
                        title: "Hybrid cost",
                        value: humanHourlyRate ? formatMoney(taskHybridCost) : "0"
                      }
                    ].filter((metric) => metricSelection[metric.key]);
                    const showRu = taskIncludeRu && (task.titleRu || task.descriptionRu);
                    const showEn = taskIncludeEn && (task.titleEn || task.descriptionEn);
                    const showEstimateBasis =
                      (taskIncludeRu && task.estimateBasisRu) || (taskIncludeEn && task.estimateBasisEn);

                    return (
                    <article className="taskCard" key={task.id}>
                      <div className="taskCardTop">
                        <span className="taskId">{task.id}</span>
                        <div className="taskEstimates">
                          {taskMetricItems.map((metric) => (
                            <span title={metric.title} key={metric.key}>
                              {metric.key === "humanHours" || metric.key === "humanCost" ? (
                                <Users size={14} aria-hidden />
                              ) : metric.key === "agentHours" || metric.key === "agentCost" ? (
                                <Bot size={14} aria-hidden />
                              ) : metric.key === "hybridHumanHours" ? (
                                <Clock3 size={14} aria-hidden />
                              ) : metric.key === "hybridCost" ? (
                                <Wallet size={14} aria-hidden />
                              ) : (
                                <Sparkles size={14} aria-hidden />
                              )}
                              {metric.value}
                            </span>
                          ))}
                        </div>
                      </div>
                      {showRu ? (
                        <div className="taskLanguageBlock">
                          <span className="languageLabel">RU</span>
                          <h4>{task.titleRu || task.titleEn}</h4>
                          <p>{task.descriptionRu || task.descriptionEn}</p>
                        </div>
                      ) : null}
                      {showEn ? (
                        <div className="taskLanguageBlock">
                          <span className="languageLabel">EN</span>
                          <h4>{task.titleEn || task.titleRu}</h4>
                          <p>{task.descriptionEn || task.descriptionRu}</p>
                        </div>
                      ) : null}
                      {showEstimateBasis && (
                        <div className="estimateBasis">
                          <Clock3 size={14} aria-hidden />
                          <div>
                            {taskIncludeRu && task.estimateBasisRu ? <p>{task.estimateBasisRu}</p> : null}
                            {taskIncludeEn && task.estimateBasisEn ? <p>{task.estimateBasisEn}</p> : null}
                          </div>
                        </div>
                      )}
                    </article>
                    );
                  })}
                </div>
              ) : (
                <div className="emptyState taskEmpty">
                  <Clock3 size={20} aria-hidden />
                  No task cards yet.
                </div>
              )}
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
