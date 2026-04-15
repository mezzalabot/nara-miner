---
name: nara-pomi-miner
description: |
  Nara Chain PoMI (Proof of Machine Intelligence) multi-wallet automated mining skill.
  Use this skill when the user asks to mine NARA tokens, set up Nara Chain automation,
  generate Nara wallets, answer PoMI quests, consolidate NARA rewards, or build bots
  for the Nara blockchain. Covers: wallet generation, quest fetching, question solving,
  ZK proof generation, gasless relay submission, multi-wallet orchestration, and
  auto-consolidation of rewards to a main wallet.
version: 1.0.0
author: nara-miner-skill
tags: [nara, blockchain, mining, pomi, web3, solana, zk-proof, automation]
---

# Nara PoMI Miner Skill

## What is This

This skill enables AI agents to automate **PoMI (Proof of Machine Intelligence) mining** on Nara Chain — a Solana-compatible L1 blockchain where agents earn NARA tokens by solving on-chain quiz challenges verified with zero-knowledge proofs.

## When to Use

Trigger this skill when the user mentions any of:
- "mine NARA" / "nara mining" / "PoMI mining"
- "nara wallet" / "generate nara wallets"
- "nara quest" / "answer quest" / "solve quest"
- "consolidate NARA" / "transfer NARA"
- "nara bot" / "nara automation"
- "naracli" / "nara-sdk"
- Multi-wallet farming on Nara Chain

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    NARA PoMI MINER                        │
│                                                          │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌───────┐ │
│  │ Wallet  │──▶│  Quest   │──▶│  ZK      │──▶│Submit │ │
│  │Generator│   │  Solver  │   │  Prover  │   │(Relay)│ │
│  └─────────┘   └──────────┘   └──────────┘   └───────┘ │
│       │                                          │       │
│       │              ┌───────────┐               │       │
│       └─────────────▶│Consolidate│◀──────────────┘       │
│                      │ → Main    │                       │
│                      └───────────┘                       │
└──────────────────────────────────────────────────────────┘
```

**Flow per round:**
1. Fetch quest (soal quiz on-chain)
2. Solve question (arithmetic, string manipulation, etc.)
3. Generate Groth16 ZK proof per wallet
4. Submit via relay (gasless) for each wallet
5. Periodically consolidate all rewards → main wallet

---

## Core Concepts

### Nara Chain
- Layer 1 blockchain, **forked from Solana**
- Native token: **NARA**
- Wallet standard: BIP39 mnemonic + Ed25519 (same as Solana)
- RPC Devnet: `https://devnet-api.nara.build/`
- RPC Mainnet: `https://mainnet-api.nara.build/`

### PoMI Mining
- System publishes quiz questions on-chain (math, string, logic)
- Agents compute the answer, generate a **Groth16 ZK proof**
- Proof is verified on-chain → NARA tokens rewarded instantly
- **First come, first served** — limited reward slots per round
- Contract: `Quest11111111111111111111111111111111111111`

### Gasless Relay
- Wallets with < 0.1 NARA can submit via relay (free)
- Relay URL: `https://quest-api.nara.build/`
- Reward still goes to the submitting wallet

### Staking (Competitive Mode)
- When reward slots hit system cap → staking required
- Stake requirement uses **parabolic decay**: high at start, drops over time
- Formula: `effective = stakeHigh - (stakeHigh - stakeLow) * (elapsed / decay)^2`

---

## Dependencies

```json
{
  "nara-sdk": "latest",
  "@solana/web3.js": "^1.95.0",
  "bip39": "^3.1.0",
  "ed25519-hd-key": "^1.3.0",
  "tweetnacl": "^1.0.3"
}
```

Required: **Node.js 20+**

---

## Key SDK Functions

All imports from `nara-sdk`:

### Wallet

```javascript
import { Keypair } from 'nara-sdk';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

// Generate new wallet
const mnemonic = bip39.generateMnemonic();
const seed = await bip39.mnemonicToSeed(mnemonic);
const derived = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
const keypair = Keypair.fromSeed(derived);

// Save keypair
fs.writeFileSync('wallet.json', JSON.stringify(Array.from(keypair.secretKey)));

// Load keypair
const data = JSON.parse(fs.readFileSync('wallet.json', 'utf-8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(data));

// Address
console.log(keypair.publicKey.toBase58());
```

### Quest Info

```javascript
import { getQuestInfo } from 'nara-sdk';
import { Connection } from '@solana/web3.js';

const connection = new Connection('https://devnet-api.nara.build/', 'confirmed');
const quest = await getQuestInfo(connection);

// quest.active        — boolean, is quest active
// quest.question      — string, question text
// quest.answerHash    — number[], on-chain answer hash
// quest.round         — string, round identifier
// quest.rewardPerWinner — number, reward per winner
// quest.remainingSlots  — number, remaining reward slots
// quest.timeRemaining   — number, seconds remaining
// quest.effectiveStakeRequirement — number, current stake needed
```

### Check Already Answered

```javascript
import { hasAnswered } from 'nara-sdk';

const answered = await hasAnswered(connection, keypair);
// true/false — whether this wallet has answered current round
```

### Generate ZK Proof

```javascript
import { generateProof } from 'nara-sdk';

const proof = await generateProof(
  answer,                    // string answer
  quest.answerHash,          // hash from quest info
  keypair.publicKey,         // wallet pubkey
  quest.round                // round (anti-replay)
);
// proof.solana — for on-chain submit
// proof.hex   — for relay submit
// THROWS if answer is wrong!
```

### Submit (Direct / On-chain)

```javascript
import { submitAnswer } from 'nara-sdk';

const { signature } = await submitAnswer(
  connection,
  keypair,
  proof.solana,
  'agent-name',    // optional
  'model-name'     // optional
);
```

### Submit (Relay / Gasless)

```javascript
import { submitAnswerViaRelay } from 'nara-sdk';

const { txHash } = await submitAnswerViaRelay(
  'https://quest-api.nara.build/',
  keypair.publicKey,
  proof.hex,
  'agent-name',    // optional
  'model-name'     // optional
);
```

### Check Reward

```javascript
import { parseQuestReward } from 'nara-sdk';

const reward = await parseQuestReward(connection, signature);
// reward.rewarded   — boolean
// reward.rewardNso  — reward amount
// reward.winner     — winner number
```

### Transfer NARA

```javascript
import {
  Connection, PublicKey, SystemProgram, Transaction,
  sendAndConfirmTransaction, LAMPORTS_PER_SOL
} from '@solana/web3.js';

const tx = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: new PublicKey('DESTINATION_ADDRESS'),
    lamports: Math.floor(amount * LAMPORTS_PER_SOL),
  })
);
const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
```

### Staking

```javascript
import { stake, unstake, getStakeInfo } from 'nara-sdk';

await stake(connection, keypair, 5);         // stake 5 NARA
await unstake(connection, keypair, 5);       // unstake 5 NARA
const info = await getStakeInfo(connection, keypair.publicKey);
// info.amount, info.stakeRound
```

---

## CLI Reference (naracli)

Alternative to SDK — use CLI directly:

```bash
# Install
npm install -g naracli

# Wallet
npx naracli wallet create
npx naracli wallet import -m "mnemonic words..."
npx naracli address
npx naracli balance

# Config
npx naracli config set rpc-url https://devnet-api.nara.build/
npx naracli config set wallet /path/to/keypair.json

# Quest / Mining
npx naracli quest get                         # view question
npx naracli quest get --json                  # JSON format
npx naracli quest answer "answer"             # submit (direct)
npx naracli quest answer "answer" --relay     # submit (gasless)
npx naracli quest answer "answer" --stake     # auto-stake

# Transfer
npx naracli transfer <address> <amount>

# Staking
npx naracli quest stake <amount>
npx naracli quest unstake <amount>
npx naracli quest stake-info
```

---

## Question Solver Patterns

PoMI quest questions are quiz challenges that need to be answered. Support these patterns:

### Arithmetic
```
"What is 42 + 58?"           → "100"
"Calculate 15 * 3 - 7"       → "38"
"Compute 100 / 4"            → "25"
"Result of (5 + 3) * 2"      → "16"
```

### String Manipulation
```
"Reverse the string 'hello'"              → "olleh"
"'abc' repeated 3 times"                  → "abcabcabc"
"Convert 'hello' to uppercase"            → "HELLO"
"Length of 'nara chain'"                   → "10"
"Concatenate 'foo' and 'bar'"             → "foobar"
"Sort characters of 'dcba'"               → "abcd"
"Character at position 2 of 'hello'"      → "l"
"Substring of 'hello' from 1 to 3"        → "el"
"Replace 'a' with 'o' in 'banana'"        → "bonono"
"Count 'a' in 'banana'"                   → "3"
```

### Math Functions
```
"10th Fibonacci number"       → "55"
"Factorial of 6"              → "720"
"Convert 255 to hexadecimal"  → "ff"
"Convert 10 to binary"        → "1010"
"15 mod 4"                    → "3"
"2 to the power of 10"        → "1024"
"GCD of 12 and 8"             → "4"
"Absolute value of -42"       → "42"
"Sum of 1, 2, 3, 4, 5"       → "15"
"Maximum of 3, 7, 1, 9"      → "9"
```

### Logic / Boolean
```
"Is 'racecar' a palindrome?"  → "true"
"Is 'hello' a palindrome?"    → "false"
```

### Solver Implementation Strategy

```javascript
function solveQuestion(question) {
  // 1. Normalize: trim, lowercase comparison
  // 2. Try regex patterns in priority order
  // 3. Each solver returns answer string or null
  // 4. First non-null result wins
  // 5. Return null if unsolvable (skip round)

  const solvers = [
    solveArithmetic,      // Highest priority — most common
    solveReverse,
    solveRepeat,
    solveUpperLower,
    solveLength,
    solveFibonacci,
    solveHexConvert,
    solveBinaryConvert,
    solveConcatenate,
    solveReplace,
    solveCharAt,
    solveSubstring,
    solveSortChars,
    solveCountChars,
    solveModulo,
    solvePower,
    solveFactorial,
    solvePalindrome,
    solveMinMax,
    solveSum,
    solveGCD,
    solveEvalExpression,  // Fallback — generic eval
  ];

  for (const solver of solvers) {
    try {
      const result = solver(question);
      if (result !== null && result !== undefined) return String(result);
    } catch { /* next */ }
  }
  return null;
}
```

---

## Multi-Wallet Mining Pattern

### Generate N Wallets

```javascript
const wallets = [];
for (let i = 0; i < N; i++) {
  const mnemonic = bip39.generateMnemonic();
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const derived = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
  const keypair = Keypair.fromSeed(derived);

  fs.writeFileSync(
    `wallets/wallet_${String(i).padStart(3,'0')}.json`,
    JSON.stringify(Array.from(keypair.secretKey))
  );

  wallets.push({
    index: i,
    keypair,
    address: keypair.publicKey.toBase58(),
    mnemonic,
  });
}

// Save index
fs.writeFileSync('wallets/index.json', JSON.stringify(
  wallets.map(w => ({
    index: w.index,
    address: w.address,
    mnemonic: w.mnemonic,
    file: `wallet_${String(w.index).padStart(3,'0')}.json`,
  })),
  null, 2
));
```

### Mining Loop (Concurrent)

```javascript
import pLimit from 'p-limit';

const limit = pLimit(CONCURRENCY); // e.g. 10
let lastRound = null;

while (true) {
  const quest = await getQuestInfo(connection);

  if (!quest.active || quest.expired || quest.round === lastRound) {
    await sleep(5000);
    continue;
  }
  lastRound = quest.round;

  const answer = solveQuestion(quest.question);
  if (!answer) { await sleep(5000); continue; }

  const results = await Promise.allSettled(
    wallets.map(w => limit(async () => {
      if (await hasAnswered(connection, w.keypair)) return { status: 'skipped' };

      const proof = await generateProof(
        answer, quest.answerHash, w.keypair.publicKey, quest.round
      );
      const { txHash } = await submitAnswerViaRelay(
        RELAY_URL, w.keypair.publicKey, proof.hex
      );

      await sleep(2000);
      const reward = await parseQuestReward(connection, txHash);
      return {
        status: reward.rewarded ? 'rewarded' : 'submitted',
        reward: reward.rewardNso,
      };
    }))
  );

  await sleep(10000);
}
```

### Consolidation Pattern

```javascript
async function consolidateAll(wallets, mainAddress) {
  const mainPubkey = new PublicKey(mainAddress);

  for (const w of wallets) {
    const balance = await connection.getBalance(w.keypair.publicKey);
    const naraBal = balance / LAMPORTS_PER_SOL;

    if (naraBal < 0.01) continue;

    const lamports = Math.floor((naraBal - 0.001) * LAMPORTS_PER_SOL);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: w.keypair.publicKey,
        toPubkey: mainPubkey,
        lamports,
      })
    );
    await sendAndConfirmTransaction(connection, tx, [w.keypair]);
  }
}
```

---

## Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `MAIN_WALLET` | (required) | Main wallet address for consolidation |
| `RPC_URL` | `https://devnet-api.nara.build/` | RPC endpoint |
| `RELAY_URL` | `https://quest-api.nara.build/` | Gasless relay endpoint |
| `TOTAL_WALLETS` | 300 | Number of wallets to generate |
| `CONCURRENCY` | 10 | Parallel wallet submissions |
| `USE_RELAY` | true | Use gasless relay mode |
| `POLL_INTERVAL_MS` | 5000 | Quest poll interval (ms) |
| `CONSOLIDATE_AFTER_ROUNDS` | 5 | Auto-consolidate every N rounds |
| `CONSOLIDATE_THRESHOLD` | 0.01 | Min balance to trigger transfer |

---

## VPS Deployment

```bash
# 1. Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Setup project
cd nara-miner && npm install

# 3. Edit config
nano src/config.js  # set MAIN_WALLET

# 4. Generate wallets
npm run generate

# 5. Run in background
screen -S nara
npm run full
# Ctrl+A D to detach

# Or use pm2:
pm2 start src/index.js --name nara-miner
pm2 logs nara-miner
```

---

## Error Handling Best Practices

1. **Proof generation fails** → answer is wrong, skip wallet this round
2. **Relay timeout** → retry 1x, then skip wallet
3. **RPC error** → exponential backoff, retry
4. **No active quest** → poll every 5 seconds
5. **All slots filled** → skip round, wait for next
6. **Consolidation fails** → log error, continue to next wallet
7. **Already answered** → skip wallet (checked via `hasAnswered`)

---

## Important Notes

- PoMI is currently live on **Devnet** only
- First come, first served — speed is critical
- Relay mode = gasless, new wallets can submit immediately
- ZK proof `generateProof()` THROWS if answer is wrong
- `round` parameter in proof prevents cross-round replay
- Each wallet can only answer ONCE per round
- Mnemonic backup is critical — lost = funds gone forever
- Reserve 0.001 NARA per wallet for tx fees during consolidation
