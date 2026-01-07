import type { TranscriptSegment } from "./turso";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const EXTRACTION_PROMPT = `You are an entity extraction system for a company knowledge base. Your job is to identify people, organizations, projects, and events mentioned in meeting transcripts.

## Entity Types
- person: Individual people mentioned by name
- organization: Companies, teams, departments
- project: Named initiatives, products, features
- event: Meetings, conferences, launches with specific names

## Guidelines
- Only extract entities that are clearly named (not generic references like "the team" or "that meeting")
- Include context about why this entity is relevant (the actual text that mentions them)
- Be conservative - only propose entities you're confident about
- If a person's role or company is mentioned, include that as context

## Output Format
Respond with valid JSON only:
{
  "entities": [
    {
      "type": "person" | "organization" | "project" | "event",
      "name": "Entity Name",
      "context": "The exact quote or summary from the transcript mentioning this entity"
    }
  ]
}

If no entities are found, return: {"entities": []}`;

export type ExtractedEntity = {
  type: string;
  name: string;
  context: string;
};

export type ExtractionResult = {
  entities: ExtractedEntity[];
};

export async function extractEntitiesFromTranscript(
  title: string,
  content: string,
  segments: TranscriptSegment[],
): Promise<ExtractionResult> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn(
      "VITE_OPENROUTER_API_KEY not set, skipping entity extraction",
    );
    return { entities: [] };
  }

  // Build the transcript text
  let transcriptText = `Meeting: ${title}\n\n`;

  if (segments.length > 0) {
    transcriptText += segments
      .map((s) => `${s.speaker}: ${s.text}`)
      .join("\n\n");
  } else if (content) {
    transcriptText += content;
  } else {
    return { entities: [] };
  }

  // Truncate if too long (keep first ~8000 chars to fit in context)
  if (transcriptText.length > 8000) {
    transcriptText = transcriptText.slice(0, 8000) + "\n\n[Transcript truncated]";
  }

  const model =
    import.meta.env.VITE_OPENROUTER_MODEL || "anthropic/claude-sonnet-4";

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Brain - Entity Extraction",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: `Extract entities from this transcript:\n\n${transcriptText}`,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent extraction
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Entity extraction API error:", error);
      return { entities: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { entities: [] };
    }

    // Parse the JSON response
    try {
      const parsed = JSON.parse(content);
      return {
        entities: parsed.entities || [],
      };
    } catch {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*"entities"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            entities: parsed.entities || [],
          };
        } catch {
          console.error("Failed to parse entity extraction response");
          return { entities: [] };
        }
      }
      return { entities: [] };
    }
  } catch (error) {
    console.error("Entity extraction failed:", error);
    return { entities: [] };
  }
}
