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
  Users
} from "lucide-react";
import "./styles.css";
import type { StreamMessage } from "../shared/launchSchema";
import { parseLaunchTaskCards, stripLaunchTaskCardsBlock, totalLaunchTaskHours } from "../shared/taskCards";

type FormState = {
  productBrief: string;
  audience: string;
  launchDate: string;
  constraints: string;
  assets: string;
};

type OutputTab = "plan" | "tasks";

const initialForm: FormState = {
  productBrief:
    "We are launching team-level release scorecards that summarize deployment confidence, unresolved blockers, and customer-impact notes before every production rollout.",
  audience: "Engineering managers, release captains, and product leads at B2B SaaS teams",
  launchDate: "2026-07-15",
  constraints:
    "Must keep current deployment process unchanged, include rollback guidance, provide monitoring links, and avoid promising automated approvals in v1.",
  assets: "Product spec, early dashboard mockups, beta feedback quotes, internal release process checklist"
};

function App() {
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [text, setText] = React.useState("");
  const [finalOutput, setFinalOutput] = React.useState("");
  const [events, setEvents] = React.useState<StreamMessage[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<OutputTab>("plan");

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
  const planText = stripLaunchTaskCardsBlock(outputText);
  const taskCards = parseLaunchTaskCards(outputText);
  const taskTotals = totalLaunchTaskHours(taskCards);
  const formatHours = (hours: number) => (Number.isInteger(hours) ? hours.toString() : hours.toFixed(1));

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
