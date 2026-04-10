/**
 * External API authentication middleware.
 * 
 * All /api/external/* endpoints are gated by a shared bearer token
 * stored in the EXTERNAL_API_KEY environment variable. Pass it as:
 *   Authorization: Bearer <key>
 *
 * This is intentionally lightweight — a single shared secret that
 * Claude (or any automation) includes in every request.
 */

import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { ENV } from "../_core/env";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = ENV.externalApiKey;

  if (!apiKey) {
    console.error("[External API] EXTERNAL_API_KEY is not configured");
    return res.status(503).json({
      error: "External API is not configured. Set the EXTERNAL_API_KEY secret.",
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Missing or malformed Authorization header. Expected: Bearer <key>",
    });
  }

  const providedKey = authHeader.slice(7); // strip "Bearer "

  // Constant-time comparison to prevent timing attacks
  if (providedKey.length !== apiKey.length) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  const a = Buffer.from(providedKey);
  const b = Buffer.from(apiKey);

  if (!timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
}
