import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { MicaButton } from "./MicaButton";
import { MicaInput } from "./MicaInput";
import { WysiwygEditor } from "./WysiwygEditor";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  MessageSquare,
  Heart,
  Reply,
  Edit,
  Trash2,
  Pin,
  Lock,
  ChevronDown,
  ChevronRight,
  Send,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { isPostHogInitialized, posthog } from "@/lib/posthog";

interface GameForumProps {
  gameId: string;
}

interface Comment {
  _id: Id<"forumComments">;
  postId: Id<"forumPosts">;
  authorId: Id<"users">;
  content: string;
  contentFormat: "markdown" | "html";
  images?: string[];
  createdAt: number;
  updatedAt: number;
  likes: Id<"users">[];
  parentCommentId?: Id<"forumComments">;
  replyCount: number;
  authorUsername: string;
  authorAvatar?: string;
  replies?: Comment[];
}

export const GameForum: React.FC<GameForumProps> = ({ gameId }) => {
  const { user, isAuthenticated } = useAuthStore();
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostFormat, setNewPostFormat] = useState<"markdown" | "html">(
    "html",
  );
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<{
    postId?: Id<"forumPosts">;
    commentId?: Id<"forumComments">;
  } | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyFormat] = useState<"markdown" | "html">("html");
  const [editingComment, setEditingComment] =
    useState<Id<"forumComments"> | null>(null);
  const [editContent, setEditContent] = useState("");

  const posts = useQuery(api.forum.getPostsForGame, { gameId });
  const createPost = useMutation(api.forum.createPost);
  const toggleLikePost = useMutation(api.forum.toggleLikePost);
  const deletePost = useMutation(api.forum.deletePost);
  const createComment = useMutation(api.forum.createComment);
  const toggleLikeComment = useMutation(api.forum.toggleLikeComment);
  const deleteComment = useMutation(api.forum.deleteComment);
  const updateComment = useMutation(api.forum.updateComment);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.userId || !isAuthenticated) {
      alert("Please sign in to create a post");
      return;
    }

    if (!newPostTitle.trim() || !newPostContent.trim()) {
      alert("Please fill in both title and content");
      return;
    }

    try {
      await createPost({
        gameId,
        authorId: user.userId as unknown as Id<"users">,
        title: newPostTitle.trim(),
        content: newPostContent,
        contentFormat: newPostFormat,
        images: [],
      });
      if (isPostHogInitialized) {
        posthog.capture("forum_post_created", {
          game_id: gameId,
          content_format: newPostFormat,
        });
      }
      setNewPostTitle("");
      setNewPostContent("");
      setShowNewPost(false);
    } catch (error: any) {
      console.error("Failed to create post:", error);
      alert(error.message || "Failed to create post");
    }
  };

  const handleToggleLikePost = async (postId: Id<"forumPosts">) => {
    if (!user?.userId || !isAuthenticated) {
      alert("Please sign in to like posts");
      return;
    }

    try {
      const post = posts?.find((candidate) => candidate._id === postId);
      await toggleLikePost({
        postId,
        userId: user.userId as unknown as Id<"users">,
      });
      if (isPostHogInitialized) {
        posthog.capture("forum_post_like_toggled", {
          game_id: gameId,
          liked: !Boolean(
            post?.likes?.includes(user.userId as unknown as Id<"users">),
          ),
        });
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  };

  const handleToggleLikeComment = async (commentId: Id<"forumComments">) => {
    if (!user?.userId || !isAuthenticated) {
      alert("Please sign in to like comments");
      return;
    }

    try {
      await toggleLikeComment({
        commentId,
        userId: user.userId as unknown as Id<"users">,
      });
      if (isPostHogInitialized) {
        posthog.capture("forum_comment_like_toggled", { game_id: gameId });
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  };

  const handleDeletePost = async (postId: Id<"forumPosts">) => {
    if (
      !confirm(
        "Are you sure you want to delete this post? This will also delete all comments.",
      )
    )
      return;

    try {
      await deletePost({ postId });
    } catch (error: any) {
      console.error("Failed to delete post:", error);
      alert(error.message || "Failed to delete post");
    }
  };

  const handleReply = async (
    postId: Id<"forumPosts">,
    parentCommentId?: Id<"forumComments">,
  ) => {
    if (!user?.userId || !isAuthenticated) {
      alert("Please sign in to reply");
      return;
    }

    if (!replyContent.trim()) {
      alert("Please enter a reply");
      return;
    }

    try {
      await createComment({
        postId,
        authorId: user.userId as unknown as Id<"users">,
        content: replyContent,
        contentFormat: replyFormat,
        parentCommentId,
        images: [],
      });
      if (isPostHogInitialized) {
        posthog.capture("forum_comment_created", {
          game_id: gameId,
          is_reply: Boolean(parentCommentId),
          content_format: replyFormat,
        });
      }
      setReplyContent("");
      setReplyingTo(null);
      // Expand the post to show comments
      setExpandedPosts((prev) => new Set(prev).add(postId));
    } catch (error: any) {
      console.error("Failed to create comment:", error);
      alert(error.message || "Failed to create comment");
    }
  };

  const handleDeleteComment = async (commentId: Id<"forumComments">) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      await deleteComment({ commentId });
    } catch (error: any) {
      console.error("Failed to delete comment:", error);
      alert(error.message || "Failed to delete comment");
    }
  };

  const handleUpdateComment = async (commentId: Id<"forumComments">) => {
    if (!editContent.trim()) {
      alert("Please enter content");
      return;
    }

    try {
      await updateComment({
        commentId,
        content: editContent,
        contentFormat: replyFormat,
      });
      setEditingComment(null);
      setEditContent("");
    } catch (error: any) {
      console.error("Failed to update comment:", error);
      alert(error.message || "Failed to update comment");
    }
  };

  const togglePostExpanded = (postId: Id<"forumPosts">) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const CommentComponent: React.FC<{
    comment: Comment;
    postId: Id<"forumPosts">;
    depth?: number;
  }> = ({ comment, postId, depth = 0 }) => {
    const isLiked =
      user?.userId &&
      comment.likes &&
      comment.likes.includes(user.userId as unknown as Id<"users">);
    const isAuthor = user?.userId === comment.authorId;
    const isEditing = editingComment === comment._id;

    return (
      <div
        className={
          "ml-8 mt-2 border-l-2 border-foreground/10 pl-4 h-[80px] overflow-y-auto"
        }
      >
        <div className="bg-foreground/5 p-3 border border-foreground/10">
          <div className="flex items-start gap-3">
            {comment.authorAvatar ? (
              <img
                src={comment.authorAvatar}
                alt={comment.authorUsername}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0">
                {comment.authorUsername.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">
                  {comment.authorUsername}
                </span>
                <span className="text-xs text-foreground/60">
                  {new Date(comment.createdAt).toLocaleString()}
                  {comment.updatedAt !== comment.createdAt && " (edited)"}
                </span>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <WysiwygEditor
                    key={`edit-${comment._id}`}
                    content={editContent}
                    onChange={setEditContent}
                    placeholder="Edit your comment..."
                  />
                  <div className="flex gap-2">
                    <MicaButton
                      variant="primary"
                      onClick={() => handleUpdateComment(comment._id)}
                      className="text-sm"
                    >
                      Save
                    </MicaButton>
                    <MicaButton
                      variant="default"
                      onClick={() => {
                        setEditingComment(null);
                        setEditContent("");
                      }}
                      className="text-sm"
                    >
                      Cancel
                    </MicaButton>
                  </div>
                </div>
              ) : (
                <>
                  {comment.contentFormat === "markdown" ? (
                    <MarkdownRenderer
                      content={comment.content}
                      className="text-sm"
                    />
                  ) : (
                    <div
                      className="text-sm prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: comment.content }}
                    />
                  )}
                  {comment.images && comment.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {comment.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Image ${idx + 1}`}
                          className="max-w-xs h-auto"
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center gap-4 mt-2">
                <button
                  onClick={() => handleToggleLikeComment(comment._id)}
                  className={`flex items-center gap-1 text-sm transition-colors ${
                    isLiked
                      ? "text-red-400"
                      : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  <Heart size={14} className={isLiked ? "fill-current" : ""} />
                  <span>{comment.likes.length}</span>
                </button>
                {depth < 3 && (
                  <button
                    onClick={() =>
                      setReplyingTo({ postId, commentId: comment._id })
                    }
                    className="flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground transition-colors"
                  >
                    <Reply size={14} />
                    <span>Reply</span>
                  </button>
                )}
                {isAuthor && !isEditing && (
                  <>
                    <button
                      onClick={() => {
                        setEditingComment(comment._id);
                        setEditContent(comment.content);
                      }}
                      className="flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteComment(comment._id)}
                      className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
              {replyingTo?.commentId === comment._id && (
                <div className="mt-3 space-y-2">
                  <WysiwygEditor
                    key={`reply-comment-${comment._id}`}
                    content={replyContent}
                    onChange={setReplyContent}
                    placeholder="Write your reply..."
                  />
                  <div className="flex gap-2">
                    <MicaButton
                      variant="primary"
                      onClick={() => handleReply(postId, comment._id)}
                      className="text-sm"
                    >
                      <Send size={14} className="mr-1" />
                      Reply
                    </MicaButton>
                    <MicaButton
                      variant="default"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyContent("");
                      }}
                      className="text-sm"
                    >
                      Cancel
                    </MicaButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => (
              <CommentComponent
                key={reply._id}
                comment={reply}
                postId={postId}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const PostComponent: React.FC<{ post: any }> = ({ post }) => {
    const isExpanded = expandedPosts.has(post._id);
    const comments = useQuery(
      api.forum.getCommentsForPost,
      isExpanded ? { postId: post._id } : "skip",
    );
    const isLiked =
      user?.userId &&
      post.likes &&
      post.likes.includes(user.userId as unknown as Id<"users">);
    const isAuthor = user?.userId === post.authorId;

    return (
      <div className="p-2 border-b h-fit border-foreground/10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={post.authorUsername}
                className="w-10 h-10"
              />
            ) : (
              <div className="w-10 h-10 bg-foreground/10 flex items-center justify-center">
                {post.authorUsername.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{post.title}</h3>
                {post.isPinned && <Pin size={16} className="text-yellow-400" />}
                {post.isLocked && (
                  <Lock size={16} className="text-foreground/60" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <span>{post.authorUsername}</span>
                <span>•</span>
                <span>{new Date(post.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-3">
          {post.contentFormat === "markdown" ? (
            <MarkdownRenderer content={post.content} />
          ) : (
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          )}
          {post.images && post.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {post.images.map((img: string, idx: number) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Image ${idx + 1}`}
                  className="max-w-md h-auto"
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={() => handleToggleLikePost(post._id)}
            className={`flex items-center gap-1 text-sm transition-colors ${
              isLiked
                ? "text-red-400"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            <Heart size={16} className={isLiked ? "fill-current" : ""} />
            <span>{post.likes.length}</span>
          </button>
          <button
            onClick={() => togglePostExpanded(post._id)}
            className="flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            <MessageSquare size={16} />
            <span>{post.commentCount || 0} comments</span>
            {isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
          {isAuthor && (
            <>
              <button
                onClick={() => setReplyingTo({ postId: post._id })}
                className="flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground transition-colors"
              >
                <Reply size={16} />
                <span>Reply</span>
              </button>
              <button
                onClick={() => handleDeletePost(post._id)}
                className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                title="Delete post"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>

        {replyingTo &&
          replyingTo.postId === post._id &&
          !replyingTo.commentId && (
            <div className="mt-3 space-y-2">
              <WysiwygEditor
                key={`reply-${post._id}`}
                content={replyContent}
                onChange={setReplyContent}
                className="rounded-xl"
                placeholder="Write your comment..."
              />
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={() => handleReply(post._id)}
                  className="text-sm bg-[var(--theme-button)] text-white rounded-full flex flex-row items-center gap-2 cursor-pointer border-none"
                >
                  <Send size={14} className="mr-1" />
                  Comment
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent("");
                  }}
                  className="text-sm rounded-full font-light cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

        {isExpanded && comments && (
          <div className="mt-4 h-full space-y-3 border-t border-white/10 pt-4">
            {comments.length > 0 ? (
              comments.map((comment: Comment) => (
                <CommentComponent
                  key={comment._id}
                  comment={comment}
                  postId={post._id}
                />
              ))
            ) : (
              <div className="text-center text-foreground/60 py-4">
                No comments yet. Be the first!
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {isAuthenticated && (
        <div>
          {!showNewPost ? (
            <Button
              variant="outline"
              onClick={() => setShowNewPost(true)}
              className="w-fit flex flex-row cursor-pointer items-center rounded-full justify-center gap-2"
            >
              <span
                className="text-sm font-light"
              >
                Create
              </span>
            </Button>
          ) : (
            <form
              onSubmit={handleCreatePost}
              className="flex flex-col bg-foreground/5 p-4 border border-foreground/10 rounded"
            >
              <Input
                type="text"
                className="w-full mb-2 rounded-full border-none"
                placeholder="Post title..."
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                required
              />
              <div className="flex gap-1 mb-1">
                <button
                  type="button"
                  onClick={() => setNewPostFormat("html")}
                  className={`px-3 py-1 rounded-full text-sm ${
                    newPostFormat === "html"
                      ? "bg-foreground/20 text-foreground"
                      : "bg-foreground/10 text-foreground/60 hover:text-foreground"
                  }`}
                  style={{
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  Rich Text
                </button>
                <button
                  type="button"
                  onClick={() => setNewPostFormat("markdown")}
                  className={`px-3 py-1 rounded-full text-sm ${
                    newPostFormat === "markdown"
                      ? "bg-foreground/20 text-foreground"
                      : "bg-foreground/10 text-foreground/60 hover:text-foreground"
                  }`}
                  style={{
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  Markdown
                </button>
              </div>
              {newPostFormat === "html" ? (
                <WysiwygEditor
                  content={newPostContent}
                  onChange={setNewPostContent}
                  placeholder="Write your post..."
                  className="rounded-xl text-foreground"
                />
              ) : (
                <textarea
                  placeholder="Write your post in Markdown..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 bg-foreground/10 border border-foreground/20 text-foreground placeholder:text-foreground/50 resize-none focus:outline-none focus:border-foreground/40 rounded-xl"
                  required
                />
              )}
              <div className="flex gap-2 justify-end mt-2">
                <Button
                  variant="outline"
                  style={{
                    padding: "0.5rem 1rem",
                    color: "var(--theme-foreground)",
                    fontSize: "0.875rem",
                  }}
                  onClick={() => {
                    setNewPostTitle("");
                    setNewPostContent("");
                    setShowNewPost(false);
                  }}
                  className="text-sm rounded-full font-light cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  style={{
                    padding: "0.5rem 1rem",
                    color: "white",
                    fontSize: "0.875rem",
                    transition: "all 0.2s ease-in-out",
                  }}
                  className="bg-[var(--theme-button)] rounded-full flex flex-row items-center gap-2 text-sm cursor-pointer border-none"
                >
                  <Send size={14} />
                  Post
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {posts && posts.length > 0 ? (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostComponent key={post._id} post={post} />
          ))}
        </div>
      ) : (
        <div
          className="text-center text-xs text-white/60 py-8"
        >
          {isAuthenticated
            ? "No discussions yet. Be the first to post!"
            : "Sign in to view and participate in discussions."}
        </div>
      )}
    </div>
  );
};
