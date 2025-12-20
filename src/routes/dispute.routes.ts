import { Router } from "express";
import * as disputeController from "../controllers/dispute.controller";

const router = Router();

router.get("/:id", disputeController.getJobDetails);

router.post("/:id/evidence", disputeController.addEvidence);

router.post("/:id/escalate", disputeController.escalateToDAO);

export default router;
