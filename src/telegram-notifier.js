// ============================================================
// TELEGRAM NOTIFIER FOR NARA MINER
// Sends notifications for rewards, consolidation, errors
// ============================================================

import https from 'https';
import { CONFIG } from './config.js';

const BOT_TOKEN = process.env.NARA_TELEGRAM_BOT_TOKEN || '8738616548:AAG3L0_tCop9uApeAo5ZI4sqDVyc3lcBXok';
const CHAT_ID = process.env.NARA_TELEGRAM_CHAT_ID || '5693827465';

/**
 * Send Telegram notification
 */
export async function sendNotification(message, options = {}) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('[TELEGRAM] Skip: no token/chat_id configured');
    return;
  }

  const payload = JSON.stringify({
    chat_id: CHAT_ID,
    text: message,
    parse_mode: options.parseMode || 'HTML',
    disable_notification: options.silent || false,
  });

  const requestOptions = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            console.log('[TELEGRAM] Notification sent');
            resolve(result);
          } else {
            console.error('[TELEGRAM] Error:', result.description);
            reject(new Error(result.description));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[TELEGRAM] Request failed:', e.message);
      reject(e);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Notify when reward is earned
 */
export async function notifyReward(walletIndex, amount, totalWallets, round) {
  const emoji = amount > 0 ? '🎉' : '⚪';
  const message = `
${emoji} <b>NARA REWARD EARNED!</b>

💰 Amount: <b>${amount} NARA</b>
👛 Wallet: #${walletIndex}
🎯 Round: ${round}
📊 Total Wallets: ${totalWallets}
⏰ Time: ${new Date().toLocaleString()}

🔥 Mining continues...`.trim();

  await sendNotification(message);
}

/**
 * Notify consolidation summary
 */
export async function notifyConsolidation(totalTransferred, walletCount, mainBalance) {
  const message = `
💰 <b>NARA CONSOLIDATION</b>

📥 Total Transferred: <b>${totalTransferred} NARA</b>
👛 From Wallets: ${walletCount}
🏦 Main Wallet Balance: <b>${mainBalance} NARA</b>
⏰ Time: ${new Date().toLocaleString()}

✅ All rewards consolidated!`.trim();

  await sendNotification(message);
}

/**
 * Notify quest solved
 */
export async function notifyQuestSolved(question, answer, rewards, totalWallets) {
  const rewardCount = rewards.filter(r => r.status === 'rewarded').length;
  const message = `
⛏️ <b>QUEST SOLVED!</b>

❓ Question: ${question.substring(0, 100)}...
✅ Answer: ${answer}
🎉 Rewards: <b>${rewardCount}/${totalWallets} wallets</b>
⏰ Time: ${new Date().toLocaleString()}

🔥 Keep mining!`.trim();

  await sendNotification(message);
}

/**
 * Notify error
 */
export async function notifyError(error, context = '') {
  const message = `
⚠️ <b>NARA MINER ERROR</b>

${context ? `Context: ${context}\n` : ''}❌ Error: ${error.substring(0, 200)}
⏰ Time: ${new Date().toLocaleString()}

🔧 Check logs for details.`.trim();

  await sendNotification(message, { silent: false });
}

/**
 * Daily summary notification
 */
export async function notifyDailySummary(stats) {
  const message = `
📊 <b>NARA MINER DAILY SUMMARY</b>

⛏️ Rounds Mined: <b>${stats.rounds}</b>
🎉 Total Rewards: <b>${stats.totalRewarded}</b>
💰 Total NARA Earned: <b>${stats.totalNara.toFixed(4)}</b>
📤 Submitted: ${stats.totalSubmitted}
⚠️ Errors: ${stats.errors}
⏰ Runtime: ${Math.floor((Date.now() - stats.startTime) / 3600000)}h

🔥 Mining continues 24/7!`.trim();

  await sendNotification(message);
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
