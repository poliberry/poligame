import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Send a message (DM or group chat)
export const sendMessage = mutation({
  args: {
    senderId: v.id("users"),
    recipientId: v.optional(v.id("users")), // For DMs
    chatId: v.optional(v.id("chats")), // For group chats
    content: v.string(),
    contentFormat: v.optional(v.union(v.literal("markdown"), v.literal("html"))),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (!args.recipientId && !args.chatId) {
      throw new Error("Either recipientId or chatId must be provided");
    }

    let finalChatId = args.chatId;

    // If it's a DM, get or create the chat
    if (args.recipientId && !args.chatId) {
      // Find existing DM chat
      const existingChats = await ctx.db
        .query("chats")
        .withIndex("by_type", (q) => q.eq("type", "dm"))
        .collect();

      for (const chat of existingChats) {
        if (chat.members.length === 2 && 
            chat.members.includes(args.senderId) && 
            chat.members.includes(args.recipientId)) {
          finalChatId = chat._id;
          break;
        }
      }

      // Create new DM chat if it doesn't exist
      if (!finalChatId) {
        const now = Date.now();
        finalChatId = await ctx.db.insert("chats", {
          type: "dm",
          members: [args.senderId, args.recipientId],
          createdBy: args.senderId,
          createdAt: now,
          updatedAt: now,
        });

        // Add chat members
        await ctx.db.insert("chatMembers", {
          chatId: finalChatId,
          userId: args.senderId,
          joinedAt: now,
        });
        await ctx.db.insert("chatMembers", {
          chatId: finalChatId,
          userId: args.recipientId,
          joinedAt: now,
        });
      }
    }

    if (!finalChatId) {
      throw new Error("Chat not found");
    }

    const now = Date.now();
    const messageData: any = {
      senderId: args.senderId,
      chatId: finalChatId,
      content: args.content,
      contentFormat: args.contentFormat || "html",
      images: args.images || [],
      createdAt: now,
      read: false,
    };
    
    // Only include recipientId if it's provided (for DMs)
    if (args.recipientId) {
      messageData.recipientId = args.recipientId;
    }
    
    const messageId = await ctx.db.insert("messages", messageData);

    // Update chat's last message - strip HTML tags and get first 100 chars
    const plainText = args.content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .trim();
    
    await ctx.db.patch(finalChatId, {
      lastMessageAt: now,
      lastMessage: plainText.substring(0, 100), // First 100 chars
      updatedAt: now,
    });

    // Send notification to recipient(s)
    const sender = await ctx.db.get(args.senderId);
    const senderName = sender?.username || sender?.email || "Someone";

    return messageId;
  },
});

// Get messages for a chat
export const getChatMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();

    const messagesWithSenders = await Promise.all(
      messages.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);
        return {
          ...message,
          senderUsername: sender?.username || sender?.email || "Anonymous",
          senderAvatar: sender?.avatar,
        };
      })
    );

    return messagesWithSenders;
  },
});

// Get user's chats (DMs and groups)
export const getUserChats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all chats where user is a member
    const chatMemberships = await ctx.db
      .query("chatMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const chats = await Promise.all(
      chatMemberships.map(async (membership) => {
        const chat = await ctx.db.get(membership.chatId);
        if (!chat) return null;

        // Get other members (for DMs, get the other person)
        const otherMembers = await Promise.all(
          chat.members
            .filter((id) => id !== args.userId)
            .map(async (id) => {
              const user = await ctx.db.get(id);
              return user ? {
                _id: user._id,
                username: user.username || user.email || "Anonymous",
                avatar: user.avatar,
                status: user.status || "offline",
              } : null;
            })
        );

        return {
          ...chat,
          otherMembers: otherMembers.filter((m) => m !== null),
        };
      })
    );

    // Sort by last message time
    return chats
      .filter((c) => c !== null)
      .sort((a, b) => {
        const timeA = a!.lastMessageAt || a!.createdAt;
        const timeB = b!.lastMessageAt || b!.createdAt;
        return timeB - timeA;
      });
  },
});

// Mark messages as read
export const markMessagesAsRead = mutation({
  args: {
    chatId: v.id("chats"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();

    const now = Date.now();
    for (const message of messages) {
      if (message.senderId !== args.userId && !message.read) {
        await ctx.db.patch(message._id, {
          read: true,
          readAt: now,
        });
      }
    }

    return { success: true };
  },
});

// Create group chat
export const createGroupChat = mutation({
  args: {
    creatorId: v.id("users"),
    name: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const chatId = await ctx.db.insert("chats", {
      name: args.name,
      type: "group",
      members: [args.creatorId, ...args.memberIds],
      createdBy: args.creatorId,
      createdAt: now,
      updatedAt: now,
    });

    // Add all members
    await ctx.db.insert("chatMembers", {
      chatId,
      userId: args.creatorId,
      joinedAt: now,
      role: "admin",
    });

    for (const memberId of args.memberIds) {
      await ctx.db.insert("chatMembers", {
        chatId,
        userId: memberId,
        joinedAt: now,
        role: "member",
      });
    }

    return chatId;
  },
});

// Get unread message count for a user
export const getUnreadCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_recipient_read", (q) => q.eq("recipientId", args.userId).eq("read", false))
      .collect();

    return unreadMessages.length;
  },
});

