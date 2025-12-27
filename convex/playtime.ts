import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Start a playtime session
export const startPlaytimeSession = mutation({
  args: {
    userId: v.id("users"),
    gameId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get or create playtime record
    let playtimeRecord = await ctx.db
      .query("gamePlaytime")
      .withIndex("by_user_game", (q) => 
        q.eq("userId", args.userId).eq("gameId", args.gameId)
      )
      .first();

    if (!playtimeRecord) {
      // Create new playtime record
      const playtimeId = await ctx.db.insert("gamePlaytime", {
        userId: args.userId,
        gameId: args.gameId,
        totalPlaytime: 0,
        lastPlayed: now,
        sessions: [{
          startTime: now,
          duration: 0,
        }],
        createdAt: now,
        updatedAt: now,
      });
      playtimeRecord = await ctx.db.get(playtimeId);
    } else {
      // Add new session
      const sessions = playtimeRecord.sessions || [];
      sessions.push({
        startTime: now,
        duration: 0,
      });
      
      await ctx.db.patch(playtimeRecord._id, {
        lastPlayed: now,
        sessions: sessions,
        updatedAt: now,
      });
    }

    return { success: true, sessionStartTime: now };
  },
});

// End a playtime session
export const endPlaytimeSession = mutation({
  args: {
    userId: v.id("users"),
    gameId: v.string(),
    sessionStartTime: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionDuration = Math.floor((now - args.sessionStartTime) / 1000); // Duration in seconds
    
    // Get playtime record
    const playtimeRecord = await ctx.db
      .query("gamePlaytime")
      .withIndex("by_user_game", (q) => 
        q.eq("userId", args.userId).eq("gameId", args.gameId)
      )
      .first();

    if (!playtimeRecord) {
      // Shouldn't happen, but create if missing
      await ctx.db.insert("gamePlaytime", {
        userId: args.userId,
        gameId: args.gameId,
        totalPlaytime: sessionDuration,
        lastPlayed: now,
        sessions: [{
          startTime: args.sessionStartTime,
          endTime: now,
          duration: sessionDuration,
        }],
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, duration: sessionDuration };
    }

    // Update the last session with end time and duration
    const sessions = playtimeRecord.sessions || [];
    const lastSessionIndex = sessions.length - 1;
    
    if (lastSessionIndex >= 0 && sessions[lastSessionIndex].startTime === args.sessionStartTime) {
      sessions[lastSessionIndex] = {
        ...sessions[lastSessionIndex],
        endTime: now,
        duration: sessionDuration,
      };
    } else {
      // Session not found, add it
      sessions.push({
        startTime: args.sessionStartTime,
        endTime: now,
        duration: sessionDuration,
      });
    }

    // Calculate total playtime
    const totalPlaytime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);

    await ctx.db.patch(playtimeRecord._id, {
      totalPlaytime,
      lastPlayed: now,
      sessions: sessions,
      updatedAt: now,
    });

    return { success: true, duration: sessionDuration, totalPlaytime };
  },
});

// Get playtime for a game
export const getGamePlaytime = query({
  args: {
    userId: v.id("users"),
    gameId: v.string(),
  },
  handler: async (ctx, args) => {
    const playtimeRecord = await ctx.db
      .query("gamePlaytime")
      .withIndex("by_user_game", (q) => 
        q.eq("userId", args.userId).eq("gameId", args.gameId)
      )
      .first();

    if (!playtimeRecord) {
      return {
        totalPlaytime: 0,
        lastPlayed: null,
        sessions: [],
      };
    }

    return {
      totalPlaytime: playtimeRecord.totalPlaytime,
      lastPlayed: playtimeRecord.lastPlayed,
      sessions: playtimeRecord.sessions || [],
    };
  },
});

// Get all playtime records for a user
export const getUserPlaytime = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const playtimeRecords = await ctx.db
      .query("gamePlaytime")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return playtimeRecords.map(record => ({
      gameId: record.gameId,
      totalPlaytime: record.totalPlaytime,
      lastPlayed: record.lastPlayed,
      sessionCount: record.sessions?.length || 0,
    }));
  },
});

// Get friends' playtime for a specific game
export const getFriendsGamePlaytime = query({
  args: {
    userId: v.id("users"),
    gameId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user's friends
    const friendships = await ctx.db
      .query("friendships")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "accepted"))
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

    // Get playtime records for all friends for this game
    const friendsPlaytime = await Promise.all(
      allFriendIds.map(async (friendId) => {
        const playtimeRecord = await ctx.db
          .query("gamePlaytime")
          .withIndex("by_user_game", (q) => 
            q.eq("userId", friendId).eq("gameId", args.gameId)
          )
          .first();

        if (!playtimeRecord) return null;

        const friend = await ctx.db.get(friendId);
        if (!friend) return null;

        return {
          userId: friendId,
          username: friend.username || friend.email || "Anonymous",
          avatar: friend.avatar,
          totalPlaytime: playtimeRecord.totalPlaytime,
          lastPlayed: playtimeRecord.lastPlayed,
          sessionCount: playtimeRecord.sessions?.length || 0,
        };
      })
    );

    return friendsPlaytime
      .filter((pt): pt is NonNullable<typeof pt> => pt !== null)
      .sort((a, b) => b.lastPlayed - a.lastPlayed); // Sort by most recently played
  },
});

