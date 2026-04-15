# NARA Multi-Wallet PoMI Miner

Automated PoMI mining bot untuk Nara Chain dengan 300 wallet.

## Cara Kerja

```
┌─────────────────────────────────────────────────────┐
│  1. GENERATE   → Buat 300 wallet keypair            │
│  2. MINE       → Setiap round:                      │
│     ├── Fetch quest (soal quiz on-chain)            │
│     ├── Solve (arithmetic/string manipulation)      │
│     ├── Generate ZK proof (Groth16)                 │
│     └── Submit via relay (gasless) × 300 wallet     │
│  3. CONSOLIDATE → Transfer semua NARA ke 1 wallet   │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js v20+
- VPS dengan koneksi stabil (recommended)

## Setup

```bash
# 1. Clone / copy folder ini ke VPS
cd nara-miner

# 2. Install dependencies
npm install

# 3. Edit config - SET MAIN WALLET!
nano src/config.js
# Ganti MAIN_WALLET dengan address wallet utama kamu

# 4. Generate 300 wallets
npm run generate

# 5. BACKUP file wallets/_BACKUP_MNEMONICS.txt !!!
# File ini berisi semua mnemonic, simpan aman!
```

## Menjalankan

```bash
# ──── Full pipeline (recommended) ────
npm run full

# ──── Atau jalankan terpisah ────

# Generate wallets saja
npm run generate

# Mining saja (pastikan wallets sudah di-generate)
npm run mine

# Consolidate saja (transfer semua ke main wallet)
npm run consolidate

# Cek status & balance semua wallet
npm run status
```

## Jalankan di Background (VPS)

```bash
# Pakai screen
screen -S nara
npm run full
# Ctrl+A lalu D untuk detach

# Atau pakai tmux
tmux new -s nara
npm run full
# Ctrl+B lalu D untuk detach

# Atau pakai pm2
npm install -g pm2
pm2 start src/index.js --name nara-miner
pm2 logs nara-miner
```

## Konfigurasi

Edit `src/config.js`:

| Setting | Default | Keterangan |
|---------|---------|------------|
| `MAIN_WALLET` | (wajib diisi) | Wallet utama untuk terima semua NARA |
| `RPC_URL` | devnet-api.nara.build | RPC endpoint |
| `TOTAL_WALLETS` | 300 | Jumlah wallet yang di-generate |
| `CONCURRENCY` | 10 | Wallet yang mining bersamaan |
| `USE_RELAY` | true | Gasless mode (wajib untuk wallet baru) |
| `CONSOLIDATE_AFTER_ROUNDS` | 5 | Auto-transfer tiap N round |
| `CONSOLIDATE_THRESHOLD` | 0.01 | Min balance untuk transfer |

## Struktur

```
nara-miner/
├── src/
│   ├── config.js          # Konfigurasi
│   ├── generate-wallets.js # Generate 300 wallets
│   ├── solver.js           # Quest question solver
│   ├── miner.js            # Main mining loop
│   ├── consolidate.js      # Transfer ke main wallet
│   ├── status.js           # Cek balance semua wallet
│   ├── index.js            # Full pipeline orchestrator
│   └── logger.js           # Logging utility
├── wallets/                # Generated wallets (gitignore!)
│   ├── index.json          # Wallet index
│   ├── wallet_000.json     # Keypair files
│   ├── ...
│   └── _BACKUP_MNEMONICS.txt
├── logs/                   # Log files
├── package.json
└── README.md
```

## Flow Mining

```
setiap round baru:
  │
  ├── quest get → dapet soal (mis: "What is 42 + 58?")
  ├── solver    → jawab: "100"
  ├── ZK proof  → generate Groth16 proof per wallet
  ├── submit    → kirim via relay (gasless) × 300 wallet
  │              (concurrent, 10 wallet bersamaan)
  ├── reward    → cek apakah dapet reward
  │
  └── setiap 5 round:
      └── consolidate → transfer semua NARA ke main wallet
```

## Notes

- PoMI saat ini live di **Devnet**
- Relay mode = gasless, wallet baru bisa langsung submit
- First come, first served - speed matters
- Question types: arithmetic, string manipulation, dll
- Solver support: +, -, *, /, reverse, repeat, uppercase, 
  lowercase, fibonacci, hex, binary, factorial, dll
- Jika solver gagal (question type baru), akan skip round
