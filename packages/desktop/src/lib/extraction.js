const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://brain.local",
    "X-Title": "Brain Desktop - Entity Extraction",
  },
});

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

// Extract entities from a transcript
async function extractEntities(title, transcript) {
  if (!process.env.OPENROUTER_KEY) {
    console.warn("OPENROUTER_KEY not set, skipping entity extraction");
    return { entities: [] };
  }

  // Build transcript text
  let transcriptText = `Meeting: ${title}\n\n`;

  if (Array.isArray(transcript)) {
    // It's an array of segments
    transcriptText += transcript
      .map((s) => `${s.speaker}: ${s.text}`)
      .join("\n\n");
  } else if (typeof transcript === "string") {
    transcriptText += transcript;
  } else {
    return { entities: [] };
  }

  // Truncate if too long
  if (transcriptText.length > 8000) {
    transcriptText =
      transcriptText.slice(0, 8000) + "\n\n[Transcript truncated]";
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "anthropic/claude-sonnet-4",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: `Extract entities from this transcript:\n\n${transcriptText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return { entities: [] };
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(content);
      return { entities: parsed.entities || [] };
    } catch {
      // Try to find JSON in response
      const jsonMatch = content.match(/\{[\s\S]*"entities"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return { entities: parsed.entities || [] };
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

module.exports = {
  extractEntities,
};
