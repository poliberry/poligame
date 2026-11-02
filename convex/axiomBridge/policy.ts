/**
 * Axiom Bridge policy for PoliGame (poliberry/poligame).
 * GENERATED from poliberry/axiom convex/lib/catalog.ts — do not edit here. Change the
 * catalog in the Axiom repo, then run `npm run bridge:install -- poligame <this convex dir>`.
 *
 * Tables not listed are invisible to Axiom. Fields not listed are dropped.
 * Sealed fields never leave this deployment.
 */
import type { BridgePolicy } from "./bridge";

export const policy: BridgePolicy = {
  version: "poligame-1",
  tables: {
    "users": {
      "fields": [
        "username",
        "email",
        "status",
        "bio",
        "twoFactorEnabled",
        "currentGameTitle",
        "lastSeen",
        "createdAt"
      ],
      "sealed": {
        "passwordHash": "secret",
        "twoFactorSecret": "secret",
        "twoFactorBackupCodes": "secret"
      },
      "writable": [
        "username",
        "bio"
      ]
    },
    "forumPosts": {
      "fields": [
        "title",
        "gameId",
        "authorId",
        "content",
        "isPinned",
        "isLocked",
        "createdAt"
      ],
      "writable": [
        "title",
        "content",
        "isPinned",
        "isLocked"
      ],
      "delete": true
    },
    "forumComments": {
      "fields": [
        "postId",
        "authorId",
        "content",
        "createdAt"
      ],
      "writable": [
        "content"
      ],
      "delete": true
    },
    "messages": {
      "fields": [
        "senderId",
        "recipientId",
        "read",
        "createdAt"
      ],
      "sealed": {
        "content": "e2ee"
      }
    },
    "gamePlaytime": {
      "fields": [
        "userId",
        "gameId",
        "totalPlaytime",
        "lastPlayed"
      ]
    },
    "themes": {
      "fields": [
        "name",
        "authorId",
        "description",
        "accentColor",
        "createdAt"
      ],
      "writable": [
        "name",
        "description",
        "accentColor"
      ],
      "delete": true
    }
  },
};
