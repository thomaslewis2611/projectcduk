/**
 * Server function for AI chat about UK tender price inflation (TPI) forecasts.
 *
 * Uses OpenAI (Chat Completions). The whole forecast dataset is small enough to
 * send as context; switch to tool calls when it outgrows that (BACKLOG 2.1).
 * Falls back to keyword matching when OPENAI_API_KEY isn't set.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const chatInputSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(messageSchema).max(20).optional(),
});

const SYSTEM_PROMPT = `You answer questions about UK construction tender price inflation (TPI) forecasts, using only the data provided.

About the data:
- It comes from consultants' quarterly Tender Price Indicator reports (currently Gardiner & Theobald).
- Each report forecasts the annual % change in tender prices (January–December) for each region and the UK weighted average, for the current year and the next three.
- Each forecast also has the same publisher's previous-report forecast for that year ("prev"), so you can say how a forecast was revised.
- Regions: Greater London, South East, South West, East, Midlands, Wales, Yorkshire & Humber, North West, North East, Scotland, Northern Ireland, and UK Average.
- These are forecasts of tender price inflation, averaged across all sectors and project sizes. They are not £ costs, and not specific to building types or sizes.

When answering:
- Cite figures with the report they come from (e.g. "G&T Q2 2026 forecast 3.50% for 2026").
- For "how much will prices rise between year A and year B", compound the annual changes, and say which report's forecasts you used.
- If asked for £/sqft costs or building-type-specific figures, say the data doesn't include them.
- If something isn't in the data, say so.
- Be concise.`;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResult = {
  response: string;
  /** Context lines that matched the question's keywords. */
  dataPoints: string[] | null;
};

const NO_DATA = "(no data available — upload reports first)";

export const chatAboutConstruction = createServerFn({ method: "POST" })
  .validator(chatInputSchema)
  .handler(async ({ data }): Promise<ChatResult> => {
    const contextText = await buildDbSummary();

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Forecast data. One line per report and region: "<publisher> <period> | <region> | <year>: <forecast>% (prev <previous forecast>%) ...".\n${contextText}`,
      },
      ...(data.history ?? []),
      { role: "user", content: data.message },
    ];

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      return await callOpenAI(apiKey, messages, contextText);
    }
    return keywordFallback(data.message, contextText);
  });

// ---------------------------------------------------------------------------
// Database context builder
// ---------------------------------------------------------------------------

async function buildDbSummary(): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from("tpi_forecast_rows")
      .select(
        "publisher, period_label, period_year, period_quarter, region, forecast_year, change_pct, previous_change_pct",
      )
      .order("period_year")
      .order("period_quarter")
      .order("region")
      .order("forecast_year");

    if (error || !data || data.length === 0) return NO_DATA;

    // Group each report's region into one line.
    const lines = new Map<string, string[]>();
    for (const row of data) {
      const key = `${row.publisher ?? "Unknown"} ${row.period_label ?? row.period_year} | ${row.region}`;
      const pct = (v: number | null) => (v === null ? "N/A" : v.toFixed(2));
      const cell = `${row.forecast_year}: ${pct(row.change_pct)}% (prev ${pct(row.previous_change_pct)}%)`;
      lines.set(key, [...(lines.get(key) ?? []), cell]);
    }
    return [...lines].map(([key, cells]) => `${key} | ${cells.join(" ")}`).join("\n");
  } catch (err) {
    console.error("[chatAboutConstruction] DB error:", err);
    return "(database error — no data available)";
  }
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function callOpenAI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  contextText: string,
): Promise<ChatResult> {
  const question = messages[messages.length - 1]?.content ?? "";
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        messages,
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error("[chatAboutConstruction] OpenAI error:", await response.text());
      throw new Error(`OpenAI API error ${response.status}`);
    }

    const result = await response.json();
    const reply: string = result.choices?.[0]?.message?.content ?? "";

    return {
      response: reply.trim() || "I couldn't generate a response. Try rephrasing your question.",
      dataPoints: matchingLines(contextText, question),
    };
  } catch (err) {
    console.error("[chatAboutConstruction] OpenAI call failed:", err);
    return keywordFallback(question, contextText);
  }
}

// ---------------------------------------------------------------------------
// Fallback: keyword-based response
// ---------------------------------------------------------------------------

function keywordFallback(message: string, contextText: string): ChatResult {
  const lines = matchingLines(contextText, message);
  if (lines && lines.length > 0) {
    return {
      response: "Here are the forecasts I found:\n\n" + lines.join("\n"),
      dataPoints: lines,
    };
  }
  return {
    response:
      "I don't have data to answer that yet. Once reports are imported you can ask about tender price inflation forecasts by region and year.",
    dataPoints: null,
  };
}

function matchingLines(contextText: string, query: string): string[] | null {
  if (contextText === NO_DATA) return null;
  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  return contextText
    .split("\n")
    .filter((line) => keywords.some((kw) => line.toLowerCase().includes(kw)));
}
