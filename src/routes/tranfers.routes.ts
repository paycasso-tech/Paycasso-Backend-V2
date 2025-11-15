import { Router } from "express";
import { getTransfers,createTransfer } from "../controllers/transfer.controller";

const router = Router();

// transfer routes
router.get("/getTransfers", getTransfers);
router.post("/createTransfer", createTransfer);

export default router;



// 0xc64a6D73C43Fda4003FB785B0A4DCFf528628343 // aimodel7303@gmail.com and Vishal@123 account wallet address