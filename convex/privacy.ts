import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get privacy settings
export const getPrivacySettings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    return user.privacySettings || {
      profileVisibility: "public",
      showGameActivity: true,
      showRecentlyPlayed: true,
      showLibrary: true,
      showFriends: true,
      showOnlineStatus: true,
      allowFriendRequests: true,
      allowMessages: "everyone",
    };
  },
});

// Update privacy settings
export const updatePrivacySettings = mutation({
  args: {
    userId: v.id("users"),
    privacySettings: v.object({
      profileVisibility: v.union(v.literal("public"), v.literal("friends"), v.literal("private")),
      showGameActivity: v.boolean(),
      showRecentlyPlayed: v.boolean(),
      showLibrary: v.boolean(),
      showFriends: v.boolean(),
      showOnlineStatus: v.boolean(),
      allowFriendRequests: v.boolean(),
      allowMessages: v.union(v.literal("everyone"), v.literal("friends"), v.literal("none")),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      privacySettings: args.privacySettings,
      updatedAt: now,
    });
    return { success: true };
  },
});

