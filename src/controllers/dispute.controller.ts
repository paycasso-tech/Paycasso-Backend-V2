import type { Request, Response } from "express";
// PrismaClient import removed
import { DisputeService } from "../services/dispute.service";

import { prisma } from "../db";
const disputeService = new DisputeService();

export const getJobDetails = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Job ID is required" });
    const job = await prisma.job.findUnique({
      where: { jobId: parseInt(id) },
      include: { evidence: true },
    });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addEvidence = async (req: Request, res: Response) => {
  const { id } = req.params;
  const jobId = id;
  if (!jobId) return res.status(400).json({ error: "Job ID is required" });
  const { sender, message, fileUrl } = req.body;

  try {
    const evidence = await prisma.evidence.create({
      data: {
        job: { connect: { jobId: parseInt(jobId) } },
        sender,
        message,
        fileUrl,
      },
    });
    res.status(201).json(evidence);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const escalateToDAO = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "ID is required" });
  const { durationSeconds } = req.body;

  try {
    const txHash = await disputeService.escalateToDAO(
      parseInt(id),
      durationSeconds
    );
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const checkDeadline = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "ID is required" });
  try {
    const txHash = await disputeService.checkAIDeadline(parseInt(id));
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const finalizeVote = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "ID is required" });
  try {
    const txHash = await disputeService.finalizeVoting(parseInt(id));
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const registerVoter = async (req: Request, res: Response) => {
  const { voterAddress } = req.body;
  if (!voterAddress) return res.status(400).json({ error: "voterAddress is required" });
  try {
    const txHash = await disputeService.registerVoter(voterAddress);
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const removeVoter = async (req: Request, res: Response) => {
  const { voterAddress } = req.body;
  if (!voterAddress) return res.status(400).json({ error: "voterAddress is required" });
  try {
    const txHash = await disputeService.removeVoter(voterAddress);
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const banVoter = async (req: Request, res: Response) => {
  const { voterAddress } = req.body;
  if (!voterAddress) return res.status(400).json({ error: "voterAddress is required" });
  try {
    const txHash = await disputeService.banVoter(voterAddress);
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const setVotingDuration = async (req: Request, res: Response) => {
  const { duration } = req.body;
  if (!duration) return res.status(400).json({ error: "duration is required" });
  try {
    const txHash = await disputeService.setVotingDuration(parseInt(duration));
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const setMinVoters = async (req: Request, res: Response) => {
  const { count } = req.body;
  if (!count) return res.status(400).json({ error: "count is required" });
  try {
    const txHash = await disputeService.setMinVotersRequired(parseInt(count));
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


export const setFeePercentage = async (req: Request, res: Response) => {
  const { fee } = req.body;
  if (fee === undefined) return res.status(400).json({ error: "fee is required" });
  try {
    const txHash = await disputeService.setFeePercentage(parseInt(fee));
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


export const voteOnDispute = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, contractorPercent } = req.body;

  if (!id || !userId || contractorPercent === undefined) {
    return res.status(400).json({ error: "Missing required fields: id, userId, contractorPercent" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet || !user.wallet.coinbaseWalletId) {
       return res.status(404).json({ error: "User or Coinbase wallet not found" });
    }

    const txHash = await disputeService.castVote(
      user.wallet.coinbaseWalletId,
      parseInt(id),
      parseInt(contractorPercent)
    );

    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createJobController = async (req: Request, res: Response) => {
  const { userId, contractorAddress, amount } = req.body;

  if (!userId || !contractorAddress || !amount) {
    return res.status(400).json({ error: "Missing required fields: userId, contractorAddress, amount" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet || !user.wallet.coinbaseWalletId) {
       return res.status(404).json({ error: "User or Coinbase wallet not found" });
    }

    const txHash = await disputeService.createJob(
      user.wallet.coinbaseWalletId,
      contractorAddress,
      parseFloat(amount)
    );

    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const releaseFundsController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!id || !userId) {
    return res.status(400).json({ error: "Missing required fields: id, userId" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet || !user.wallet.coinbaseWalletId) {
       return res.status(404).json({ error: "User or Coinbase wallet not found" });
    }

    const txHash = await disputeService.releaseFunds(
      user.wallet.coinbaseWalletId,
      parseInt(id)
    );

    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const raiseDisputeController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!id || !userId) {
    return res.status(400).json({ error: "Missing required fields: id, userId" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet || !user.wallet.coinbaseWalletId) {
       return res.status(404).json({ error: "User or Coinbase wallet not found" });
    }

    const txHash = await disputeService.raiseDispute(
      user.wallet.coinbaseWalletId,
      parseInt(id)
    );

    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const acceptVerdictController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!id || !userId) {
    return res.status(400).json({ error: "Missing required fields: id, userId" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet || !user.wallet.coinbaseWalletId) {
       return res.status(404).json({ error: "User or Coinbase wallet not found" });
    }

    const txHash = await disputeService.acceptVerdict(
      user.wallet.coinbaseWalletId,
      parseInt(id)
    );

    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectVerdictController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!id || !userId) {
    return res.status(400).json({ error: "Missing required fields: id, userId" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet || !user.wallet.coinbaseWalletId) {
       return res.status(404).json({ error: "User or Coinbase wallet not found" });
    }

    const txHash = await disputeService.rejectVerdict(
      user.wallet.coinbaseWalletId,
      parseInt(id)
    );

    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
