#!/usr/bin/env node

/**
 * Build Script for Music App
 *
 * Creates a deployable "dist/music" directory that can be
 * drag-and-dropped to your hosting provider.
 *
 * Usage: npm run build
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'music');

// Files and directories to include in the build
const INCLUDE = [
  // Server files
  'server',
  'public',
  'package.json',
  'package-lock.json',
  'robots.txt'
];

// Files to exclude (even if inside included directories)
// Note: .htaccess in public/ is excluded because we copy it to root separately
const EXCLUDE = ['.DS_Store', '*.log', 'node_modules', '.htaccess'];

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded files
    if (shouldExclude(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Check if file should be excluded
 */
function shouldExclude(filename) {
  for (const pattern of EXCLUDE) {
    if (pattern.startsWith('*')) {
      // Wildcard pattern
      const ext = pattern.slice(1);
      if (filename.endsWith(ext)) return true;
    } else {
      if (filename === pattern) return true;
    }
  }
  return false;
}

/**
 * Clean dist directory
 */
function clean() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });
}

/**
 * Create production .env file
 */
function createEnvFile() {
  const envExample = path.join(ROOT, '.env.example');
  const envDist = path.join(DIST, '.env');

  // Copy .env.example as .env (user will need to fill in values)
  if (fs.existsSync(envExample)) {
    let content = fs.readFileSync(envExample, 'utf8');
    // Set NODE_ENV to production
    content = content.replace('NODE_ENV=development', 'NODE_ENV=production');
    fs.writeFileSync(envDist, content);
    console.log('  ✓ Created .env (fill in your API keys)');
  }
}

/**
 * Copy .htaccess to dist root (for Apache reverse proxy)
 */
function copyHtaccess() {
  const htaccessSrc = path.join(ROOT, 'public', '.htaccess');
  const htaccessDest = path.join(DIST, '.htaccess');

  if (fs.existsSync(htaccessSrc)) {
    fs.copyFileSync(htaccessSrc, htaccessDest);
    console.log('  ✓ Copied .htaccess (Apache reverse proxy config)');
  }
}

/**
 * Create start script for production
 */
function createStartScript() {
  const startScript = `#!/bin/bash
# Start the music app server
cd "$(dirname "$0")"
node server/index.js
`;

  const startPath = path.join(DIST, 'start.sh');
  fs.writeFileSync(startPath, startScript);
  fs.chmodSync(startPath, '755');
  console.log('  ✓ Created start.sh');
}

/**
 * Main build function
 */
function build() {
  console.log('🎵 Building Music App for deployment...\n');

  // Clean
  console.log('Cleaning dist directory...');
  clean();
  console.log('  ✓ Cleaned dist/music\n');

  // Copy files
  console.log('Copying files...');
  for (const item of INCLUDE) {
    const src = path.join(ROOT, item);
    const dest = path.join(DIST, item);

    if (!fs.existsSync(src)) {
      console.log(`  ⚠ Skipping ${item} (not found)`);
      continue;
    }

    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copyDir(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
    console.log(`  ✓ Copied ${item}`);
  }
  console.log('');

  // Create production files
  console.log('Creating production files...');
  createEnvFile();
  createStartScript();
  copyHtaccess();
  console.log('');

  // Summary
  console.log('✅ Build complete!\n');
  console.log('Next steps:');
  console.log('  1. cd dist/music');
  console.log('  2. Edit .env with your API keys');
  console.log('  3. npm install --production');
  console.log('  4. Upload the "music" folder to your host');
  console.log('  5. Run: ./start.sh or node server/index.js\n');
}

// Run build
build();
