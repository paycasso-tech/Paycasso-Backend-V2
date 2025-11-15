-- Add coinbaseWalletId column to Wallet
ALTER TABLE "Wallet" ADD COLUMN "coinbaseWalletId" TEXT;

-- Create unique index if needed
CREATE UNIQUE INDEX "Wallet_coinbaseWalletId_key" ON "Wallet"("coinbaseWalletId");
