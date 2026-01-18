import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  /**
   * GET /api/auth/login
   * Redirects user to Google OAuth login page
   */
  app.get("/api/auth/login", (req: Request, res: Response) => {
    try {
      const authUrl = sdk.getGoogleAuthUrl();
      res.redirect(302, authUrl);
    } catch (error) {
      console.error("[OAuth] Failed to generate auth URL:", error);
      res.status(500).json({ error: "Failed to initiate login" });
    }
  });

  /**
   * GET /api/auth/callback/google
   * Handles Google OAuth callback
   */
  app.get("/api/auth/callback/google", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const error = getQueryParam(req, "error");

    if (error) {
      console.error("[OAuth] Google returned error:", error);
      res.redirect(302, "/?error=oauth_denied");
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code is required" });
      return;
    }

    try {
      const { user, sessionToken } = await sdk.handleGoogleCallback(code);

      if (!user.id) {
        res.status(400).json({ error: "User ID missing from Google response" });
        return;
      }

      await db.upsertUser({
        openId: user.id,
        name: user.name || null,
        email: user.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Google callback failed:", error);
      res.redirect(302, "/?error=auth_failed");
    }
  });

  /**
   * GET /api/auth/logout
   * Clears session cookie and redirects to home
   */
  app.get("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.redirect(302, "/");
  });

  // Keep the old callback route for backwards compatibility (optional, can remove)
  // app.get("/api/oauth/callback", async (req: Request, res: Response) => {
  //   // Old Manus OAuth callback - no longer used
  //   res.redirect(302, "/api/auth/login");
  // });
}
