# Nara Multi-Wallet PoMI Miner

When working with this project:

1. **Config first** — Always check `src/config.js` before running. MAIN_WALLET must be set.
2. **Generate wallets** — Run `npm run generate` before mining. Creates 300 wallets in `wallets/`.
3. **Never commit wallets/** — Contains private keys. Already in .gitignore.
4. **Solver extensible** — Add new question patterns in `src/solver.js` when new quest types appear.
5. **Relay = gasless** — New wallets use relay mode by default. No initial balance needed.
6. **Network** — Currently on Devnet (`https://devnet-api.nara.build/`).

## Key SDK imports
```javascript
import { getQuestInfo, hasAnswered, generateProof, submitAnswerViaRelay, Keypair } from 'nara-sdk';
import { Connection } from '@solana/web3.js';
```
