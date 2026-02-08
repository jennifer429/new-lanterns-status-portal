import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";

export function registerAuthRoutes(app: Router) {
  const router = Router();

  // Email/password login endpoint
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      console.log('[/api/auth/login] Looking for user:', email);

      // Find user by email
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);
      
      console.log('[/api/auth/login] User found:', !!user, 'Has password:', !!user?.passwordHash);

      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      console.log('[/api/auth/login] Comparing password...');
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      console.log('[/api/auth/login] Password valid:', isPasswordValid);

      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Determine redirect URL based on user's clientId
      let orgSlug: string;
      if (user.clientId === 2) {
        // SRV partner admin
        orgSlug = "SRV/admin";
      } else if (user.clientId === 1) {
        // RadOne partner admin (note: clientId 1 is RadOne, not 3)
        orgSlug = "RadOne/admin";
      } else {
        // Platform admin (New Lantern staff)
        orgSlug = "org/admin";
      }

      // Create session token
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email?.split('@')[0] || "User",
        expiresInMs: ONE_YEAR_MS,
      });

      // Clear any existing session cookie first
      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie(COOKIE_NAME, cookieOptions);
      
      // Set new session cookie
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      
      console.log('[/api/auth/login] Set cookie with options:', { ...cookieOptions, maxAge: ONE_YEAR_MS });
      console.log('[/api/auth/login] Session token for user:', user.email, 'openId:', user.openId);
      console.log('[/api/auth/login] Returning orgSlug:', orgSlug);

      // Return success response
      return res.json({
        email: user.email || "",
        name: user.name || user.email?.split('@')[0] || "User",
        role: user.role,
        orgSlug,
      });
    } catch (error) {
      console.error('[/api/auth/login] Error:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use("/api/auth", router);
}
