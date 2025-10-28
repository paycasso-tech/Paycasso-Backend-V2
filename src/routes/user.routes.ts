import { Router } from "express"
import { getUserWallet, registerUser, loginUser } from "../controllers/user.controller";

const router = Router ();

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