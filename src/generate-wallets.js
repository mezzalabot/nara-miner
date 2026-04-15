// ============================================================
// GENERATE 300 NARA WALLETS
// Masing-masing wallet disimpan sebagai keypair JSON
// ============================================================

import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { CONFIG } from './config.js';

const WALLETS_DIR = CONFIG.WALLETS_DIR;
const INDEX_FILE = CONFIG.WALLETS_INDEX;

async function generateWallets() {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   NARA WALLET GENERATOR v1.0        ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════╝\n'));

  // Buat folder wallets
  if (!fs.existsSync(WALLETS_DIR)) {
    fs.mkdirSync(WALLETS_DIR, { recursive: true });
  }

  // Cek apakah udah ada wallets
  if (fs.existsSync(INDEX_FILE)) {
    const existing = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    console.log(chalk.yellow(`⚠  Udah ada ${existing.length} wallets. Mau overwrite? (hapus folder wallets/ dulu)`));
    console.log(chalk.yellow(`   Lokasi: ${path.resolve(WALLETS_DIR)}`));
    process.exit(1);
  }

  const wallets = [];
  const total = CONFIG.TOTAL_WALLETS;

  console.log(chalk.white(`Generating ${total} wallets...\n`));

  for (let i = 0; i < total; i++) {
    // Generate mnemonic (BIP39)
    const mnemonic = bip39.generateMnemonic();

    // Derive keypair (Solana standard derivation path)
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);

    // Simpan keypair ke file
    const filename = `wallet_${String(i).padStart(3, '0')}.json`;
    const filepath = path.join(WALLETS_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(Array.from(keypair.secretKey)));

    // Simpan info ke index
    wallets.push({
      index: i,
      address: keypair.publicKey.toBase58(),
      mnemonic: mnemonic,
      file: filename,
    });

    // Progress
    if ((i + 1) % 25 === 0 || i === total - 1) {
      const pct = Math.round(((i + 1) / total) * 100);
      const bar = '█'.repeat(Math.floor(pct / 2)) + '░'.repeat(50 - Math.floor(pct / 2));
      process.stdout.write(`\r  ${chalk.green(bar)} ${chalk.white(`${pct}%`)} (${i + 1}/${total})`);
    }
  }

  // Simpan index
  fs.writeFileSync(INDEX_FILE, JSON.stringify(wallets, null, 2));

  // Simpan backup mnemonic terpisah (PENTING!)
  const mnemonicBackup = wallets.map(w => `${w.index}\t${w.address}\t${w.mnemonic}`).join('\n');
  const backupFile = path.join(WALLETS_DIR, '_BACKUP_MNEMONICS.txt');
  fs.writeFileSync(backupFile, `# NARA WALLET BACKUP - JANGAN SHARE FILE INI!\n# Generated: ${new Date().toISOString()}\n# Format: index\\taddress\\tmnemonic\n\n${mnemonicBackup}`);

  console.log('\n');
  console.log(chalk.green.bold('✓ Semua wallet berhasil dibuat!\n'));
  console.log(chalk.white(`  Total     : ${chalk.bold(total)} wallets`));
  console.log(chalk.white(`  Lokasi    : ${chalk.bold(path.resolve(WALLETS_DIR))}`));
  console.log(chalk.white(`  Index     : ${chalk.bold(path.resolve(INDEX_FILE))}`));
  console.log(chalk.white(`  Backup    : ${chalk.bold(path.resolve(backupFile))}`));
  console.log(chalk.white(`  Main Wallet: ${chalk.bold(CONFIG.MAIN_WALLET)}`));
  console.log('');
  console.log(chalk.red.bold('⚠  BACKUP FILE _BACKUP_MNEMONICS.txt WAJIB DISIMPAN AMAN!'));
  console.log(chalk.red.bold('   File ini berisi semua mnemonic - JANGAN SHARE!'));
  console.log('');

  // Preview 5 wallet pertama
  console.log(chalk.cyan('Preview (5 wallet pertama):'));
  wallets.slice(0, 5).forEach(w => {
    console.log(chalk.gray(`  [${w.index}] ${w.address}`));
  });
  console.log(chalk.gray(`  ... dan ${total - 5} wallet lainnya`));
  console.log('');
}

generateWallets().catch(err => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});
