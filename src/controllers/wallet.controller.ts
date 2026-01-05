import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { Coinbase, ExternalAddress, Wallet } from "@coinbase/coinbase-sdk";
import { faucet } from "../services/coinbase.service/coinbase.services";
import { PriceService } from "../services/price.service";

const prisma = new PrismaClient();
const priceService = new PriceService();

/**
 * API: GET /api/wallet/balance
 * Purpose: Get wallet balance with live USDC amount
 */
export const getBalance = async (req: Request, res: Response) => {
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

    if (!user?.wallet?.address) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Fetch on-chain balance
    const address = new ExternalAddress(
      process.env.APP_ENV === "production"
        ? Coinbase.networks.BaseMainnet
        : Coinbase.networks.BaseSepolia,
      user.wallet.address
    );

    const usdcBalance = (
      await address.getBalance(Coinbase.assets.Usdc)
    ).toNumber();

    // Calculate rewards
    const apyRate = 3; // 3% APY
    const lastUpdated = user.wallet.rewards?.lastUpdated || new Date();
    const daysSince =
      (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    const pendingRewards = (usdcBalance * apyRate * daysSince) / (100 * 365);

    return res.json({
      wallet: {
        address: user.wallet.address,
        usdcBalance,
        usdBalance: user.wallet.usdBalance,
        rewards: {
          earned: user.wallet.rewards?.amount || 0,
          pending: pendingRewards,
          total: (user.wallet.rewards?.amount || 0) + pendingRewards,
          apy: apyRate,
        },
      },
    });
  } catch (error) {
    console.error("[wallet/balance] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/wallet/deposit
 * Purpose: Get deposit address for user
 */
export const getDepositAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { wallet: true },
    });

    if (!user?.wallet?.address) {
      return res
        .status(404)
        .json({ error: "Wallet not found. Please create wallet first." });
    }

    return res.json({
      address: user.wallet.address,
      network:
        process.env.APP_ENV === "production" ? "Base Mainnet" : "Base Sepolia",
      supportedAssets: ["USDC", "ETH"],
      instructions: "Send USDC or ETH to this address on Base network",
    });
  } catch (error) {
    console.error("[wallet/deposit] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/wallet/withdraw
 * Purpose: Withdraw USDC to external address
 */
export const withdraw = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { destinationAddress, amount } = req.body;

    if (!destinationAddress || !amount) {
      return res
        .status(400)
        .json({ error: "Destination address and amount required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be positive" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { wallet: true },
    });

    if (!user?.wallet?.coinbaseWalletId) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Fetch Coinbase wallet
    const wallet = await Wallet.fetch(user.wallet.coinbaseWalletId);
    const balance = await wallet.getBalance(Coinbase.assets.Usdc);

    if (balance.lessThan(amount)) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Create withdrawal transfer
    const transfer = await wallet.createTransfer({
      amount,
      assetId: Coinbase.assets.Usdc,
      destination: destinationAddress,
      gasless: true,
    });

    // Wait for confirmation
    const result = await transfer.wait({ timeoutSeconds: 30 });

    return res.json({
      success: true,
      transactionHash: result.getTransactionHash(),
      transactionLink: result.getTransactionLink(),
      amount,
      destination: destinationAddress,
      status: result.getStatus(),
    });
  } catch (error) {
    console.error("[wallet/withdraw] Error:", error);
    return res.status(500).json({ error: "Withdrawal failed" });
  }
};

/**
 * API: POST /api/wallet/swap
 * Purpose: Swap between crypto assets (placeholder - implement with DEX integration)
 */
export const swap = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { fromAsset, toAsset, amount } = req.body;

    // TODO: Implement actual swap logic with Uniswap/DEX
    return res.status(501).json({
      error: "Swap functionality coming soon",
      message: "DEX integration in progress",
    });
  } catch (error) {
    console.error("[wallet/swap] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/faucet/claim
 * Purpose: Claim testnet faucet funds
 */
export const claimFaucet = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (process.env.APP_ENV === "production") {
      return res
        .status(403)
        .json({ error: "Faucet only available on testnet" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { wallet: true, faucet: true },
    });

    if (!user?.wallet?.address) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Check cooldown (24 hours)
    const lastClaim = user.faucet?.lastRequested;
    if (lastClaim) {
      const hoursSince = (Date.now() - lastClaim.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return res.status(429).json({
          error: "Faucet cooldown active",
          nextClaimIn: `${Math.ceil(24 - hoursSince)} hours`,
        });
      }
    }

    // Send faucet funds
    const faucetAmount = 100; // 100 USDC
    const faucetWallet = faucet();

    const transfer = await faucetWallet.createTransfer({
      amount: faucetAmount,
      assetId: Coinbase.assets.Usdc,
      destination: user.wallet.address,
      gasless: true,
    });

    await transfer.wait({ timeoutSeconds: 30 });

    // Update faucet record
    await prisma.faucet.update({
      where: { id: user.faucet!.id },
      data: {
        amount: (user.faucet?.amount || 0) + faucetAmount,
        lastRequested: new Date(),
      },
    });

    return res.json({
      success: true,
      amount: faucetAmount,
      message: "Faucet claim successful",
      nextClaimAvailable: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    console.error("[faucet/claim] Error:", error);
    return res.status(500).json({ error: "Faucet claim failed" });
  }
};

/**
 * API: GET /api/rewards/balance
 * Purpose: Get rewards balance and stats
 */
export const getRewards = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        wallet: { include: { rewards: true } },
      },
    });

    if (!user?.wallet?.address) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Get current balance
    const address = new ExternalAddress(
      process.env.APP_ENV === "production"
        ? Coinbase.networks.BaseMainnet
        : Coinbase.networks.BaseSepolia,
      user.wallet.address
    );
    const usdcBalance = (
      await address.getBalance(Coinbase.assets.Usdc)
    ).toNumber();

    // Calculate pending rewards
    const apyRate = 3;
    const lastUpdated = user.wallet.rewards?.lastUpdated || new Date();
    const daysSince =
      (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    const pendingRewards = (usdcBalance * apyRate * daysSince) / (100 * 365);

    return res.json({
      earned: user.wallet.rewards?.amount || 0,
      pending: pendingRewards,
      total: (user.wallet.rewards?.amount || 0) + pendingRewards,
      apy: apyRate,
      lastUpdated: user.wallet.rewards?.lastUpdated,
      projectedYearlyEarnings: (usdcBalance * apyRate) / 100,
    });
  } catch (error) {
    console.error("[rewards/balance] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API: POST /api/rewards/claim
 * Purpose: Claim accumulated rewards
 */
export const claimRewards = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        wallet: { include: { rewards: true } },
      },
    });

    if (!user?.wallet?.address) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const totalRewards = user.wallet.rewards?.amount || 0;

    if (totalRewards < 1) {
      return res
        .status(400)
        .json({ error: "Minimum 1 USDC required to claim" });
    }

    // Transfer rewards from faucet/treasury to user
    const faucetWallet = faucet();
    const transfer = await faucetWallet.createTransfer({
      amount: totalRewards,
      assetId: Coinbase.assets.Usdc,
      destination: user.wallet.address,
      gasless: true,
    });

    await transfer.wait({ timeoutSeconds: 30 });

    // Reset rewards
    await prisma.rewards.update({
      where: { id: user.wallet.rewards!.id },
      data: {
        amount: 0,
        lastUpdated: new Date(),
      },
    });

    return res.json({
      success: true,
      amountClaimed: totalRewards,
      transactionHash: transfer.getTransactionHash(),
      transactionLink: transfer.getTransactionLink(),
    });
  } catch (error) {
    console.error("[rewards/claim] Error:", error);
    return res.status(500).json({ error: "Failed to claim rewards" });
  }
};

/**
 * API: GET /api/prices/live
 * Purpose: Get live cryptocurrency prices
 */
export const getLivePrices = async (req: Request, res: Response) => {
  try {
    const prices = await priceService.getLivePrices();
    return res.json({ prices });
  } catch (error) {
    console.error("[prices/live] Error:", error);
    return res.status(500).json({ error: "Failed to fetch prices" });
  }
};
