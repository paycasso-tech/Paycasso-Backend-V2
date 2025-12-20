import { Router } from "express";
import userRoutes from "./user.routes";
import transferRoutes from "./tranfers.routes"; 
import disputeRoutes from "./dispute.routes";

const router = Router();

router.use("/user", userRoutes);
router.use("/transfer", transferRoutes);
router.use("/dispute", disputeRoutes);

export { router as userRoutes, transferRoutes, disputeRoutes };