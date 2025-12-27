import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Update user's current game activity
export const updateGameActivity = mutation({
  args: {
    userId: v.id("users"),
    gameId: v.optional(v.string()),
    gameTitle: v.optional(v.string()),
    gameLauncher: v.optional(v.string()),
    gameIcon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: any = {
      updatedAt: now,
    };

    if (args.gameId) {
      updates.currentGameId = args.gameId;
      updates.currentGameTitle = args.gameTitle;
      updates.currentGameLauncher = args.gameLauncher;
      updates.currentGameIcon = args.gameIcon;
      updates.status = "online";
    } else {
      // Game stopped
      updates.currentGameId = undefined;
      updates.currentGameTitle = undefined;
      updates.currentGameLauncher = undefined;
      updates.currentGameIcon = undefined;
    }

    await ctx.db.patch(args.userId, updates);
    return { success: true };
  },
});

// Get friends' game activity
export const getFriendsGameActivity = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all friends
    const friendships = await ctx.db
      .query("friendships")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "accepted"))
      .collect();

    const friendsWithActivity = await Promise.all(
      friendships.map(async (friendship) => {
        const friend = await ctx.db.get(friendship.friendId);
        if (!friend) return null;

        return {
          friendId: friend._id,
          username: friend.username || friend.email || "Anonymous",
          avatar: friend.avatar,
          status: friend.status || "offline",
          currentGame: friend.currentGameId ? {
            id: friend.currentGameId,
            title: friend.currentGameTitle || "Unknown Game",
            launcher: friend.currentGameLauncher,
            icon: friend.currentGameIcon,
          } : null,
        };
      })
    );

    return friendsWithActivity.filter((f) => f !== null);
  },
});

