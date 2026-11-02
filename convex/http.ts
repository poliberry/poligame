import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { axiomBridgeHttp } from "./axiomBridge/bridge";

const http = httpRouter();

// The Axiom Bridge (convex/axiom.ts): Poliberry's Axiom platform reads records and runs approved
// changes through it. Requests are encrypted and signed; unset AXIOM_BRIDGE_SECRET to turn it off.
http.route({ pathPrefix: "/axiom/v1/", method: "POST", handler: axiomBridgeHttp(httpAction, internal.axiom) });

export default http;
