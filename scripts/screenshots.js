#!/usr/bin/env node

/**
 * Screenshot script for mockups
 *
 * Takes screenshots of the music app in two viewport sizes:
 *
 *   Desktop (browser mockup):  1400×880 viewport @ 2x  →  2800×1760px
 *   Mobile  (small viewport):   393×852 viewport @ 2x  →   786×1704px
 *
 * Captures all permutations of:
 *   - Users (comma-separated)
 *   - Viewports (desktop, mobile)
 *   - Image sources (itunes, discogs, the-audio-db)
 *   - Scroll positions (top, middle, bottom)
 *   - Plus a loading state capture per viewport
 *
 * Filenames include a timestamp so previous runs are preserved.
 *
 * Usage:
 *   node scripts/screenshots.js [users] [url]
 *
 * Examples:
 *   node scripts/screenshots.js                                    # defaults: solitude12
 *   node scripts/screenshots.js a                                  # single user
 *   node scripts/screenshots.js a,b,c                              # multiple users
 *   node scripts/screenshots.js solitude12 http://localhost:3000   # local dev server
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const usernames = (process.argv[2] || 'solitude12')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);
const baseUrl = (process.argv[3] || 'https://music.payamyousefi.com').replace(/\/$/, '');

const OUTPUT_DIR = path.join(__dirname, '..', 'screenshots');

// Timestamp for this run (e.g. 20260208_181500)
const NOW = new Date();
const TIMESTAMP = [
  NOW.getFullYear(),
  String(NOW.getMonth() + 1).padStart(2, '0'),
  String(NOW.getDate()).padStart(2, '0'),
  '_',
  String(NOW.getHours()).padStart(2, '0'),
  String(NOW.getMinutes()).padStart(2, '0'),
  String(NOW.getSeconds()).padStart(2, '0')
].join('');

const VIEWPORTS = {
  desktop: {
    width: 1400,
    height: 880,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    label: 'desktop'
    // Output: 2800×1760
  },
  mobile: {
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    label: 'mobile'
    // Output: 786×1704
  }
};

// Image sources available in the app (radio buttons in the UI)
const IMAGE_SOURCES = ['ITUNES', 'DISCOGS', 'THE_AUDIO_DB'];

// Scroll positions to capture
const SCROLL_POSITIONS = ['top', 'middle', 'bottom'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the app to finish loading artist tiles and images.
 */
async function waitForAppLoaded(page, timeoutMs = 120000) {
  console.log('  ⏳ Waiting for artist tiles to load…');

  // First wait for at least 6 artists (partial load)
  await page.waitForFunction(
    () => {
      const loaded = document.querySelectorAll('.artist.image-loaded');
      return loaded.length >= 6;
    },
    { timeout: timeoutMs, polling: 500 }
  );

  // Then try to wait for all artists
  try {
    await page.waitForFunction(
      () => {
        const total = document.querySelectorAll('.artist').length;
        const loaded = document.querySelectorAll('.artist.image-loaded').length;
        return loaded >= total;
      },
      { timeout: 45000, polling: 500 }
    );
    console.log('  ✅ All artist images loaded');
  } catch {
    const counts = await page.evaluate(() => {
      const total = document.querySelectorAll('.artist').length;
      const loaded = document.querySelectorAll('.artist.image-loaded').length;
      return { total, loaded };
    });
    console.log(`  ⚠️  ${counts.loaded}/${counts.total} artist images loaded (continuing)`);
  }

  // Wait for the personality headline
  try {
    await page.waitForFunction(
      () => {
        const headline = document.querySelector('.personality-headline');
        return !headline || headline.textContent.trim().length > 0;
      },
      { timeout: 15000, polling: 500 }
    );
  } catch {
    console.log('  ⚠️  Personality headline did not load (continuing)');
  }

  // Settle time for rendering
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log('  ✅ Ready');
}

/**
 * Wait for all background image sources to finish prefetching.
 */
async function waitForAllSourcesPrefetched(page, timeoutMs = 90000) {
  console.log('  ⏳ Waiting for all image sources to prefetch…');

  try {
    await page.waitForFunction(
      () => {
        const tiles = document.querySelectorAll('.artist');
        if (tiles.length === 0) return false;

        let sourcesWithImages = new Set();
        tiles.forEach((tile) => {
          tile.querySelectorAll('.source-layer[data-has-image="true"]').forEach((layer) => {
            sourcesWithImages.add(layer.dataset.source);
          });
        });

        return sourcesWithImages.size >= 2;
      },
      { timeout: timeoutMs, polling: 1000 }
    );

    const sourceInfo = await page.evaluate(() => {
      const tiles = document.querySelectorAll('.artist');
      const counts = {};
      tiles.forEach((tile) => {
        tile.querySelectorAll('.source-layer[data-has-image="true"]').forEach((layer) => {
          const src = layer.dataset.source;
          counts[src] = (counts[src] || 0) + 1;
        });
      });
      return counts;
    });
    console.log('  📊 Images per source:', JSON.stringify(sourceInfo));
  } catch {
    console.log('  ⚠️  Not all sources prefetched in time (continuing)');
  }

  // Extra settle time for all sources
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

/**
 * Switch the active image source by clicking the corresponding radio button.
 */
async function switchImageSource(page, source) {
  const switched = await page.evaluate((src) => {
    const radio = document.querySelector(`.image-sources-config input[type="radio"][value="${src}"]`);
    if (!radio) return false;
    radio.click();
    return true;
  }, source);

  if (switched) {
    // Wait for crossfade animation to complete
    await new Promise((resolve) => setTimeout(resolve, 2500));
  } else {
    console.log(`  ⚠️  Could not find radio button for ${source}`);
  }

  return switched;
}

/**
 * Scroll to a named position.
 */
async function scrollTo(page, position) {
  await page.evaluate((pos) => {
    if (pos === 'top') {
      window.scrollTo(0, 0);
    } else if (pos === 'middle') {
      const scrollMax = document.body.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.round(scrollMax / 2));
    } else if (pos === 'bottom') {
      window.scrollTo(0, document.body.scrollHeight);
    }
  }, position);
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

/**
 * Save a screenshot and log its details.
 */
async function saveScreenshot(page, filepath) {
  await page.screenshot({ path: filepath, fullPage: false });
  const { size } = fs.statSync(filepath);
  console.log(`  💾 ${path.basename(filepath)}  (${(size / 1024).toFixed(0)} KB)`);
  return filepath;
}

/**
 * Build a filename with timestamp.
 * e.g. music-solitude12-desktop-itunes-top_20260208_181500.png
 */
function makeFilename(user, viewportLabel, source, position) {
  const sourceName = source ? source.toLowerCase().replace(/_/g, '-') : 'loading';
  return `music-${user}-${viewportLabel}-${sourceName}-${position}_${TIMESTAMP}.png`;
}

/**
 * Capture all permutations for one user + one viewport:
 *   - Loading state (1 shot)
 *   - Each image source × each scroll position (3 sources × 3 positions = 9 shots)
 *   Total: 10 shots per user per viewport
 */
async function captureUserViewport(page, user, viewport) {
  const { label } = viewport;
  const url = `${baseUrl}/${user}`;
  const saved = [];

  console.log(
    `\n${'═'.repeat(60)}\n👤 ${user} — ${label.toUpperCase()} (${viewport.width}×${viewport.height} @${viewport.deviceScaleFactor}x)\n${'═'.repeat(60)}`
  );

  // Set viewport
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile || false,
    hasTouch: viewport.hasTouch || false
  });

  if (viewport.userAgent) {
    await page.setUserAgent(viewport.userAgent);
  }

  // --- Loading state ---
  console.log('\n📸 Loading state…');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  saved.push(await saveScreenshot(page, path.join(OUTPUT_DIR, makeFilename(user, label, null, 'top'))));

  // --- Wait for full load + all sources prefetched ---
  await waitForAppLoaded(page);
  await waitForAllSourcesPrefetched(page);

  // --- All source × position permutations ---
  for (const source of IMAGE_SOURCES) {
    const sourceName = source.toLowerCase().replace(/_/g, '-');
    console.log(`\n  🔄 Switching to ${sourceName}…`);

    const switched = await switchImageSource(page, source);
    if (!switched) continue;

    for (const position of SCROLL_POSITIONS) {
      console.log(`\n📸 ${sourceName} — ${position}…`);
      await scrollTo(page, position);
      saved.push(await saveScreenshot(page, path.join(OUTPUT_DIR, makeFilename(user, label, source, position))));
    }
  }

  return saved;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const totalExpected = usernames.length * 2 * (1 + IMAGE_SOURCES.length * SCROLL_POSITIONS.length);

  console.log('🎵 Music App Screenshot Tool');
  console.log('━'.repeat(60));
  console.log(`  Users:     ${usernames.join(', ')}`);
  console.log(`  Base URL:  ${baseUrl}`);
  console.log(`  Timestamp: ${TIMESTAMP}`);
  console.log(`  Output:    ${OUTPUT_DIR}`);
  console.log(`  Expected:  ~${totalExpected} screenshots`);
  console.log('━'.repeat(60));

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allFiles = { desktop: [], mobile: [] };

  try {
    const page = await browser.newPage();

    for (const user of usernames) {
      for (const [key, viewport] of Object.entries(VIEWPORTS)) {
        const files = await captureUserViewport(page, user, viewport);
        allFiles[key].push(...files);
      }
    }

    const totalFiles = allFiles.desktop.length + allFiles.mobile.length;

    console.log('\n' + '━'.repeat(60));
    console.log(`✅ ${totalFiles} screenshots saved to ./screenshots/`);

    console.log('\nDesktop (2800×1760):');
    allFiles.desktop.forEach((f) => console.log(`  ${path.basename(f)}`));
    console.log('\nMobile (786×1704):');
    allFiles.mobile.forEach((f) => console.log(`  ${path.basename(f)}`));

    console.log('\nCopy command:');
    console.log(`  cp screenshots/*_${TIMESTAMP}.png <destination>`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
