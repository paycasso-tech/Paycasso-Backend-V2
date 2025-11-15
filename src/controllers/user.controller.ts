import type { Request, Response } from "express";
import { PrismaClient } from "../../generated/prisma/client";
import { Coinbase, ExternalAddress } from "@coinbase/coinbase-sdk";
import { cb as coinbase, createWalletForUser, fundWallet } from "../services/coinbase.service/coinbase.services";
import { faucetConfig } from "../utils/lib/faucet";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

export const getUserWallet = async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
        const email = (req.headers["x-user-email"] as string | undefined) || (req.query.email as string | undefined);

        if (!token || !email) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userEmail = email!;
        const authToken = token!;

        // Find existing user by email
        let dbUser: any = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { wallet: { include: { rewards: true } }, faucet: true }
        });

        // If user doesn't exist, create user with nested wallet, rewards, and faucet
        if (!dbUser) {
            const emailPrefix = userEmail.split("@")[0];
            const name: string = emailPrefix as string;

            const tempPassword = randomBytes(16).toString("hex");
            const passwordHash = await bcrypt.hash(tempPassword, 10);

            dbUser = await prisma.user.create({
                // Cast to any until Prisma client is regenerated with new schema
                data: ({
                    userId: authToken, // using auth token as a stable identifier
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
                } as any),
                include: { wallet: { include: { rewards: true } }, faucet: true }
            });
        }

        if (!dbUser) {
            return res.status(500).json({ error: "Failed to create or fetch user" });
        }

        // If wallet doesn't have an on-chain address, create and connect one via Coinbase
        if (!dbUser.wallet?.address) {
            try {
                // Narrow the type for the wallet creation call
                const updated = await createWalletForUser({ id: dbUser.id, walletId: dbUser.walletId } as { id: string; walletId: string });
                if (!updated) {
                    throw new Error("Failed to create on-chain wallet");
                }
                dbUser = updated as typeof dbUser;
                const address = dbUser?.wallet?.address as string;

                try {
                    await fundWallet(address, Coinbase.assets.Usdc, faucetConfig.INITIAL_AMOUNT);
                } catch (err) {
                    console.error(`[api/wallet/user] Failed to fund wallet | User: ${dbUser?.userId}`);
                    console.error(err);
                }
            } catch (err) {
                console.error(`[api/wallet/user] Failed to create wallet | User: ${dbUser?.userId}`);
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
                const usdcBalance = (await address.getBalance(Coinbase.assets.Usdc)).toNumber();

                const apyRate = 3; // 3% APY
                const currentDate = new Date();
                const lastUpdated = dbUser.wallet.rewards?.lastUpdated || new Date();
                const timeDifference = currentDate.getTime() - new Date(lastUpdated).getTime();
                const daysSinceLastUpdate = timeDifference / (1000 * 60 * 60 * 24);
                const rewardEarned = (usdcBalance * apyRate * daysSinceLastUpdate) / (100 * 365);

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
                    include: { wallet: { include: { rewards: true } }, faucet: true }
                });

                if (!dbUser) {
                    return res.status(500).json({ error: "Failed to fetch user" });
                }

                return res.json({
                    ...dbUser,
                    wallet: dbUser.wallet ? { ...dbUser.wallet, usdcBalance } : null,
                });
            } catch (err) {
                console.error(`[api/wallet/user] Failed to fetch balance | User: ${dbUser?.userId}`);
                console.error(err);
            }
        }

        return res.json(dbUser);
    } catch (error) {
        console.error("[api/wallet/user] Failed to get user:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const registerUser = async (req: Request, res: Response) => {
    try {
        const emailInput = (req.body?.email as string | undefined) || (req.query.email as string | undefined);
        const passwordInput = (req.body?.password as string | undefined) || (req.query.password as string | undefined);

        if (!emailInput || !passwordInput) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const existing = await prisma.user.findUnique({ where: { email: emailInput } });
        if (existing) {
            return res.status(409).json({ error: "User already exists" });
        }

        const passwordHash = await bcrypt.hash(passwordInput, 10);
        const token = randomBytes(24).toString("hex");
        const name = emailInput.split("@")[0];

        const created = await prisma.user.create({
            // Cast to any until Prisma client is regenerated with new schema
            data: ({
                userId: token,
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
            } as any),
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
        const emailInput = (req.body?.email as string | undefined) || (req.query.email as string | undefined);
        const passwordInput = (req.body?.password as string | undefined) || (req.query.password as string | undefined);

        if (!emailInput || !passwordInput) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await prisma.user.findUnique({ where: { email: emailInput } }) as (typeof prisma.user extends any ? any : never);
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


