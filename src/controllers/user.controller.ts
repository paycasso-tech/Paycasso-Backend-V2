import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { Coinbase, ExternalAddress } from "@coinbase/coinbase-sdk";
import {
  createWalletForUser,
  fundWallet,
} from "../services/coinbase.service/coinbase.services";
import { faucetConfig } from "../utils/lib/faucet";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

// ============================================
// LEGACY FUNCTION - Keep for backward compatibility
// ============================================

/**
 * API: GET /api/user/getWallet (LEGACY - Keep for existing frontend)
 * Purpose: Get or create wallet with auto-funding (original implementation)
 * This is your original implementation - kept unchanged
 */
export const getUserWallet = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    const email =
      (req.headers["x-user-email"] as string | undefined) ||
      (req.query.email as string | undefined);

    if (!token || !email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userEmail = email!;
    const authToken = token!;

    // Find existing user by email
    let dbUser: any = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { wallet: { include: { rewards: true } }, faucet: true },
    });

    // If user doesn't exist, create user with nested wallet, rewards, and faucet
    if (!dbUser) {
      const emailPrefix = userEmail.split("@")[0] || "user";
      const name: string = emailPrefix as string;

      const tempPassword = randomBytes(16).toString("hex");
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Generate unique username
      let username = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, "");
      username = username + "_" + randomBytes(3).toString("hex");

      dbUser = await prisma.user.create({
        data: {
          userId: authToken,
          username: username, // Add username
          name,
          email: userEmail,
          imageUrl: "",
          password: passwordHash,
          wallet: {
            create: {
              address: null,
              rewards: { create: {} },
            },
          },
          faucet: { create: {} },
        } as any,
        include: { wallet: { include: { rewards: true } }, faucet: true },
      });
    }

    if (!dbUser) {
      return res.status(500).json({ error: "Failed to create or fetch user" });
    }

    // If wallet doesn't have an on-chain address, create and connect one via Coinbase
    if (!dbUser.wallet?.address) {
      try {
        const updated = await createWalletForUser({
          id: dbUser.id,
          walletId: dbUser.walletId,
        } as { id: string; walletId: string });
        if (!updated) {
          throw new Error("Failed to create on-chain wallet");
        }
        dbUser = updated as typeof dbUser;
        const address = dbUser?.wallet?.address as string;

        try {
          await fundWallet(
            address,
            Coinbase.assets.Usdc,
            faucetConfig.INITIAL_AMOUNT
          );
        } catch (err) {
          console.error(
            `[api/wallet/user] Failed to fund wallet | User: ${dbUser?.userId}`
          );
          console.error(err);
        }
      } catch (err) {
        console.error(
          `[api/wallet/user] Failed to create wallet | User: ${dbUser?.userId}`
        );
        console.error(err);
      }
    }

    // If wallet exists, fetch wallet balance & calculate reward accrual
    if (dbUser.wallet?.address) {
      try {
        const address = new ExternalAddress(
          process.env.APP_ENV === "production"
            ? Coinbase.networks.BaseMainnet
            : Coinbase.networks.BaseSepolia,
          dbUser.wallet.address as string
        );
        const usdcBalance = (
          await address.getBalance(Coinbase.assets.Usdc)
        ).toNumber();

        const apyRate = 3; // 3% APY
        const currentDate = new Date();
        const lastUpdated = dbUser.wallet.rewards?.lastUpdated || new Date();
        const timeDifference =
          currentDate.getTime() - new Date(lastUpdated).getTime();
        const daysSinceLastUpdate = timeDifference / (1000 * 60 * 60 * 24);
        const rewardEarned =
          (usdcBalance * apyRate * daysSinceLastUpdate) / (100 * 365);

        if (dbUser.wallet.rewards) {
          await prisma.rewards.update({
            where: { id: dbUser.wallet.rewards.id },
            data: {
              amount: dbUser.wallet.rewards.amount + rewardEarned,
              lastUpdated: currentDate,
            },
          });
        }

        // refetch user for response
        dbUser = await prisma.user.findUnique({
          where: { id: dbUser.id },
          include: { wallet: { include: { rewards: true } }, faucet: true },
        });

        if (!dbUser) {
          return res.status(500).json({ error: "Failed to fetch user" });
        }

        return res.json({
          ...dbUser,
          wallet: dbUser.wallet ? { ...dbUser.wallet, usdcBalance } : null,
        });
      } catch (err) {
        console.error(
          `[api/wallet/user] Failed to fetch balance | User: ${dbUser?.userId}`
        );
        console.error(err);
      }
    }

    return res.json(dbUser);
  } catch (error) {
    console.error("[api/wallet/user] Failed to get user:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ============================================
// NEW AUTHENTICATION-BASED FUNCTIONS
// ============================================

/**
 * API: GET /api/user/profile
 * Purpose: Get authenticated user's complete profile (JWT-based)
 * This is the new JWT-based implementation
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        wallet: { include: { rewards: true } },
        faucet: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch on-chain balance if wallet exists
    let usdcBalance = 0;
    if (user.wallet?.address) {
      try {
        const address = new ExternalAddress(
          process.env.APP_ENV === "production"
            ? Coinbase.networks.BaseMainnet
            : Coinbase.networks.BaseSepolia,
          user.wallet.address
        );
        usdcBalance = (
          await address.getBalance(Coinbase.assets.Usdc)
        ).toNumber();

        // Update rewards (same logic as legacy)
        const apyRate = 3;
        const currentDate = new Date();
        const lastUpdated = user.wallet.rewards?.lastUpdated || new Date();
        const timeDifference =
          currentDate.getTime() - new Date(lastUpdated).getTime();
        const daysSinceLastUpdate = timeDifference / (1000 * 60 * 60 * 24);
        const rewardEarned =
          (usdcBalance * apyRate * daysSinceLastUpdate) / (100 * 365);

        if (user.wallet.rewards && daysSinceLastUpdate > 0) {
          await prisma.rewards.update({
            where: { id: user.wallet.rewards.id },
            data: {
              amount: user.wallet.rewards.amount + rewardEarned,
              lastUpdated: currentDate,
            },
          });
        }
      } catch (err) {
        console.error("[user/profile] Failed to fetch balance:", err);
      }
    }

    return res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
      bio: user.bio,
      isVerified: user.isVerified,
      role: user.role,
      wallet: user.wallet
        ? {
            ...user.wallet,
            usdcBalance,
          }
        : null,
      faucet: user.faucet,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("[user/profile] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: PUT /api/user/profile
 * Purpose: Update user profile information
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, bio, imageUrl } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(name && { name }),
        ...(bio && { bio }),
        ...(imageUrl && { imageUrl }),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        bio: true,
        imageUrl: true,
      },
    });

    return res.json({
      message: "Profile updated successfully",
      user: updated,
    });
  } catch (error) {
    console.error("[user/update-profile] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: PUT /api/user/change-password
 * Purpose: Change user password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new password required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    const user = (await prisma.user.findUnique({
      where: { id: req.user.userId },
    })) as any;

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });

    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("[user/change-password] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: DELETE /api/user/account
 * Purpose: Soft delete user account
 */
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { password } = req.body;

    if (!password) {
      return res
        .status(400)
        .json({ error: "Password required for account deletion" });
    }

    const user = (await prisma.user.findUnique({
      where: { id: req.user.userId },
    })) as any;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { isActive: false },
    });

    await prisma.session.deleteMany({
      where: { userId: req.user.userId },
    });

    return res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("[user/delete-account] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: GET /api/user/:username
 * Purpose: Get public user profile by username
 */
export const getUserByUsername = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        imageUrl: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("[user/get-by-username] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ============================================
// LEGACY AUTH FUNCTIONS (Keep for backward compatibility)
// ============================================

export const registerUser = async (req: Request, res: Response) => {
  try {
    const emailInput =
      (req.body?.email as string | undefined) ||
      (req.query.email as string | undefined);
    const passwordInput =
      (req.body?.password as string | undefined) ||
      (req.query.password as string | undefined);

    if (!emailInput || !passwordInput) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existing = await prisma.user.findUnique({
      where: { email: emailInput },
    });
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(passwordInput, 10);
    const token = randomBytes(24).toString("hex");
    const name = emailInput.split("@")[0] || "user";

    // Generate unique username
    let username = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    username = username + "_" + randomBytes(3).toString("hex");

    const created = await prisma.user.create({
      data: {
        userId: token,
        username: username,
        name,
        email: emailInput!,
        imageUrl: "",
        password: passwordHash,
        wallet: {
          create: {
            address: null,
            rewards: { create: {} },
          },
        },
        faucet: { create: {} },
      } as any,
      include: { wallet: { include: { rewards: true } }, faucet: true },
    });

    return res.status(201).json({
      message: "User registered successfully",
      token: created.userId,
      email: created.email,
    });
  } catch (error) {
    console.error("[api/auth/register] Failed to register user:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const emailInput =
      (req.body?.email as string | undefined) ||
      (req.query.email as string | undefined);
    const passwordInput =
      (req.body?.password as string | undefined) ||
      (req.query.password as string | undefined);

    if (!emailInput || !passwordInput) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = (await prisma.user.findUnique({
      where: { email: emailInput },
    })) as typeof prisma.user extends any ? any : never;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.password) {
      return res.status(400).json({ error: "User has no password set" });
    }

    const valid = await bcrypt.compare(passwordInput, user.password as string);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.json({
      message: "Login successful",
      token: user.userId,
      email: user.email,
    });
  } catch (error) {
    console.error("[api/auth/login] Failed to login:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
