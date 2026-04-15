import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[CONFIG.LOG_LEVEL] ?? 1;

// Pastikan folder logs ada
const logDir = path.dirname(CONFIG.LOG_FILE);
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function writeToFile(level, msg) {
  const line = `[${timestamp()}] [${level.toUpperCase()}] ${msg}\n`;
  fs.appendFileSync(CONFIG.LOG_FILE, line);
}

export const log = {
  debug(msg, ...args) {
    if (currentLevel <= 0) {
      console.log(chalk.gray(`[${timestamp()}] [DBG] ${msg}`), ...args);
      writeToFile('debug', msg);
    }
  },
  info(msg, ...args) {
    if (currentLevel <= 1) {
      console.log(chalk.cyan(`[${timestamp()}] [INF] ${msg}`), ...args);
      writeToFile('info', msg);
    }
  },
  success(msg, ...args) {
    if (currentLevel <= 1) {
      console.log(chalk.green(`[${timestamp()}] [OK!] ${msg}`), ...args);
      writeToFile('info', msg);
    }
  },
  warn(msg, ...args) {
    if (currentLevel <= 2) {
      console.log(chalk.yellow(`[${timestamp()}] [WRN] ${msg}`), ...args);
      writeToFile('warn', msg);
    }
  },
  error(msg, ...args) {
    console.log(chalk.red(`[${timestamp()}] [ERR] ${msg}`), ...args);
    writeToFile('error', msg);
  },
  mining(walletIdx, msg) {
    if (currentLevel <= 1) {
      const tag = chalk.magenta(`[W-${String(walletIdx).padStart(3, '0')}]`);
      console.log(`${chalk.cyan(`[${timestamp()}]`)} ${tag} ${msg}`);
      writeToFile('info', `[W-${walletIdx}] ${msg}`);
    }
  },
};
