import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createPost = mutation({
  args: {
    gameId: v.string(),
    authorId: v.id("users"),
    title: v.string(),
    content: v.string(),
    contentFormat: v.optional(v.union(v.literal("markdown"), v.literal("html"))),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const postId = await ctx.db.insert("forumPosts", {
      gameId: args.gameId,
      authorId: args.authorId,
      title: args.title,
      content: args.content,
      contentFormat: args.contentFormat || "html",
      images: args.images || [],
      createdAt: now,
      updatedAt: now,
      likes: [],
      commentCount: 0,
      isPinned: false,
      isLocked: false,
      // Legacy fields for backward compatibility
      upvotes: 0,
      downvotes: 0,
    });
    
    return postId;
  },
});

export const getPostsForGame = query({
  args: { gameId: v.string() },
  handler: async (ctx, args) => {
    // Get pinned posts first
    const pinnedPosts = await ctx.db
      .query("forumPosts")
      .withIndex("by_game_pinned", (q) => q.eq("gameId", args.gameId).eq("isPinned", true))
      .order("desc")
      .collect();
    
    // Get regular posts
    const regularPosts = await ctx.db
      .query("forumPosts")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .collect();
    
    // Filter out pinned posts from regular posts and combine
    const regularPostIds = new Set(pinnedPosts.map(p => p._id));
    const filteredRegular = regularPosts.filter(p => !regularPostIds.has(p._id));
    
    const allPosts = [...pinnedPosts, ...filteredRegular];
    
    // Fetch author info for each post and normalize data
    const postsWithAuthors = await Promise.all(
      allPosts.map(async (post) => {
        const author = await ctx.db.get(post.authorId);
        // Normalize likes - ensure it exists and is an array
        let likes = post.likes || [];
        if (!Array.isArray(likes)) {
          likes = [];
        }
        return {
          ...post,
          likes,
          commentCount: post.commentCount || 0,
          contentFormat: post.contentFormat || "html",
          images: post.images || [],
          isPinned: post.isPinned || false,
          isLocked: post.isLocked || false,
          authorUsername: author?.username || author?.email || "Anonymous",
          authorAvatar: author?.avatar,
        };
      })
    );
    
    return postsWithAuthors;
  },
});

export const getPostById = query({
  args: { postId: v.id("forumPosts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;
    
    const author = await ctx.db.get(post.authorId);
    // Normalize likes - ensure it exists and is an array
    let likes = post.likes || [];
    if (!Array.isArray(likes)) {
      likes = [];
    }
    return {
      ...post,
      likes,
      commentCount: post.commentCount || 0,
      contentFormat: post.contentFormat || "html",
      images: post.images || [],
      isPinned: post.isPinned || false,
      isLocked: post.isLocked || false,
      authorUsername: author?.username || author?.email || "Anonymous",
      authorAvatar: author?.avatar,
    };
  },
});

export const updatePost = mutation({
  args: {
    postId: v.id("forumPosts"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    contentFormat: v.optional(v.union(v.literal("markdown"), v.literal("html"))),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    
    const updates: any = {
      updatedAt: Date.now(),
    };
    
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.contentFormat !== undefined) updates.contentFormat = args.contentFormat;
    if (args.images !== undefined) updates.images = args.images;
    
    await ctx.db.patch(args.postId, updates);
    return args.postId;
  },
});

export const deletePost = mutation({
  args: { postId: v.id("forumPosts") },
  handler: async (ctx, args) => {
    // Delete all comments for this post
    const comments = await ctx.db
      .query("forumComments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .collect();
    
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }
    
    await ctx.db.delete(args.postId);
    return args.postId;
  },
});

export const toggleLikePost = mutation({
  args: {
    postId: v.id("forumPosts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    
    const likes = post.likes || [];
    const hasLiked = likes.includes(args.userId);
    
    if (hasLiked) {
      // Remove like
      await ctx.db.patch(args.postId, {
        likes: likes.filter(id => id !== args.userId),
      });
      return { liked: false };
    } else {
      // Add like
      await ctx.db.patch(args.postId, {
        likes: [...likes, args.userId],
      });
      return { liked: true };
    }
  },
});

export const createComment = mutation({
  args: {
    postId: v.id("forumPosts"),
    authorId: v.id("users"),
    content: v.string(),
    contentFormat: v.optional(v.union(v.literal("markdown"), v.literal("html"))),
    images: v.optional(v.array(v.string())),
    parentCommentId: v.optional(v.id("forumComments")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const commentId = await ctx.db.insert("forumComments", {
      postId: args.postId,
      authorId: args.authorId,
      content: args.content,
      contentFormat: args.contentFormat || "html",
      images: args.images || [],
      parentCommentId: args.parentCommentId,
      createdAt: now,
      updatedAt: now,
      likes: [],
      replyCount: 0,
      // Legacy fields for backward compatibility
      upvotes: 0,
      downvotes: 0,
    });
    
    // Update post comment count
    const post = await ctx.db.get(args.postId);
    if (post) {
      await ctx.db.patch(args.postId, {
        commentCount: (post.commentCount || 0) + 1,
      });
    }
    
    // Update parent comment reply count if this is a reply
    if (args.parentCommentId) {
      const parentComment = await ctx.db.get(args.parentCommentId);
      if (parentComment) {
        await ctx.db.patch(args.parentCommentId, {
          replyCount: (parentComment.replyCount || 0) + 1,
        });
      }
    }
    
    return commentId;
  },
});

export const getCommentsForPost = query({
  args: { postId: v.id("forumPosts") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("forumComments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("asc")
      .collect();
    
    // Fetch author info for each comment and normalize data
    const commentsWithAuthors = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        // Normalize likes - convert legacy upvotes/downvotes to likes array if needed
        let likes = comment.likes || [];
        if (likes.length === 0 && (comment.upvotes || 0) > 0) {
          // Legacy comment - we can't convert upvotes to likes without user IDs, so just use empty array
          likes = [];
        }
        return {
          ...comment,
          likes,
          replyCount: comment.replyCount || 0,
          contentFormat: comment.contentFormat || "html",
          images: comment.images || [],
          authorUsername: author?.username || author?.email || "Anonymous",
          authorAvatar: author?.avatar,
        };
      })
    );
    
    // Build comment tree
    const commentMap = new Map();
    const rootComments: any[] = [];
    
    // First pass: create map and identify root comments
    commentsWithAuthors.forEach(comment => {
      commentMap.set(comment._id, { ...comment, replies: [] });
      if (!comment.parentCommentId) {
        rootComments.push(commentMap.get(comment._id));
      }
    });
    
    // Second pass: build tree
    commentsWithAuthors.forEach(comment => {
      if (comment.parentCommentId) {
        const parent = commentMap.get(comment.parentCommentId);
        if (parent) {
          parent.replies.push(commentMap.get(comment._id));
        }
      }
    });
    
    return rootComments;
  },
});

export const toggleLikeComment = mutation({
  args: {
    commentId: v.id("forumComments"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    
    // Normalize likes - ensure it exists
    let likes = comment.likes || [];
    if (!Array.isArray(likes)) {
      likes = [];
    }
    const hasLiked = likes.includes(args.userId);
    
    if (hasLiked) {
      await ctx.db.patch(args.commentId, {
        likes: likes.filter(id => id !== args.userId),
      });
      return { liked: false };
    } else {
      await ctx.db.patch(args.commentId, {
        likes: [...likes, args.userId],
      });
      return { liked: true };
    }
  },
});

export const updateComment = mutation({
  args: {
    commentId: v.id("forumComments"),
    content: v.string(),
    contentFormat: v.optional(v.union(v.literal("markdown"), v.literal("html"))),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    
    const updates: any = {
      content: args.content,
      updatedAt: Date.now(),
    };
    
    if (args.contentFormat !== undefined) updates.contentFormat = args.contentFormat;
    if (args.images !== undefined) updates.images = args.images;
    
    await ctx.db.patch(args.commentId, updates);
    return args.commentId;
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("forumComments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    
    // Delete all replies
    const replies = await ctx.db
      .query("forumComments")
      .withIndex("by_parent", (q) => q.eq("parentCommentId", args.commentId))
      .collect();
    
    for (const reply of replies) {
      await ctx.db.delete(reply._id);
    }
    
    // Update post comment count
    const post = await ctx.db.get(comment.postId);
    if (post) {
      await ctx.db.patch(comment.postId, {
        commentCount: Math.max(0, (post.commentCount || 0) - 1 - replies.length),
      });
    }
    
    // Update parent comment reply count if this is a reply
    if (comment.parentCommentId) {
      const parentComment = await ctx.db.get(comment.parentCommentId);
      if (parentComment) {
        await ctx.db.patch(comment.parentCommentId, {
          replyCount: Math.max(0, (parentComment.replyCount || 0) - 1),
        });
      }
    }
    
    await ctx.db.delete(args.commentId);
    return args.commentId;
  },
});

// Global community forum (not game-specific)
export const createCommunityPost = mutation({
  args: {
    authorId: v.id("users"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const postId = await ctx.db.insert("communityPosts", {
      authorId: args.authorId,
      title: args.title,
      content: args.content,
      createdAt: now,
      updatedAt: now,
      upvotes: [],
      downvotes: [],
    });
    
    return postId;
  },
});

export const getCommunityPosts = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("communityPosts")
      .order("desc")
      .collect();
    
    // Fetch author info for each post
    const postsWithAuthors = await Promise.all(
      posts.map(async (post) => {
        const author = await ctx.db.get(post.authorId);
        return {
          ...post,
          authorUsername: author?.username || author?.email || "Anonymous",
          authorAvatar: author?.avatar,
        };
      })
    );
    
    return postsWithAuthors;
  },
});
