import React from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  ListChecks,
  Radio,
  Rocket,
  Send,
  Sparkles,
  Users,
  Wallet
} from "lucide-react";
import "./styles.css";
import {
  extractNumberedSections,
  getEnglishPlanText,
  getRussianPlanText
} from "../shared/launchOutput";
import type { StreamMessage } from "../shared/launchSchema";
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

const hybridDelegationRate = 0.45;
const hybridReviewRate = 0.25;
const storageKey = "launch-desk-ui-state-v1";

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
};

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

  React.useEffect(() => {
    const state: PersistedState = {
      form,
      text,
      finalOutput,
      events,
      error,
      activeTab
    };
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [activeTab, error, events, finalOutput, form, text]);

  const update = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

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
        body: JSON.stringify(form)
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
                  <div className="metricPill">
                    <Users size={15} aria-hidden />
                    <span>{formatHours(taskTotals.humanHours)} human h</span>
                  </div>
                  <div className="metricPill">
                    <Bot size={15} aria-hidden />
                    <span>{formatHours(taskTotals.agentHours)} agent h</span>
                  </div>
                  <div className="metricPill">
                    <Clock3 size={15} aria-hidden />
                    <span>{formatHours(hybridHumanHours)} hybrid human h</span>
                  </div>
                  <div className="metricPill">
                    <Sparkles size={15} aria-hidden />
                    <span>{formatHours(savedHumanHours)} saved h</span>
                  </div>
                  <div className="metricPill">
                    <Wallet size={15} aria-hidden />
                    <span>{humanHourlyRate ? `${formatMoney(humanCost)} human cost` : "human rate not set"}</span>
                  </div>
                  <div className="metricPill">
                    <Bot size={15} aria-hidden />
                    <span>{agentHourlyRate ? `${formatMoney(agentCost)} agent cost` : "agent rate not set"}</span>
                  </div>
                  <div className="metricPill">
                    <Sparkles size={15} aria-hidden />
                    <span>{humanHourlyRate ? `${formatMoney(hybridCost)} hybrid cost` : "rate not set"}</span>
                  </div>
                </div>
              </div>

              {taskCards.length ? (
                <div className="taskGrid">
                  {taskCards.map((task) => (
                    <article className="taskCard" key={task.id}>
                      <div className="taskCardTop">
                        <span className="taskId">{task.id}</span>
                        <div className="taskEstimates">
                          <span title="Human hours">
                            <Users size={14} aria-hidden />
                            {formatHours(task.humanHours)}h
                          </span>
                          <span title="Agent hours">
                            <Bot size={14} aria-hidden />
                            {formatHours(task.agentHours)}h
                          </span>
                          <span title="Hybrid human plus agent hours">
                            <Clock3 size={14} aria-hidden />
                            {formatHours(calculateHybridHumanHours(task.humanHours, task.agentHours))}h
                          </span>
                          <span title="Hybrid cost">
                            <Wallet size={14} aria-hidden />
                            {humanHourlyRate
                              ? formatMoney(
                                  calculateHybridHumanHours(task.humanHours, task.agentHours) * humanHourlyRate +
                                    task.agentHours * agentHourlyRate
                                )
                              : "0"}
                          </span>
                        </div>
                      </div>
                      <div className="taskLanguageBlock">
                        <span className="languageLabel">RU</span>
                        <h4>{task.titleRu || task.titleEn}</h4>
                        <p>{task.descriptionRu || task.descriptionEn}</p>
                      </div>
                      <div className="taskLanguageBlock">
                        <span className="languageLabel">EN</span>
                        <h4>{task.titleEn || task.titleRu}</h4>
                        <p>{task.descriptionEn || task.descriptionRu}</p>
                      </div>
                      {(task.estimateBasisRu || task.estimateBasisEn) && (
                        <div className="estimateBasis">
                          <Clock3 size={14} aria-hidden />
                          <div>
                            {task.estimateBasisRu ? <p>{task.estimateBasisRu}</p> : null}
                            {task.estimateBasisEn ? <p>{task.estimateBasisEn}</p> : null}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
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
