import { Router } from "express";
import { getTransfers,createTransfer } from "../controllers/transfer.controller";

const router = Router();


/**
 * @openapi
 * tags:
 *   - name: Transfer
 *     description: Wallet transfer operations
 */

/**
 * @openapi
 * /api/transfer/getTransfers:
 *   get:
 *     summary: Get all transfers for the logged-in user
 *     description: >
 *       Requires Authorization token and user email.
 *       Email must be provided either via `x-user-email` header
 *       or `email` query parameter.
 *     tags: [Transfer]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-user-email
 *         required: false
 *         schema:
 *           type: string
 *           example: name@example.com
 *       - in: query
 *         name: email
 *         required: false
 *         schema:
 *           type: string
 *           example: name@example.com
 *     responses:
 *       200:
 *         description: List of transfers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transfer'
 *       401:
 *         description: Unauthorized (missing token or email)
 *       500:
 *         description: Internal Server Error
 */


/**
 * @openapi
 * /api/transfer/createTransfer:
 *   post:
 *     summary: Create a new transfer
 *     tags: [Transfer]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTransferRequest'
 *     responses:
 *       200:
 *         description: Transfer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateTransferResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     CreateTransferRequest:
 *       type: object
 *       required:
 *         - asset
 *         - data
 *       properties:
 *         asset:
 *           type: string
 *           example: usdc
 *         data:
 *           type: object
 *           required:
 *             - recipient
 *             - amount
 *           properties:
 *             recipient:
 *               type: string
 *               example: 0xc64a6D73C43Fda4003FB785B0A4DCFf528628343
 *             amount:
 *               type: number
 *               example: 0.01
 *
 *     CreateTransferResponse:
 *       type: object
 *       properties:
 *         transactionLink:
 *           type: string
 *           example: https://etherscan.io/tx/0xabc...
 *         status:
 *           type: string
 *           example: completed
 *
 *     Transfer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         destinationAddress:
 *           type: string
 *         amount:
 *           type: number
 *         status:
 *           type: string
 *         transactionLink:
 *           type: string
 */


// transfer routes
router.get("/getTransfers", getTransfers);
router.post("/createTransfer", createTransfer);

export default router;



// 0xc64a6D73C43Fda4003FB785B0A4DCFf528628343 // aimodel7303@gmail.com and Vishal@123 account wallet address