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
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'music');

// Assets that get content-hashed for cache busting.
// Each is identified by its source path (relative to dist) and the literal
// URL string used to reference it from the HTML template. Hash is appended
// before the extension (e.g. app.js → app.abc12345.js) and the template is
// rewritten to point at the new name. Favicon and PWA icons are intentionally
// excluded — browsers look up favicon.ico by literal name and PWA icons rarely
// churn.
const HASHABLE_ASSETS = [
  { distPath: 'public/scripts/app.js', htmlRef: '/scripts/app.js' },
  { distPath: 'public/stylesheets/main.css', htmlRef: '/stylesheets/main.css' },
  { distPath: 'public/stylesheets/reset.css', htmlRef: '/stylesheets/reset.css' }
];

const TEMPLATE_REL_PATH = 'server/templates/index.html';

// Files and directories to include in the build
const INCLUDE = [
  // Server files
  'server',
  'public',
  'scripts/start.sh',
  'ecosystem.config.js',
  'package.json',
  'package-lock.json'
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
 * Hash listed assets in dist and rewrite their references in the HTML template.
 * Renames each asset to `<basename>.<hash><ext>` (8-char sha256 prefix), then
 * replaces every occurrence of the original URL in the template with the
 * hashed URL. The dev workflow (`npm run dev`) does not run build, so source
 * files keep their original names locally — the rename only happens in dist.
 */
function hashAndRewriteAssets() {
  const templateFullPath = path.join(DIST, TEMPLATE_REL_PATH);
  if (!fs.existsSync(templateFullPath)) {
    console.log(`  ⚠ Template not found at ${TEMPLATE_REL_PATH} — skipping asset hashing`);
    return;
  }

  let template = fs.readFileSync(templateFullPath, 'utf8');

  for (const { distPath, htmlRef } of HASHABLE_ASSETS) {
    const fullPath = path.join(DIST, distPath);
    if (!fs.existsSync(fullPath)) {
      console.log(`  ⚠ ${distPath} not found in dist — skipping`);
      continue;
    }

    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);

    const ext = path.extname(fullPath);
    const base = path.basename(fullPath, ext);
    const newName = `${base}.${hash}${ext}`;
    const newFullPath = path.join(path.dirname(fullPath), newName);
    fs.renameSync(fullPath, newFullPath);

    // E.g. "/scripts/app.js" → "/scripts/app.abc12345.js"
    const newHtmlRef = htmlRef.replace(path.basename(htmlRef), newName);

    if (!template.includes(htmlRef)) {
      console.log(`  ⚠ ${htmlRef} not found in template — hash applied but unreferenced`);
    }
    template = template.split(htmlRef).join(newHtmlRef);

    console.log(`  ✓ ${path.basename(distPath)} → ${newName}`);
  }

  fs.writeFileSync(templateFullPath, template);
  console.log(`  ✓ Rewrote ${TEMPLATE_REL_PATH} with hashed references`);
}

/**
 * Ensure start.sh is executable in dist
 */
function ensureStartScriptExecutable() {
  const startPath = path.join(DIST, 'scripts', 'start.sh');
  if (fs.existsSync(startPath)) {
    fs.chmodSync(startPath, '755');
    console.log('  ✓ scripts/start.sh is executable');
  }
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
      // Ensure parent directory exists (for paths like 'scripts/start.sh')
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    console.log(`  ✓ Copied ${item}`);
  }
  console.log('');

  // Hash static assets and rewrite template references
  console.log('Hashing static assets...');
  hashAndRewriteAssets();
  console.log('');

  // Create production files
  console.log('Creating production files...');
  createEnvFile();
  ensureStartScriptExecutable();
  copyHtaccess();
  console.log('');

  // Summary
  console.log('✅ Build complete!\n');
  console.log('Next steps:');
  console.log('  1. cd dist/music');
  console.log('  2. Edit .env with your API keys');
  console.log('  3. npm install --production');
  console.log('  4. Upload the "music" folder to your host');
  console.log('  5. Start with PM2:  pm2 start ecosystem.config.js');
  console.log('     Or directly:     node server/index.js\n');
}

// Run build
build();
