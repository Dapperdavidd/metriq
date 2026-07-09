// apps/host/src/lib/copilot.ts
//
// The Copilot is a narrator, never a judge: quality comes from the rubric, money from
// the chain, the model only translates state into a line a human reads in two seconds.
//
// Change from the source draft: it does NOT fall silent on failure. It tries the live
// Claude call first; on error, timeout, missing key, or empty parse it returns the
// deterministic fallback the client already folded from the shared reducer. The
// practicality surface never goes blank in front of a judge.

import type { RunSnapshot } from "@metriq/core";

const SYSTEM = `You are the efficiency commentator for a live agent spending race.
You receive a JSON snapshot. Reply with ONLY: { "line": string } - one sentence,
<= 140 chars, present tense, plain language, naming at most two agents,
about spend efficiency (value per OKB), never hype.`;

const MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 3500;

export async function readout(snapshot: RunSnapshot): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return snapshot.fallbackLine;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(snapshot) }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return snapshot.fallbackLine;

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as { line?: string };
    return parsed.line && parsed.line.length > 0 ? parsed.line : snapshot.fallbackLine;
  } catch {
    return snapshot.fallbackLine; // a deterministic line beats a broken one
  } finally {
    clearTimeout(timer);
  }
}
