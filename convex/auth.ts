import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple password hashing function using Web Crypto API
// Note: In production, you should use bcrypt or similar for better security
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const now = Date.now();
    const passwordHash = await hashPassword(args.password);

    const userId = await ctx.db.insert("users", {
      email: args.email,
      passwordHash,
      username: args.username || args.email.split("@")[0],
      createdAt: now,
      updatedAt: now,
    });

    return { 
      userId: userId.toString(), 
      email: args.email, 
      username: args.username || args.email.split("@")[0] 
    };
  },
});

export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    twoFactorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const passwordHash = await hashPassword(args.password);
    if (user.passwordHash !== passwordHash) {
      throw new Error("Invalid email or password");
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      if (!args.twoFactorCode) {
        return {
          requiresTwoFactor: true,
          userId: user._id.toString(),
        };
      }
      
      // Verify 2FA code (simplified - in production use proper TOTP library)
      // For now, we'll verify it in a separate function
      const isValid = await verifyTwoFactorCode(user.twoFactorSecret || "", args.twoFactorCode);
      if (!isValid) {
        throw new Error("Invalid 2FA code");
      }
    }

    return {
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      steamUserId: user.steamUserId,
      epicUserId: user.epicUserId,
      eaUserId: user.eaUserId,
      rockstarUserId: user.rockstarUserId,
      twoFactorEnabled: user.twoFactorEnabled || false,
      novuSubscriberId: user.novuSubscriberId,
    };
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    
    return {
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      steamUserId: user.steamUserId,
      epicUserId: user.epicUserId,
      eaUserId: user.eaUserId,
      rockstarUserId: user.rockstarUserId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      twoFactorEnabled: user.twoFactorEnabled || false,
      status: user.status,
      novuSubscriberId: user.novuSubscriberId,
    };
  },
});

// Generate a random secret for 2FA
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// Verify TOTP code (simplified - in production use proper library)
async function verifyTwoFactorCode(_secret: string, code: string): Promise<boolean> {
  // This is a simplified version - in production, use a proper TOTP library
  // For now, we'll accept codes that match a simple pattern
  // In real implementation, use: https://www.npmjs.com/package/otpauth
  return code.length === 6 && /^\d{6}$/.test(code);
}

// Setup 2FA - generate secret and QR code data
export const setupTwoFactor = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const secret = generateSecret();
    const issuer = "PoliGame";
    const accountName = user.email;
    
    // Generate QR code URL (otpauth://totp/...)
    const qrCodeUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

    // Store the secret temporarily (user needs to verify before enabling)
    await ctx.db.patch(args.userId, {
      twoFactorSecret: secret,
      updatedAt: Date.now(),
    });

    return {
      secret,
      qrCodeUrl,
    };
  },
});

// Enable 2FA after verification
export const enableTwoFactor = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.twoFactorSecret) {
      throw new Error("2FA setup not started");
    }

    // Verify the code
    const isValid = await verifyTwoFactorCode(user.twoFactorSecret, args.code);
    if (!isValid) {
      throw new Error("Invalid verification code");
    }

    // Generate backup codes
    const backupCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }

    await ctx.db.patch(args.userId, {
      twoFactorEnabled: true,
      twoFactorBackupCodes: backupCodes,
      updatedAt: Date.now(),
    });

    return {
      backupCodes,
    };
  },
});

// Disable 2FA
export const disableTwoFactor = mutation({
  args: {
    userId: v.id("users"),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify password
    const passwordHash = await hashPassword(args.password);
    if (user.passwordHash !== passwordHash) {
      throw new Error("Invalid password");
    }

    await ctx.db.patch(args.userId, {
      twoFactorEnabled: false,
      twoFactorSecret: undefined,
      twoFactorBackupCodes: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Generate QR code login token (for desktop app - no userId yet)
export const generateQRLoginToken = mutation({
  args: {
    deviceName: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate a unique token
    const token = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
    
    const now = Date.now();
    const expiresAt = now + (5 * 60 * 1000); // 5 minutes

    await ctx.db.insert("qrLoginTokens", {
      token,
      userId: undefined, // Will be set when mobile authorizes
      expiresAt,
      used: false,
      createdAt: now,
      deviceName: args.deviceName || undefined,
      location: args.location || undefined,
    });

    return {
      token,
      expiresAt,
      qrCodeUrl: `poligame://login?token=${token}`,
    };
  },
});

// Authorize QR login from mobile app
export const authorizeQRLogin = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const qrToken = await ctx.db
      .query("qrLoginTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!qrToken) {
      throw new Error("Invalid QR code");
    }

    if (qrToken.used) {
      throw new Error("QR code already used");
    }

    if (qrToken.expiresAt < Date.now()) {
      throw new Error("QR code expired");
    }

    // Set the userId (authorize the login)
    await ctx.db.patch(qrToken._id, {
      userId: args.userId,
    });

    return { success: true };
  },
});

export const getQRTokenInfo = mutation({
  args: {
    token: v.string(),
    scannedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const qrToken = await ctx.db
      .query("qrLoginTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!qrToken) {
      throw new Error("Invalid QR code");
    }

    if (qrToken.used || qrToken.expiresAt < Date.now()) {
      throw new Error("QR code expired or already used");
    }

    // Mark token as scanned by this user (if not already scanned)
    if (!qrToken.scannedByUserId) {
      await ctx.db.patch(qrToken._id, {
        scannedByUserId: args.scannedByUserId,
      });
    }

    return {
      deviceName: qrToken.deviceName || "Unknown Device",
      location: qrToken.location || "Unknown Location",
      createdAt: qrToken.createdAt,
    };
  },
});

// Verify QR code login token (for desktop app - polls until authorized)
export const verifyQRLoginToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const qrToken = await ctx.db
      .query("qrLoginTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!qrToken) {
      return { status: "invalid" };
    }

    if (qrToken.used) {
      return { status: "used" };
    }

    if (qrToken.expiresAt < Date.now()) {
      return { status: "expired" };
    }

    // If userId is set, mobile has authorized
    if (qrToken.userId) {
      const user = await ctx.db.get(qrToken.userId);
      if (!user) {
        return { status: "error" };
      }

      return {
        status: "authorized",
        user: {
          userId: user._id.toString(),
          email: user.email,
          username: user.username,
          avatar: user.avatar,
          bio: user.bio,
          steamUserId: user.steamUserId,
          epicUserId: user.epicUserId,
          eaUserId: user.eaUserId,
          rockstarUserId: user.rockstarUserId,
          twoFactorEnabled: user.twoFactorEnabled || false,
          novuSubscriberId: user.novuSubscriberId,
        },
      };
    }

    // If scannedByUserId is set but userId is not, mobile has scanned but not yet authorized
    if (qrToken.scannedByUserId) {
      const scannedUser = await ctx.db.get(qrToken.scannedByUserId);
      if (scannedUser) {
        return {
          status: "pending-acceptance",
          user: {
            userId: scannedUser._id.toString(),
            email: scannedUser.email,
            username: scannedUser.username,
            avatar: scannedUser.avatar,
            bio: scannedUser.bio,
          },
        };
      }
    }

    // Still waiting for scan
    return { status: "pending" };
  },
});

// Mark QR token as used (called after successful login)
export const markQRTokenAsUsed = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const qrToken = await ctx.db
      .query("qrLoginTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (qrToken) {
      await ctx.db.patch(qrToken._id, {
        used: true,
      });
    }

    return { success: true };
  },
});

