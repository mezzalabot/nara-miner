// ============================================================
// NARA MULTI-WALLET MINER
// Automated PoMI mining across 300 wallets
// ============================================================

import {
  getQuestInfo,
  hasAnswered,
  generateProof,
  submitAnswer,
  submitAnswerViaRelay,
  parseQuestReward,
  Keypair,
} from 'nara-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import chalk from 'chalk';
import { CONFIG } from './config.js';
import { log } from './logger.js';
import { solveQuestion } from './solver.js';
import { consolidateAll } from './consolidate.js';
import { notifyReward, notifyQuestSolved, notifyConsolidation, notifyError, sendNotification } from './telegram-notifier.js';

// ──── LOAD WALLETS ────

function loadWallets() {
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

  return wallets;
}

// ──── MINE SINGLE WALLET ────

async function mineWithWallet(connection, wallet, quest, answer) {
  const idx = wallet.index;

  try {
    // Cek apakah udah jawab round ini
    const alreadyAnswered = await hasAnswered(connection, wallet.keypair);
    if (alreadyAnswered) {
      log.debug(`[W-${idx}] Udah jawab round ini, skip`);
      return { wallet: idx, status: 'skipped', reason: 'already_answered' };
    }

    // Generate ZK proof
    log.mining(idx, 'Generating ZK proof...');
    let proof;
    try {
      proof = await generateProof(
        answer,
        quest.answerHash,
        wallet.keypair.publicKey,
        quest.round
      );
    } catch (e) {
      log.warn(`[W-${idx}] Proof generation gagal: ${e.message}`);
      return { wallet: idx, status: 'failed', reason: 'proof_failed', error: e.message };
    }

    // Submit answer
    log.mining(idx, 'Submitting answer...');
    let signature;

    if (CONFIG.USE_RELAY) {
      // Gasless via relay
      try {
        const result = await submitAnswerViaRelay(
          CONFIG.RELAY_URL,
          wallet.keypair.publicKey,
          proof.hex
        );
        signature = result.txHash;
        log.mining(idx, chalk.green(`Relay submit OK: ${signature.slice(0, 16)}...`));
      } catch (e) {
        log.warn(`[W-${idx}] Relay submit gagal: ${e.message}`);
        return { wallet: idx, status: 'failed', reason: 'relay_failed', error: e.message };
      }
    } else {
      // Direct on-chain submit
      try {
        const result = await submitAnswer(
          connection,
          wallet.keypair,
          proof.solana
        );
        signature = result.signature;
        log.mining(idx, chalk.green(`Direct submit OK: ${signature.slice(0, 16)}...`));
      } catch (e) {
        log.warn(`[W-${idx}] Direct submit gagal: ${e.message}`);
        return { wallet: idx, status: 'failed', reason: 'submit_failed', error: e.message };
      }
    }

    // Cek reward
    try {
      // Tunggu sebentar biar tx confirmed
      await sleep(2000);
      const reward = await parseQuestReward(connection, signature);
      if (reward.rewarded) {
        log.success(`[W-${idx}] REWARD! ${reward.rewardNso} NARA`);
        return { wallet: idx, status: 'rewarded', reward: reward.rewardNso, tx: signature };
      } else {
        log.mining(idx, chalk.yellow('Submitted tapi ga dapet reward (slot penuh)'));
        return { wallet: idx, status: 'submitted', reward: 0, tx: signature };
      }
    } catch (e) {
      log.mining(idx, chalk.yellow(`Submitted, reward check gagal: ${e.message}`));
      return { wallet: idx, status: 'submitted', reward: null, tx: signature };
    }
  } catch (e) {
    log.error(`[W-${idx}] Unexpected error: ${e.message}`);
    return { wallet: idx, status: 'error', error: e.message };
  }
}

// ──── MAIN MINING LOOP ────

async function startMining() {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   NARA MULTI-WALLET MINER v1.0      ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════╝\n'));

  // Load wallets
  const wallets = loadWallets();
  log.info(`Loaded ${wallets.length} wallets`);
  log.info(`RPC: ${CONFIG.RPC_URL}`);
  log.info(`Relay: ${CONFIG.USE_RELAY ? CONFIG.RELAY_URL : 'DISABLED'}`);
  log.info(`Main Wallet: ${CONFIG.MAIN_WALLET}`);
  log.info(`Concurrency: ${CONFIG.CONCURRENCY}`);
  console.log('');

  // Startup notification
  const startupMessage = `\n🚀 <b>NARA MINER STARTED</b>\n\n👛 Wallets: <b>${wallets.length}</b>\n🌐 Network: ${CONFIG.RPC_URL.includes('mainnet') ? 'Mainnet' : 'Devnet'}\n🏦 Main: ${CONFIG.MAIN_WALLET.slice(0, 12)}...\n⏰ Started: ${new Date().toLocaleString()}\n\n⛏️ Mining...`.trim();
  sendNotification(startupMessage).catch(() => {});

  const connection = new Connection(CONFIG.RPC_URL, 'confirmed');
  const limit = pLimit(CONFIG.CONCURRENCY);

  let roundCount = 0;
  let totalRewards = 0;
  let lastRound = null;

  // Stats tracking
  const stats = {
    rounds: 0,
    totalSubmitted: 0,
    totalRewarded: 0,
    totalNara: 0,
    errors: 0,
    startTime: Date.now(),
  };

  // ──── MINING LOOP ────

  while (true) {
    try {
      // Fetch current quest
      log.info('Fetching quest...');
      const quest = await getQuestInfo(connection);

      if (!quest.active || quest.expired) {
        log.info('No active quest / expired. Waiting...');
        await sleep(CONFIG.POLL_INTERVAL_MS);
        continue;
      }

      // Skip kalau masih round yang sama
      if (quest.round === lastRound) {
        log.debug(`Same round (${quest.round}), waiting...`);
        await sleep(CONFIG.POLL_INTERVAL_MS);
        continue;
      }

      // New round!
      lastRound = quest.round;
      roundCount++;
      stats.rounds++;

      log.info(chalk.bold(`\n═══ ROUND ${roundCount} ═══`));
      log.info(`Question: ${quest.question}`);
      log.info(`Reward: ${quest.rewardPerWinner} NARA x ${quest.rewardCount} slots`);
      log.info(`Remaining slots: ${quest.remainingSlots}`);
      log.info(`Deadline: ${quest.timeRemaining}s`);

      if (quest.remainingSlots <= 0) {
        log.warn('No remaining slots, skip round');
        await sleep(CONFIG.POLL_INTERVAL_MS);
        continue;
      }

      // Solve question
      const answer = solveQuestion(quest.question);
      if (!answer) {
        log.error(`Gabisa solve: "${quest.question}"`);
        await sleep(CONFIG.POLL_INTERVAL_MS);
        continue;
      }

      log.info(chalk.green(`Answer: ${answer}`));

      // Mine semua wallet secara concurrent (dengan limit)
      const results = await Promise.allSettled(
        wallets.map(wallet =>
          limit(() => mineWithWallet(connection, wallet, quest, answer))
        )
      );

      // Hitung stats
      let roundRewarded = 0;
      let roundNara = 0;
      let roundErrors = 0;
      let roundSubmitted = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const r = result.value;
          if (r.status === 'rewarded') {
            roundRewarded++;
            roundNara += r.reward || 0;
          }
          if (r.status === 'submitted' || r.status === 'rewarded') {
            roundSubmitted++;
          }
          if (r.status === 'failed' || r.status === 'error') {
            roundErrors++;
          }
        } else {
          roundErrors++;
        }
      }

      stats.totalSubmitted += roundSubmitted;
      stats.totalRewarded += roundRewarded;
      stats.totalNara += roundNara;
      stats.errors += roundErrors;

      // Round summary
      console.log('');
      log.info(chalk.bold('── Round Summary ──'));
      log.info(`  Submitted : ${roundSubmitted}`);
      log.success(`  Rewarded  : ${roundRewarded}`);
      log.info(`  NARA Earned: ${roundNara}`);
      if (roundErrors > 0) log.warn(`  Errors    : ${roundErrors}`);
      log.info(chalk.bold('── Total Stats ──'));

      // Telegram notification for rewards
      if (roundRewarded > 0) {
        const rewardResults = results
          .filter(r => r.status === 'fulfilled' && r.value.status === 'rewarded')
          .map(r => r.value);
        for (const r of rewardResults.slice(0, 3)) { // Notify first 3 rewards
          notifyReward(r.wallet, r.reward, wallets.length, quest.round).catch(() => {});
        }
      }

      // Notify quest solved (if this is first time solving this question)
      if (answer && roundSubmitted > 0) {
        notifyQuestSolved(quest.question, answer, results.map(r => r.value || {}), wallets.length).catch(() => {});
      }
      log.info(`  Rounds    : ${stats.rounds}`);
      log.info(`  Submitted : ${stats.totalSubmitted}`);
      log.success(`  Rewarded  : ${stats.totalRewarded}`);
      log.info(`  Total NARA: ${stats.totalNara}`);
      const uptime = ((Date.now() - stats.startTime) / 60000).toFixed(1);
      log.info(`  Uptime    : ${uptime} min`);
      console.log('');

      // Auto consolidate
      if (CONFIG.AUTO_CONSOLIDATE && roundCount % CONFIG.CONSOLIDATE_AFTER_ROUNDS === 0) {
        log.info(chalk.yellow('Auto consolidating rewards to main wallet...'));
        try {
          const result = await consolidateAll(connection, wallets, CONFIG.MAIN_WALLET, CONFIG.CONSOLIDATE_THRESHOLD);
          if (result.totalTransferred > 0) {
            const mainBalance = await connection.getBalance(new PublicKey(CONFIG.MAIN_WALLET)) / 1000000000;
            notifyConsolidation(result.totalTransferred.toFixed(4), wallets.length, mainBalance.toFixed(4)).catch(() => {});
          }
        } catch (e) {
          log.error(`Consolidate error: ${e.message}`);
          notifyError(e.message, 'Consolidation').catch(() => {});
        }
      }

      // Wait sebelum cek round berikutnya
      await sleep(CONFIG.ROUND_WAIT_MS);
    } catch (e) {
      log.error(`Mining loop error: ${e.message}`);
      notifyError(e.message, 'Mining Loop').catch(() => {});
      await sleep(CONFIG.POLL_INTERVAL_MS);
    }
  }
}

// ──── UTILS ────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──── RUN ────

startMining().catch(err => {
  log.error(`Fatal: ${err.message}`);
  process.exit(1);
});
