import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all transcripts (metadata only - full content in Turso)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("transcripts").order("desc").collect();
  },
});

// Get a single transcript by ID
export const get = query({
  args: { id: v.id("transcripts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get a transcript by its Turso ID
export const getByTursoId = query({
  args: { tursoId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcripts")
      .withIndex("by_turso_id", (q) => q.eq("tursoId", args.tursoId))
      .first();
  },
});

// Sync a transcript from the desktop app
export const sync = mutation({
  args: {
    tursoId: v.string(),
    title: v.string(),
    meetingPlatform: v.optional(v.string()),
    participants: v.array(v.string()),
    durationSeconds: v.optional(v.number()),
    recordedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if transcript already exists
    const existing = await ctx.db
      .query("transcripts")
      .withIndex("by_turso_id", (q) => q.eq("tursoId", args.tursoId))
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        title: args.title,
        meetingPlatform: args.meetingPlatform,
        participants: args.participants,
        durationSeconds: args.durationSeconds,
      });
      return existing._id;
    }

    // Create new
    return await ctx.db.insert("transcripts", {
      tursoId: args.tursoId,
      title: args.title,
      meetingPlatform: args.meetingPlatform,
      participants: args.participants,
      durationSeconds: args.durationSeconds,
      recordedAt: args.recordedAt,
      createdAt: Date.now(),
    });
  },
});

// Delete a transcript
export const remove = mutation({
  args: { id: v.id("transcripts") },
  handler: async (ctx, args) => {
    // Also delete any entity proposals for this transcript
    const proposals = await ctx.db
      .query("entityProposals")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", args.id))
      .collect();

    for (const proposal of proposals) {
      await ctx.db.delete(proposal._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Get entity proposals for a transcript
export const getProposals = query({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("entityProposals")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", args.transcriptId))
      .collect();
  },
});

// Get all pending entity proposals
export const getPendingProposals = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("entityProposals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

// Create an entity proposal
export const createProposal = mutation({
  args: {
    transcriptId: v.id("transcripts"),
    entityType: v.string(),
    entityName: v.string(),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("entityProposals", {
      transcriptId: args.transcriptId,
      entityType: args.entityType,
      entityName: args.entityName,
      context: args.context,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Resolve an entity proposal (approve or dismiss)
export const resolveProposal = mutation({
  args: {
    id: v.id("entityProposals"),
    status: v.union(v.literal("approved"), v.literal("dismissed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      resolvedAt: Date.now(),
    });
  },
});
