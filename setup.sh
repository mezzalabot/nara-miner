#!/bin/bash
# ============================================================
# NARA MULTI-MINER - VPS SETUP SCRIPT
# One-click install & setup di VPS Ubuntu/Debian
# ============================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║   NARA Multi-Wallet Miner - VPS Setup       ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ──── 1. Install Node.js 20+ ────
echo -e "${YELLOW}[1/5] Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 20 ]; then
        echo -e "${GREEN}  ✓ Node.js $(node -v) detected${NC}"
    else
        echo -e "${YELLOW}  Node.js version too low, upgrading...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
else
    echo -e "${YELLOW}  Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo -e "${GREEN}  ✓ Node.js $(node -v) / npm $(npm -v)${NC}"

# ──── 2. Install dependencies ────
echo -e "\n${YELLOW}[2/5] Installing npm dependencies...${NC}"
npm install
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# ──── 3. Prompt for main wallet ────
echo -e "\n${YELLOW}[3/5] Configuration${NC}"

CURRENT_WALLET=$(grep -oP "MAIN_WALLET.*'([^']+)'" src/config.js | grep -oP "'[^']+'" | tr -d "'")

if [ "$CURRENT_WALLET" = "GANTI_DENGAN_WALLET_UTAMA_MU" ]; then
    echo -e "${RED}  ⚠  Main wallet belum di-set!${NC}"
    read -p "  Masukkan address wallet utama: " MAIN_WALLET
    
    if [ -n "$MAIN_WALLET" ]; then
        sed -i "s|GANTI_DENGAN_WALLET_UTAMA_MU|${MAIN_WALLET}|g" src/config.js
        echo -e "${GREEN}  ✓ Main wallet set: ${MAIN_WALLET}${NC}"
    else
        echo -e "${RED}  ✗ Wallet kosong! Edit manual: nano src/config.js${NC}"
    fi
else
    echo -e "${GREEN}  ✓ Main wallet: ${CURRENT_WALLET}${NC}"
fi

# ──── 4. Generate wallets ────
echo -e "\n${YELLOW}[4/5] Generating wallets...${NC}"

if [ -f "wallets/index.json" ]; then
    WALLET_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('wallets/index.json','utf-8')).length)")
    echo -e "${GREEN}  ✓ ${WALLET_COUNT} wallets already exist${NC}"
    read -p "  Generate ulang? (y/N): " REGEN
    if [ "$REGEN" = "y" ] || [ "$REGEN" = "Y" ]; then
        rm -rf wallets/
        npm run generate
    fi
else
    npm run generate
fi

# ──── 5. Ready ────
echo -e "\n${CYAN}╔══════════════════════════════════════════════╗"
echo "║   SETUP COMPLETE!                            ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${GREEN}Commands:${NC}"
echo -e "  ${CYAN}npm run full${NC}         → Start full mining pipeline"
echo -e "  ${CYAN}npm run mine${NC}         → Mining only"
echo -e "  ${CYAN}npm run consolidate${NC}  → Transfer semua ke main wallet"
echo -e "  ${CYAN}npm run status${NC}       → Cek balance semua wallet"
echo ""
echo -e "${YELLOW}Jalankan di background:${NC}"
echo -e "  ${CYAN}screen -S nara${NC}"
echo -e "  ${CYAN}npm run full${NC}"
echo -e "  ${CYAN}Ctrl+A D${NC} (detach)"
echo ""
echo -e "${RED}⚠  BACKUP wallets/_BACKUP_MNEMONICS.txt sekarang!${NC}"
echo ""
