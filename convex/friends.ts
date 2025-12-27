import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
// Send friend request
export const sendFriendRequest = mutation({
  args: {
    userId: v.id("users"),
    friendId: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (args.userId === args.friendId) {
      throw new Error("Cannot friend yourself");
    }

    // Check if friendship already exists
    const existing = await ctx.db
      .query("friendships")
      .withIndex("by_user_friend", (q) => q.eq("userId", args.userId).eq("friendId", args.friendId))
      .first();

    if (existing) {
      throw new Error("Friendship already exists");
    }

    // Check reverse direction
    const reverse = await ctx.db
      .query("friendships")
      .withIndex("by_user_friend", (q) => q.eq("userId", args.friendId).eq("friendId", args.userId))
      .first();

    if (reverse) {
      throw new Error("Friendship already exists");
    }

    const now = Date.now();
    await ctx.db.insert("friendships", {
      userId: args.userId,
      friendId: args.friendId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Send notification to friend
    const sender = await ctx.db.get(args.userId);
    const senderName = sender?.username || sender?.email || "Someone";

    return { success: true };
  },
});

// Accept friend request
export const acceptFriendRequest = mutation({
  args: {
    userId: v.id("users"),
    friendId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find the pending request
    const request = await ctx.db
      .query("friendships")
      .withIndex("by_user_friend", (q) => q.eq("userId", args.friendId).eq("friendId", args.userId))
      .first();

    if (!request || request.status !== "pending") {
      throw new Error("Friend request not found");
    }

    const now = Date.now();
    // Update the request to accepted
    await ctx.db.patch(request._id, {
      status: "accepted",
      updatedAt: now,
    });

    // Create reverse friendship
    const reverseExists = await ctx.db
      .query("friendships")
      .withIndex("by_user_friend", (q) => q.eq("userId", args.userId).eq("friendId", args.friendId))
      .first();

    if (!reverseExists) {
      await ctx.db.insert("friendships", {
        userId: args.userId,
        friendId: args.friendId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create or get DM chat
    const dmChat = await getOrCreateDMChat(ctx, args.userId, args.friendId);
    
    return { success: true, chatId: dmChat };
  },
});

// Helper function to get or create DM chat
async function getOrCreateDMChat(ctx: any, userId1: any, userId2: any) {
  // Check if DM chat already exists
  const existingChats = await ctx.db
    .query("chats")
    .withIndex("by_type", (q: any) => q.eq("type", "dm"))
    .collect();

  for (const chat of existingChats) {
    if (chat.members.length === 2 && 
        chat.members.includes(userId1) && 
        chat.members.includes(userId2)) {
      return chat._id;
    }
  }

  // Create new DM chat
  const now = Date.now();
  const chatId = await ctx.db.insert("chats", {
    type: "dm",
    members: [userId1, userId2],
    createdBy: userId1,
    createdAt: now,
    updatedAt: now,
  });

  // Add chat members
  await ctx.db.insert("chatMembers", {
    chatId,
    userId: userId1,
    joinedAt: now,
  });
  await ctx.db.insert("chatMembers", {
    chatId,
    userId: userId2,
    joinedAt: now,
  });

  return chatId;
}

// Remove friend
export const removeFriend = mutation({
  args: {
    userId: v.id("users"),
    friendId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Delete both directions
    const friendship1 = await ctx.db
      .query("friendships")
      .withIndex("by_user_friend", (q) => q.eq("userId", args.userId).eq("friendId", args.friendId))
      .first();

    if (friendship1) {
      await ctx.db.delete(friendship1._id);
    }

    const friendship2 = await ctx.db
      .query("friendships")
      .withIndex("by_user_friend", (q) => q.eq("userId", args.friendId).eq("friendId", args.userId))
      .first();

    if (friendship2) {
      await ctx.db.delete(friendship2._id);
    }

    return { success: true };
  },
});

// Get friends list
export const getFriends = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const friendships = await ctx.db
      .query("friendships")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "accepted"))
      .collect();

    const friends = await Promise.all(
      friendships.map(async (friendship) => {
        const friend = await ctx.db.get(friendship.friendId);
        if (!friend) return null;

        return {
          _id: friend._id,
          username: friend.username || friend.email || "Anonymous",
          avatar: friend.avatar,
          bio: friend.bio,
          status: friend.status || "offline",
          lastSeen: friend.lastSeen,
          currentGame: friend.currentGameId ? {
            id: friend.currentGameId,
            title: friend.currentGameTitle || "",
            launcher: friend.currentGameLauncher || "",
            icon: friend.currentGameIcon,
          } : null,
          friendshipId: friendship._id,
        };
      })
    );

    return friends.filter((f) => f !== null);
  },
});

// Get pending friend requests (sent and received)
export const getFriendRequests = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Sent requests
    const sent = await ctx.db
      .query("friendships")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "pending"))
      .collect();

    // Received requests
    const received = await ctx.db
      .query("friendships")
      .withIndex("by_friend", (q) => q.eq("friendId", args.userId))
      .collect();

    const receivedPending = received.filter((f) => f.status === "pending");

    const sentWithUsers = await Promise.all(
      sent.map(async (req) => {
        const user = await ctx.db.get(req.friendId);
        return {
          ...req,
          user: user ? {
            _id: user._id,
            username: user.username || user.email || "Anonymous",
            avatar: user.avatar,
          } : null,
        };
      })
    );

    const receivedWithUsers = await Promise.all(
      receivedPending.map(async (req) => {
        const user = await ctx.db.get(req.userId);
        return {
          ...req,
          user: user ? {
            _id: user._id,
            username: user.username || user.email || "Anonymous",
            avatar: user.avatar,
          } : null,
        };
      })
    );

    return {
      sent: sentWithUsers.filter((r) => r.user !== null),
      received: receivedWithUsers.filter((r) => r.user !== null),
    };
  },
});

// Search users
export const searchUsers = query({
  args: { query: v.string(), currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    if (args.query.length < 2) {
      return [];
    }

    // Get all users (in a real app, you'd want full-text search)
    const allUsers = await ctx.db.query("users").collect();

    const queryLower = args.query.toLowerCase();
    const matchingUsers = allUsers
      .filter((user) => {
        if (user._id === args.currentUserId) return false;
        const username = (user.username || "").toLowerCase();
        const email = user.email.toLowerCase();
        return username.includes(queryLower) || email.includes(queryLower);
      })
      .slice(0, 20); // Limit results

    // Check friendship status for each user
    const usersWithStatus = await Promise.all(
      matchingUsers.map(async (user) => {
        const friendship = await ctx.db
          .query("friendships")
          .withIndex("by_user_friend", (q) => q.eq("userId", args.currentUserId).eq("friendId", user._id))
          .first();

        return {
          _id: user._id,
          username: user.username || user.email || "Anonymous",
          avatar: user.avatar,
          bio: user.bio,
          status: user.status || "offline",
          friendshipStatus: friendship?.status || null,
        };
      })
    );

    return usersWithStatus;
  },
});

// Update user status
export const updateUserStatus = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(v.literal("online"), v.literal("away"), v.literal("busy"), v.literal("offline")),
    currentGame: v.optional(v.object({
      id: v.string(),
      title: v.string(),
      launcher: v.string(),
      icon: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if game just started (wasn't playing before, now is)
    const user = await ctx.db.get(args.userId);
    const wasPlaying = user?.currentGameId !== undefined;
    const isPlaying = args.currentGame !== undefined;
    const gameJustStarted = !wasPlaying && isPlaying;
    
    const updateData: any = {
      status: args.status,
      lastSeen: args.status === "offline" ? now : undefined,
      updatedAt: now,
    };
    
    if (args.currentGame) {
      updateData.currentGameId = args.currentGame.id;
      updateData.currentGameTitle = args.currentGame.title;
      updateData.currentGameLauncher = args.currentGame.launcher;
      updateData.currentGameIcon = args.currentGame.icon;
    } else {
      updateData.currentGameId = undefined;
      updateData.currentGameTitle = undefined;
      updateData.currentGameLauncher = undefined;
      updateData.currentGameIcon = undefined;
    }
    
    await ctx.db.patch(args.userId, updateData);
    
    return { success: true };
  },
});

