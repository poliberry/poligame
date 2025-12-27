import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Add a screenshot
export const addScreenshot = mutation({
  args: {
    userId: v.id("users"),
    gameId: v.string(),
    imageUrl: v.string(), // Base64 or URL
    thumbnailUrl: v.optional(v.string()),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const screenshotId = await ctx.db.insert("gameScreenshots", {
      userId: args.userId,
      gameId: args.gameId,
      imageUrl: args.imageUrl,
      thumbnailUrl: args.thumbnailUrl,
      caption: args.caption,
      createdAt: now,
    });

    return { success: true, screenshotId };
  },
});

// Get screenshots for a game
export const getGameScreenshots = query({
  args: {
    gameId: v.string(),
    userId: v.optional(v.id("users")), // If provided, only get user's screenshots
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("gameScreenshots")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId));

    const screenshots = await query.collect();

    // Filter by userId if provided
    const filtered = args.userId
      ? screenshots.filter((s) => s.userId === args.userId)
      : screenshots;

    // Sort by most recent first
    return filtered
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((screenshot) => ({
        _id: screenshot._id,
        userId: screenshot.userId,
        gameId: screenshot.gameId,
        imageUrl: screenshot.imageUrl,
        thumbnailUrl: screenshot.thumbnailUrl,
        caption: screenshot.caption,
        createdAt: screenshot.createdAt,
      }));
  },
});

// Get user's screenshots
export const getUserScreenshots = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const screenshots = await ctx.db
      .query("gameScreenshots")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by most recent first
    return screenshots
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((screenshot) => ({
        _id: screenshot._id,
        gameId: screenshot.gameId,
        imageUrl: screenshot.imageUrl,
        thumbnailUrl: screenshot.thumbnailUrl,
        caption: screenshot.caption,
        createdAt: screenshot.createdAt,
      }));
  },
});

// Delete a screenshot
export const deleteScreenshot = mutation({
  args: {
    screenshotId: v.id("gameScreenshots"),
    userId: v.id("users"), // Verify ownership
  },
  handler: async (ctx, args) => {
    const screenshot = await ctx.db.get(args.screenshotId);
    
    if (!screenshot) {
      throw new Error("Screenshot not found");
    }

    if (screenshot.userId !== args.userId) {
      throw new Error("Unauthorized: You can only delete your own screenshots");
    }

    await ctx.db.delete(args.screenshotId);
    return { success: true };
  },
});

// Update screenshot caption
export const updateScreenshotCaption = mutation({
  args: {
    screenshotId: v.id("gameScreenshots"),
    userId: v.id("users"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const screenshot = await ctx.db.get(args.screenshotId);
    
    if (!screenshot) {
      throw new Error("Screenshot not found");
    }

    if (screenshot.userId !== args.userId) {
      throw new Error("Unauthorized: You can only update your own screenshots");
    }

    await ctx.db.patch(args.screenshotId, {
      caption: args.caption,
    });

    return { success: true };
  },
});

