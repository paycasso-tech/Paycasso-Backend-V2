import { ethers } from "ethers";
import { Wallet } from "@coinbase/coinbase-sdk";
// PrismaClient import removed
import DisputeArtifact from "../abis/TFADispute.json";
import DAOVotingArtifact from "../abis/TFADAOVoting.json";

import { prisma } from "../db";

export class DisputeService {
  /**
   * Cast a vote on behalf of a user (Voter)
   * Uses Coinbase CDP Wallet
   */
  async castVote(voterWalletId: string, jobId: number, contractorPercent: number) {
    try {
      console.log(`Casting vote for Job ${jobId} by wallet ${voterWalletId}`);
      
      // 1. Fetch User's Wallet
      const wallet = await Wallet.fetch(voterWalletId);
      
      // 2. Function Args
      const args = {
        _jobId: jobId.toString(),
        _contractorPercent: contractorPercent.toString()
      };

      console.log("Invoking contract with args:", args);

      // 3. Submit Transaction
      const invocation = await wallet.invokeContract({
        contractAddress: process.env.TFA_DAO_VOTING_ADDRESS!,
        method: "castVote",
        args: args,
        abi: DAOVotingArtifact.abi as any 
      });

      console.log("Vote transaction submitted. Waiting for confirmation...");
      const tx = await invocation.wait();
      
      console.log(`Vote confirmed: ${tx.getTransactionHash()}`);
      return tx.getTransactionHash();

    } catch (error) {
      console.error("Failed to cast vote:", error);
      throw error;
    }
  }

  /**
   * Create a new Job (User Action)
   */
  async createJob(clientWalletId: string, contractorAddress: string, amountUSDC: number) {
      try {
          console.log(`Creating Job: Client ${clientWalletId} -> Contractor ${contractorAddress} ($${amountUSDC})`);
          
          const wallet = await Wallet.fetch(clientWalletId);
          const amountWei = ethers.parseUnits(amountUSDC.toString(), 6).toString(); // USDC has 6 decimals

          const usdcAddress = process.env.APP_ENV === "production" 
              ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" 
              : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

          const erc20Abi = [
            {
              "constant": false,
              "inputs": [
                {"name": "_spender","type": "address"},
                {"name": "_value","type": "uint256"}
              ],
              "name": "approve",
              "outputs": [{"name": "","type": "bool"}],
              "type": "function"
            }
          ];

          // 1. Approve USDC
          console.log("Approving USDC spending...");
          const approval = await wallet.invokeContract({
              contractAddress: usdcAddress,
              method: "approve",
              args: {
                  _spender: process.env.TFA_DISPUTE_ADDRESS!,
                  _value: amountWei
              },
              abi: erc20Abi as any
          });
          await approval.wait();
          console.log("USDC Approved.");

          // 2. Create Job
          console.log("Calling createJob...");
          const invocation = await wallet.invokeContract({
              contractAddress: process.env.TFA_DISPUTE_ADDRESS!,
              method: "createJob",
              args: {
                  _contractor: contractorAddress,
                  _amount: amountWei
              },
              abi: DisputeArtifact.abi as any
          });
          const tx = await invocation.wait();
          return tx.getTransactionHash();

      } catch (error) {
          console.error("Failed to create job:", error);
          throw error;
      }
  }

  /**
   * Release Funds to Contractor (User Action - Client)
   */
  async releaseFunds(clientWalletId: string, jobId: number) {
      try {
          console.log(`Releasing funds for Job ${jobId}`);
          const wallet = await Wallet.fetch(clientWalletId);
          
          const invocation = await wallet.invokeContract({
              contractAddress: process.env.TFA_DISPUTE_ADDRESS!,
              method: "releaseToContractor",
              args: { _jobId: jobId.toString() },
              abi: DisputeArtifact.abi as any
          });

          const tx = await invocation.wait();
          return tx.getTransactionHash();
      } catch (error) {
          console.error("Failed to release funds:", error);
          throw error;
      }
  }

  /**
   * Raise Dispute (User Action)
   */
  async raiseDispute(userWalletId: string, jobId: number) {
      try {
          console.log(`Raising dispute for Job ${jobId}`);
          const wallet = await Wallet.fetch(userWalletId);
          
          const invocation = await wallet.invokeContract({
              contractAddress: process.env.TFA_DISPUTE_ADDRESS!,
              method: "raiseDispute",
              args: { _jobId: jobId.toString() },
              abi: DisputeArtifact.abi as any
          });

          const tx = await invocation.wait();
          return tx.getTransactionHash();
      } catch (error) {
          console.error("Failed to raise dispute:", error);
          throw error;
      }
  }

  /**
   * Accept AI Verdict (User Action)
   */
  async acceptVerdict(userWalletId: string, jobId: number) {
      try {
          console.log(`Accepting AI verdict for Job ${jobId}`);
          const wallet = await Wallet.fetch(userWalletId);
          
          const invocation = await wallet.invokeContract({
              contractAddress: process.env.TFA_DISPUTE_ADDRESS!,
              method: "acceptAIVerdict",
              args: { _jobId: jobId.toString() },
              abi: DisputeArtifact.abi as any
          });

          const tx = await invocation.wait();
          return tx.getTransactionHash();
      } catch (error) {
          console.error("Failed to accept verdict:", error);
          throw error;
      }
  }

  /**
   * Reject AI Verdict (User Action)
   */
  async rejectVerdict(userWalletId: string, jobId: number) {
      try {
          console.log(`Rejecting AI verdict for Job ${jobId}`);
          const wallet = await Wallet.fetch(userWalletId);
          
          const invocation = await wallet.invokeContract({
              contractAddress: process.env.TFA_DISPUTE_ADDRESS!,
              method: "rejectAIVerdict",
              args: { _jobId: jobId.toString() },
              abi: DisputeArtifact.abi as any
          });

          const tx = await invocation.wait();
          return tx.getTransactionHash();
      } catch (error) {
          console.error("Failed to reject verdict:", error);
          throw error;
      }
  }

  /**
   * Manually start voting session (DAO Escalation)
   * Only callable if the sender has the right role or if logic permits public calling
   */
  async escalateToDAO(jobId: number, durationSeconds: number = 86400) {
    try {
      console.log(`escalating job ${jobId} to DAO with duration ${durationSeconds}`);
      
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
    private disputeContract: ethers.Contract;
    private daoContract: ethers.Contract;
    
    // Admin-privileged contract instances
    private adminDisputeContract?: ethers.Contract;
    private adminDaoContract?: ethers.Contract;

    constructor() {
        const provider = new ethers.WebSocketProvider(process.env.BASE_WSS_URL!);
        
        // 1. Setup AI Agent Wallet (Default for standard ops)
        const aiWallet = new ethers.Wallet(process.env.AI_WALLET_PRIVATE_KEY!, provider);
        
        // 2. Setup Admin Wallet (Optional, for admin ops)
        let adminWallet: ethers.Wallet | null = null;
        if (process.env.ADMIN_WALLET_PRIVATE_KEY && !process.env.ADMIN_WALLET_PRIVATE_KEY.includes("YOUR_")) {
            try {
                adminWallet = new ethers.Wallet(process.env.ADMIN_WALLET_PRIVATE_KEY, provider);
            } catch (e) {
                console.warn("⚠️  Invalid ADMIN_WALLET_PRIVATE_KEY format.");
            }
        } else {
            console.warn("⚠️  ADMIN_WALLET_PRIVATE_KEY is missing or invalid. Admin functions will fail.");
        }

        // Initialize Contracts (AI Signer)
        this.disputeContract = new ethers.Contract(process.env.TFA_DISPUTE_ADDRESS!, DisputeArtifact.abi, aiWallet);
        this.daoContract = new ethers.Contract(process.env.TFA_DAO_VOTING_ADDRESS!, DAOVotingArtifact.abi, aiWallet);

        // Initialize Contracts (Admin Signer) - Only if wallet exists
        if (adminWallet) {
            this.adminDisputeContract = new ethers.Contract(process.env.TFA_DISPUTE_ADDRESS!, DisputeArtifact.abi, adminWallet);
            this.adminDaoContract = new ethers.Contract(process.env.TFA_DAO_VOTING_ADDRESS!, DAOVotingArtifact.abi, adminWallet);
        }

        this.initializeListeners();
    }
    private initializeListeners() {
    console.log("Initializing Smart Contract Listeners...");

    // Sync Job Creation
    this.disputeContract.on(
      "JobCreated",
      async (id, client, contractor, amount) => {
        console.log(`Job Created: ${id} by ${client}`);
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
    this.disputeContract.on("DisputeRaised", async (id, raisedBy) => {
      console.log(`Dispute Raised for Job ${id} by ${raisedBy}`);
      await prisma.job.update({
        where: { jobId: Number(id) },
        data: { status: "DisputeRaised" },
      });
      // Trigger AI Agent instantly (or queue it)
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
      console.log(`Voting session started for job ${jobId}, ends at ${endTime}`);
      await prisma.job.update({
        where: { jobId: Number(jobId) },
        data: { status: "DisputeRaised" },
      });
    });

    this.daoContract.on("VotingFinalized", async (jobId, consensusPercent, mad) => {
      console.log(`Voting finalized for job ${jobId}. Consensus: ${consensusPercent}%`);
      await prisma.job.update({
        where: { jobId: Number(jobId) },
        data: { status: "Resolved" },
      });
    });
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
