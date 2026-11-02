/**
 * Axiom Bridge: how Poliberry's Axiom platform reads and changes PoliGame records.
 *
 * Axiom calls `/axiom/v1/*` (see http.ts) over protocol v2: AES-256-GCM encrypted bodies, HMAC-signed
 * requests, single-use nonces (axiomBridge/protocol.ts). What it can see and change is decided here,
 * not in Axiom: axiomBridge/policy.ts lists the exposed tables and fields, and sealed values never
 * leave this deployment in readable form. Writes only run for a change request independently
 * approved in Axiom, and only if the record is unchanged since approval.
 *
 * Environment: AXIOM_BRIDGE_SECRET (shared with Axiom), AXIOM_SEAL_KEY (PoliGame only — never share),
 * optional AXIOM_BRIDGE_SECRET_PREVIOUS during rotation. Unset AXIOM_BRIDGE_SECRET to turn it off.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { axiomBridgeDefinitions } from "./axiomBridge/bridge";
import { policy } from "./axiomBridge/policy";

const d = axiomBridgeDefinitions(policy, v);
export const describe = internalQuery(d.describe);
export const list = internalQuery(d.list);
export const get = internalQuery(d.get);
export const consumeNonce = internalMutation(d.consumeNonce);
export const update = internalMutation(d.update);
export const insert = internalMutation(d.insert);
export const remove = internalMutation(d.remove);
