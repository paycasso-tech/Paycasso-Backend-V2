import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  generateAccessToken,
  generateRefreshToken,
  generateUsername,
  generateSecureToken,
  hashToken,
  getTokenExpiry,
  verifyRefreshToken,
} from "../utils/auth/auth.utils";

const prisma = new PrismaClient();

/**
 * API: POST /api/auth/register
 * Purpose: Register new user with username, email, password
 * Features: Auto-generates unique username, creates wallet, sends verification email
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, username } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(409)
        .json({ error: "User with this email already exists" });
    }

    // Generate or validate username
    let finalUsername = username;
    if (!finalUsername) {
      finalUsername = generateUsername(email);

      // Ensure username is unique
      let usernameExists = await prisma.user.findUnique({
        where: { username: finalUsername },
      });
      while (usernameExists) {
        finalUsername = generateUsername(email);
        usernameExists = await prisma.user.findUnique({
          where: { username: finalUsername },
        });
      }
    } else {
      // Check if provided username is available
      const usernameExists = await prisma.user.findUnique({
        where: { username: finalUsername },
      });
      if (usernameExists) {
        return res.status(409).json({ error: "Username already taken" });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with nested wallet, rewards, faucet
    const user = await prisma.user.create({
      data: {
        userId: generateSecureToken(), // Temporary ID
        username: finalUsername,
        name: name || finalUsername,
        email,
        password: passwordHash,
        wallet: {
          create: {
            address: null,
            rewards: { create: {} },
          },
        },
        faucet: { create: {} },
      } as any,
      include: { wallet: true, faucet: true },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    // Store session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        expiresAt: getTokenExpiry(24 * 7), // 7 days
      },
    });

    // Create email verification token
    const verificationToken = generateSecureToken();
    await prisma.emailVerification.create({
      data: {
        email: user.email,
        token: hashToken(verificationToken),
        expiresAt: getTokenExpiry(24), // 24 hours
      },
    });

    // TODO: Send verification email
    console.log(
      `[auth/register] Verification link: /verify-email?token=${verificationToken}`
    );

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("[auth/register] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/auth/login
 * Purpose: Authenticate user and return JWT tokens
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = (await prisma.user.findUnique({
      where: { email },
      include: { wallet: true },
    })) as any;

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Account is deactivated" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    // Store session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        expiresAt: getTokenExpiry(24 * 7),
      },
    });

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        imageUrl: user.imageUrl,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("[auth/login] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/auth/logout
 * Purpose: Invalidate user session
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(400).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Delete session
    await prisma.session.deleteMany({
      where: { token },
    });

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("[auth/logout] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/auth/refresh-token
 * Purpose: Refresh access token using refresh token
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      userId: session.user.id,
      email: session.user.email,
      username: session.user.username,
    });

    const newRefreshToken = generateRefreshToken({
      userId: session.user.id,
      email: session.user.email,
      username: session.user.username,
    });

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: getTokenExpiry(24 * 7),
      },
    });

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("[auth/refresh-token] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/auth/forgot-password
 * Purpose: Initiate password reset process
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Don't reveal if user exists (security best practice)
    if (!user) {
      return res.json({
        message: "If the email exists, a reset link has been sent",
      });
    }

    // Generate reset token
    const resetToken = generateSecureToken();
    await prisma.passwordReset.create({
      data: {
        email,
        token: hashToken(resetToken),
        expiresAt: getTokenExpiry(1), // 1 hour
      },
    });

    // TODO: Send email with reset link
    console.log(
      `[auth/forgot-password] Reset link: /reset-password?token=${resetToken}`
    );

    return res.json({
      message: "If the email exists, a reset link has been sent",
    });
  } catch (error) {
    console.error("[auth/forgot-password] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/auth/reset-password
 * Purpose: Reset password using token
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: "Token and new password are required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    // Find valid reset token
    const resetEntry = await prisma.passwordReset.findUnique({
      where: { token: hashToken(token) },
    });

    if (!resetEntry || resetEntry.used || resetEntry.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { email: resetEntry.email },
      data: { password: passwordHash },
    });

    // Mark token as used
    await prisma.passwordReset.update({
      where: { id: resetEntry.id },
      data: { used: true },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { user: { email: resetEntry.email } },
    });

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("[auth/reset-password] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/auth/verify-email
 * Purpose: Verify user email address
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Verification token required" });
    }

    // Find verification entry
    const verification = await prisma.emailVerification.findUnique({
      where: { token: hashToken(token) },
    });

    if (!verification || verification.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification token" });
    }

    // Update user
    await prisma.user.update({
      where: { email: verification.email },
      data: { isVerified: true },
    });

    // Delete verification entry
    await prisma.emailVerification.delete({
      where: { id: verification.id },
    });

    return res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("[auth/verify-email] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/auth/check-username
 * Purpose: Check if username is available
 */
export const checkUsername = async (req: Request, res: Response) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    if (username.length < 3) {
      return res
        .status(400)
        .json({ error: "Username must be at least 3 characters" });
    }

    const exists = await prisma.user.findUnique({ where: { username } });

    return res.json({
      available: !exists,
      username,
    });
  } catch (error) {
    console.error("[auth/check-username] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
