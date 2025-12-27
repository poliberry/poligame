/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as forum from "../forum.js";
import type * as friends from "../friends.js";
import type * as gameActivity from "../gameActivity.js";
import type * as gameCustomizations from "../gameCustomizations.js";
import type * as messages from "../messages.js";
import type * as playtime from "../playtime.js";
import type * as privacy from "../privacy.js";
import type * as profile from "../profile.js";
import type * as screenshots from "../screenshots.js";
import type * as user from "../user.js";
import type * as xp from "../xp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  forum: typeof forum;
  friends: typeof friends;
  gameActivity: typeof gameActivity;
  gameCustomizations: typeof gameCustomizations;
  messages: typeof messages;
  playtime: typeof playtime;
  privacy: typeof privacy;
  profile: typeof profile;
  screenshots: typeof screenshots;
  user: typeof user;
  xp: typeof xp;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
