const endpoint = process.env.LAUNCH_DESK_API_URL || "http://127.0.0.1:8787/api/launch-plan";

const payload = {
  productBrief:
    "Launch Desk should plan a controlled release of deployment confidence scorecards for engineering managers. The release must show readiness, owners, risks, and customer-impact notes before production rollout.",
  audience: "Engineering managers, release captains, and product leads",
  launchDate: "2026-07-15",
  constraints:
    "Do not change the deployment process in v1. Include rollback guidance, monitoring links, support escalation, and beta feedback review.",
  assets: "Product spec, dashboard mockups, beta quotes, draft changelog, and internal release checklist"
};

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

if (!response.ok || !response.body) {
  throw new Error(`Stream request failed with status ${response.status}`);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let sawToolProgress = false;
let sawTextDelta = false;
let sawFinal = false;
let textChars = 0;

while (true) {
  const { done, value } = await reader.read();
  if (done) {
    break;
  }

  buffer += decoder.decode(value, { stream: true });
  const chunks = buffer.split("\n\n");
  buffer = chunks.pop() || "";

  for (const chunk of chunks) {
    const line = chunk.split("\n").find((entry) => entry.startsWith("data: "));
    if (!line) continue;

    const event = JSON.parse(line.slice(6));
    if (event.type === "error") {
      throw new Error(event.message);
    }
    if (event.type === "tool_progress") {
      sawToolProgress = true;
    }
    if (event.type === "text_delta") {
      sawTextDelta = true;
      textChars += event.delta.length;
    }
    if (event.type === "final") {
      sawFinal = true;
    }

    if (sawToolProgress && sawTextDelta && sawFinal) {
      console.log(JSON.stringify({ ok: true, sawToolProgress, sawTextDelta, sawFinal, textChars }, null, 2));
      process.exit(0);
    }
  }
}

throw new Error(
  `Missing required stream event. tool_progress=${sawToolProgress}; text_delta=${sawTextDelta}; final=${sawFinal}; textChars=${textChars}`
);
