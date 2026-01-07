import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getOrCreate = mutation({
  args: {
    contextType: v.union(
      v.literal("document"),
      v.literal("entity"),
      v.literal("global"),
    ),
  },
  handler: async (ctx, args) => {
    // For now, just get the most recent session of this type
    // Later we might want per-document sessions
    const existing = await ctx.db.query("sessions").order("desc").first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("sessions", {
      contextType: args.contextType,
      createdAt: Date.now(),
    });
  },
});

export const create = mutation({
  args: {
    contextType: v.union(
      v.literal("document"),
      v.literal("entity"),
      v.literal("global"),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      contextType: args.contextType,
      createdAt: Date.now(),
    });
  },
});
