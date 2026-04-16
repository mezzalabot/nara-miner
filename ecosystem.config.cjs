// PM2 Ecosystem Config for Nara Miner
// GPT-5.4 recommended: fork mode with memory monitoring

module.exports = {
  apps: [
    {
      name: 'nara-miner',
      script: './src/miner.js',
      interpreter: './node_modules/.bin/tsx',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      // Load env vars from .env file (API keys, config)
      env_file: './.env',
      env: {
        NODE_ENV: 'production',
        TELEGRAM_CHAT_ID: '5693827465',
      },
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Auto-restart on failure (but not too fast)
      min_uptime: '10s',
      max_restarts: 10,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
