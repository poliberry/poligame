import { query } from "./_generated/server";
import { v } from "convex/values";

// Get user's recently played games
export const getRecentlyPlayedGames = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    // Get playtime records sorted by last played
    const playtimeRecords = await ctx.db
      .query("gamePlaytime")
      .withIndex("by_user_last_played", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return playtimeRecords.map(record => ({
      gameId: record.gameId,
      lastPlayed: record.lastPlayed,
      totalPlaytime: record.totalPlaytime,
    }));
  },
});

// Get user's library games
export const getUserLibrary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const library = await ctx.db
      .query("userLibrary")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return library.map(item => ({
      gameId: item.gameId,
      launcher: item.launcher,
      addedAt: item.addedAt,
      lastPlayed: item.lastPlayed,
    }));
  },
});

// Get user's friends
export const getUserFriends = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get accepted friendships where user is either userId or friendId
    const friendships = await ctx.db
      .query("friendships")
      .withIndex("by_user_status", (q) => 
        q.eq("userId", args.userId).eq("status", "accepted")
      )
      .collect();

    const friendIds = friendships.map(f => f.friendId);
    
    // Also check reverse friendships
    const reverseFriendships = await ctx.db
      .query("friendships")
      .withIndex("by_friend", (q) => q.eq("friendId", args.userId))
      .collect();

    const reverseFriendIds = reverseFriendships
      .filter(f => f.status === "accepted")
      .map(f => f.userId);

    const allFriendIds = [...new Set([...friendIds, ...reverseFriendIds])];
    
    // Get friend user data
    const friends = await Promise.all(
      allFriendIds.map(async (friendId) => {
        const friend = await ctx.db.get(friendId);
        if (!friend) return null;
        return {
          userId: friend._id.toString(),
          username: friend.username,
          email: friend.email,
          avatar: friend.avatar,
          status: friend.status,
          currentGameTitle: friend.currentGameTitle,
        };
      })
    );

    return friends.filter(f => f !== null);
  },
});

// Check if viewer can see profile content based on privacy settings
export const canViewProfileContent = query({
  args: { 
    profileUserId: v.id("users"),
    viewerUserId: v.optional(v.id("users")),
    contentType: v.union(
      v.literal("profile"),
      v.literal("recentlyPlayed"),
      v.literal("library"),
      v.literal("friends")
    ),
  },
  handler: async (ctx, args) => {
    const profileUser = await ctx.db.get(args.profileUserId);
    if (!profileUser) return false;

    // If viewing own profile, always allow
    if (args.viewerUserId && args.viewerUserId === args.profileUserId) {
      return true;
    }

    const privacy = profileUser.privacySettings || {
      profileVisibility: "public",
      showGameActivity: true,
      showRecentlyPlayed: true,
      showLibrary: true,
      showFriends: true,
    };

    // Check profile visibility
    if (privacy.profileVisibility === "private") {
      return false;
    }

    if (privacy.profileVisibility === "friends") {
      if (!args.viewerUserId) return false;
      
      // TypeScript narrowing: after the check above, viewerUserId is definitely defined
      const viewerUserId = args.viewerUserId;
      
      // Check if viewer is a friend
      const friendship = await ctx.db
        .query("friendships")
        .withIndex("by_user_friend", (q) => 
          q.eq("userId", args.profileUserId).eq("friendId", viewerUserId)
        )
        .first();

      const reverseFriendship = await ctx.db
        .query("friendships")
        .withIndex("by_user_friend", (q) => 
          q.eq("userId", viewerUserId).eq("friendId", args.profileUserId)
        )
        .first();

      const isFriend = (friendship && friendship.status === "accepted") ||
                      (reverseFriendship && reverseFriendship.status === "accepted");

      if (!isFriend) return false;
    }

    // Check specific content visibility
    switch (args.contentType) {
      case "recentlyPlayed":
        return privacy.showRecentlyPlayed !== false;
      case "library":
        return privacy.showLibrary !== false;
      case "friends":
        return privacy.showFriends !== false;
      case "profile":
        return true; // Already checked above
      default:
        return false;
    }
  },
});

