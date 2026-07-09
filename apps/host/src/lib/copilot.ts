// apps/host/src/lib/copilot.ts
//
// The Copilot is a narrator, never a judge: quality comes from the rubric, money from
// the chain, the model only translates state into a line a human reads in two seconds.
//
// It never falls silent on failure. It tries a live model first; on error, timeout,
// missing config, or empty parse it returns the deterministic fallback the client
// already folded from the shared reducer. The practicality surface never goes blank.
//
// The provider is pluggable so a budget-constrained operator has a $0 path:
//   - deterministic (default): no key, no network, works offline. What the demo ships.
//   - anthropic: set ANTHROPIC_API_KEY (claude-sonnet-4-6), the on-theme voice.
//   - any OpenAI-compatible endpoint: set COPILOT_BASE_URL (+ COPILOT_API_KEY,
//     COPILOT_MODEL). Covers free tiers (Groq, Google AI Studio) and local runtimes
//     (Ollama, LM Studio) with zero spend. The Copilot is a provider-agnostic narrator;
//     the product's real agents are the four strategies, not this line.

import type { RunSnapshot } from "@metriq/core";

const SYSTEM = `You are the efficiency commentator for a live agent spending race.
You receive a JSON snapshot. Reply with ONLY: { "line": string } - one sentence,
<= 140 chars, present tense, plain language, naming at most two agents,
about spend efficiency (value per OKB), never hype.`;

const TIMEOUT_MS = 3500;

// Pull a one-sentence line out of a model reply that may or may not be strict JSON.
function extractLine(text: string, fallback: string): string {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { line?: string };
    if (parsed.line && parsed.line.length > 0) return parsed.line.slice(0, 200);
  } catch {
    // not JSON; fall through to plain-text handling
  }
  // free models sometimes return a bare sentence: take the first non-empty line
  const firstLine = cleaned.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return firstLine ? firstLine.replace(/^["']|["']$/g, "").slice(0, 200) : fallback;
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, fallback: T): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

// Claude, via the Anthropic Messages API. The on-theme voice from the design doc.
async function readoutAnthropic(snapshot: RunSnapshot, key: string): Promise<string> {
  return withTimeout(async (signal) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.COPILOT_MODEL ?? "claude-sonnet-4-6",
        max_tokens: 200,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(snapshot) }],
      }),
      signal,
    });
    if (!res.ok) return snapshot.fallbackLine;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";
    return extractLine(text, snapshot.fallbackLine);
  }, snapshot.fallbackLine);
}

// Any OpenAI-compatible /chat/completions endpoint: Groq, Google AI Studio (OpenAI
// endpoint), OpenRouter, Ollama, LM Studio. The $0 path.
async function readoutOpenAICompatible(
  snapshot: RunSnapshot,
  baseUrl: string,
  key: string | undefined,
  model: string,
): Promise<string> {
  return withTimeout(async (signal) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 200,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(snapshot) },
        ],
      }),
      signal,
    });
    if (!res.ok) return snapshot.fallbackLine;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? "";
    return extractLine(text, snapshot.fallbackLine);
  }, snapshot.fallbackLine);
}

export async function readout(snapshot: RunSnapshot): Promise<string> {
  // Priority: an explicit OpenAI-compatible endpoint (free/local) wins, then Anthropic,
  // else the deterministic line. Default (nothing set) is fully offline and free.
  const baseUrl = process.env.COPILOT_BASE_URL;
  if (baseUrl) {
    const model = process.env.COPILOT_MODEL ?? "llama-3.3-70b-versatile";
    return readoutOpenAICompatible(snapshot, baseUrl, process.env.COPILOT_API_KEY, model);
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return readoutAnthropic(snapshot, anthropicKey);
  return snapshot.fallbackLine;
}
