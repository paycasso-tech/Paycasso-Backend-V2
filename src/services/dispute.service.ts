import { ethers } from "ethers";
import { PrismaClient } from "../../generated/prisma/client";
import DisputeArtifact from "../abis/TFADispute.json";
import DAOVotingArtifact from "../abis/TFADAOVoting.json";

const prisma = new PrismaClient();

export class DisputeService {
  escalateToDAO(arg0: number, durationSeconds: any) {
      throw new Error("Method not implemented.");
  }
  private provider: ethers.WebSocketProvider;
  private aiWallet: ethers.Wallet;
  private disputeContract: ethers.Contract;
  private daoContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.WebSocketProvider(process.env.BASE_WSS_URL!);
    this.aiWallet = new ethers.Wallet(
      process.env.AI_WALLET_PRIVATE_KEY!,
      this.provider
    );

    this.disputeContract = new ethers.Contract(
      process.env.TFA_DISPUTE_ADDRESS!,
      DisputeArtifact.abi,
      this.aiWallet
    );

    this.daoContract = new ethers.Contract(
      process.env.TFA_DAO_VOTING_ADDRESS!,
      DAOVotingArtifact.abi,
      this.aiWallet
    );
  }

  public startListeners() {
    console.log("🛰️ TFA Dispute Listeners Active");

    // Sync Job Creation
    this.disputeContract.on(
      "JobCreated",
      async (id, client, contractor, amount) => {
        const amountReadable = parseFloat(ethers.formatUnits(amount, 6));
        await prisma.job.upsert({
          where: { jobId: Number(id) },
          update: { status: "Active" },
          create: {
            jobId: Number(id),
            clientAddress: client,
            contractorAddress: contractor,
            amountUSDC: amountReadable,
            status: "Active",
          },
        });
      }
    );

    // Sync Dispute Raised
    this.disputeContract.on("DisputeRaised", async (id) => {
      await prisma.job.update({
        where: { jobId: Number(id) },
        data: { status: "DisputeRaised" },
      });
      this.processAIDispute(Number(id));
    });
  }

  private async processAIDispute(jobId: number) {
    try {
      // Logic for AI analysis here
      const verdict = { percent: 60, reason: "Merged Backend AI Result" };

      const tx = await this.disputeContract.submitAIVerdict(
        jobId,
        verdict.percent,
        verdict.reason
      );
      await tx.wait();

      await prisma.job.update({
        where: { jobId },
        data: {
          status: "AIResolved",
          aiContractorPercent: verdict.percent,
          aiExplanation: verdict.reason,
          aiDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });
    } catch (err) {
      console.error("AI Submission Failed:", err);
    }
  }
}
