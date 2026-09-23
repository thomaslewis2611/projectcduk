/**
 * Server function for AI-powered chat about UK construction price data.
 *
 * Uses the Vercel AI SDK with OpenAI as the default provider.
 * Falls back to keyword-based matching when no API key is configured.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const chatInputSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(messageSchema).max(20).optional(),
});

const SYSTEM_PROMPT = `You are a helpful assistant specialised in UK construction price data. 
You answer questions about build costs, price indices, and regional comparisons based on a database of UK construction price index reports. 

Key facts to know:
- The database contains price index values and price-per-sqft figures for various building types and regions across the UK.
- Build types include: Industrial & Logistics Sheds/Units, Offices, Retail, Warehouses, Residential (private and social), Hotels, Leisure, and more.
- Regions include all UK nations and English regions: North East England, North West England, Yorkshire and the Humber, East Midlands, West Midlands, Eastern England, South East England, South West England, London, Wales, Scotland, and Northern Ireland.
- Size bands are in sqft ranges (e.g. 50,000-100,000 sqft, 150,000-250,000 sqft).
- Price index values are base-period normalised (typically Q1 2021 = 100).
- Price-per-sqft figures are in GBP (£).

When answering:
- Reference specific data points with their quarter and year.
- For size bands, interpolate or explain nearest bands if the requested size falls between defined bands.
- Round prices to whole pounds (£) and indices to one decimal place.
- Be concise but specific — cite actual figures from the data.
- If you don't have data for a specific combination, say so clearly and suggest what data IS available.`;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResult = {
  response: string;
  /** Context lines that matched the question's keywords. */
  dataPoints: string[] | null;
};

export const chatAboutConstruction = createServerFn({ method: "POST" })
  .validator(chatInputSchema)
  .handler(async ({ data }): Promise<ChatResult> => {
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Gather context from the database
    const contextText = await buildDbSummary();
    if (contextText) {
      messages.push({
        role: "system",
        content: `Current database contents:\n${contextText}\n\nUse these figures to answer the user's questions. Only cite data from the database; if something isn't in the data, say you don't have it.`,
      });
    }

    // Add conversation history
    if (data.history) {
      for (const msg of data.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add the current user message
    messages.push({ role: "user", content: data.message });

    // Try OpenAI first, then Anthropic, then fall back to keyword search
    const apiKey =
      process.env.OPENAI_API_KEY ?? (globalThis as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;

    if (apiKey) {
      return await callOpenAI(apiKey, messages, contextText);
    }

    const anthropicKey =
      process.env.ANTHROPIC_API_KEY ??
      (globalThis as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY;
    if (anthropicKey) {
      return await callAnthropic(anthropicKey, messages, contextText);
    }

    // Fallback: keyword-based response
    return await keywordFallback(data.message, contextText);
  });

// ---------------------------------------------------------------------------
// Database context builder
// ---------------------------------------------------------------------------

async function buildDbSummary(): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from("price_index_rows")
      .select("year, quarter, region, building_type, size_band, index_value, price_per_sqft")
      .order("year", { nullsFirst: false })
      .order("quarter", { nullsFirst: false });

    if (error || !data || data.length === 0) {
      return "(no data available — upload PDF reports first)";
    }

    return data
      .map((row) => {
        const period = row.quarter ?? `${row.year ?? "Unknown period"}`;
        const region = row.region ?? "Unknown region";
        const bt = row.building_type ?? "Unknown type";
        const sb = row.size_band ?? "Unknown size";
        const idx = row.index_value ?? "N/A";
        const price = row.price_per_sqft ? `£${row.price_per_sqft}/sqft` : "N/A";
        return `${period} | ${region} | ${bt} | ${sb} | Index=${idx} | ${price}`;
      })
      .join("\n");
  } catch (err) {
    console.error("[chatAboutConstruction] DB error:", err);
    return "(database error — no data available)";
  }
}

// ---------------------------------------------------------------------------
// OpenAI integration
// ---------------------------------------------------------------------------

async function callOpenAI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  contextText: string,
): Promise<ChatResult> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[chatAboutConstruction] OpenAI error:", err);
      throw new Error("OpenAI API error");
    }

    const result = await response.json();
    const reply = result.choices?.[0]?.message?.content ?? "";

    return {
      response: reply.trim() || "I couldn't generate a response. Try rephrasing your question.",
      dataPoints: extractDataPoints(contextText, messages[messages.length - 1]?.content ?? ""),
    };
  } catch (err) {
    console.error("[chatAboutConstruction] OpenAI call failed:", err);
    return await keywordFallback(messages[messages.length - 1]?.content ?? "", contextText);
  }
}

// ---------------------------------------------------------------------------
// Anthropic integration
// ---------------------------------------------------------------------------

async function callAnthropic(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  contextText: string,
): Promise<ChatResult> {
  // Separate system messages from user/assistant messages
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const antdMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        system,
        messages: antdMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[chatAboutConstruction] Anthropic error:", err);
      throw new Error("Anthropic API error");
    }

    const result = await response.json();
    const content = result.content?.[0]?.text ?? "";

    return {
      response: content.trim() || "I couldn't generate a response. Try rephrasing your question.",
      dataPoints: extractDataPoints(contextText, messages[messages.length - 1]?.content ?? ""),
    };
  } catch (err) {
    console.error("[chatAboutConstruction] Anthropic call failed:", err);
    return await keywordFallback(messages[messages.length - 1]?.content ?? "", contextText);
  }
}

// ---------------------------------------------------------------------------
// Fallback: keyword-based response
// ---------------------------------------------------------------------------

async function keywordFallback(message: string, contextText: string): Promise<ChatResult> {
  const keywords = message
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  const matchingLines = contextText
    .split("\n")
    .filter(
      (line) =>
        line !== "(no data available — upload PDF reports first)" &&
        keywords.some((kw) => line.toLowerCase().includes(kw)),
    );

  if (matchingLines.length > 0) {
    return {
      response: "Here are the data points I found:\n\n" + matchingLines.join("\n"),
      dataPoints: matchingLines,
    };
  }

  return {
    response:
      "I don't have enough data to answer that yet. Please upload PDF reports so I can provide specific figures. You can also ask me to compare data across regions, building types, or time periods once reports are uploaded.",
    dataPoints: null,
  };
}

// ---------------------------------------------------------------------------
// Extract data points from context for structured results
// ---------------------------------------------------------------------------

function extractDataPoints(contextText: string, query: string): string[] | null {
  if (contextText.includes("no data available")) return null;

  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  return contextText
    .split("\n")
    .filter((line) => keywords.some((kw) => line.toLowerCase().includes(kw)));
}
