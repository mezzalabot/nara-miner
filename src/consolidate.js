// ============================================================
// CONSOLIDATE - Transfer semua NARA ke main wallet
// ============================================================

import {
  Keypair,
} from 'nara-sdk';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { CONFIG } from './config.js';
import { log } from './logger.js';

const NARA_DECIMALS = 9; // Solana-compatible, 1 NARA = 10^9 lamports

/**
 * Consolidate NARA dari semua sub-wallets ke main wallet
 */
export async function consolidateAll(connection, wallets, mainWalletAddress, threshold) {
  const mainPubkey = new PublicKey(mainWalletAddress);
  let totalTransferred = 0;
  let successCount = 0;
  let failCount = 0;

  log.info(`Consolidating to: ${mainWalletAddress}`);
  log.info(`Threshold: ${threshold} NARA`);

  for (const wallet of wallets) {
    try {
      // Cek balance
      const balance = await connection.getBalance(wallet.keypair.publicKey);
      const balanceNara = balance / LAMPORTS_PER_SOL;

      if (balanceNara < threshold) {
        log.debug(`[W-${wallet.index}] Balance ${balanceNara} < threshold, skip`);
        continue;
      }

      // Hitung amount (sisain sedikit buat fee)
      const fee = 0.001; // reserve 0.001 NARA buat tx fee
      const transferAmount = balanceNara - fee;

      if (transferAmount <= 0) {
        continue;
      }

      const lamports = Math.floor(transferAmount * LAMPORTS_PER_SOL);

      // Buat & kirim transaction
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.keypair.publicKey,
          toPubkey: mainPubkey,
          lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(connection, tx, [wallet.keypair], {
        commitment: 'confirmed',
      });

      totalTransferred += transferAmount;
      successCount++;
      log.success(`[W-${wallet.index}] Sent ${transferAmount.toFixed(4)} NARA → ${mainWalletAddress.slice(0, 8)}... (tx: ${signature.slice(0, 16)}...)`);
    } catch (e) {
      failCount++;
      log.warn(`[W-${wallet.index}] Transfer gagal: ${e.message}`);
    }
  }

  console.log('');
  log.info(chalk.bold('── Consolidation Summary ──'));
  log.success(`  Transferred: ${totalTransferred.toFixed(4)} NARA`);
  log.info(`  Success: ${successCount} wallets`);
  if (failCount > 0) log.warn(`  Failed: ${failCount} wallets`);
  log.info(`  Destination: ${mainWalletAddress}`);
  console.log('');

  return { totalTransferred, successCount, failCount };
}

// ──── STANDALONE MODE ────

async function main() {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   NARA CONSOLIDATOR v1.0            ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════╝\n'));

  if (CONFIG.MAIN_WALLET === 'GANTI_DENGAN_WALLET_UTAMA_MU') {
    log.error('Main wallet belum di-set! Edit src/config.js dulu.');
    process.exit(1);
  }

  // Load wallets
  if (!fs.existsSync(CONFIG.WALLETS_INDEX)) {
    log.error('Wallet index tidak ditemukan. Jalankan: npm run generate');
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(CONFIG.WALLETS_INDEX, 'utf-8'));
  const wallets = [];

  for (const entry of index) {
    const filepath = path.join(CONFIG.WALLETS_DIR, entry.file);
    const keypairData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    wallets.push({
      index: entry.index,
      address: entry.address,
      keypair,
    });
  }

  log.info(`Loaded ${wallets.length} wallets`);

  const connection = new Connection(CONFIG.RPC_URL, 'confirmed');

  // Cek total balance dulu
  log.info('Scanning balances...');
  let totalBalance = 0;
  let nonZero = 0;

  for (const wallet of wallets) {
    try {
      const balance = await connection.getBalance(wallet.keypair.publicKey);
      const balanceNara = balance / LAMPORTS_PER_SOL;
      if (balanceNara > 0) {
        totalBalance += balanceNara;
        nonZero++;
        log.debug(`[W-${wallet.index}] ${wallet.address.slice(0, 12)}... = ${balanceNara.toFixed(4)} NARA`);
      }
    } catch { /* skip */ }
  }

  console.log('');
  log.info(`Total balance across all wallets: ${chalk.bold(totalBalance.toFixed(4))} NARA`);
  log.info(`Wallets with balance: ${chalk.bold(nonZero)} / ${wallets.length}`);
  console.log('');

  if (nonZero === 0) {
    log.warn('Semua wallet kosong, nothing to consolidate.');
    return;
  }

  // Execute consolidation
  await consolidateAll(
    connection,
    wallets,
    CONFIG.MAIN_WALLET,
    CONFIG.CONSOLIDATE_THRESHOLD
  );
}

// Cek apakah dijalankan standalone
const isMain = process.argv[1]?.endsWith('consolidate.js');
if (isMain) {
  main().catch(err => {
    log.error(`Fatal: ${err.message}`);
    process.exit(1);
  });
}
