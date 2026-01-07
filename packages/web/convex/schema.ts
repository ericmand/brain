import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Chat sessions - groups messages together
  sessions: defineTable({
    contextType: v.union(
      v.literal("document"),
      v.literal("entity"),
      v.literal("global"),
    ),
    createdAt: v.number(),
  }),

  // Chat messages - immutable, append-only
  // Note: We treat this as immutable evidence. Messages are created, never updated or deleted.
  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

  // Proposed changes from AI - immutable record of what was proposed
  // Each message can have multiple changes (multi-file edits)
  changes: defineTable({
    messageId: v.id("messages"),
    sessionId: v.id("sessions"),
    documentId: v.string(), // "new" for create operations
    operation: v.union(
      v.literal("insert"),
      v.literal("replace"),
      v.literal("delete"),
      v.literal("create"),
    ),
    target: v.string(), // location for insert/replace/delete, or title for create
    content: v.optional(v.string()), // the proposed content (empty for delete)
    description: v.string(),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_session", ["sessionId"]),

  // Change resolutions - records when/how a change was resolved
  // Separate from changes to maintain immutability of the proposal
  changeResolutions: defineTable({
    changeId: v.id("changes"),
    status: v.union(v.literal("applied"), v.literal("dismissed")),
    resolvedAt: v.number(),
  }).index("by_change", ["changeId"]),

  // Transcripts - meeting recordings synced from desktop app
  transcripts: defineTable({
    tursoId: v.string(), // ID from Turso for cross-reference
    title: v.string(),
    meetingPlatform: v.optional(v.string()),
    participants: v.array(v.string()),
    durationSeconds: v.optional(v.number()),
    recordedAt: v.number(),
    createdAt: v.number(),
    // Note: Full content/segments stored in Turso, Convex just syncs metadata for real-time updates
  }).index("by_turso_id", ["tursoId"]),

  // Entity proposals extracted from transcripts
  entityProposals: defineTable({
    transcriptId: v.id("transcripts"),
    entityType: v.string(), // Person, Organization, Project, etc.
    entityName: v.string(),
    context: v.string(), // The transcript excerpt that led to this proposal
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("dismissed"),
    ),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_transcript", ["transcriptId"])
    .index("by_status", ["status"]),
});
