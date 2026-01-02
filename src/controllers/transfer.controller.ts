import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { Coinbase, Wallet, Transfer } from "@coinbase/coinbase-sdk";
import path from "path";

const prisma = new PrismaClient();

// Use absolute path for the API key file
const apiKeyPath = path.join(
  process.cwd(),
  "src/services/coinbase.service/cdp_api_key.json"
);

const cb = Coinbase.configureFromJson({
  filePath: apiKeyPath,
  useServerSigner: true,
});

interface TransferData {
  id: string;
  destinationAddress: string;
  destinationUser: {
    wallet: {
      rewards: {
        amount: number;
        lastUpdated: string;
        _id: string;
        usdBalance: number;
        address: string;
      };
      _id: string;
      userId: string;
      name: string;
      email: string;
      imageUrl: string;
      faucet: {
        amount: number;
        _id: string;
        __v: number;
        assetId: string;
      };
    };
  } | null;
  transactionLink: string | null;
  status: string | null;
  amount: number;
}

export const getTransfers = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    const email =
      (req.headers["x-user-email"] as string | undefined) ||
      (req.query.email as string | undefined);

    if (!token || !email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userEmail = email!;
    const authToken = token!;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { wallet: { include: { rewards: true } }, faucet: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.wallet?.address) {
      return res.status(404).json({ error: "Wallet address not found" });
    }

    // Try to fetch the Wallet object using the stored Coinbase wallet ID
    let wallet;

    const coinbaseWalletId = (user.wallet as any).coinbaseWalletId as
      | string
      | undefined;

    if (coinbaseWalletId) {
      wallet = await Wallet.fetch(coinbaseWalletId);
    } else {
      // Fallback: no coinbaseWalletId stored — look up wallet by address
      console.warn(
        "[api/transfer/get] coinbaseWalletId missing — attempting to locate wallet by address:",
        user.wallet.address
      );

      const walletsList = await Wallet.listWallets();
      for (const w of walletsList.data) {
        try {
          const addrs = await w.listAddresses();
          const found = addrs.find(
            (a: any) => a.getId() === user.wallet.address
          );
          if (found) {
            wallet = w;
            break;
          }
        } catch (e) {
          // Some wallets may throw on listAddresses, skip those
          continue;
        }
      }
    }

    if (!wallet) {
      console.error(
        "[api/transfer/get] Coinbase wallet not found for user wallet",
        user.wallet
      );
      return res.status(404).json({ error: "Coinbase wallet not found" });
    }
    const address = await wallet.getDefaultAddress();
    const transfersResponse = await address.listTransfers();

    const processedTransfers: TransferData[] = [];
    const addressUserMap = new Map<string, any | null>();

    // Handle paginated response
    const items = transfersResponse.data;

    for (const transfer of items) {
      const destinationAddress = transfer.getDestinationAddressId();
      let destinationUser: any | null = null;

      if (addressUserMap.has(destinationAddress)) {
        destinationUser = addressUserMap.get(destinationAddress) ?? null;
      } else {
        // Find user by wallet address in database
        const foundUser = await prisma.user.findFirst({
          where: {
            wallet: {
              address: { contains: destinationAddress },
            },
          },
          include: {
            wallet: { include: { rewards: true } },
            faucet: true,
          },
        });

        if (foundUser && foundUser.wallet) {
          destinationUser = {
            wallet: {
              rewards: {
                amount: foundUser.wallet.rewards?.amount || 0,
                lastUpdated:
                  foundUser.wallet.rewards?.lastUpdated.toISOString() ||
                  new Date().toISOString(),
                _id: foundUser.wallet.id,
                usdBalance: foundUser.wallet.usdBalance || 0,
                address: foundUser.wallet.address || destinationAddress,
              },
              _id: foundUser.wallet.id,
              userId: foundUser.userId,
              name: foundUser.name,
              email: foundUser.email,
              imageUrl: foundUser.imageUrl,
              faucet: {
                amount: foundUser.faucet?.amount || 0,
                _id: foundUser.faucet?.id || "",
                __v: 0,
                assetId: "usdc",
              },
            },
          };
        }

        addressUserMap.set(destinationAddress, destinationUser);
      }

      processedTransfers.push({
        id: transfer.getId(),
        destinationAddress: transfer.getDestinationAddressId(),
        destinationUser: destinationUser,
        transactionLink: transfer.getTransactionLink() || null,
        status: transfer.getStatus() || null,
        amount: Number(transfer.getAmount()),
      });
    }

    // Reverse to show most recent first
    return res.json(processedTransfers.reverse());
  } catch (error) {
    console.error("[api/transfer/get] Failed to get transfers:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createTransfer = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { asset, data } = req.body as {
      asset?: string;
      data?: { recipient?: string; amount?: number };
    };
    const recipient = data?.recipient;
    const amount = data?.amount;

    if (!asset || !data || !recipient || !amount) {
      return res.status(400).json({ error: "Invalid request" });
    }

    // Find sending user by token stored as userId
    const user = (await prisma.user.findFirst({
      where: { userId: token },
      include: { wallet: { include: { rewards: true } }, faucet: true },
    })) as any;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.wallet?.id) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Resolve Coinbase Wallet instance (prefer coinbaseWalletId saved in DB)
    let wallet: any;
    const coinbaseWalletId = (user.wallet as any).coinbaseWalletId as
      | string
      | undefined;

    if (coinbaseWalletId) {
      wallet = await Wallet.fetch(coinbaseWalletId);
    } else {
      // Fallback: try to find wallet by matching address
      console.warn(
        "[api/transfer/create] coinbaseWalletId missing — attempting to locate wallet by address:",
        user.wallet.address
      );
      const walletsList = await Wallet.listWallets();
      for (const w of walletsList.data) {
        try {
          const addrs = await w.listAddresses();
          const found = addrs.find(
            (a: any) => a.getId() === user.wallet.address
          );
          if (found) {
            wallet = w;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (!wallet) {
      console.error(
        "[api/transfer/create] Coinbase wallet not found for user",
        { userId: user.userId, wallet: user.wallet }
      );
      return res.status(404).json({ error: "Coinbase wallet not found" });
    }

    // If asset is USDC check balance
    if (asset === Coinbase.assets.Usdc) {
      const balance = await wallet.getBalance(asset);
      if (balance.lessThan(amount)) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
    } else {
      return res.status(400).json({ error: "Unsupported asset" });
    }

    // Destination: if recipient matches a known user email, use their wallet address
    const destUser = (await prisma.user.findUnique({
      where: { email: recipient },
      include: { wallet: true },
    })) as any;
    const destinationAddress = destUser?.wallet?.address
      ? destUser.wallet.address
      : recipient;

    // Create transfer and wait
    const transferOp = await (
      await wallet.createTransfer({
        amount: amount,
        assetId: asset,
        destination: destinationAddress,
        gasless: asset === Coinbase.assets.Usdc ? true : false,
      })
    ).wait({ timeoutSeconds: 30 });

    // Wait for finalization (some SDK methods use a second wait)
    try {
      const transferResult = await transferOp.wait({ timeoutSeconds: 30 });
      return res.json({
        transactionLink: transferResult.getTransactionLink(),
        status: transferResult.getStatus(),
      });
    } catch (err) {
      console.error("[api/transfer/create] Transfer finalization failed:", err);
      return res.status(500).json({ error: "Transfer process timed out" });
    }
  } catch (error) {
    console.error("[api/transfer/create] Failed to create transfer:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
