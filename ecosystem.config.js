/**
 * PM2 Ecosystem Configuration
 * https://pm2.keymetrics.io/docs/usage/application-declaration/
 *
 * Usage:
 *   pm2 start ecosystem.config.js          # Start the app
 *   pm2 restart ecosystem.config.js        # Restart
 *   pm2 reload ecosystem.config.js         # Zero-downtime reload
 *   pm2 stop ecosystem.config.js           # Stop
 *   pm2 delete ecosystem.config.js         # Remove from PM2
 *
 * File watching:
 *   PM2 watches server/ and public/ directories for changes.
 *   When files are updated (via FTP, manual edit, etc.), PM2 detects
 *   the change and automatically restarts the server.
 *   A 5-second delay allows multi-file FTP uploads to complete
 *   before triggering a single restart.
 */

module.exports = {
  apps: [
    {
      name: 'music',
      script: 'scripts/start.sh', // Wrapper that runs npm install if package.json changed
      interpreter: '/bin/bash',

      // Watch for file changes and auto-restart
      watch: ['server', 'public', 'package.json'],
      watch_delay: 5000, // 5s delay to let FTP uploads finish before restarting
      ignore_watch: ['node_modules', '.git', 'logs', '*.log'],

      // Environment
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },

      // Restart behavior
      max_restarts: 10, // Max restarts within restart_delay window
      min_uptime: 5000, // Consider started after 5s uptime
      restart_delay: 3000, // Wait 3s between crash restarts

      // Logging
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Process
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
