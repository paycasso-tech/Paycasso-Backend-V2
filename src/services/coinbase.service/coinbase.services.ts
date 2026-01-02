import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { PrismaClient } from "@prisma/client";
import {
  getWalletIdFromPath,
  storeWalletIdToPath,
} from "../../utils/lib/coinbase/index";
import fs from "fs";
import path from "path";

// Use absolute path for the API key file
const apiKeyPath = path.join(
  process.cwd(),
  "src/services/coinbase.service/cdp_api_key.json"
);

const cb = Coinbase.configureFromJson({
  filePath: apiKeyPath,
  useServerSigner: true,
});

const prisma = new PrismaClient();

const createWalletForUser = async (user: { id: string; walletId: string }) => {
  const wallet = await Wallet.create({
    networkId: Coinbase.networks.BaseSepolia,
  });

  const defaultAddressId = (await wallet.getDefaultAddress()).getId();

  // If Prisma schema doesn't yet include 'coinbaseWalletId', cast the payload to `any` to avoid
  // TS errors. Best long-term fix: add `coinbaseWalletId String?` to your Prisma Wallet model and run
  // `npx prisma migrate dev` + `npx prisma generate`.
  const walletUpdateData: any = {
    address: defaultAddressId,
    coinbaseWalletId: wallet.getId() as string,
  };

  await prisma.wallet.update({
    where: { id: user.walletId },
    data: walletUpdateData,
  });

  return await prisma.user.findUnique({
    where: { id: user.id },
    include: { wallet: true, faucet: true },
  });
};

// FAUCET

let _faucet: Wallet;
const faucet = () => _faucet;
const faucetIdPath = path.join(
  process.cwd(),
  "src/services/coinbase.service/faucet_id.json"
);

const setupFaucet = async () => {
  try {
    // If Wallet exists
    if (fs.existsSync(faucetIdPath)) {
      console.log("[coinbase/setup] 🔄 Faucet exists, re-instantiating...");
      const faucetId = getWalletIdFromPath(faucetIdPath);
      _faucet = await Wallet.fetch(faucetId);
      console.log(
        "[coinbase/setup] ✅ Faucet re-instantiated: ",
        (await _faucet.getDefaultAddress()).getId()
      );
    }
    // Create Wallet
    else {
      console.log("[coinbase/setup] 🔄 Creating faucet wallet...");
      _faucet = await Wallet.create({
        networkId: Coinbase.networks.BaseSepolia,
      });
      storeWalletIdToPath(faucetIdPath, _faucet.getId() as string);
      console.log(
        "[coinbase/setupFaucet] ✅ Faucet set up: ",
        (await _faucet.getDefaultAddress()).getId()
      );
    }
  } catch (err) {
    console.error("[coinbase/setupFaucet] ❌ Failed to setup Faucet");
    console.error(err);
    throw err;
  }
};

const fundWallet = async (
  destination: string,
  asset: string,
  amount: number
) => {
  await (
    await faucet().createTransfer({
      destination: destination,
      amount: amount,
      assetId: asset,
      gasless: asset === Coinbase.assets.Usdc ? true : false,
    })
  ).wait({ timeoutSeconds: 30 });
};

export { cb, createWalletForUser, fundWallet, faucet, setupFaucet };
