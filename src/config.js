// ============================================================
// NARA MULTI-MINER CONFIG - OPTIMIZED
// ============================================================

import os from 'os';

const cpuCount = os.cpus().length;

export const CONFIG = {
  MAIN_WALLET: process.env.NARA_MAIN_WALLET || '3PFnwk23PRkPemtFtBH7TsUiAEsb5pcrVgjRYR7764yu',

  // Force mainnet unless you intentionally edit this file.
  RPC_URL: 'https://mainnet-api.nara.build/',
  RELAY_URL: process.env.NARA_RELAY || 'https://quest-api.nara.build/',

  TOTAL_WALLETS: 304,
  WALLETS_DIR: './wallets',
  WALLETS_INDEX: './wallets/index.json',

  // GPT-5.4 recommended: reduced for stability (was 96/48/48/24)
  CHECK_CONCURRENCY: Number(process.env.NARA_CHECK_CONCURRENCY || 16),
  PROOF_CONCURRENCY: Number(process.env.NARA_PROOF_CONCURRENCY || 4),
  SUBMIT_CONCURRENCY: Number(process.env.NARA_SUBMIT_CONCURRENCY || 12),
  REWARD_CONCURRENCY: Number(process.env.NARA_REWARD_CONCURRENCY || 8),

  // Aggressive polling for faster response (250ms = 4 checks/second)
  POLL_INTERVAL_MS: Number(process.env.NARA_POLL_INTERVAL_MS || 250),
  ROUND_WAIT_MS: Number(process.env.NARA_ROUND_WAIT_MS || 1200),
  REWARD_CHECK_DELAY_MS: Number(process.env.NARA_REWARD_CHECK_DELAY_MS || 1500),

  USE_RELAY: true,
  MIN_BALANCE_FOR_DIRECT: Number(process.env.NARA_MIN_BALANCE_FOR_DIRECT || 0.1),
  // Increased from 4 to 50 for hybrid direct/relay strategy
  // Top 50 wallets get direct submission (faster), rest use relay
  PRIORITY_WALLET_COUNT: Number(process.env.NARA_PRIORITY_WALLET_COUNT || 50),

  AUTO_CONSOLIDATE: true,
  CONSOLIDATE_THRESHOLD: Number(process.env.NARA_CONSOLIDATE_THRESHOLD || 0.01),
  CONSOLIDATE_AFTER_ROUNDS: Number(process.env.NARA_CONSOLIDATE_AFTER_ROUNDS || 5),

  LOG_LEVEL: process.env.NARA_LOG_LEVEL || 'info',
  LOG_FILE: process.env.NARA_LOG_FILE || './logs/miner.log',
};
