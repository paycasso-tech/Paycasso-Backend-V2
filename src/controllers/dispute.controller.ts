import type { Request, Response } from "express";
import { PrismaClient } from "../../generated/prisma/client";
import { DisputeService } from "../services/dispute.service";

const prisma = new PrismaClient();
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
  const { jobId } = req.params;
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
  const { durationSeconds } = req.body;

  try {
    // Calls the new 2-argument startVoting function
    const txHash = disputeService.escalateToDAO(
        parseInt(id),
        durationSeconds
    );
    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
