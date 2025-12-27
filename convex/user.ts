import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    username: v.optional(v.string()),
    avatar: v.optional(v.string()),
    bio: v.optional(v.string()),
    banner: v.optional(v.string()),
    customCss: v.optional(v.string()),
    steamUserId: v.optional(v.string()),
    epicUserId: v.optional(v.string()),
    eaUserId: v.optional(v.string()),
    rockstarUserId: v.optional(v.string()),
    novuSubscriberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    
    // Remove undefined values
    const updateData: any = { updatedAt: Date.now() };
    if (updates.username !== undefined) updateData.username = updates.username;
    if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
    if (updates.bio !== undefined) updateData.bio = updates.bio;
    if (updates.banner !== undefined) updateData.banner = updates.banner;
    if (updates.customCss !== undefined) updateData.customCss = updates.customCss;
    if (updates.steamUserId !== undefined) updateData.steamUserId = updates.steamUserId;
    if (updates.epicUserId !== undefined) updateData.epicUserId = updates.epicUserId;
    if (updates.eaUserId !== undefined) updateData.eaUserId = updates.eaUserId;
    if (updates.rockstarUserId !== undefined) updateData.rockstarUserId = updates.rockstarUserId;
    if (updates.novuSubscriberId !== undefined) updateData.novuSubscriberId = updates.novuSubscriberId;

    await ctx.db.patch(userId, updateData);

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    return {
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      banner: user.banner,
      customCss: user.customCss,
      steamUserId: user.steamUserId,
      epicUserId: user.epicUserId,
      eaUserId: user.eaUserId,
      rockstarUserId: user.rockstarUserId,
      updatedAt: user.updatedAt,
      novuSubscriberId: user.novuSubscriberId,
    };
  },
});

export const getUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});