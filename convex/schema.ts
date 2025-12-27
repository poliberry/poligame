import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    username: v.optional(v.string()),
    avatar: v.optional(v.string()), // Base64 encoded image or URL
    bio: v.optional(v.string()),
    steamUserId: v.optional(v.string()),
    epicUserId: v.optional(v.string()),
    eaUserId: v.optional(v.string()),
    rockstarUserId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Profile customization
    banner: v.optional(v.string()), // Banner image URL or base64
    customCss: v.optional(v.string()), // Custom CSS for profile
    // Privacy settings
    privacySettings: v.optional(v.object({
      profileVisibility: v.union(v.literal("public"), v.literal("friends"), v.literal("private")),
      showGameActivity: v.boolean(),
      showRecentlyPlayed: v.boolean(), // Show recently played games
      showLibrary: v.boolean(), // Show games in library
      showFriends: v.boolean(), // Show friend list
      showOnlineStatus: v.boolean(),
      allowFriendRequests: v.boolean(),
      allowMessages: v.union(v.literal("everyone"), v.literal("friends"), v.literal("none")),
    })),
    // Status
    status: v.optional(v.union(v.literal("online"), v.literal("away"), v.literal("busy"), v.literal("offline"))),
    lastSeen: v.optional(v.number()),
    // Currently playing
    currentGameId: v.optional(v.string()), // Game ID from local database
    currentGameTitle: v.optional(v.string()),
    currentGameLauncher: v.optional(v.string()),
    currentGameIcon: v.optional(v.string()),
    // 2FA
    twoFactorEnabled: v.optional(v.boolean()),
    twoFactorSecret: v.optional(v.string()), // TOTP secret
    twoFactorBackupCodes: v.optional(v.array(v.string())), // Backup codes
    // FCM tokens for push notifications (mobile only)
    fcmTokens: v.optional(v.array(v.object({
      token: v.string(),
      platform: v.union(v.literal("mobile"), v.literal("desktop")),
      deviceId: v.optional(v.string()),
      updatedAt: v.number(),
    }))),
    novuSubscriberId: v.optional(v.string()),
  }).index("by_email", ["email"]),
  
  // QR code login tokens
  qrLoginTokens: defineTable({
    token: v.string(), // Unique token for QR code
    userId: v.optional(v.id("users")), // User who authorized the login (set when mobile authorizes)
    scannedByUserId: v.optional(v.id("users")), // User who scanned the QR code (set when mobile scans)
    expiresAt: v.number(), // Expiration timestamp
    used: v.boolean(), // Whether the token has been used
    createdAt: v.number(),
    deviceName: v.optional(v.string()), // Name of the device requesting login
    location: v.optional(v.string()), // Approximate location
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),
  
  // Friends relationships
  friendships: defineTable({
    userId: v.id("users"),
    friendId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("blocked")), // pending = request sent, accepted = friends
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_friend", ["friendId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_friend", ["userId", "friendId"]),
  
  // Private messages (DMs)
  messages: defineTable({
    senderId: v.id("users"),
    recipientId: v.id("users"), // For DMs, or null for group chats
    chatId: v.optional(v.id("chats")), // For group chats
    content: v.string(),
    contentFormat: v.optional(v.union(v.literal("markdown"), v.literal("html"))),
    images: v.optional(v.array(v.string())),
    createdAt: v.number(),
    read: v.boolean(),
    readAt: v.optional(v.number()),
  })
    .index("by_sender", ["senderId"])
    .index("by_recipient", ["recipientId"])
    .index("by_chat", ["chatId"])
    .index("by_recipient_read", ["recipientId", "read"]),
  
  // Group chats
  chats: defineTable({
    name: v.optional(v.string()), // Optional name for group chats
    type: v.union(v.literal("dm"), v.literal("group")), // DM is a special type of chat with 2 members
    members: v.array(v.id("users")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.optional(v.number()),
    lastMessage: v.optional(v.string()),
  })
    .index("by_member", ["members"])
    .index("by_type", ["type"]),
  
  // Chat members (for easier querying)
  chatMembers: defineTable({
    chatId: v.id("chats"),
    userId: v.id("users"),
    joinedAt: v.number(),
    role: v.optional(v.union(v.literal("admin"), v.literal("member"))), // For group chats
  })
    .index("by_chat", ["chatId"])
    .index("by_user", ["userId"])
    .index("by_chat_user", ["chatId", "userId"]),
  
  // Forum posts for game discussions
  forumPosts: defineTable({
    gameId: v.string(), // Game ID from local database
    authorId: v.id("users"),
    title: v.string(),
    content: v.string(), // Markdown or HTML content
    contentFormat: v.optional(v.union(v.literal("markdown"), v.literal("html"))), // Content format
    images: v.optional(v.array(v.string())), // Array of image URLs or base64
    createdAt: v.number(),
    updatedAt: v.number(),
    // Legacy fields (for backward compatibility)
    upvotes: v.optional(v.number()),
    downvotes: v.optional(v.number()),
    // New fields
    likes: v.optional(v.array(v.id("users"))), // Users who liked this post
    commentCount: v.optional(v.number()), // Cached comment count
    isPinned: v.optional(v.boolean()), // Pinned posts
    isLocked: v.optional(v.boolean()), // Locked posts
  })
    .index("by_game", ["gameId"])
    .index("by_author", ["authorId"])
    .index("by_game_pinned", ["gameId", "isPinned"]),
  
  // Forum comments/replies
  forumComments: defineTable({
    postId: v.id("forumPosts"),
    authorId: v.id("users"),
    content: v.string(), // Markdown or HTML content
    contentFormat: v.optional(v.union(v.literal("markdown"), v.literal("html"))),
    images: v.optional(v.array(v.string())), // Array of image URLs or base64
    createdAt: v.number(),
    updatedAt: v.number(),
    // Legacy fields (for backward compatibility)
    upvotes: v.optional(v.number()),
    downvotes: v.optional(v.number()),
    // New fields
    likes: v.optional(v.array(v.id("users"))), // Users who liked this comment
    parentCommentId: v.optional(v.id("forumComments")), // For nested replies
    replyCount: v.optional(v.number()), // Cached reply count
  })
    .index("by_post", ["postId"])
    .index("by_author", ["authorId"])
    .index("by_parent", ["parentCommentId"]),
  
  // User customizations for games (won't be overridden by sync)
  gameCustomizations: defineTable({
    gameId: v.string(), // Game ID from local database
    userId: v.id("users"),
    customCoverArt: v.optional(v.string()), // Base64 or URL
    customGridCoverArt: v.optional(v.string()),
    customLogo: v.optional(v.string()),
    customHeroArt: v.optional(v.string()),
    customized: v.optional(v.boolean()), // Flag to indicate this game has been customized
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_user_game", ["userId", "gameId"]),

  // Global community forum posts (not game-specific)
  communityPosts: defineTable({
    authorId: v.id("users"),
    title: v.string(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    upvotes: v.array(v.id("users")),
    downvotes: v.array(v.id("users")),
  })
    .index("by_author", ["authorId"]),

  // Game playtime tracking
  gamePlaytime: defineTable({
    userId: v.id("users"),
    gameId: v.string(), // Game ID from local database
    totalPlaytime: v.number(), // Total playtime in seconds
    lastPlayed: v.number(), // Last played timestamp
    sessions: v.optional(v.array(v.object({
      startTime: v.number(),
      endTime: v.optional(v.number()),
      duration: v.number(), // Duration in seconds
    }))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_game", ["gameId"])
    .index("by_user_game", ["userId", "gameId"])
    .index("by_user_last_played", ["userId", "lastPlayed"]),

  // Game screenshots/media gallery
  gameScreenshots: defineTable({
    userId: v.id("users"),
    gameId: v.string(),
    imageUrl: v.string(), // Base64 or URL
    thumbnailUrl: v.optional(v.string()),
    caption: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_game", ["gameId"])
    .index("by_user_game", ["userId", "gameId"]),

  // XP system and achievements
  userXP: defineTable({
    userId: v.id("users"),
    totalXP: v.number(),
    level: v.number(),
    xpByGame: v.optional(v.array(v.object({
      gameId: v.string(),
      xp: v.number(),
    }))),
    achievements: v.optional(v.array(v.object({
      gameId: v.string(),
      achievementId: v.string(),
      unlockedAt: v.number(),
    }))),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Game activity feed
  gameActivity: defineTable({
    userId: v.id("users"),
    gameId: v.string(),
    activityType: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("achievement"),
      v.literal("screenshot")
    ),
    details: v.optional(v.string()), // JSON string for additional details
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_game", ["gameId"])
    .index("by_user_game", ["userId", "gameId"]),

  // Game tags and metadata
  gameTags: defineTable({
    gameId: v.string(),
    tag: v.string(),
    source: v.union(v.literal("auto"), v.literal("user"), v.literal("manual")),
    confidence: v.optional(v.number()), // For auto-tagged items
    createdAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_tag", ["tag"]),

  // User library (synced games)
  userLibrary: defineTable({
    userId: v.id("users"),
    gameId: v.string(),
    launcher: v.string(), // steam, epic, ea, rockstar
    addedAt: v.number(),
    lastPlayed: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_game", ["gameId"])
    .index("by_user_launcher", ["userId", "launcher"]),
});

