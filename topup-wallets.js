// Top up 46 wallets (index 4-49) with 0.2 NARA each for direct submission
// Uses main wallet (index 0) as source

import { Connection, PublicKey, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const RPC_URL = 'https://mainnet-api.nara.build/';
const WALLETS_DIR = './wallets';
const WALLETS_INDEX = './wallets/index.json';

// Configuration
const SOURCE_WALLET_INDEX = 0; // Main wallet
const START_INDEX = 4;         // First wallet to fund
const END_INDEX = 49;          // Last wallet to fund (46 wallets total)
const AMOUNT_NARA = 0.2;       // Amount to transfer to each wallet
const LAMPORTS_PER_NARA = 1000000000; // 1 NARA = 10^9 lamports

async function loadWallet(index) {
  const walletsData = JSON.parse(fs.readFileSync(WALLETS_INDEX, 'utf8'));
  const walletInfo = walletsData.find(w => w.index === index);
  if (!walletInfo) throw new Error(`Wallet ${index} not found in index`);
  
  const walletPath = path.join(WALLETS_DIR, walletInfo.file);
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  
  // Convert to Keypair
  const secretKey = Uint8Array.from(walletData.privateKey || walletData._keypair?.secretKey || walletData);
  return Keypair.fromSecretKey(secretKey);
}

async function checkBalance(connection, publicKey) {
  try {
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return balance / LAMPORTS_PER_NARA;
  } catch (e) {
    return 0;
  }
}

async function topUpWallet(connection, sourceKeypair, destPublicKey, amountNara) {
  const amountLamports = Math.floor(amountNara * LAMPORTS_PER_NARA);
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sourceKeypair.publicKey,
      toPubkey: new PublicKey(destPublicKey),
      lamports: amountLamports,
    })
  );
  
  const signature = await connection.sendTransaction(transaction, [sourceKeypair]);
  await connection.confirmTransaction(signature);
  
  return signature;
}

async function main() {
  console.log('=== NARA WALLET TOP-UP ===');
  console.log(`Funding wallets ${START_INDEX}-${END_INDEX} with ${AMOUNT_NARA} NARA each`);
  console.log(`Total needed: ${(END_INDEX - START_INDEX + 1) * AMOUNT_NARA} NARA`);
  console.log('');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Load source wallet (main)
  const sourceWallet = await loadWallet(SOURCE_WALLET_INDEX);
  const sourceBalance = await checkBalance(connection, sourceWallet.publicKey.toBase58());
  console.log(`Source wallet (${SOURCE_WALLET_INDEX}): ${sourceBalance.toFixed(2)} NARA`);
  console.log(`Address: ${sourceWallet.publicKey.toBase58()}`);
  console.log('');
  
  if (sourceBalance < (END_INDEX - START_INDEX + 1) * AMOUNT_NARA + 0.01) {
    console.error('ERROR: Insufficient balance for top-up');
    console.error(`Need: ${(END_INDEX - START_INDEX + 1) * AMOUNT_NARA} NARA + fees`);
    console.error(`Have: ${sourceBalance.toFixed(2)} NARA`);
    process.exit(1);
  }
  
  // Load wallets index
  const walletsData = JSON.parse(fs.readFileSync(WALLETS_INDEX, 'utf8'));
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = START_INDEX; i <= END_INDEX; i++) {
    const walletInfo = walletsData.find(w => w.index === i);
    if (!walletInfo) {
      console.log(`[SKIP] Wallet ${i} not found in index`);
      continue;
    }
    
    const currentBalance = await checkBalance(connection, walletInfo.address);
    console.log(`[${i}] ${walletInfo.address.slice(0, 20)}... Current: ${currentBalance.toFixed(4)} NARA`);
    
    if (currentBalance >= 0.15) {
      console.log(`    Already funded, skipping`);
      successCount++;
      continue;
    }
    
    try {
      const signature = await topUpWallet(connection, sourceWallet, walletInfo.address, AMOUNT_NARA);
      console.log(`    ✅ Sent ${AMOUNT_NARA} NARA - Sig: ${signature.slice(0, 20)}...`);
      successCount++;
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`    ❌ Failed: ${e.message}`);
      failCount++;
    }
  }
  
  console.log('');
  console.log('=== TOP-UP COMPLETE ===');
  console.log(`Success: ${successCount}/${END_INDEX - START_INDEX + 1}`);
  console.log(`Failed: ${failCount}`);
  
  // Check remaining balance
  const remainingBalance = await checkBalance(connection, sourceWallet.publicKey.toBase58());
  console.log(`Source remaining: ${remainingBalance.toFixed(2)} NARA`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
