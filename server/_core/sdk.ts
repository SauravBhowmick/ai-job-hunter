import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  email?: string;
};

// Google OAuth URLs
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
  id_token?: string;
}

class GoogleOAuthService {
  constructor() {
    console.log("[OAuth] Initialized Google OAuth");
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      console.error(
        "[OAuth] ERROR: Google OAuth credentials not configured! Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
      );
    }
  }

  /**
   * Generate the Google OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });

    if (state) {
      params.append("state", state);
    }

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<GoogleTokenResponse> {
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const { data } = await axios.post<GoogleTokenResponse>(
      GOOGLE_TOKEN_URL,
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return data;
  }

  /**
   * Get user info from Google using access token
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const { data } = await axios.get<GoogleUserInfo>(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return data;
  }
}

class SDKServer {
  private readonly googleOAuth: GoogleOAuthService;

  constructor() {
    this.googleOAuth = new GoogleOAuthService();
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Get Google OAuth authorization URL
   */
  getGoogleAuthUrl(redirectPath: string = "/api/auth/callback/google"): string {
    const redirectUri = `${ENV.appUrl}${redirectPath}`;
    return this.googleOAuth.getAuthorizationUrl(redirectUri);
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(
    code: string,
    redirectPath: string = "/api/auth/callback/google"
  ): Promise<{ user: GoogleUserInfo; sessionToken: string }> {
    const redirectUri = `${ENV.appUrl}${redirectPath}`;
    
    // Exchange code for token
    const tokenResponse = await this.googleOAuth.exchangeCodeForToken(
      code,
      redirectUri
    );

    // Get user info
    const userInfo = await this.googleOAuth.getUserInfo(tokenResponse.access_token);

    // Create session token
    const sessionToken = await this.createSessionToken(userInfo.id, {
      name: userInfo.name,
      email: userInfo.email,
    });

    return { user: userInfo, sessionToken };
  }

  /**
   * Create a session token for a user
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string; email?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
        email: options.email,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      email: payload.email,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string; email?: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, email } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
        email: typeof email === "string" ? email : undefined,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    // If user not in DB, create from session data
    if (!user) {
      try {
        await db.upsertUser({
          openId: session.openId,
          name: session.name || null,
          email: session.email ?? null,
          loginMethod: "google",
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(session.openId);
      } catch (error) {
        console.error("[Auth] Failed to create user:", error);
        throw ForbiddenError("Failed to create user");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
