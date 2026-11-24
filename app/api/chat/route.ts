import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildSystemPrompt, DEFAULT_REFERENCE_DATE, metricTools } from "@/lib/chat";
import { isIsoDate } from "@/lib/dates";

function lastQuestion(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return (last?.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join(" ");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelId = process.env.OPENROUTER_MODEL;
  if (!apiKey || !modelId) {
    return Response.json(
      { error: "Set OPENROUTER_API_KEY and OPENROUTER_MODEL in .env.local" },
      { status: 500 },
    );
  }

  let body: { messages?: UIMessage[]; today?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "Send a non-empty messages array" }, { status: 400 });
  }

  const today = body.today ?? process.env.REFERENCE_DATE ?? DEFAULT_REFERENCE_DATE;
  if (!isIsoDate(today)) {
    return Response.json({ error: "today must be YYYY-MM-DD" }, { status: 400 });
  }

  const openrouter = createOpenRouter({ apiKey });

  const result = streamText({
    model: openrouter.chat(modelId, { extraBody: { reasoning: { enabled: false } } }),
    instructions: buildSystemPrompt(today, lastQuestion(body.messages)),
    messages: await convertToModelMessages(body.messages),
    temperature: 0,
    tools: metricTools,
    stopWhen: isStepCount(2),
    prepareStep: ({ stepNumber }) =>
      stepNumber >= 1 ? { toolChoice: "none" } : {},
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        const text = error instanceof Error ? error.message : String(error);
        return /rate limit|429/i.test(text)
          ? "the AI model is out of free requests for today"
          : "the AI model could not answer";
      },
    }),
  });
}
