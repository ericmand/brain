import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all messages for a session with their changes and resolution status
export const getBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    // For each message, get its changes and their resolution status
    const messagesWithChanges = await Promise.all(
      messages.map(async (message) => {
        const changes = await ctx.db
          .query("changes")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();

        // Get resolution status for each change
        const changesWithStatus = await Promise.all(
          changes.map(async (change) => {
            const resolution = await ctx.db
              .query("changeResolutions")
              .withIndex("by_change", (q) => q.eq("changeId", change._id))
              .first();

            return {
              ...change,
              status: resolution?.status ?? ("pending" as const),
            };
          }),
        );

        return {
          ...message,
          changes: changesWithStatus.length > 0 ? changesWithStatus : undefined,
        };
      }),
    );

    return messagesWithChanges;
  },
});

// Send a user message (immutable - just creates)
export const sendUserMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: "user",
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

// Send an assistant message with optional changes (immutable - just creates)
export const sendAssistantMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    changes: v.optional(
      v.array(
        v.object({
          documentId: v.string(),
          operation: v.union(
            v.literal("insert"),
            v.literal("replace"),
            v.literal("delete"),
            v.literal("create"),
          ),
          target: v.string(),
          content: v.optional(v.string()),
          description: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: "assistant",
      content: args.content,
      createdAt: Date.now(),
    });

    // Create change records if provided
    if (args.changes) {
      for (const change of args.changes) {
        await ctx.db.insert("changes", {
          messageId,
          sessionId: args.sessionId,
          documentId: change.documentId,
          operation: change.operation,
          target: change.target,
          content: change.content,
          description: change.description,
          createdAt: Date.now(),
        });
      }
    }

    return messageId;
  },
});

// Resolve a change (apply or dismiss) - creates immutable resolution record
export const resolveChange = mutation({
  args: {
    changeId: v.id("changes"),
    status: v.union(v.literal("applied"), v.literal("dismissed")),
  },
  handler: async (ctx, args) => {
    // Check if already resolved
    const existing = await ctx.db
      .query("changeResolutions")
      .withIndex("by_change", (q) => q.eq("changeId", args.changeId))
      .first();

    if (existing) {
      return existing._id; // Already resolved, don't create duplicate
    }

    return await ctx.db.insert("changeResolutions", {
      changeId: args.changeId,
      status: args.status,
      resolvedAt: Date.now(),
    });
  },
});

// Resolve all pending changes for a message
export const resolveAllChangesForMessage = mutation({
  args: {
    messageId: v.id("messages"),
    status: v.union(v.literal("applied"), v.literal("dismissed")),
  },
  handler: async (ctx, args) => {
    const changes = await ctx.db
      .query("changes")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    for (const change of changes) {
      // Check if already resolved
      const existing = await ctx.db
        .query("changeResolutions")
        .withIndex("by_change", (q) => q.eq("changeId", change._id))
        .first();

      if (!existing) {
        await ctx.db.insert("changeResolutions", {
          changeId: change._id,
          status: args.status,
          resolvedAt: Date.now(),
        });
      }
    }
  },
});

// Get pending changes for the session (for document store to apply)
export const getPendingChanges = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const changes = await ctx.db
      .query("changes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Filter to only pending (no resolution record)
    const pendingChanges = await Promise.all(
      changes.map(async (change) => {
        const resolution = await ctx.db
          .query("changeResolutions")
          .withIndex("by_change", (q) => q.eq("changeId", change._id))
          .first();

        return resolution ? null : change;
      }),
    );

    return pendingChanges.filter(Boolean);
  },
});
