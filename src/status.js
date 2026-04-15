// ============================================================
// STATUS CHECKER - Cek balance semua wallet
// ============================================================

import { Keypair } from 'nara-sdk';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { CONFIG } from './config.js';

async function checkStatus() {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   NARA WALLET STATUS CHECKER        ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════╝\n'));

  if (!fs.existsSync(CONFIG.WALLETS_INDEX)) {
    console.log(chalk.red('Wallet index tidak ditemukan. Jalankan: npm run generate'));
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(CONFIG.WALLETS_INDEX, 'utf-8'));
  const connection = new Connection(CONFIG.RPC_URL, 'confirmed');

  console.log(chalk.white(`RPC: ${CONFIG.RPC_URL}`));
  console.log(chalk.white(`Wallets: ${index.length}`));
  console.log(chalk.white(`Main: ${CONFIG.MAIN_WALLET}\n`));

  let totalBalance = 0;
  let nonZero = 0;
  const richWallets = [];

  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    try {
      const filepath = path.join(CONFIG.WALLETS_DIR, entry.file);
      const keypairData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

      const balance = await connection.getBalance(keypair.publicKey);
      const balanceNara = balance / LAMPORTS_PER_SOL;

      if (balanceNara > 0) {
        totalBalance += balanceNara;
        nonZero++;
        richWallets.push({ index: i, address: entry.address, balance: balanceNara });
      }

      // Progress
      if ((i + 1) % 50 === 0 || i === index.length - 1) {
        process.stdout.write(`\r  Scanning... ${i + 1}/${index.length}`);
      }
    } catch (e) {
      // skip
    }
  }

  console.log('\n');

  // Tampilkan wallets yang punya balance
  if (richWallets.length > 0) {
    console.log(chalk.cyan.bold('Wallets with balance:'));
    console.log(chalk.gray('─'.repeat(70)));

    // Sort by balance descending
    richWallets.sort((a, b) => b.balance - a.balance);

    for (const w of richWallets) {
      const idx = chalk.magenta(`[W-${String(w.index).padStart(3, '0')}]`);
      const addr = chalk.white(w.address.slice(0, 20) + '...');
      const bal = chalk.green(`${w.balance.toFixed(6)} NARA`);
      console.log(`  ${idx} ${addr} ${bal}`);
    }
    console.log(chalk.gray('─'.repeat(70)));
  }

  console.log('');
  console.log(chalk.white.bold('Summary:'));
  console.log(chalk.white(`  Total wallets     : ${index.length}`));
  console.log(chalk.white(`  With balance      : ${chalk.green(nonZero)}`));
  console.log(chalk.white(`  Empty             : ${index.length - nonZero}`));
  console.log(chalk.green.bold(`  Total NARA        : ${totalBalance.toFixed(6)}`));
  console.log('');

  // Cek main wallet balance juga
  try {
    if (CONFIG.MAIN_WALLET !== 'GANTI_DENGAN_WALLET_UTAMA_MU') {
      const { PublicKey } = await import('@solana/web3.js');
      const mainBalance = await connection.getBalance(new PublicKey(CONFIG.MAIN_WALLET));
      console.log(chalk.yellow.bold(`  Main Wallet NARA  : ${(mainBalance / LAMPORTS_PER_SOL).toFixed(6)}`));
      console.log('');
    }
  } catch { /* skip */ }
}

checkStatus().catch(err => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});
