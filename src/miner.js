// ============================================================
// NARA MULTI-WALLET MINER - OPTIMIZED PIPELINE
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
import {
  notifyReward,
  notifyQuestSolved,
  notifyConsolidation,
  notifyError,
  sendNotification,
} from './telegram-notifier.js';

function loadWallets() {
  if (!fs.existsSync(CONFIG.WALLETS_INDEX)) {
    log.error('Wallet index tidak ditemukan. Jalankan: npm run generate');
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(CONFIG.WALLETS_INDEX, 'utf-8'));
  return index.map((entry) => {
    const filepath = path.join(CONFIG.WALLETS_DIR, entry.file);
    const keypairData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    return {
      index: entry.index,
      address: entry.address,
      keypair,
    };
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function questKey(quest) {
  return `${quest.round}:${quest.answerHash}`;
}

function shortTx(signature) {
  return signature ? `${signature.slice(0, 16)}...` : 'n/a';
}

function makeRuntime() {
  return {
    startTime: Date.now(),
    stats: {
      rounds: 0,
      totalEligible: 0,
      totalSubmitted: 0,
      totalRewarded: 0,
      totalNara: 0,
      errors: 0,
    },
    rewardChecksInFlight: 0,
    rewardLimit: pLimit(CONFIG.REWARD_CONCURRENCY),
    directWalletSet: new Set(),
    lastQuestKey: null,
  };
}

async function resolveSubmissionModes(connection, wallets) {
  const balanceLimit = pLimit(Math.min(CONFIG.CHECK_CONCURRENCY, 48));
  const direct = new Set();

  await Promise.all(
    wallets.map((wallet) =>
      balanceLimit(async () => {
        try {
          const lamports = await connection.getBalance(wallet.keypair.publicKey);
          const balance = lamports / 1_000_000_000;
          if (balance >= CONFIG.MIN_BALANCE_FOR_DIRECT) {
            direct.add(wallet.address);
          }
        } catch (e) {
          log.warn(`[W-${wallet.index}] gagal cek balance: ${e.message}`);
        }
      })
    )
  );

  return direct;
}

async function getEligibleWallets(connection, wallets) {
  const limit = pLimit(CONFIG.CHECK_CONCURRENCY);
  const checks = await Promise.all(
    wallets.map((wallet) =>
      limit(async () => {
        try {
          const alreadyAnswered = await hasAnswered(connection, wallet.keypair);
          return alreadyAnswered ? null : wallet;
        } catch (e) {
          log.warn(`[W-${wallet.index}] hasAnswered gagal: ${e.message}`);
          return null;
        }
      })
    )
  );
  return checks.filter(Boolean);
}

async function submitProof(connection, wallet, proof, useRelay) {
  if (useRelay) {
    const result = await submitAnswerViaRelay(
      CONFIG.RELAY_URL,
      wallet.keypair.publicKey,
      proof.hex
    );
    return { signature: result.txHash, mode: 'relay' };
  }

  const result = await submitAnswer(connection, wallet.keypair, proof.solana);
  return { signature: result.signature, mode: 'direct' };
}

function scheduleRewardCheck(connection, wallet, signature, questRound, runtime) {
  runtime.rewardChecksInFlight += 1;

  setTimeout(() => {
    runtime.rewardLimit(async () => {
      try {
        const reward = await parseQuestReward(connection, signature);
        if (reward?.rewarded) {
          runtime.stats.totalRewarded += 1;
          runtime.stats.totalNara += Number(reward.rewardNso || 0);
          log.success(`[W-${wallet.index}] REWARD! ${reward.rewardNso} NARA`);
          notifyReward(wallet.index, reward.rewardNso, CONFIG.TOTAL_WALLETS, questRound).catch(() => {});
        } else {
          log.mining(wallet.index, chalk.yellow('Submitted, no reward / slot penuh'));
        }
      } catch (e) {
        log.mining(wallet.index, chalk.yellow(`Reward check gagal: ${e.message}`));
      } finally {
        runtime.rewardChecksInFlight -= 1;
      }
    }).catch(() => {
      runtime.rewardChecksInFlight -= 1;
    });
  }, CONFIG.REWARD_CHECK_DELAY_MS);
}

async function buildProofForWallet(wallet, quest, answer) {
  const proof = await generateProof(
    answer,
    quest.answerHash,
    wallet.keypair.publicKey,
    quest.round
  );
  return { wallet, proof };
}

async function submitPreparedProof(connection, wallet, proof, quest, runtime) {
  const useRelay = CONFIG.USE_RELAY && !runtime.directWalletSet.has(wallet.address);

  try {
    const { signature, mode } = await submitProof(connection, wallet, proof, useRelay);
    runtime.stats.totalSubmitted += 1;
    log.mining(wallet.index, chalk.green(`${mode} submit OK: ${shortTx(signature)}`));
    scheduleRewardCheck(connection, wallet, signature, quest.round, runtime);
    return {
      wallet: wallet.index,
      address: wallet.address,
      status: 'submitted',
      mode,
      tx: signature,
    };
  } catch (e) {
    runtime.stats.errors += 1;
    const reason = String(e.message || e);
    log.warn(`[W-${wallet.index}] submit gagal: ${reason}`);
    return {
      wallet: wallet.index,
      address: wallet.address,
      status: 'failed',
      error: reason,
    };
  }
}

async function processQuest(connection, wallets, quest, answer, runtime) {
  const proofLimit = pLimit(CONFIG.PROOF_CONCURRENCY);
  const submitLimit = pLimit(CONFIG.SUBMIT_CONCURRENCY);

  const eligible = await getEligibleWallets(connection, wallets);
  runtime.stats.totalEligible += eligible.length;

  if (eligible.length === 0) {
    return { eligible: 0, submitted: 0, results: [] };
  }

  const priorityWallets = [];
  const secondaryWallets = [];

  for (const wallet of eligible) {
    if (runtime.directWalletSet.has(wallet.address) || wallet.index < CONFIG.PRIORITY_WALLET_COUNT) {
      priorityWallets.push(wallet);
    } else {
      secondaryWallets.push(wallet);
    }
  }

  const orderedWallets = [...priorityWallets, ...secondaryWallets];

  const submitJobs = [];

  await Promise.all(
    orderedWallets.map((wallet) =>
      proofLimit(async () => {
        try {
          const { proof } = await buildProofForWallet(wallet, quest, answer);
          submitJobs.push(
            submitLimit(() => submitPreparedProof(connection, wallet, proof, quest, runtime))
          );
        } catch (e) {
          runtime.stats.errors += 1;
          const reason = String(e.message || e);
          log.warn(`[W-${wallet.index}] proof gagal: ${reason}`);
          submitJobs.push(Promise.resolve({
            wallet: wallet.index,
            address: wallet.address,
            status: 'failed',
            error: reason,
          }));
        }
      })
    )
  );

  const settled = await Promise.allSettled(submitJobs);
  const results = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  return {
    eligible: eligible.length,
    submitted: results.filter((r) => r.status === 'submitted').length,
    results,
  };
}

async function maybeConsolidate(connection, wallets) {
  if (!CONFIG.AUTO_CONSOLIDATE) return;

  try {
    const result = await consolidateAll(
      connection,
      wallets,
      CONFIG.MAIN_WALLET,
      CONFIG.CONSOLIDATE_THRESHOLD
    );
    if (result.totalTransferred > 0) {
      const mainBalance = await connection.getBalance(new PublicKey(CONFIG.MAIN_WALLET));
      notifyConsolidation(
        result.totalTransferred.toFixed(4),
        wallets.length,
        (mainBalance / 1_000_000_000).toFixed(4)
      ).catch(() => {});
    }
  } catch (e) {
    log.error(`Consolidate error: ${e.message}`);
    notifyError(e.message, 'Consolidation').catch(() => {});
  }
}

async function startMining() {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║ NARA MULTI-WALLET MINER v2.0 FAST   ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════╝\n'));

  const wallets = loadWallets();
  const connection = new Connection(CONFIG.RPC_URL, 'confirmed');
  const runtime = makeRuntime();

  runtime.directWalletSet = await resolveSubmissionModes(connection, wallets);

  log.info(`Loaded ${wallets.length} wallets`);
  log.info(`RPC_URL resolved = ${CONFIG.RPC_URL}`);
  log.info(`ENV NARA_RPC = ${process.env.NARA_RPC || '(ignored by config)'}`);
  log.info(`Relay = ${CONFIG.USE_RELAY ? CONFIG.RELAY_URL : 'DISABLED'}`);
  log.info(`Direct-capable wallets = ${runtime.directWalletSet.size}`);
  log.info(`Check concurrency = ${CONFIG.CHECK_CONCURRENCY}`);
  log.info(`Proof concurrency = ${CONFIG.PROOF_CONCURRENCY}`);
  log.info(`Submit concurrency = ${CONFIG.SUBMIT_CONCURRENCY}`);
  console.log('');

  const startupMessage = `\n<b>NARA MINER STARTED</b>\n\nWallets: <b>${wallets.length}</b>\nNetwork: Mainnet\nRPC: <code>${CONFIG.RPC_URL}</code>\nRelay: <code>${CONFIG.RELAY_URL}</code>\nDirect-capable: <b>${runtime.directWalletSet.size}</b>\nStarted: ${new Date().toLocaleString()}\n`.trim();
  sendNotification(startupMessage).catch(() => {});

  while (true) {
    try {
      const quest = await getQuestInfo(connection);

      if (!quest.active || quest.expired) {
        await sleep(CONFIG.POLL_INTERVAL_MS);
        continue;
      }

      if (quest.remainingSlots <= 0) {
        log.info(`Round ${quest.round}: slot habis, skip`);
        await sleep(CONFIG.POLL_INTERVAL_MS);
        continue;
      }

      const currentQuestKey = questKey(quest);
      if (runtime.lastQuestKey === currentQuestKey) {
        await sleep(CONFIG.POLL_INTERVAL_MS);
        continue;
      }
      runtime.lastQuestKey = currentQuestKey;
      runtime.stats.rounds += 1;

      log.info(chalk.bold(`\n═══ ROUND ${quest.round} ═══`));
      log.info(`Question: ${quest.question}`);
      log.info(`Remaining slots: ${quest.remainingSlots}`);
      log.info(`Reward: ${quest.rewardPerWinner} x ${quest.rewardCount}`);
      log.info(`Time remaining: ${quest.timeRemaining}s`);

      const solveStarted = Date.now();
      const answer = solveQuestion(quest.question);
      const solveMs = Date.now() - solveStarted;

      if (!answer) {
        log.error(`Gabisa solve: "${quest.question}"`);
        notifyError(`Cannot solve question: ${quest.question}`, 'Solver').catch(() => {});
        await sleep(CONFIG.POLL_INTERVAL_MS);
        continue;
      }

      log.info(chalk.green(`Answer: ${answer}`));
      log.info(`Solve latency: ${solveMs} ms`);

      const roundStarted = Date.now();
      const { eligible, submitted, results } = await processQuest(
        connection,
        wallets,
        quest,
        answer,
        runtime
      );
      const roundMs = Date.now() - roundStarted;

      log.info(chalk.bold('── Round Summary ──'));
      log.info(`Eligible       : ${eligible}`);
      log.info(`Submitted      : ${submitted}`);
      log.info(`Round latency  : ${roundMs} ms`);
      log.info(`Reward checks  : ${runtime.rewardChecksInFlight} in flight`);

      if (submitted > 0) {
        notifyQuestSolved(quest.question, answer, results, wallets.length).catch(() => {});
      }

      const uptime = ((Date.now() - runtime.startTime) / 60000).toFixed(1);
      log.info(chalk.bold('── Total Stats ──'));
      log.info(`Rounds         : ${runtime.stats.rounds}`);
      log.info(`Eligible total : ${runtime.stats.totalEligible}`);
      log.info(`Submitted total: ${runtime.stats.totalSubmitted}`);
      log.info(`Rewarded total : ${runtime.stats.totalRewarded}`);
      log.info(`Total NARA     : ${runtime.stats.totalNara}`);
      log.info(`Errors         : ${runtime.stats.errors}`);
      log.info(`Uptime         : ${uptime} min`);
      console.log('');

      if (CONFIG.AUTO_CONSOLIDATE && runtime.stats.rounds % CONFIG.CONSOLIDATE_AFTER_ROUNDS === 0) {
        await maybeConsolidate(connection, wallets);
        runtime.directWalletSet = await resolveSubmissionModes(connection, wallets);
      }

      await sleep(CONFIG.ROUND_WAIT_MS);
    } catch (e) {
      log.error(`Mining loop error: ${e.message}`);
      notifyError(e.message, 'Mining Loop').catch(() => {});
      await sleep(CONFIG.POLL_INTERVAL_MS);
    }
  }
}

startMining().catch((err) => {
  log.error(`Fatal: ${err.message}`);
  process.exit(1);
});
