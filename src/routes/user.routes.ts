import { Router } from "express"
import { getUserWallet, registerUser, loginUser } from "../controllers/user.controller";

const router = Router ();


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
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 address:
 *                   type: string
 *                 balance:
 *                   type: number
 *       401:
 *         description: Unauthorized
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
 *               name:
 *                 type: string
 *                 example: Manish
 *               email:
 *                 type: string
 *                 example: manish@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid request
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
 *                 example: manish@example.com
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
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal Server Error
 */


// user authentication routes
router.get("/getWallet",getUserWallet);
router.post("/register",registerUser);
router.post("/login",loginUser);
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