// Sends report text to Groq's LLM and gets back:
//   - category: bug, feature_request, question, incident, other
//   - severity: low, medium, high
//   - summary: one-line summary of the report
//
// Falls back gracefully if the API is down or slow.

interface TriageResult {
  category: string;
  severity: string;
  summary: string;
}

export async function triageReport(
  title: string,
  description: string
): Promise<TriageResult> {
  const apiKey = process.env.GROQ_API_KEY;

  // If no API key, return defaults — don't break the flow
  if (!apiKey) {
    console.error("GROQ_API_KEY not set, skipping AI triage");
    return {
      category: "unknown",
      severity: "low",
      summary: title,
    };
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: `You are a report triage assistant. Analyze the report and respond with ONLY a JSON object, no other text:
{
  "category": "bug" | "feature_request" | "question" | "incident" | "spam" | "hate_speech" | "inappropriate_content" | "harassment" | "other",
  "severity": "low" | "medium" | "high",
  "summary": "one-line summary under 100 characters"
}

Rules:
- category: classify what type of report this is
- severity: assess urgency based on the content (override user-provided severity if the content clearly warrants it)
- summary: a concise one-line summary capturing the key issue
For reports about harmful content (spam, hate speech, sexual content, harassment), categorize accordingly and always set severity to "high"
- Respond with ONLY the JSON object, no markdown, no backticks, no explanation`,
            },
            {
              role: "user",
              content: `Title: ${title}\nDescription: ${description}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 150,
        }),
      }
    );

    if (!response.ok) {
      console.error("Groq API error:", response.status, await response.text());
      return { category: "unknown", severity: "low", summary: title };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Parse the JSON response — strip any markdown backticks if present
    const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
    const result = JSON.parse(cleaned);

    return {
      category: result.category ?? "unknown",
      severity: result.severity ?? "low",
      summary: result.summary ?? title,
    };
  } catch (error) {
    console.error("AI triage failed:", error);
    // Graceful fallback — the report still goes through
    return {
      category: "unknown",
      severity: "low",
      summary: title,
    };
  }
}