import { Router } from "express";
import { getUserWallet, registerUser, loginUser } from "../controllers/user.controller";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: User
 *     description: User authentication and wallet management
 */

/**
 * @openapi
 * /api/user/getWallet:
 *   get:
 *     summary: Get logged-in user's wallet details
 *     description: >
 *       Requires Authorization token and user email.
 *       Email must be provided either via `x-user-email` header
 *       or `email` query parameter.
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOi...
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
 *         description: Wallet details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 email:
 *                   type: string
 *                 wallet:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                       nullable: true
 *                     usdcBalance:
 *                       type: number
 *                     rewards:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: number
 *                         lastUpdated:
 *                           type: string
 *                           format: date-time
 *                 faucet:
 *                   type: object
 *       401:
 *         description: Unauthorized (missing token or email)
 *       500:
 *         description: Internal Server Error
 */

/**
 * @openapi
 * /api/user/register:
 *   post:
 *     summary: Register a new user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: name@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 token:
 *                   type: string
 *                 email:
 *                   type: string
 *       400:
 *         description: Email and password are required
 *       409:
 *         description: User already exists
 *       500:
 *         description: Internal Server Error
 */

/**
 * @openapi
 * /api/user/login:
 *   post:
 *     summary: Login user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: name@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                 email:
 *                   type: string
 *       400:
 *         description: Email and password are required
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal Server Error
 */

// routes
router.get("/getWallet", getUserWallet);
router.post("/register", registerUser);
router.post("/login", loginUser);
// router.get("/logout",logoutUser);
// router.get("/profile",getUserProfile);
// router.get("/update-profile",updateUserProfile);
// router.get("/delete-profile",deleteUserProfile);
// router.get("/forgot-password",forgotUserPassword);
// router.get("/reset-password",resetUserPassword);
// router.get("/verify-email",verifyUserEmail);
// router.get("/resend-verification-email",resendVerificationEmail);
// router.get("/send-verification-email",sendVerificationEmail);

export default router;