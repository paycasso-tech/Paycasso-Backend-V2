import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as walletController from "../controllers/wallet.controller";


const router = Router();

/**
 * @swagger
 * /api/wallet/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/balance", authenticate, walletController.getBalance);

/**
 * @swagger
 * /api/wallet/deposit:
 *   get:
 *     summary: Get deposit address
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Deposit address retrieved
 */
router.get("/deposit", authenticate, walletController.getDepositAddress);

/**
 * @swagger
 * /api/wallet/withdraw:
 *   post:
 *     summary: Withdraw USDC to external address
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinationAddress:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Withdrawal successful
 */
router.post("/withdraw", authenticate, walletController.withdraw);

/**
 * @swagger
 * /api/wallet/swap:
 *   post:
 *     summary: Swap crypto assets
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromAsset:
 *                 type: string
 *               toAsset:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       501:
 *         description: Coming soon
 */
router.post("/swap", authenticate, walletController.swap);

/**
 * @swagger
 * /api/faucet/claim:
 *   post:
 *     summary: Claim testnet faucet funds
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Faucet claimed successfully
 */
router.post("/faucet/claim", authenticate, walletController.claimFaucet);

/**
 * @swagger
 * /api/rewards/balance:
 *   get:
 *     summary: Get rewards balance
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Rewards balance retrieved
 */
router.get("/rewards/balance", authenticate, walletController.getRewards);

/**
 * @swagger
 * /api/rewards/claim:
 *   post:
 *     summary: Claim accumulated rewards
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Rewards claimed successfully
 */
router.post("/rewards/claim", authenticate, walletController.claimRewards);

/**
 * @swagger
 * /api/prices/live:
 *   get:
 *     summary: Get live cryptocurrency prices
 *     tags: [Wallet]
 *     responses:
 *       200:
 *         description: Live prices retrieved
 */
router.get("/prices/live", walletController.getLivePrices);

export default router;
