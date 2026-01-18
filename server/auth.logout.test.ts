import { Router } from "express";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";

const authRouter = Router();

/**
 * GET /api/auth/login
 * Redirects user to Google OAuth login page
 */
authRouter.get("/login", (req, res) => {
  try {
    const authUrl = sdk.getGoogleAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error("[Auth] Failed to generate auth URL:", error);
    res.status(500).json({ error: "Failed to initiate login" });
  }
});

/**
 * GET /api/auth/callback/google
 * Handles Google OAuth callback
 */
authRouter.get("/callback/google", async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      console.error("[Auth] OAuth error:", error);
      return res.redirect("/?error=oauth_denied");
    }

    if (!code || typeof code !== "string") {
      console.error("[Auth] Missing authorization code");
      return res.redirect("/?error=missing_code");
    }

    // Exchange code for token and get user info
    const { user, sessionToken } = await sdk.handleGoogleCallback(code);

    // Upsert user in database
    await db.upsertUser({
      openId: user.id,
      name: user.name,
      email: user.email,
      loginMethod: "google",
      lastSignedIn: new Date(),
    });

    // Set session cookie
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

    // Redirect to home page
    res.redirect("/");
  } catch (error) {
    console.error("[Auth] Callback error:", error);
    res.redirect("/?error=auth_failed");
  }
});

/**
 * GET /api/auth/logout
 * Clears session cookie and logs user out
 */
authRouter.get("/logout", (req, res) => {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  res.redirect("/");
});

/**
 * GET /api/auth/me
 * Returns current user info (for API calls)
 */
authRouter.get("/me", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json({ user });
  } catch (error) {
    res.json({ user: null });
  }
});

export { authRouter };
