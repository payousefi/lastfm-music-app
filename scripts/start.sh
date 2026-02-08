#!/bin/bash
# PM2 startup wrapper script
# - Loads .env file for environment variables
# - Checks if dependencies need updating before starting the server
# PM2 runs this script instead of node directly, so dependency changes
# via FTP upload of package.json are handled automatically.

set -e

# Navigate to project root (parent of scripts/)
cd "$(dirname "$0")/.."

# Load .env file if it exists (export vars for the node process)
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

# Check if package.json is newer than node_modules
# This detects when package.json was updated via FTP but npm install wasn't run
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
  echo "📦 Dependencies changed — running npm install --production..."
  npm install --production
  echo "✅ Dependencies updated"
fi

# Start the server
exec node server/index.js
