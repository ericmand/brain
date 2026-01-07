const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are a helpful AI assistant embedded in a knowledge management app. You help users with conversations, analysis, and making changes to documents and entities.

## About the user
You're likely talking to a founder, PM, or operator at an early-stage company. They're busy, pragmatic, and appreciate directness.

## Tools
You have tools to explore the workspace:

Documents:
- list_documents: See all documents in the workspace
- read_document: Read the full content of a specific document
- search_documents: Search for text across all documents

Entities (the knowledge graph):
- list_entities: List all entities (people, organizations, projects, events)
- get_entity: Get full details of an entity including properties and relationships
- search_entities: Search entities by name
- create_entity: Create a new entity
- create_relationship: Create a relationship between two entities

Use these tools to gather context before responding. Don't assume you know what's in documents or entities - read them first if relevant.

## Making Changes
When you want to propose changes to documents, respond with a JSON object containing a "changes" array.

Response format (always valid JSON, no markdown code blocks):

For general conversation:
{
  "message": "Your response here."
}

When proposing changes:
{
  "message": "Your explanation of what you're proposing",
  "changes": [
    {
      "documentId": "id of document to change (use 'new' for creating a new document)",
      "description": "Brief description of this change",
      "operation": "insert" | "replace" | "delete" | "create",
      "target": "Where to make the change, or document title for create",
      "content": "<HTML content>"
    }
  ]
}

## Operations
- "insert": Add content (target: "after <heading>", "before <heading>", "at the end", "at the beginning")
- "replace": Replace a section (target: "replace <section name>")
- "delete": Remove a section (target: "delete <section name>")
- "create": Create new document (documentId: "new", target: document title)

## Guidelines
- Use tools to explore before answering questions about the workspace
- Be conversational and natural
- You can propose changes to multiple documents at once
- Only suggest changes when the user wants to modify content
- Use semantic HTML: <h1>-<h3>, <p>, <ul>/<li>, <strong>, <em>
- Keep changes focused and minimal`;

// Tool definitions for OpenRouter
const TOOLS = [
  // Document tools
  {
    type: "function" as const,
    function: {
      name: "list_documents",
      description:
        "List all documents in the workspace with their IDs, titles, and paths",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_document",
      description: "Read the full content of a document by its ID",
      parameters: {
        type: "object",
        properties: {
          documentId: {
            type: "string",
            description: "The ID of the document to read",
          },
        },
        required: ["documentId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_documents",
      description:
        "Search for text across all documents. Returns matching documents with snippets.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query (case-insensitive)",
          },
        },
        required: ["query"],
      },
    },
  },
  // Entity tools
  {
    type: "function" as const,
    function: {
      name: "list_entities",
      description:
        "List all entities in the knowledge graph, optionally filtered by type",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["person", "organization", "project", "event"],
            description: "Optional filter by entity type",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_entity",
      description:
        "Get full details of an entity including properties and relationships",
      parameters: {
        type: "object",
        properties: {
          entityId: {
            type: "string",
            description: "The ID of the entity to get",
          },
        },
        required: ["entityId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_entities",
      description: "Search for entities by name",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query (case-insensitive name match)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_entity",
      description: "Create a new entity in the knowledge graph",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["person", "organization", "project", "event"],
            description: "The type of entity to create",
          },
          name: {
            type: "string",
            description: "The name of the entity",
          },
          properties: {
            type: "object",
            description:
              "Optional properties for the entity (e.g., role, email, website)",
          },
        },
        required: ["type", "name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_relationship",
      description: "Create a relationship between two entities",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "works_at",
              "owns",
              "participated_in",
              "mentioned_in",
              "decided",
              "reports_to",
              "client_of",
              "investor_in",
              "founded",
              "member_of",
            ],
            description: "The type of relationship",
          },
          subjectId: {
            type: "string",
            description: "The ID of the subject entity (who/what is doing)",
          },
          objectId: {
            type: "string",
            description:
              "The ID of the object entity (to whom/what it is done)",
          },
          properties: {
            type: "object",
            description:
              "Optional properties for the relationship (e.g., role, since)",
          },
        },
        required: ["type", "subjectId", "objectId"],
      },
    },
  },
];

export type AIChange = {
  documentId: string;
  description: string;
  operation: "insert" | "replace" | "delete" | "create";
  target: string;
  content?: string;
};

export type AIResponse = {
  message: string;
  changes?: AIChange[];
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type DocumentContext = {
  id: string;
  path: string;
  title: string;
  content: string;
  frontmatter?: Record<string, string>;
  frontmatterRaw?: string | null;
};

export type EntityContext = {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
};

export type RelationshipContext = {
  id: string;
  type: string;
  subject_id: string;
  object_id: string;
  properties: Record<string, unknown>;
};

export type WorkspaceContext = {
  documents: DocumentContext[];
  entities: EntityContext[];
  relationships: RelationshipContext[];
  activeDocumentId: string | null;
};

// Tool handlers
function handleListDocuments(workspace: WorkspaceContext): string {
  const docs = workspace.documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    path: doc.path,
    isActive: doc.id === workspace.activeDocumentId,
  }));
  return JSON.stringify(docs, null, 2);
}

function handleReadDocument(
  workspace: WorkspaceContext,
  documentId: string,
): string {
  const doc = workspace.documents.find((d) => d.id === documentId);
  if (!doc) {
    return JSON.stringify({ error: `Document not found: ${documentId}` });
  }
  return JSON.stringify(
    {
      id: doc.id,
      title: doc.title,
      path: doc.path,
      content: doc.content,
      frontmatter: doc.frontmatter,
      frontmatterRaw: doc.frontmatterRaw,
    },
    null,
    2,
  );
}

function handleSearchDocuments(
  workspace: WorkspaceContext,
  query: string,
): string {
  const lowerQuery = query.toLowerCase();
  const results = workspace.documents
    .filter(
      (doc) =>
        doc.content.toLowerCase().includes(lowerQuery) ||
        (doc.frontmatterRaw || "").toLowerCase().includes(lowerQuery) ||
        doc.title.toLowerCase().includes(lowerQuery),
    )
    .map((doc) => {
      // Find snippet around match
      const lowerContent = doc.content.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);
      let snippet = "";
      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(
          doc.content.length,
          matchIndex + query.length + 50,
        );
        snippet = doc.content.slice(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < doc.content.length) snippet = snippet + "...";
      }
      return {
        id: doc.id,
        title: doc.title,
        snippet,
      };
    });

  return JSON.stringify({ query, matches: results }, null, 2);
}

// Entity tool handlers
function handleListEntities(
  workspace: WorkspaceContext,
  type?: string,
): string {
  let entities = workspace.entities;
  if (type) {
    entities = entities.filter((e) => e.type === type);
  }
  return JSON.stringify(
    entities.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
    })),
    null,
    2,
  );
}

function handleGetEntity(
  workspace: WorkspaceContext,
  entityId: string,
): string {
  const entity = workspace.entities.find((e) => e.id === entityId);
  if (!entity) {
    return JSON.stringify({ error: `Entity not found: ${entityId}` });
  }

  // Get relationships for this entity
  const relationships = workspace.relationships
    .filter((r) => r.subject_id === entityId || r.object_id === entityId)
    .map((r) => {
      const isOutgoing = r.subject_id === entityId;
      const otherEntityId = isOutgoing ? r.object_id : r.subject_id;
      const otherEntity = workspace.entities.find(
        (e) => e.id === otherEntityId,
      );
      return {
        id: r.id,
        type: r.type,
        direction: isOutgoing ? "outgoing" : "incoming",
        otherEntity: otherEntity
          ? {
              id: otherEntity.id,
              name: otherEntity.name,
              type: otherEntity.type,
            }
          : { id: otherEntityId },
        properties: r.properties,
      };
    });

  return JSON.stringify(
    {
      ...entity,
      relationships,
    },
    null,
    2,
  );
}

function handleSearchEntities(
  workspace: WorkspaceContext,
  query: string,
): string {
  const lowerQuery = query.toLowerCase();
  const results = workspace.entities
    .filter((e) => e.name.toLowerCase().includes(lowerQuery))
    .map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
    }));

  return JSON.stringify({ query, matches: results }, null, 2);
}

// Entity mutation handlers - these need to be async
// We'll store mutations to be applied after the AI response
type EntityMutation =
  | {
      type: "create_entity";
      entityType: string;
      name: string;
      properties?: Record<string, unknown>;
    }
  | {
      type: "create_relationship";
      relType: string;
      subjectId: string;
      objectId: string;
      properties?: Record<string, unknown>;
    };

let pendingMutations: EntityMutation[] = [];

export function getPendingEntityMutations(): EntityMutation[] {
  const mutations = [...pendingMutations];
  pendingMutations = [];
  return mutations;
}

function handleCreateEntity(
  entityType: string,
  name: string,
  properties?: Record<string, unknown>,
): string {
  // Queue the mutation to be applied after the response
  const tempId = `pending-${entityType}-${Date.now()}`;
  pendingMutations.push({
    type: "create_entity",
    entityType,
    name,
    properties,
  });

  return JSON.stringify({
    success: true,
    message: `Entity "${name}" will be created`,
    tempId,
  });
}

function handleCreateRelationship(
  relType: string,
  subjectId: string,
  objectId: string,
  properties?: Record<string, unknown>,
): string {
  pendingMutations.push({
    type: "create_relationship",
    relType,
    subjectId,
    objectId,
    properties,
  });

  return JSON.stringify({
    success: true,
    message: `Relationship ${relType} will be created between ${subjectId} and ${objectId}`,
  });
}

// Execute a tool call
function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  workspace: WorkspaceContext,
): string {
  switch (toolName) {
    // Document tools
    case "list_documents":
      return handleListDocuments(workspace);
    case "read_document":
      return handleReadDocument(workspace, args.documentId as string);
    case "search_documents":
      return handleSearchDocuments(workspace, args.query as string);
    // Entity tools
    case "list_entities":
      return handleListEntities(workspace, args.type as string | undefined);
    case "get_entity":
      return handleGetEntity(workspace, args.entityId as string);
    case "search_entities":
      return handleSearchEntities(workspace, args.query as string);
    case "create_entity":
      return handleCreateEntity(
        args.type as string,
        args.name as string,
        args.properties as Record<string, unknown> | undefined,
      );
    case "create_relationship":
      return handleCreateRelationship(
        args.type as string,
        args.subjectId as string,
        args.objectId as string,
        args.properties as Record<string, unknown> | undefined,
      );
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
};

export async function chatWithAI(
  workspace: WorkspaceContext,
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): Promise<AIResponse> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn("VITE_OPENROUTER_API_KEY not set, using mock response");
    return getMockResponse(userMessage, workspace);
  }

  const model =
    import.meta.env.VITE_OPENROUTER_MODEL || "anthropic/claude-sonnet-4";

  // Build initial messages
  const messages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  // Tool use loop - keep calling until we get a final response
  const MAX_TOOL_ITERATIONS = 10;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Brain - AI Knowledge Management",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: TOOLS,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      throw new Error("No response from AI");
    }

    // Check if there are tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls to history
      messages.push({
        role: "assistant",
        content: assistantMessage.content || "",
        tool_calls: assistantMessage.tool_calls,
      });

      // Execute each tool call and add results
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          args = {};
        }

        console.log(`[AI Tool] ${toolName}`, args);
        const result = executeTool(toolName, args, workspace);
        console.log(
          `[AI Tool Result]`,
          result.slice(0, 200) + (result.length > 200 ? "..." : ""),
        );

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Continue loop to get next response
      continue;
    }

    // No tool calls - this is the final response
    const content = assistantMessage.content;
    if (!content) {
      return { message: "" };
    }

    // Parse the JSON response - try to extract JSON even if there's surrounding text
    try {
      // First try direct parse
      const parsed = JSON.parse(content);
      return {
        message: parsed.message || "",
        changes: parsed.changes || undefined,
      };
    } catch {
      // Try to find JSON object in the response
      const jsonMatch = content.match(/\{[\s\S]*"message"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            message: parsed.message || "",
            changes: parsed.changes || undefined,
          };
        } catch {
          // Fall through to plain message
        }
      }

      // If still can't parse, return as plain message
      return {
        message: content,
        changes: undefined,
      };
    }
  }

  throw new Error("Max tool iterations reached");
}

// Mock response for development without API key
function getMockResponse(
  userMessage: string,
  workspace: WorkspaceContext,
): AIResponse {
  const lower = userMessage.toLowerCase();
  const activeDoc = workspace.documents.find(
    (d) => d.id === workspace.activeDocumentId,
  );

  if (lower.includes("add") && lower.includes("mobile")) {
    return {
      message:
        "I'll add a Mobile App section to the Roadmap and create a tracking decision in the Decisions Log.",
      changes: [
        {
          documentId: "roadmap",
          description: "Add Mobile App section to Q2 2025",
          operation: "insert",
          target: "after Q2 2025",
          content: `<h3>Mobile App</h3>
<ul>
  <li>iOS app (React Native)</li>
  <li>Push notifications</li>
  <li>Offline support</li>
</ul>`,
        },
        {
          documentId: "decisions",
          description: "Add mobile decision to Decisions Log",
          operation: "insert",
          target: "at the end",
          content: `<h2>2025-01-06: Mobile App</h2>
<p>Decided to build mobile app with React Native for cross-platform support.</p>
<p><strong>Rationale:</strong> Code sharing with web, faster iteration.</p>`,
        },
      ],
    };
  }

  if (lower.includes("create") || lower.includes("new doc")) {
    return {
      message: "I'll create a new document for you.",
      changes: [
        {
          documentId: "new",
          description: "Create new document",
          operation: "create",
          target: "Meeting Notes",
          content: `<h1>Meeting Notes</h1>
<p>Notes from today's discussion.</p>`,
        },
      ],
    };
  }

  if (
    lower.includes("add") &&
    (lower.includes("section") || lower.includes("item"))
  ) {
    return {
      message: `I'll add that to ${activeDoc?.title || "the document"}.`,
      changes: activeDoc
        ? [
            {
              documentId: activeDoc.id,
              description: "Add new section",
              operation: "insert",
              target: "at the end",
              content: `<h2>New Section</h2>
<p>Content goes here.</p>`,
            },
          ]
        : undefined,
    };
  }

  if (
    lower.includes("hello") ||
    lower.includes("hi ") ||
    lower.includes("hey")
  ) {
    return { message: "Hey! What's on your mind?" };
  }

  if (lower.includes("?")) {
    return {
      message:
        "Good question. I'm in mock mode (no API key). Add VITE_OPENROUTER_API_KEY to .env.local for real responses.",
    };
  }

  return {
    message: `I can see ${workspace.documents.length} documents in your workspace. I'm in mock mode — set VITE_OPENROUTER_API_KEY for real AI. Try "add mobile app" to test multi-doc edits.`,
  };
}
