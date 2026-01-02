import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import DisputeArtifact from "../abis/TFADispute.json";
import DAOVotingArtifact from "../abis/TFADAOVoting.json";

const prisma = new PrismaClient();

export class DisputeService {
  /**
   * Manually start voting session (DAO Escalation)
   * Only callable if the sender has the right role or if logic permits public calling
   */
  async escalateToDAO(jobId: number, durationSeconds: number = 86400) {
    try {
      console.log(
        `escalating job ${jobId} to DAO with duration ${durationSeconds}`
      );

      const tx = await this.daoContract.startVoting!(jobId, durationSeconds);
      console.log("Transaction sent:", tx.hash);

      await tx.wait();
      console.log("Voting started successfully");

      return tx.hash;
    } catch (error) {
      console.error("Failed to escalate to DAO:", error);
      throw error;
    }
  }

  /**
   * Check if AI acceptance deadline has passed and trigger escalation if needed
   */
  async checkAIDeadline(jobId: number) {
    try {
      const tx = await this.disputeContract.checkAIDeadline!(jobId);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Failed to check AI deadline:", error);
      throw error;
    }
  }

  /**
   * Finalize a voting session after time has expired
   */
  async finalizeVoting(jobId: number) {
    try {
      const tx = await this.daoContract.finalizeVoting!(jobId);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Failed to finalize voting:", error);
      throw error;
    }
  }

  /**
   * Register a new voter (Admin only)
   */
  async registerVoter(voterAddress: string) {
    try {
      console.log(`Registering voter: ${voterAddress}`);
      const tx = await this.daoContract.registerVoter!(voterAddress);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Failed to register voter:", error);
      throw error;
    }
  }

  /**
   * Remove a voter (Admin only)
   */
  async removeVoter(voterAddress: string) {
    try {
      console.log(`Removing voter: ${voterAddress}`);
      const tx = await this.daoContract.removeVoter!(voterAddress);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Failed to remove voter:", error);
      throw error;
    }
  }
  /**
   * Ban a voter (Admin only)
   */
  async banVoter(voterAddress: string) {
    try {
      console.log(`Banning voter: ${voterAddress}`);
      const tx = await this.daoContract.banVoter!(voterAddress);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Failed to ban voter:", error);
      throw error;
    }
  }

  /**
   * Set Voting Duration (Admin only)
   */
  async setVotingDuration(duration: number) {
    try {
      console.log(`Setting voting duration to: ${duration}`);
      const tx = await this.daoContract.setVotingDuration!(duration);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Failed to set voting duration:", error);
      throw error;
    }
  }

  /**
   * Set Minimum Voters Required (Admin only)
   */
  async setMinVotersRequired(count: number) {
    try {
      console.log(`Setting min voters required to: ${count}`);
      const tx = await this.daoContract.setMinVotersRequired!(count);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Failed to set min voters:", error);
      throw error;
    }
  }

  /**
   * Set Fee Percentage (Admin only)
   */
  async setFeePercentage(fee: number) {
    try {
      console.log(`Setting fee percentage to: ${fee}`);
      const tx = await this.disputeContract.setFeePercentage!(fee);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Failed to set fee percentage:", error);
      throw error;
    }
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
    console.log(" TFA Dispute Listeners Active");

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

    // Sync AI Verdict Acceptance/Rejection
    this.disputeContract.on("AIVerdictAccepted", async (id, acceptedBy) => {
      console.log(`AI Verdict accepted for job ${id} by ${acceptedBy}`);
      // In a real app, you might check if BOTH accepted to update status to "Resolved"
    });

    this.disputeContract.on("AIVerdictRejected", async (id, rejectedBy) => {
      console.log(`AI Verdict rejected for job ${id} by ${rejectedBy}`);
      await prisma.job.update({
        where: { jobId: Number(id) },
        data: { status: "DisputeRaised" }, // or similar status indicating escalation
      });
    });

    // Sync Funds Released
    this.disputeContract.on("FundsReleased", async (id, to, amount) => {
      console.log(`Funds released for job ${id} to ${to}`);
      await prisma.job.update({
        where: { jobId: Number(id) },
        data: { status: "Resolved" },
      });
    });

    // --- DAO Voting Listeners ---

    this.daoContract.on("VotingSessionStarted", async (jobId, endTime) => {
      console.log(
        `Voting session started for job ${jobId}, ends at ${endTime}`
      );
      await prisma.job.update({
        where: { jobId: Number(jobId) },
        data: { status: "DisputeRaised" }, // Ensure this status exists in enum/schema
      });
    });

    this.daoContract.on(
      "VotingFinalized",
      async (jobId, consensusPercent, mad) => {
        console.log(
          `Voting finalized for job ${jobId}. Consensus: ${consensusPercent}%`
        );
        await prisma.job.update({
          where: { jobId: Number(jobId) },
          data: { status: "Resolved" },
        });
      }
    );
  }

  private async processAIDispute(jobId: number) {
    try {
      // Logic for AI analysis here
      const verdict = { percent: 60, reason: "Merged Backend AI Result" };

      const tx = await this.disputeContract.submitAIVerdict!(
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
