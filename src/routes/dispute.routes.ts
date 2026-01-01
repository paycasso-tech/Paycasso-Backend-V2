import { Router } from "express";
import * as disputeController from "../controllers/dispute.controller";

const router = Router();

router.get("/:id", disputeController.getJobDetails);

router.post("/:id/evidence", disputeController.addEvidence);

router.post("/:id/escalate", disputeController.escalateToDAO);

router.post("/:id/check-deadline", disputeController.checkDeadline);

router.post("/:id/finalize", disputeController.finalizeVote);

router.post("/voters/register", disputeController.registerVoter);

router.post("/voters/remove", disputeController.removeVoter);

router.post("/voters/ban", disputeController.banVoter);

router.post("/config/duration", disputeController.setVotingDuration);

router.post("/config/min-voters", disputeController.setMinVoters);

router.post("/config/fee", disputeController.setFeePercentage);

export default router;
