#!/usr/bin/env node

/**
 * Demo screenshot script for portfolio
 *
 * Same APIs as the real app, but the Last.fm `topartists` response is
 * intercepted via Puppeteer and replaced with 12 hand-picked artists.
 * MusicBrainz, Discogs, TheAudioDB, iTunes, and /api/personality all run
 * for real against those artist names — so the resulting tile images,
 * personality headline, and background color are all genuine.
 *
 * Viewports:
 *   Desktop: 1322×887 @ 2x  →  2644×1774
 *   Mobile:   402×660 @ 3x  →  1206×1980   (iPhone 16 Pro width, chrome stripped)
 *
 * Curated portfolio set:
 *   For each of 3 image sources (iTunes, Discogs, TheAudioDB):
 *     - Desktop: top + bottom           (bottom = scrolled so the footer
 *                                        sits just below the viewport,
 *                                        last grid rows in frame; sticky
 *                                        header makes a personality-scroll
 *                                        variant redundant)
 *     - Mobile:  top + middle + personality
 *                                       (personality = scrolled so <main>
 *                                        sits at the top of the viewport,
 *                                        matching the runtime mobile auto-
 *                                        scroll target in displayPersonality)
 *   Plus a mobile-only "personality loading" shot captured ~2s after
 *   navigation (rolling-text loading animation visible, tiles in skeleton).
 *   Total: 3 sources × (2 desktop + 3 mobile) + 1 mobile loading = 16 shots.
 *
 *   Note: tiles missing an iTunes image fall back to Discogs/AudioDB even
 *   when iTunes is selected, so the "itunes" shots may include some
 *   non-iTunes artwork. The other source variants are still captured so
 *   each can be labeled and chosen on its own merits.
 *
 * Usage:
 *   node scripts/screenshots-demo.js                                 # prod
 *   node scripts/screenshots-demo.js http://localhost:3000           # local
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const baseUrl = (process.argv[2] || 'https://music.payamyousefi.com').replace(/\/$/, '');

const OUTPUT_DIR = path.join(__dirname, '..', 'screenshots');

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

// Artist pool — script randomly picks 12 from this list each run.
// Curated favorites first, then the real top-12-this-month artists pulled from
// prod (solitude12, 2026-05) appended at the end so the pool stays mostly
// in the order you chose.
const ARTIST_POOL = [
  'Not For Radio',
  'Magdalena Bay',
  'Night Tapes',
  'Marina',
  'Massive Attack',
  'Monster Rally',
  "she's green",
  'Dirty Art Club',
  'Mr Twin Sister',
  'Blonde Redhead',
  'TOKiMONSTA',
  'Drama',
  'Bolden.',
  'Crumb',
  'Bonobo',
  'Beach House'
];

// Real top-12 playcounts for solitude12, 1-month window, pulled from prod
// on 2026-05-23. Mostly a flat 4-play tail with a 16/13 spike at the top.
const PLAYCOUNTS = [16, 13, 5, 4, 4, 4, 4, 4, 4, 4, 4, 3];

const VIEWPORTS = {
  desktop: {
    width: 1322,
    height: 887,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    label: 'desktop',
    // Sticky header keeps the personality visible mid-page, so we skip the
    // personality-scroll variant here.
    // "bottom" scrolls so the footer is just below the viewport (out of
    // frame) — useful for showing the last rows of the grid.
    positions: ['top', 'bottom']
    // Output: 2644×1774
  },
  mobile: {
    width: 402,
    height: 660,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    label: 'mobile',
    positions: ['top', 'middle', 'personality'],
    // Take an extra shot at ~2s after navigation, before tiles/headline finish,
    // so the rolling "Vibing…" personality loading state is captured.
    captureLoadingState: true
    // Output: 1206×1980
  }
};

const IMAGE_SOURCES = ['ITUNES', 'DISCOGS', 'THE_AUDIO_DB'];

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------

/**
 * Pick `count` artists from the pool at random, but preserve the pool's
 * original priority ordering in the result — so if Marina (pool index 0)
 * is selected she always lands at rank 1 and gets the top playcount.
 */
function pickArtists(pool, count) {
  const indexed = pool.map((name, idx) => ({ name, idx }));
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  return indexed
    .slice(0, count)
    .sort((a, b) => a.idx - b.idx)
    .map(({ name }) => name);
}

/**
 * Build a Last.fm-shaped topartists response. mbid is left blank so the
 * frontend's MusicBrainz search-by-name path runs (returns real MBIDs for
 * well-known artists), which in turn gives Discogs/AudioDB real images.
 */
function buildFakeLastfmResponse(artists) {
  return {
    topartists: {
      artist: artists.map((name, index) => ({
        name,
        playcount: String(PLAYCOUNTS[index]),
        mbid: '',
        url: `https://www.last.fm/music/${encodeURIComponent(name.replace(/\s+/g, '+'))}`,
        streamable: '0',
        image: [],
        '@attr': { rank: String(index + 1) }
      })),
      '@attr': {
        user: 'demo',
        totalPages: '1',
        page: '1',
        perPage: String(artists.length),
        total: String(artists.length)
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

async function waitForAppLoaded(page, timeoutMs = 120000) {
  console.log('  ⏳ Waiting for artist tiles to load…');

  await page.waitForFunction(() => document.querySelectorAll('.artist.image-loaded').length >= 6, {
    timeout: timeoutMs,
    polling: 500
  });

  try {
    await page.waitForFunction(
      () => {
        const total = document.querySelectorAll('.artist').length;
        const loaded = document.querySelectorAll('.artist.image-loaded').length;
        return total > 0 && loaded >= total;
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

  // Wait for the personality headline to finish rolling/loading
  try {
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.music-personality');
        if (!el) return true;
        const text = el.querySelector('.personality-text');
        return el.classList.contains('visible') && text && text.textContent.trim().length > 0;
      },
      { timeout: 30000, polling: 500 }
    );
    console.log('  ✅ Personality headline visible');
  } catch {
    console.log('  ⚠️  Personality headline did not finish (continuing)');
  }

  // Settle time so any mobile auto-scroll-to-main finishes before we screenshot
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

async function waitForAllSourcesPrefetched(page, timeoutMs = 90000) {
  console.log('  ⏳ Waiting for all image sources to prefetch…');

  try {
    await page.waitForFunction(
      () => {
        const tiles = document.querySelectorAll('.artist');
        if (tiles.length === 0) return false;
        const sources = new Set();
        tiles.forEach((tile) => {
          tile.querySelectorAll('.source-layer[data-has-image="true"]').forEach((layer) => {
            sources.add(layer.dataset.source);
          });
        });
        return sources.size >= 2;
      },
      { timeout: timeoutMs, polling: 1000 }
    );

    const sourceInfo = await page.evaluate(() => {
      const tiles = document.querySelectorAll('.artist');
      const counts = {};
      tiles.forEach((tile) => {
        tile.querySelectorAll('.source-layer[data-has-image="true"]').forEach((layer) => {
          counts[layer.dataset.source] = (counts[layer.dataset.source] || 0) + 1;
        });
      });
      return counts;
    });
    console.log('  📊 Images per source:', JSON.stringify(sourceInfo));
  } catch {
    console.log('  ⚠️  Not all sources prefetched in time (continuing)');
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));
}

async function switchImageSource(page, source) {
  const switched = await page.evaluate((src) => {
    const radio = document.querySelector(`.image-sources-config input[type="radio"][value="${src}"]`);
    if (!radio) return false;
    radio.click();
    return true;
  }, source);

  if (switched) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
  } else {
    console.log(`  ⚠️  Could not find radio button for ${source}`);
  }

  return switched;
}

async function scrollTo(page, position) {
  await page.evaluate((pos) => {
    if (pos === 'top') {
      window.scrollTo(0, 0);
    } else if (pos === 'personality') {
      // Match the runtime mobile auto-scroll target (see displayPersonality
      // in public/scripts/app.js). Scrolling <main> to viewport top puts the
      // personality headline at the very top with the header/form above.
      const main = document.querySelector('main');
      if (main) {
        main.scrollIntoView({ behavior: 'auto', block: 'start' });
      } else {
        window.scrollTo(0, 0);
      }
    } else if (pos === 'middle') {
      const scrollMax = document.body.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.round(scrollMax / 2));
    } else if (pos === 'bottom') {
      // Scroll so the footer is just below the viewport (out of frame) and
      // the last visible content above is the bottom of the artist grid.
      // The sticky username form remains pinned at the top of the viewport
      // (where applicable), so the personality and its glow are well past
      // the visible area.
      const footer = document.querySelector('footer');
      if (footer) {
        const footerTop = footer.getBoundingClientRect().top + window.scrollY;
        const target = Math.max(0, Math.round(footerTop - window.innerHeight));
        window.scrollTo(0, target);
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }
    }
  }, position);
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function saveScreenshot(page, filepath) {
  await page.screenshot({ path: filepath, fullPage: false });
  const { size } = fs.statSync(filepath);
  console.log(`  💾 ${path.basename(filepath)}  (${(size / 1024).toFixed(0)} KB)`);
  return filepath;
}

function makeFilename(viewportLabel, source, position) {
  const sourceName = source ? source.toLowerCase().replace(/_/g, '-') : 'loading';
  return `music-demo-${viewportLabel}-${sourceName}-${position}_${TIMESTAMP}.png`;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

async function captureViewport(page, viewport) {
  const { label } = viewport;
  const url = `${baseUrl}/`;
  const saved = [];

  console.log(
    `\n${'═'.repeat(60)}\n📱 DEMO — ${label.toUpperCase()} (${viewport.width}×${viewport.height} @${viewport.deviceScaleFactor}x → ${viewport.width * viewport.deviceScaleFactor}×${viewport.height * viewport.deviceScaleFactor})\n${'═'.repeat(60)}`
  );

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

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  if (viewport.captureLoadingState) {
    console.log('\n📸 Personality loading state…');
    // First wait until the progressive bg-color update has actually fired
    // (body's inline backgroundColor becomes set). animateBackgroundColor()
    // doesn't run until at least one tile has loaded AND that tile's
    // personality data has resolved, so the timing depends on iTunes/MB/
    // AudioDB latency — a fixed wait was racy. Once it fires, give the
    // 2.5s transition time to settle off black, plus a small buffer for
    // the personality element's 0.6s opacity fade-in.
    try {
      await page.waitForFunction(() => document.body.style.backgroundColor.length > 0, {
        timeout: 10000,
        polling: 200
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch {
      console.log('  ⚠️  Background color never set — capturing whatever we have');
    }
    saved.push(await saveScreenshot(page, path.join(OUTPUT_DIR, makeFilename(label, null, 'top'))));
  }

  await waitForAppLoaded(page);
  await waitForAllSourcesPrefetched(page);

  for (const source of IMAGE_SOURCES) {
    const sourceName = source.toLowerCase().replace(/_/g, '-');
    console.log(`\n  🔄 Switching to ${sourceName}…`);
    const switched = await switchImageSource(page, source);
    if (!switched) continue;

    for (const position of viewport.positions) {
      console.log(`\n📸 ${sourceName} — ${position}…`);
      await scrollTo(page, position);
      saved.push(await saveScreenshot(page, path.join(OUTPUT_DIR, makeFilename(label, source, position))));
    }
  }

  return saved;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const selectedArtists = pickArtists(ARTIST_POOL, 12);
  const fakeResponse = buildFakeLastfmResponse(selectedArtists);
  const totalExpected = Object.values(VIEWPORTS).reduce(
    (sum, vp) => sum + IMAGE_SOURCES.length * vp.positions.length + (vp.captureLoadingState ? 1 : 0),
    0
  );

  console.log('🎵 Music App — Demo Screenshot Tool');
  console.log('━'.repeat(60));
  console.log(`  Base URL:  ${baseUrl}`);
  console.log(`  Timestamp: ${TIMESTAMP}`);
  console.log(`  Output:    ${OUTPUT_DIR}`);
  console.log(`  Expected:  ~${totalExpected} screenshots`);
  console.log('━'.repeat(60));
  console.log('  Selected artists (rank — name — playcount):');
  selectedArtists.forEach((name, i) => {
    console.log(`    ${String(i + 1).padStart(2, ' ')}. ${name.padEnd(20, ' ')}  ${PLAYCOUNTS[i]} plays`);
  });
  console.log('━'.repeat(60));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allFiles = { desktop: [], mobile: [] };

  try {
    const page = await browser.newPage();

    // Intercept the Last.fm topartists endpoint and serve fake data.
    // All other requests (MusicBrainz, Discogs, AudioDB, iTunes, /api/personality)
    // pass through unchanged so the resulting images and headline are real.
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (/\/api\/lastfm\/user\/[^/]+\/topartists/.test(url)) {
        request.respond({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          headers: { 'Cache-Control': 'no-store' },
          body: JSON.stringify(fakeResponse)
        });
        return;
      }
      request.continue();
    });

    for (const viewport of Object.values(VIEWPORTS)) {
      const files = await captureViewport(page, viewport);
      allFiles[viewport.label].push(...files);
    }

    const totalFiles = allFiles.desktop.length + allFiles.mobile.length;

    console.log('\n' + '━'.repeat(60));
    console.log(`✅ ${totalFiles} screenshots saved to ./screenshots/`);

    console.log('\nDesktop (2644×1774):');
    allFiles.desktop.forEach((f) => console.log(`  ${path.basename(f)}`));
    console.log('\nMobile (1206×1980):');
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
