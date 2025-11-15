import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';
import path from 'path';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apiKeyPath = path.join(process.cwd(), 'src/services/coinbase.service/cdp_api_key.json');
  const cb = Coinbase.configureFromJson({ filePath: apiKeyPath, useServerSigner: true });

  const walletsList = await Wallet.listWallets();
  for (const w of walletsList.data) {
    try {
      const defaultAddress = await w.getDefaultAddress();
      const addressId = defaultAddress.getId();

      const existing = await prisma.wallet.findFirst({ where: { address: { contains: addressId } } });
      if (existing) {
        console.log('Found db wallet for address', addressId, ' - updating coinbaseWalletId to', w.getId());
        await prisma.wallet.update({ where: { id: existing.id }, data: { coinbaseWalletId: w.getId() as string } });
      }
    } catch (err) {
      // ignore
      console.warn('Failed to handle wallet', w.getId(), err);
      continue;
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
