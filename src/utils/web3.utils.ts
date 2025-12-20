import { ethers } from "ethers";

/**
 * Converts human-readable USDC (e.g. 10.5) to blockchain format (6 decimals)
 */
export const toUSDC = (amount: number | string): bigint => {
  return ethers.parseUnits(amount.toString(), 6);
};

/**
 * Converts blockchain USDC (BigInt) to human-readable number
 */
export const fromUSDC = (amount: bigint | string): number => {
  return parseFloat(ethers.formatUnits(amount, 6));
};

/**
 * Ensures percentages are within 0-100 range for the DAO
 */
export const formatPercent = (percent: number): number => {
  return Math.min(Math.max(Math.floor(percent), 0), 100);
};

/**
 * Standardizes the 72-hour AI Acceptance window calculation
 */
export const getAIDeadline = (): Date => {
  return new Date(Date.now() + 72 * 60 * 60 * 1000);
};
