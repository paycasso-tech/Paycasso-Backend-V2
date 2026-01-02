import { randomBytes, createHash } from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const JWT_EXPIRY = "15m"; // Access token expires in 15 minutes
const REFRESH_EXPIRY = "7d"; // Refresh token expires in 7 days

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
}

/**
 * Generate access token (short-lived)
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

/**
 * Generate refresh token (long-lived)
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
};

/**
 * Generate unique username from email
 */
export const generateUsername = (email: string): string => {
  const base = (email.split("@")[0] || email)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const random = randomBytes(3).toString("hex");
  return `${base}_${random}`;
};

/**
 * Generate verification/reset token
 */
export const generateSecureToken = (): string => {
  return randomBytes(32).toString("hex");
};

/**
 * Hash token for storage
 */
export const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

/**
 * Calculate token expiry
 */
export const getTokenExpiry = (hours: number = 24): Date => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};
