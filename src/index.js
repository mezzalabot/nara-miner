// ============================================================
// NARA MULTI-MINER - FULL PIPELINE
// Generate wallets → Mine → Consolidate
// ============================================================

import chalk from 'chalk';
import { CONFIG } from './config.js';

async function main() {
  console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════════╗
║                                              ║
║   ███╗   ██╗ █████╗ ██████╗  █████╗         ║
║   ████╗  ██║██╔══██╗██╔══██╗██╔══██╗        ║
║   ██╔██╗ ██║███████║██████╔╝███████║        ║
║   ██║╚██╗██║██╔══██║██╔══██╗██╔══██║        ║
║   ██║ ╚████║██║  ██║██║  ██║██║  ██║        ║
║   ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝        ║
║                                              ║
║   Multi-Wallet PoMI Miner v1.0               ║
║   ${CONFIG.TOTAL_WALLETS} Wallets × Automated Mining             ║
║                                              ║
╚══════════════════════════════════════════════╝
  `));

  // Validasi config
  if (CONFIG.MAIN_WALLET === 'GANTI_DENGAN_WALLET_UTAMA_MU') {
    console.log(chalk.red.bold('\n⚠  MAIN_WALLET belum di-set!'));
    console.log(chalk.white('   Edit file: src/config.js'));
    console.log(chalk.white('   Ganti MAIN_WALLET dengan address wallet utama kamu\n'));
    process.exit(1);
  }

  console.log(chalk.white('Config:'));
  console.log(chalk.gray(`  RPC        : ${CONFIG.RPC_URL}`));
  console.log(chalk.gray(`  Relay      : ${CONFIG.USE_RELAY ? CONFIG.RELAY_URL : 'DISABLED'}`));
  console.log(chalk.gray(`  Main Wallet: ${CONFIG.MAIN_WALLET}`));
  console.log(chalk.gray(`  Wallets    : ${CONFIG.TOTAL_WALLETS}`));
  console.log(chalk.gray(`  Concurrency: ${CONFIG.CONCURRENCY}`));
  console.log(chalk.gray(`  Auto Consol: every ${CONFIG.CONSOLIDATE_AFTER_ROUNDS} rounds`));
  console.log('');

  // Jalankan miner (miner.js handle semuanya)
  console.log(chalk.yellow('Starting miner... (Ctrl+C to stop)\n'));
  await import('./miner.js');
}

main().catch(err => {
  console.error(chalk.red('Fatal:'), err.message);
  process.exit(1);
});
