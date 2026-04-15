// ============================================================
// NARA MULTI-MINER CONFIG
// ============================================================

export const CONFIG = {
  // ──── MAIN WALLET (semua reward ditransfer ke sini) ────
  // Using first generated wallet as main (change to your own if needed)
  MAIN_WALLET: '3PFnwk23PRkPemtFtBH7TsUiAEsb5pcrVgjRYR7764yu',

  // ──── NETWORK ────
  RPC_URL: process.env.NARA_RPC || 'https://mainnet-api.nara.build/',
  RELAY_URL: process.env.NARA_RELAY || 'https://quest-api.nara.build/',

  // ──── WALLET GENERATION ────
  TOTAL_WALLETS: 304,
  WALLETS_DIR: './wallets',
  WALLETS_INDEX: './wallets/index.json',

  // ──── MINING ────
  CONCURRENCY: 10,             // jumlah wallet yg mine bareng
  POLL_INTERVAL_MS: 5_000,     // cek quest baru tiap 5 detik
  ROUND_WAIT_MS: 10_000,       // tunggu 10 detik setelah round selesai
  USE_RELAY: true,             // gasless mode (default: true buat wallet baru)
  MIN_BALANCE_FOR_DIRECT: 0.1, // min saldo buat direct submit (non-relay)

  // ──── AUTO CONSOLIDATE ────
  AUTO_CONSOLIDATE: true,
  CONSOLIDATE_THRESHOLD: 0.01, // min saldo buat transfer ke main wallet
  CONSOLIDATE_AFTER_ROUNDS: 5, // konsolidasi setiap N round

  // ──── LOGGING ────
  LOG_LEVEL: 'info',           // 'debug' | 'info' | 'warn' | 'error'
  LOG_FILE: './logs/miner.log',
};
