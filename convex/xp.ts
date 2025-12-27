import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Calculate level from total XP (exponential progression)
function calculateLevel(totalXP: number): number {
  // Level formula: level = floor(sqrt(totalXP / 100)) + 1
  // This means:
  // Level 1: 0-99 XP
  // Level 2: 100-399 XP
  // Level 3: 400-899 XP
  // Level 4: 900-1599 XP
  // etc.
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

// Calculate XP needed for next level
function xpForNextLevel(level: number): number {
  return Math.pow(level, 2) * 100;
}

// Add XP to user (called when user completes actions)
export const addXP = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    gameId: v.optional(v.string()),
    reason: v.optional(v.string()), // e.g., "game_completed", "achievement_unlocked", "screenshot_shared"
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get or create user XP record
    let userXP = await ctx.db
      .query("userXP")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!userXP) {
      // Create new XP record
      const xpId = await ctx.db.insert("userXP", {
        userId: args.userId,
        totalXP: args.amount,
        level: calculateLevel(args.amount),
        xpByGame: args.gameId ? [{ gameId: args.gameId, xp: args.amount }] : [],
        achievements: [],
        updatedAt: now,
      });
      const newUserXP = await ctx.db.get(xpId);
      if (!newUserXP) {
        throw new Error("Failed to create user XP record");
      }
      return { success: true, totalXP: newUserXP.totalXP, level: newUserXP.level };
    } else {
      // Update existing record
      const newTotalXP = userXP.totalXP + args.amount;
      const newLevel = calculateLevel(newTotalXP);
      
      // Update game-specific XP if gameId provided
      let xpByGame = userXP.xpByGame || [];
      if (args.gameId) {
        const gameIndex = xpByGame.findIndex((g) => g.gameId === args.gameId);
        if (gameIndex >= 0) {
          xpByGame[gameIndex] = {
            gameId: args.gameId,
            xp: xpByGame[gameIndex].xp + args.amount,
          };
        } else {
          xpByGame.push({ gameId: args.gameId, xp: args.amount });
        }
      }

      await ctx.db.patch(userXP._id, {
        totalXP: newTotalXP,
        level: newLevel,
        xpByGame,
        updatedAt: now,
      });

      return { success: true, totalXP: newTotalXP, level: newLevel };
    }
  },
});

// Get user XP
export const getUserXP = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userXP = await ctx.db
      .query("userXP")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!userXP) {
      return {
        totalXP: 0,
        level: 1,
        xpByGame: [],
        achievements: [],
        xpForNextLevel: xpForNextLevel(1),
        xpProgress: 0,
      };
    }

    const xpForNext = xpForNextLevel(userXP.level);
    const xpForCurrent = xpForNextLevel(userXP.level - 1);
    const xpProgress = ((userXP.totalXP - xpForCurrent) / (xpForNext - xpForCurrent)) * 100;

    return {
      totalXP: userXP.totalXP,
      level: userXP.level,
      xpByGame: userXP.xpByGame || [],
      achievements: userXP.achievements || [],
      xpForNextLevel: xpForNext,
      xpProgress: Math.min(100, Math.max(0, xpProgress)),
    };
  },
});

// Get leaderboard (top users by XP)
export const getLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    
    // Get all user XP records
    const allXP = await ctx.db.query("userXP").collect();
    
    // Sort by total XP descending
    const sorted = allXP.sort((a, b) => b.totalXP - a.totalXP).slice(0, limit);
    
    // Get user details for each
    const leaderboard = await Promise.all(
      sorted.map(async (xp) => {
        const user = await ctx.db.get(xp.userId);
        if (!user) return null;
        
        return {
          userId: xp.userId,
          username: user.username || user.email || "Anonymous",
          avatar: user.avatar,
          totalXP: xp.totalXP,
          level: xp.level,
          rank: sorted.indexOf(xp) + 1,
        };
      })
    );

    return leaderboard.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  },
});

// Get leaderboard for a specific game
export const getGameLeaderboard = query({
  args: {
    gameId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    
    // Get all user XP records
    const allXP = await ctx.db.query("userXP").collect();
    
    // Filter and sort by game-specific XP
    const gameXP = allXP
      .map((xp) => {
        const gameXPEntry = (xp.xpByGame || []).find((g) => g.gameId === args.gameId);
        return {
          xp,
          gameXP: gameXPEntry?.xp || 0,
        };
      })
      .filter((entry) => entry.gameXP > 0)
      .sort((a, b) => b.gameXP - a.gameXP)
      .slice(0, limit);
    
    // Get user details
    const leaderboard = await Promise.all(
      gameXP.map(async (entry, index) => {
        const user = await ctx.db.get(entry.xp.userId);
        if (!user) return null;
        
        return {
          userId: entry.xp.userId,
          username: user.username || user.email || "Anonymous",
          avatar: user.avatar,
          gameXP: entry.gameXP,
          rank: index + 1,
        };
      })
    );

    return leaderboard.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  },
});

// Unlock achievement (adds to user's achievements list)
export const unlockAchievement = mutation({
  args: {
    userId: v.id("users"),
    gameId: v.string(),
    achievementId: v.string(),
    xpReward: v.optional(v.number()), // Optional XP reward for unlocking
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get user XP record
    let userXP = await ctx.db
      .query("userXP")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!userXP) {
      // Create new XP record
      const xpId = await ctx.db.insert("userXP", {
        userId: args.userId,
        totalXP: args.xpReward || 0,
        level: calculateLevel(args.xpReward || 0),
        xpByGame: [],
        achievements: [{
          gameId: args.gameId,
          achievementId: args.achievementId,
          unlockedAt: now,
        }],
        updatedAt: now,
      });
      return { success: true };
    }

    // Check if achievement already unlocked
    const alreadyUnlocked = (userXP.achievements || []).some(
      (a) => a.gameId === args.gameId && a.achievementId === args.achievementId
    );

    if (alreadyUnlocked) {
      return { success: false, message: "Achievement already unlocked" };
    }

    // Add achievement
    const achievements = userXP.achievements || [];
    achievements.push({
      gameId: args.gameId,
      achievementId: args.achievementId,
      unlockedAt: now,
    });

    // Add XP if reward provided
    let newTotalXP = userXP.totalXP;
    if (args.xpReward) {
      newTotalXP = userXP.totalXP + args.xpReward;
    }

    await ctx.db.patch(userXP._id, {
      achievements,
      totalXP: newTotalXP,
      level: calculateLevel(newTotalXP),
      updatedAt: now,
    });

    return { success: true };
  },
});

