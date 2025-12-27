import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const updateGameCustomization = mutation({
  args: {
    gameId: v.string(),
    userId: v.id("users"),
    customCoverArt: v.optional(v.string()),
    customGridCoverArt: v.optional(v.string()),
    customLogo: v.optional(v.string()),
    customHeroArt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if customization already exists
    const existing = await ctx.db
      .query("gameCustomizations")
      .withIndex("by_user_game", (q) => 
        q.eq("userId", args.userId).eq("gameId", args.gameId)
      )
      .first();
    
    const now = Date.now();
    const updateData: any = {
      updatedAt: now,
      customized: true, // Mark as customized for launcher games
    };
    
    if (args.customCoverArt !== undefined) updateData.customCoverArt = args.customCoverArt;
    if (args.customGridCoverArt !== undefined) updateData.customGridCoverArt = args.customGridCoverArt;
    if (args.customLogo !== undefined) updateData.customLogo = args.customLogo;
    if (args.customHeroArt !== undefined) updateData.customHeroArt = args.customHeroArt;
    
    if (existing) {
      await ctx.db.patch(existing._id, updateData);
      return existing._id;
    } else {
      const id = await ctx.db.insert("gameCustomizations", {
        gameId: args.gameId,
        userId: args.userId,
        customCoverArt: args.customCoverArt,
        customGridCoverArt: args.customGridCoverArt,
        customLogo: args.customLogo,
        customHeroArt: args.customHeroArt,
        customized: true, // Mark as customized for launcher games
        createdAt: now,
        updatedAt: now,
      });
      return id;
    }
  },
});

export const getGameCustomization = query({
  args: {
    gameId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const customization = await ctx.db
      .query("gameCustomizations")
      .withIndex("by_user_game", (q) => 
        q.eq("userId", args.userId).eq("gameId", args.gameId)
      )
      .first();
    
    return customization;
  },
});

export const deleteGameCustomization = mutation({
  args: {
    gameId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find all customizations for this game and user
    const customizations = await ctx.db
      .query("gameCustomizations")
      .withIndex("by_user_game", (q) => 
        q.eq("userId", args.userId).eq("gameId", args.gameId)
      )
      .collect();
    
    // Delete all customizations
    for (const customization of customizations) {
      await ctx.db.delete(customization._id);
    }
    
    return { deleted: customizations.length };
  },
});

