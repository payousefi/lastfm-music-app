(function () {
  'use strict';

  // Service identifiers for configurable pipeline
  const SERVICES = {
    // Metadata services (find artist IDs)
    MUSICBRAINZ: 'MUSICBRAINZ', // Finds MBID + Discogs ID

    // Image services (get actual images)
    DISCOGS: 'DISCOGS', // Needs Discogs ID (from MusicBrainz)
    THE_AUDIO_DB: 'THE_AUDIO_DB', // Needs MBID (from MusicBrainz)
    ITUNES: 'ITUNES' // Standalone - searches by name, gets album art
  };

  // Configuration - API keys are now server-side
  const CONFIG = {
    defaultUsername: 'solitude12',
    artistLimit: 12,
    period: '1month',
    tileSize: 250, // Tile size in pixels (matches CSS .artist width/height)

    // Image source pipeline - tried in order until image found
    // MusicBrainz is always called first if DISCOGS or THE_AUDIO_DB are in the list
    // Example configs:
    //   Default: ['DISCOGS', 'THE_AUDIO_DB', 'ITUNES']
    //   iTunes only: ['ITUNES']
    //   iTunes first: ['ITUNES', 'DISCOGS', 'THE_AUDIO_DB']
    imageSources: ['ITUNES', 'DISCOGS', 'THE_AUDIO_DB']
  };

  // Original source order for consistent fallback behavior
  const ORIGINAL_SOURCE_ORDER = ['ITUNES', 'DISCOGS', 'THE_AUDIO_DB'];

  // Discogs rate limiter - adaptive delay based on remaining requests from headers
  // Discogs allows 60 requests/minute. We adjust speed based on how many are left.
  const discogsRateLimiter = {
    remaining: 60,

    async waitIfNeeded() {
      // Adaptive delay: go faster when we have plenty, slower when running low
      // remaining > 30: 500ms (fast)
      // remaining 10-30: 1000ms (moderate)
      // remaining < 10: 2000ms (slow, conserve)
      let delay;
      if (this.remaining > 30) {
        delay = 500;
      } else if (this.remaining > 10) {
        delay = 1000;
      } else {
        delay = 2000;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    },

    updateFromHeaders(headers) {
      const remaining = headers.get('X-Discogs-Ratelimit-Remaining');
      if (remaining !== null) {
        this.remaining = parseInt(remaining, 10);
      }
    }
  };

  // MusicBrainz rate limiter - adaptive delay based on remaining requests from headers
  // MusicBrainz allows 300 requests per 60s window. We adjust speed based on how many are left.
  const musicBrainzRateLimiter = {
    remaining: 300,
    rateLimited: false, // Set true when we get a 429 (legacy burst limit)

    async waitIfNeeded() {
      // If we hit a rate limit error, back off significantly
      if (this.rateLimited) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.rateLimited = false;
        return;
      }

      // Adaptive delay based on remaining requests
      // remaining > 150: 200ms (fast - plenty of headroom)
      // remaining 50-150: 500ms (moderate)
      // remaining < 50: 1000ms (slow, conserve)
      let delay;
      if (this.remaining > 150) {
        delay = 200;
      } else if (this.remaining > 50) {
        delay = 500;
      } else {
        delay = 1000;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    },

    updateFromHeaders(headers) {
      const remaining = headers.get('X-RateLimit-Remaining');
      if (remaining !== null) {
        this.remaining = parseInt(remaining, 10);
      }
    },

    markRateLimited() {
      this.rateLimited = true;
    }
  };

  // DOM Elements
  let wrapperEl, contentEl, usernameInput, headerSubtitle, personalityEl, srAnnouncerEl, usernameErrorEl;

  // Image cache - keyed by "artistName:SOURCE" for per-source caching
  // Also stores MusicBrainz data keyed by "artistName:MB_DATA"
  const imageCache = {};

  // Luminance cache - keyed by "artistName:SOURCE", stores boolean (true = light image)
  const luminanceCache = {};

  // Personality data cache - stores genre/style/mood per artist
  const personalityCache = {};

  // Current artists (for reloading when sources change)
  let currentArtists = [];

  // Personality loading animation timeout
  let showPersonalityLoadingTimeout = null;
  let personalityAnimationTimeout = null;

  // Auto-rotation state
  let autoRotationInterval = null;
  let autoRotationStartTimeout = null; // Pending timeout before rotation starts
  let autoRotationSourceIndex = 0;
  let autoRotationDirection = 1; // 1 = forward, -1 = backward
  let autoRotationDisabled = false; // Set to true when user manually selects a source
  let availableSources = []; // Sources that have been fully loaded

  // Current personality seed (for deterministic color/headline generation)
  let currentPersonalitySeed = null;

  /**
   * Simple hash function (djb2) for creating deterministic seeds
   * @param {string} str - String to hash
   * @returns {number} - 32-bit hash value
   */
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // Convert to unsigned 32-bit
  }

  /**
   * Seeded pseudo-random number generator (mulberry32)
   * Returns a function that generates deterministic random numbers 0-1
   * @param {number} seed - Seed value
   * @returns {function} - Function that returns next random number
   */
  function createSeededRandom(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Generate a personality seed from username and artist data
   * The seed changes when the user's listening data changes
   * @param {string} username - Last.fm username
   * @param {Array} artists - Array of artist objects with name and playcount
   * @returns {number} - Deterministic seed value
   */
  function generatePersonalitySeed(username, artists) {
    // Create a string that captures the essence of the user's current listening
    // Include artist names and playcounts so seed changes when listening changes
    const dataString =
      username.toLowerCase() +
      '|' +
      artists
        .map((a) => `${a.name.toLowerCase()}:${a.playcount}`)
        .sort()
        .join(',');
    return hashString(dataString);
  }

  /**
   * Analyze artist data to generate a music personality headline
   * Calls server-side API for headline generation (keeps logic private)
   * @param {Array} artistsData - Array of artist data with mood/genre/style
   * @param {number} [seed] - Optional seed for deterministic headlines
   */
  async function analyzePersonality(artistsData, seed) {
    try {
      const response = await fetch('/api/personality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artists: artistsData,
          seed: seed ? (seed() * 1000000) | 0 : null // Convert seeded random to integer seed
        })
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Personality API error:', error);
    }

    // Fallback to a generic headline if API fails
    return {
      headline: 'A Musical Soul',
      mood: 'relaxed',
      genre: 'eclectic',
      moodCounts: {},
      genreCounts: {}
    };
  }

  /**
   * Rolling text word pool - tracks used words to avoid repetition within a session
   */
  const ROLLING_PARTICIPLES = [
    // Analytical
    'Analyzing',
    'Processing',
    'Decoding',
    'Interpreting',
    'Calculating',
    'Computing',
    // Discovery
    'Discovering',
    'Exploring',
    'Uncovering',
    'Investigating',
    'Researching',
    'Excavating',
    // Sensory/Emotional
    'Vibing',
    'Listening',
    'Sensing',
    'Feeling',
    'Absorbing',
    'Channeling',
    'Tuning in',
    // Creative
    'Curating',
    'Contemplating',
    'Pondering',
    'Imagining',
    'Conjuring',
    // Playful
    'Jamming',
    'Grooving',
    'Syncing',
    'Harmonizing',
    'Resonating',
    'Calibrating',
    'Brewing',
    'Marinating'
  ];

  let rollingWordsRemaining = [];

  /**
   * Reset the rolling word pool for a new loading session
   */
  function resetRollingWords() {
    rollingWordsRemaining = [...ROLLING_PARTICIPLES];
  }

  /**
   * Generate random present participle for loading animation
   * Picks from remaining unused words, resets pool when exhausted
   */
  function generateRollingText() {
    // If pool is empty, refill it
    if (rollingWordsRemaining.length === 0) {
      rollingWordsRemaining = [...ROLLING_PARTICIPLES];
    }

    // Pick and remove a random word from remaining pool
    const index = Math.floor(Math.random() * rollingWordsRemaining.length);
    const word = rollingWordsRemaining.splice(index, 1)[0];

    return word + '...';
  }

  /**
   * Show the personality loading state with rolling text animation
   */
  /**
   * Announce a message to screen readers via the dedicated live region.
   * Clears then sets text with a small delay to ensure the announcement fires.
   */
  function announceToScreenReader(message) {
    if (!srAnnouncerEl) return;
    srAnnouncerEl.textContent = '';
    setTimeout(() => {
      srAnnouncerEl.textContent = message;
    }, 100);
  }

  function showPersonalityLoading(username) {
    if (!personalityEl) return;

    // Clear any existing animation and reset word pool for fresh session
    if (personalityAnimationTimeout) {
      clearTimeout(personalityAnimationTimeout);
    }
    resetRollingWords();

    // Generate possessive text based on username
    const isDefault = username === CONFIG.defaultUsername;
    const whosText = isDefault ? 'My' : `${sanitize(username)}'s`;

    // Rolling text has aria-hidden="true" so screen readers ignore the rapid updates
    personalityEl.innerHTML = `<span class="personality-label">${whosText} Music Personality</span><span class="personality-content"><span class="personality-rolling" aria-hidden="true"></span><span class="personality-text"></span></span>`;
    personalityEl.style.display = 'block';
    personalityEl.classList.remove('visible');
    personalityEl.classList.add('loading');

    // Announce loading state once via dedicated announcer (not the live region)
    announceToScreenReader(`Loading ${whosText} music personality`);

    // Start rolling text animation with variable timing (feels more organic)
    const rollingEl = personalityEl.querySelector('.personality-rolling');
    if (rollingEl) {
      rollingEl.textContent = generateRollingText();

      // Use recursive setTimeout with random delays (300-600ms) for organic "thinking" feel
      const scheduleNextWord = () => {
        const delay = 300 + Math.random() * 300; // 300-600ms
        personalityAnimationTimeout = setTimeout(() => {
          rollingEl.textContent = generateRollingText();
          scheduleNextWord();
        }, delay);
      };
      scheduleNextWord();
    }
  }

  /**
   * Display the music personality headline (replaces loading state)
   */
  function displayPersonality(headline) {
    if (!personalityEl || !headline) return;

    // Stop the rolling animation
    if (personalityAnimationTimeout) {
      clearTimeout(personalityAnimationTimeout);
      personalityAnimationTimeout = null;
    }

    // Fade out the rolling text first
    const rollingEl = personalityEl.querySelector('.personality-rolling');
    if (rollingEl) {
      rollingEl.classList.add('fading-out');
    }

    // After fade-out, show the result
    setTimeout(() => {
      // Update the text content
      const textEl = personalityEl.querySelector('.personality-text');
      if (textEl) {
        textEl.textContent = headline;
      } else {
        // Fallback if structure doesn't exist
        personalityEl.innerHTML = `<span class="personality-label">Your Music Personality</span><span class="personality-content"><span class="personality-rolling" aria-hidden="true"></span><span class="personality-text">${sanitize(headline)}</span></span>`;
      }

      // Transition from loading to visible — enable live region for the final headline
      personalityEl.setAttribute('aria-live', 'polite');
      personalityEl.classList.remove('loading');
      personalityEl.classList.add('visible');

      // Announce the headline via the dedicated announcer
      announceToScreenReader(`Your music personality: ${headline}`);

      // On mobile viewports, smoothly scroll to the main content area
      // so the personality headline is visible after it fades in
      // Only scroll if user hasn't already scrolled past the username section
      if (window.innerWidth <= 768) {
        const usernameSection = document.querySelector('.username-section');
        const mainElement = document.querySelector('main');
        if (usernameSection && mainElement) {
          const usernameSectionBottom = usernameSection.getBoundingClientRect().bottom;
          // Only scroll if the username section is still visible (user is near top)
          // and the input field is not focused (user may be typing another username)
          const inputIsFocused = document.activeElement === usernameInput;
          if (usernameSectionBottom > 0 && !inputIsFocused) {
            // Small delay to let the fade-in animation start
            setTimeout(() => {
              mainElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        }
      }
    }, 300);
  }

  /**
   * Hide the music personality headline
   */
  function hidePersonality() {
    if (!personalityEl) return;

    // Stop the rolling animation
    if (personalityAnimationTimeout) {
      clearTimeout(personalityAnimationTimeout);
      personalityAnimationTimeout = null;
    }

    // Disable live region before hiding to prevent stale announcements
    personalityEl.setAttribute('aria-live', 'off');
    personalityEl.classList.remove('visible', 'loading');
    personalityEl.style.display = 'none';
  }

  /**
   * Sanitize a string to prevent XSS attacks
   */
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /**
   * Convert HSL to RGB
   * @returns {r, g, b} values 0-255
   */
  function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;

    if (h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  /**
   * Calculate relative luminance per WCAG 2.1
   * @param {number} r - Red 0-255
   * @param {number} g - Green 0-255
   * @param {number} b - Blue 0-255
   * @returns {number} Relative luminance 0-1
   */
  function getRelativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   * @returns {number} Contrast ratio (1-21)
   */
  function getContrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Find minimum lightness for text to achieve target contrast ratio
   * @param {number} bgH - Background hue
   * @param {number} bgS - Background saturation
   * @param {number} bgL - Background lightness
   * @param {number} textS - Text saturation
   * @param {number} targetRatio - Target contrast ratio (4.5 for WCAG AA)
   * @returns {number} Minimum lightness for text
   */
  function findMinLightnessForContrast(bgH, bgS, bgL, textS, targetRatio) {
    const bgRgb = hslToRgb(bgH, bgS, bgL);
    const bgLum = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

    // Binary search for minimum lightness that achieves target contrast
    let low = 50,
      high = 100;
    while (high - low > 1) {
      const mid = (low + high) / 2;
      const textRgb = hslToRgb(bgH, textS, mid);
      const textLum = getRelativeLuminance(textRgb.r, textRgb.g, textRgb.b);
      const ratio = getContrastRatio(textLum, bgLum);

      if (ratio >= targetRatio) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return Math.ceil(high);
  }

  /**
   * Mood-to-color mapping for personality-influenced backgrounds
   * Each mood has a hue range, saturation range, and lightness range
   * Hue ranges are designed to evoke the emotional quality of each mood
   */
  const MOOD_COLORS = {
    happy: {
      // Warm yellows, oranges, bright greens (30-120 hue range)
      hueMin: 30,
      hueMax: 120,
      satMin: 60,
      satMax: 85,
      lightMin: 22,
      lightMax: 32
    },
    sad: {
      // Cool blues, blue-purples (200-260 hue range)
      hueMin: 200,
      hueMax: 260,
      satMin: 40,
      satMax: 70,
      lightMin: 18,
      lightMax: 28
    },
    angry: {
      // Reds, deep oranges (0-30 or 340-360 hue range)
      hueMin: 340,
      hueMax: 390, // Wraps around: 390 = 30
      satMin: 65,
      satMax: 90,
      lightMin: 20,
      lightMax: 30
    },
    relaxed: {
      // Soft greens, teals, gentle blues (140-200 hue range)
      hueMin: 140,
      hueMax: 200,
      satMin: 35,
      satMax: 65,
      lightMin: 20,
      lightMax: 30
    },
    energetic: {
      // Vibrant magentas, hot pinks, electric purples (280-340 hue range)
      hueMin: 280,
      hueMax: 340,
      satMin: 70,
      satMax: 95,
      lightMin: 22,
      lightMax: 32
    },
    dark: {
      // Deep purples, dark blues, near-blacks (240-300 hue range)
      hueMin: 240,
      hueMax: 300,
      satMin: 30,
      satMax: 60,
      lightMin: 12,
      lightMax: 22
    }
  };

  /**
   * Generate a blended HSL color from weighted mood proportions.
   * Instead of picking a single dominant mood (which causes jarring hue jumps),
   * this blends all mood colors proportionally for smooth transitions.
   * @param {function} [seededRandom] - Optional seeded random function (0-1)
   * @param {object} moodWeights - Object mapping mood names to their weights (e.g., { sad: 0.4, angry: 0.35 })
   * @param {number} [confidence=1] - Confidence factor (0-1) for progressive loading dampening
   */
  function generateBlendedColor(seededRandom, moodWeights, confidence) {
    let random1, random2, random3;

    if (seededRandom) {
      random1 = seededRandom();
      random2 = seededRandom();
      random3 = seededRandom();
    } else if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(3);
      window.crypto.getRandomValues(arr);
      random1 = arr[0] / 0xffffffff;
      random2 = arr[1] / 0xffffffff;
      random3 = arr[2] / 0xffffffff;
    } else {
      random1 = Math.random();
      random2 = Math.random();
      random3 = Math.random();
    }

    // Collect all mood entries with valid configs
    const entries = Object.entries(moodWeights || {}).filter(([mood]) => MOOD_COLORS[mood]);

    let hue, saturation, lightness;

    if (entries.length > 0) {
      // Normalize weights to sum to 1
      const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

      // Weighted average of each mood's center hue, saturation, and lightness
      // Use circular mean for hue to handle wrap-around (e.g., red 350° + blue 220°)
      let sinSum = 0,
        cosSum = 0;
      let satSum = 0,
        lightSum = 0;

      for (const [mood, weight] of entries) {
        const config = MOOD_COLORS[mood];
        const w = weight / totalWeight;

        // Center of the mood's hue range
        let centerHue = (config.hueMin + config.hueMax) / 2;
        if (centerHue >= 360) centerHue -= 360;

        // Circular mean components
        const rad = (centerHue * Math.PI) / 180;
        sinSum += Math.sin(rad) * w;
        cosSum += Math.cos(rad) * w;

        // Weighted average of saturation and lightness midpoints
        satSum += ((config.satMin + config.satMax) / 2) * w;
        lightSum += ((config.lightMin + config.lightMax) / 2) * w;
      }

      // Circular mean for hue
      const meanHue = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;

      // Add some randomness within a narrow range around the blended center
      hue = Math.round(meanHue + (random1 - 0.5) * 30); // ±15° variation
      if (hue < 0) hue += 360;
      if (hue >= 360) hue -= 360;

      saturation = Math.round(satSum + (random2 - 0.5) * 15); // ±7.5% variation
      lightness = Math.round(lightSum + (random3 - 0.5) * 6); // ±3% variation
    } else {
      // Full spectrum fallback
      hue = Math.round(random1 * 359);
      saturation = Math.round(random2 * 35 + 55);
      lightness = Math.round(random3 * 12 + 20);
    }

    // Apply confidence dampening for progressive loading
    if (typeof confidence === 'number' && confidence < 1) {
      const eased = confidence * confidence * (3 - 2 * confidence); // smoothstep
      const mutedSat = 30;
      saturation = Math.round(mutedSat + (saturation - mutedSat) * eased);
    }

    // Clamp values
    saturation = Math.max(20, Math.min(95, saturation));
    lightness = Math.max(12, Math.min(35, lightness));

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Generate a random HSL color for the background, optionally influenced by mood
   * If a seeded random function is provided, uses deterministic randomness
   * Otherwise uses crypto.getRandomValues for better randomness distribution
   * Tuned for vivid colors with good white text contrast (WCAG AA)
   * @param {function} [seededRandom] - Optional seeded random function (0-1)
   * @param {string} [mood] - Optional mood to influence color (happy, sad, angry, relaxed, energetic, dark)
   */
  function generateRandomColor(seededRandom, mood) {
    // Delegate to blended color with a single mood at 100% weight
    if (mood && MOOD_COLORS[mood]) {
      return generateBlendedColor(seededRandom, { [mood]: 1 });
    }

    // No mood - full spectrum
    let random1, random2, random3;
    if (seededRandom) {
      random1 = seededRandom();
      random2 = seededRandom();
      random3 = seededRandom();
    } else if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(3);
      window.crypto.getRandomValues(arr);
      random1 = arr[0] / 0xffffffff;
      random2 = arr[1] / 0xffffffff;
      random3 = arr[2] / 0xffffffff;
    } else {
      random1 = Math.random();
      random2 = Math.random();
      random3 = Math.random();
    }
    const hue = Math.round(random1 * 359);
    const saturation = Math.round(random2 * 35 + 55);
    const lightness = Math.round(random3 * 12 + 20);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Animate background color change
   * @param {string} targetColor - HSL color string
   * @param {object} [options] - Animation options
   * @param {number} [options.duration=0.7] - Transition duration in seconds
   */
  function animateBackgroundColor(targetColor, options = {}) {
    const duration = options.duration || 0.7;
    document.body.style.transition = `background-color ${duration}s ease-out`;
    wrapperEl.style.transition = `background-color ${duration}s ease-out`;
    document.body.style.backgroundColor = targetColor;
    wrapperEl.style.backgroundColor = targetColor;

    // Set CSS variable for star color to match background (cutout effect)
    // Uses exact same polygon points as the loading star in CSS
    const encodedColor = encodeURIComponent(targetColor);
    const starSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpolygon fill='${encodedColor}' points='50,5 61,40 98,40 68,62 79,97 50,75 21,97 32,62 2,40 39,40'/%3E%3C/svg%3E")`;
    document.documentElement.style.setProperty('--star-bg', starSvg);

    // Parse HSL values for derived colors
    const hslMatch = targetColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
      const h = parseInt(hslMatch[1], 10);
      const s = parseInt(hslMatch[2], 10);
      const l = parseInt(hslMatch[3], 10);

      // Personality glow - brighter version of background color
      const glowL = Math.min(l + 45, 60);
      const glowColor = `hsla(${h}, ${s}%, ${glowL}%, 0.6)`;
      document.documentElement.style.setProperty('--personality-glow', glowColor);

      // Generate tinted text colors based on background hue
      // Use moderate saturation (15-35%) for noticeable tint
      // The findMinLightnessForContrast function ensures WCAG compliance by adjusting lightness
      const textS = Math.min(Math.max(s * 0.4, 25), 35);

      // Calculate minimum lightness values for WCAG AA compliance (4.5:1 contrast)
      // Each tier has a different target contrast ratio:
      // --text-primary: 7:1 (WCAG AAA for normal text)
      // --text-secondary: 4.5:1 (WCAG AA for normal text)
      // --text-tertiary: 4.5:1 (WCAG AA for normal text)
      // --text-muted: 3:1 (WCAG AA for large text / UI components)
      const primaryL = Math.max(findMinLightnessForContrast(h, s, l, textS, 7), 90);
      const secondaryL = Math.max(findMinLightnessForContrast(h, s, l, textS, 4.5), 80);
      const tertiaryL = Math.max(findMinLightnessForContrast(h, s, l, textS, 4.5), 70);
      const mutedL = Math.max(findMinLightnessForContrast(h, s, l, textS, 3), 60);

      document.documentElement.style.setProperty('--text-primary', `hsl(${h}, ${textS}%, ${primaryL}%)`);
      document.documentElement.style.setProperty('--text-secondary', `hsl(${h}, ${textS}%, ${secondaryL}%)`);
      document.documentElement.style.setProperty('--text-tertiary', `hsl(${h}, ${textS}%, ${tertiaryL}%)`);
      document.documentElement.style.setProperty('--text-muted', `hsl(${h}, ${textS}%, ${mutedL}%)`);

      // Generate tinted border and background colors
      // Use same hue but high lightness with varying alpha for subtle tinting
      const uiL = 95; // Very light for borders/backgrounds
      document.documentElement.style.setProperty('--border-specular', `hsla(${h}, ${textS}%, ${uiL}%, 0.1)`);
      document.documentElement.style.setProperty('--border-subtle', `hsla(${h}, ${textS}%, ${uiL}%, 0.25)`);
      document.documentElement.style.setProperty('--border-medium', `hsla(${h}, ${textS}%, ${uiL}%, 0.45)`);
      document.documentElement.style.setProperty('--border-strong', `hsla(${h}, ${textS}%, ${uiL}%, 0.65)`);
      document.documentElement.style.setProperty('--bg-subtle', `hsla(${h}, ${textS}%, ${uiL}%, 0.08)`);
      document.documentElement.style.setProperty('--bg-medium', `hsla(${h}, ${textS}%, ${uiL}%, 0.15)`);
      document.documentElement.style.setProperty('--bg-strong', `hsla(${h}, ${textS}%, ${uiL}%, 0.25)`);
      // Input field specific vars (higher opacity for better affordance)
      document.documentElement.style.setProperty('--input-bg', `hsla(${h}, ${textS}%, ${uiL}%, 0.2)`);
      document.documentElement.style.setProperty('--input-bg-focus', `hsla(${h}, ${textS}%, ${uiL}%, 0.3)`);
      document.documentElement.style.setProperty('--input-border', `hsla(${h}, ${textS}%, ${uiL}%, 0.6)`);
      document.documentElement.style.setProperty('--input-border-focus', `hsla(${h}, ${textS}%, ${uiL}%, 0.8)`);
    }
  }

  /**
   * Update document title and meta description to match SEO
   */
  function updateDocumentMeta(username) {
    const isDefault = username === CONFIG.defaultUsername;
    const titleName = isDefault ? 'Payam Yousefi' : sanitize(username);
    const whosText = isDefault ? 'my' : `${sanitize(username)}'s`;

    // Update title
    document.title = `Music — ${titleName}`;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', `Curious about ${whosText} taste in music? Over the past month...`);
    }
  }

  /**
   * Update the header subtitle with the current username
   */
  function updateHeaderSubtitle(username) {
    // Update document title and meta description to match SEO
    updateDocumentMeta(username);

    if (headerSubtitle) {
      const isDefault = username === CONFIG.defaultUsername;
      const whosText = isDefault
        ? 'my'
        : `<a href="https://last.fm/user/${encodeURIComponent(username)}" target="_blank" rel="noopener noreferrer">${sanitize(username)}</a>'s`;
      headerSubtitle.innerHTML = `Curious about ${whosText} taste in music?<br>Over the past month...`;
    }
  }

  /**
   * Slide down animation for content
   */
  function slideDown(element, duration = 500) {
    element.style.display = 'block';
    element.style.overflow = 'hidden';
    element.style.height = '0';
    element.style.opacity = '0';

    element.offsetHeight;
    const targetHeight = element.scrollHeight;

    element.style.transition = `height ${duration}ms ease-out, opacity ${duration}ms ease-out`;
    element.style.height = targetHeight + 'px';
    element.style.opacity = '1';

    setTimeout(() => {
      element.style.height = '';
      element.style.overflow = '';
      element.style.transition = '';
    }, duration);
  }

  /**
   * Check if a Discogs image URL is valid (not a placeholder)
   */
  function isValidDiscogsImage(url) {
    if (!url) return false;
    if (url.includes('spacer.gif')) return false;
    if (url === '') return false;
    return true;
  }

  /**
   * Get MBID and Discogs ID from MusicBrainz relations
   * Flow: Last.fm MBID (or name search) → MusicBrainz → { mbid, discogsId }
   */
  async function getMusicBrainzData(artistName, mbid) {
    let effectiveMbid = mbid;

    // If no MBID from Last.fm, search MusicBrainz by name
    if (!effectiveMbid || effectiveMbid.length === 0) {
      try {
        // Wait if rate limited
        await musicBrainzRateLimiter.waitIfNeeded();

        const searchUrl = `/api/musicbrainz/artist?query=${encodeURIComponent(artistName)}`;
        const searchResponse = await fetch(searchUrl);

        // Update rate limiter from response headers
        musicBrainzRateLimiter.updateFromHeaders(searchResponse.headers);

        // Handle rate limit (429 from server, which converts MB's 200+error body)
        if (searchResponse.status === 429) {
          musicBrainzRateLimiter.markRateLimited();
          // Retry once after backing off
          await musicBrainzRateLimiter.waitIfNeeded();
          const retryResponse = await fetch(searchUrl);
          musicBrainzRateLimiter.updateFromHeaders(retryResponse.headers);
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (retryData.artists && retryData.artists.length > 0) {
              const mbArtist = retryData.artists[0];
              if (mbArtist.name && mbArtist.name.toLowerCase() === artistName.toLowerCase()) {
                effectiveMbid = mbArtist.id;
              }
            }
          }
        } else if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.artists && searchData.artists.length > 0) {
            // Verify the returned artist name matches (case-insensitive)
            // MusicBrainz may return a different artist with the same name
            const mbArtist = searchData.artists[0];
            if (mbArtist.name && mbArtist.name.toLowerCase() === artistName.toLowerCase()) {
              effectiveMbid = mbArtist.id;
            }
          }
        }
      } catch (error) {
        // Search failed, continue without MBID
      }
    }

    if (!effectiveMbid) {
      return { mbid: null, discogsId: null };
    }

    // Fetch MusicBrainz artist with URL relations
    let discogsId = null;
    try {
      // Wait if rate limited
      await musicBrainzRateLimiter.waitIfNeeded();

      const mbUrl = `/api/musicbrainz/artist/${effectiveMbid}`;
      const response = await fetch(mbUrl);

      // Update rate limiter from response headers
      musicBrainzRateLimiter.updateFromHeaders(response.headers);

      // Handle rate limit (429 from server)
      if (response.status === 429) {
        musicBrainzRateLimiter.markRateLimited();
        // Retry once after backing off
        await musicBrainzRateLimiter.waitIfNeeded();
        const retryResponse = await fetch(mbUrl);
        musicBrainzRateLimiter.updateFromHeaders(retryResponse.headers);
        if (retryResponse.ok) {
          const data = await retryResponse.json();
          if (data.name && data.name.toLowerCase() !== artistName.toLowerCase()) {
            return { mbid: null, discogsId: null };
          }
          if (data.relations) {
            for (const rel of data.relations) {
              if (rel.type === 'discogs' && rel.url && rel.url.resource) {
                const match = rel.url.resource.match(/discogs\.com\/artist\/(\d+)/);
                if (match) {
                  discogsId = match[1];
                  break;
                }
              }
            }
          }
        }
      } else if (response.ok) {
        const data = await response.json();

        // Verify the MBID resolves to the correct artist name
        // This catches cases where Last.fm provides a wrong MBID (e.g., "Drama" → wrong artist)
        if (data.name && data.name.toLowerCase() !== artistName.toLowerCase()) {
          return { mbid: null, discogsId: null };
        }

        // Find Discogs relation and extract artist ID
        if (data.relations) {
          for (const rel of data.relations) {
            if (rel.type === 'discogs' && rel.url && rel.url.resource) {
              const match = rel.url.resource.match(/discogs\.com\/artist\/(\d+)/);
              if (match) {
                discogsId = match[1];
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      // Continue with just MBID
    }

    return { mbid: effectiveMbid, discogsId };
  }

  /**
   * Fetch artist data from TheAudioDB using MBID
   * Returns image URL and genre/style/mood for personality analysis
   * Respects 429 rate limits by waiting retryAfter seconds and retrying once
   */
  async function fetchAudioDBData(mbid) {
    const empty = { image: null, genre: null, style: null, mood: null };
    if (!mbid) {
      return empty;
    }

    try {
      const url = `/api/audiodb/artist/${mbid}`;
      let response = await fetch(url);

      // Handle rate limiting — wait retryAfter seconds and retry once
      if (response.status === 429) {
        let retryAfter = 60; // default fallback
        try {
          const body = await response.json();
          if (body.retryAfter) {
            retryAfter = body.retryAfter;
          }
        } catch (_) {
          // Use default
        }
        console.warn(`TheAudioDB rate limited — waiting ${retryAfter}s before retry`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        response = await fetch(url);
      }

      if (!response.ok) {
        return empty;
      }

      const data = await response.json();

      if (data.artists && data.artists.length > 0) {
        const artist = data.artists[0];
        return {
          image: artist.strArtistThumb || artist.strArtistFanart || null,
          genre: artist.strGenre || null,
          style: artist.strStyle || null,
          mood: artist.strMood || null
        };
      }

      return empty;
    } catch (error) {
      return empty;
    }
  }

  /**
   * Fetch artist image from TheAudioDB using MBID (wrapper for backward compatibility)
   */
  async function fetchAudioDBImage(mbid) {
    const data = await fetchAudioDBData(mbid);
    return data.image;
  }

  /**
   * Fetch artist image from iTunes/Apple Music Search API
   * Two-step process: search for artist, then lookup their albums for artwork
   * Uses local PHP proxy to avoid CORS issues with Apple's inconsistent CDN headers
   */
  async function fetchiTunesImage(artistName) {
    if (!artistName) {
      return null;
    }

    try {
      // Step 1: Search for the artist to get their ID (via Node proxy)
      const searchUrl = `/api/itunes/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`;
      const searchResponse = await fetch(searchUrl);

      if (!searchResponse.ok) {
        return null;
      }

      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        return null;
      }

      const artist = searchData.results[0];
      // Verify artist name matches (case-insensitive)
      if (!artist.artistName || artist.artistName.toLowerCase() !== artistName.toLowerCase()) {
        return null;
      }

      const artistId = artist.artistId;

      // Step 2: Lookup artist's albums to get artwork (via Node proxy)
      const lookupUrl = `/api/itunes/lookup?id=${artistId}&entity=album&limit=1`;
      const lookupResponse = await fetch(lookupUrl);

      if (!lookupResponse.ok) {
        return null;
      }

      const lookupData = await lookupResponse.json();

      // Results include the artist first, then albums
      if (lookupData.results && lookupData.results.length > 1) {
        const album = lookupData.results[1]; // First album after artist
        if (album.artworkUrl100) {
          // Replace 100x100 with 3x tile size for retina displays
          const targetSize = CONFIG.tileSize * 3;
          return album.artworkUrl100.replace('100x100', `${targetSize}x${targetSize}`);
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch artist image from Discogs API using verified artist ID
   * Uses rate limiter to respect API limits while maximizing throughput
   * Optimizes for images at least 3x tile size for retina displays
   */
  async function fetchDiscogsImageById(discogsId) {
    if (!discogsId) {
      return null;
    }

    const MIN_SIZE = CONFIG.tileSize * 3; // 750px for retina displays (3x 250px tiles)

    // Wait if rate limited
    await discogsRateLimiter.waitIfNeeded();

    try {
      const url = `/api/discogs/artist/${discogsId}`;
      const response = await fetch(url);

      // Update rate limiter from response headers
      discogsRateLimiter.updateFromHeaders(response.headers);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.images && data.images.length > 0) {
        // Filter valid images and sort by size preference
        const validImages = data.images.filter((img) => isValidDiscogsImage(img.uri));

        if (validImages.length === 0) {
          return null;
        }

        // Prefer primary image if it meets size requirements
        const primaryImage = validImages.find((img) => img.type === 'primary');

        // Check if primary image is large enough
        if (primaryImage && primaryImage.width >= MIN_SIZE && primaryImage.height >= MIN_SIZE) {
          return primaryImage.uri;
        }

        // Find any image that meets size requirements
        const largeImage = validImages.find((img) => img.width >= MIN_SIZE && img.height >= MIN_SIZE);

        if (largeImage) {
          return largeImage.uri;
        }

        // Fall back to primary or first valid image if no large images available
        return (primaryImage || validImages[0]).uri;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch image for a specific source
   * Returns { source, imageUrl } or { source, imageUrl: null }
   */
  async function fetchImageForSource(artistName, source, mbData) {
    const { mbid, discogsId } = mbData || {};
    const cacheKey = `${artistName}:${source}`;

    // Check cache first
    if (imageCache[cacheKey] !== undefined) {
      return { source, imageUrl: imageCache[cacheKey] };
    }

    // Not in cache, fetch from source
    let fetchedUrl = null;

    switch (source) {
      case 'DISCOGS':
        if (discogsId) {
          fetchedUrl = await fetchDiscogsImageById(discogsId);
        }
        break;

      case 'THE_AUDIO_DB':
        if (mbid) {
          fetchedUrl = await fetchAudioDBImage(mbid);
        }
        break;

      case 'ITUNES':
        fetchedUrl = await fetchiTunesImage(artistName);
        break;
    }

    // Cache the result (even if null, to avoid re-fetching)
    imageCache[cacheKey] = fetchedUrl;

    return { source, imageUrl: fetchedUrl };
  }

  /**
   * Check if a source needs MusicBrainz data
   */
  function sourceNeedsMbData(source) {
    return source === 'DISCOGS' || source === 'THE_AUDIO_DB';
  }

  /**
   * Fetch artist image using configurable source pipeline
   * Sources are tried in order defined by CONFIG.imageSources
   * Images are cached per-source so switching sources uses cached data when available
   */
  async function fetchArtistImageWithData(artistName, mbData) {
    // Try each source in configured order
    for (const source of CONFIG.imageSources) {
      const result = await fetchImageForSource(artistName, source, mbData);
      if (result.imageUrl) {
        return result; // Return { source, imageUrl }
      }
    }

    return { source: CONFIG.imageSources[0], imageUrl: null };
  }

  /**
   * Preload an image and return a promise
   * Returns the Image element for potential canvas analysis
   */
  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // crossOrigin is intentionally NOT set here.
      // Setting crossOrigin='anonymous' sends an Origin header to CDNs like
      // i.discogs.com and r2.theaudiodb.com. Those CDNs don't respond with
      // Access-Control-Allow-Origin, so the browser blocks the load entirely.
      // Canvas luminance analysis uses a separate CORS-mode load (see
      // cacheTileLuminance) so display and analysis are decoupled.
      img.onload = () => resolve(img);
      img.onerror = () => reject();
      img.src = url;
    });
  }

  /**
   * Load an image in CORS mode for canvas pixel analysis.
   * Returns a Promise<HTMLImageElement> if the CDN supports CORS, or null if not.
   * This is separate from preloadImage so that display (no CORS) and canvas
   * analysis (needs CORS) use independent image loads.
   */
  function loadImageForCanvas(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // CDN doesn't support CORS — resolve null, don't reject
      img.src = url;
    });
  }

  /**
   * Analyze the luminance of the bottom-right region of an image (where .title sits)
   * Uses an offscreen canvas to sample pixel data
   * @param {HTMLImageElement} img - Loaded image element
   * @returns {boolean} true if the region is "light" (needs dark title), false if "dark"
   */
  function isImageLight(img) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Use a small sample size for performance (scale down to 50x50)
      const sampleSize = 50;
      canvas.width = sampleSize;
      canvas.height = sampleSize;

      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

      // Sample the bottom-right quadrant (where .title overlay sits)
      // Title is positioned: bottom: 0, right: 0, left: auto
      // So sample roughly the bottom 40%, right 70% of the image
      const startX = Math.floor(sampleSize * 0.3);
      const startY = Math.floor(sampleSize * 0.6);
      const regionW = sampleSize - startX;
      const regionH = sampleSize - startY;

      const imageData = ctx.getImageData(startX, startY, regionW, regionH);
      const data = imageData.data;

      // Calculate average luminance using WCAG relative luminance formula
      let totalLuminance = 0;
      const pixelCount = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        // Simplified relative luminance (skip gamma for performance)
        totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }

      const avgLuminance = totalLuminance / pixelCount;

      // Threshold: luminance > 0.5 means the region is "light"
      // White text on light backgrounds needs dark backdrop
      return avgLuminance > 0.5;
    } catch (e) {
      // Canvas tainted by CORS or other error — default to dark (current behavior)
      return false;
    }
  }

  /**
   * Analyze and cache whether a tile's image is light or dark.
   * Canvas pixel analysis requires CORS-mode image loading. Only iTunes/Apple CDN
   * supports CORS for arbitrary origins — Discogs (i.discogs.com) and TheAudioDB
   * (r2.theaudiodb.com) do not. Attempting a CORS-mode load against those CDNs
   * produces browser console errors even though the display image loads fine.
   * For non-CORS sources we skip analysis and default to false (dark).
   * @param {string} imageUrl - The image URL to analyze
   * @param {string} artistName - Artist name for cache key
   * @param {string} source - Image source identifier (ITUNES, DISCOGS, THE_AUDIO_DB)
   */
  async function cacheTileLuminance(imageUrl, artistName, source) {
    const cacheKey = `${artistName}:${source}`;
    if (luminanceCache[cacheKey] === undefined) {
      // Only iTunes CDN (mzstatic.com) supports CORS — skip canvas analysis for others
      const supportsCors = source === SERVICES.ITUNES;
      if (supportsCors) {
        const corsImg = await loadImageForCanvas(imageUrl);
        luminanceCache[cacheKey] = corsImg ? isImageLight(corsImg) : false;
      } else {
        luminanceCache[cacheKey] = false;
      }
    }
  }

  /**
   * Apply the correct title theme (light or dark backdrop) to a tile
   * based on the currently visible source layer's luminance
   * @param {Element} tile - The tile element
   * @param {string} source - The currently active source
   */
  function applyTitleTheme(tile, source) {
    const artistName = tile.dataset.artist;
    const cacheKey = `${artistName}:${source}`;
    const isLight = luminanceCache[cacheKey];

    if (isLight) {
      tile.classList.add('light-image');
    } else {
      tile.classList.remove('light-image');
    }
  }

  /**
   * Set image on a specific source layer within a tile
   */
  function setSourceLayerImage(tile, source, imageUrl) {
    const layer = tile.querySelector(`.source-layer[data-source="${source}"]`);
    if (layer && imageUrl) {
      layer.style.backgroundImage = `url(${imageUrl})`;
      layer.dataset.hasImage = 'true';
    }
  }

  /**
   * Get the best image source for a tile based on fallback order
   * Returns the source that has an image, following the fallback order
   * @param {boolean} allowFallback - If false, only returns primarySource if it has an image
   */
  function getBestSourceForTile(tile, primarySource, allowFallback = true) {
    const fallbackOrder = allowFallback
      ? [primarySource, ...ORIGINAL_SOURCE_ORDER.filter((s) => s !== primarySource)]
      : [primarySource];

    for (const source of fallbackOrder) {
      const layer = tile.querySelector(`.source-layer[data-source="${source}"]`);
      if (layer && layer.dataset.hasImage === 'true') {
        return source;
      }
    }
    return null; // No source has an image
  }

  /**
   * Check if a source has finished loading for all artists
   * A source is considered "loaded" when it's in availableSources
   */
  function isSourceFullyLoaded(source) {
    return availableSources.includes(source);
  }

  /**
   * Show a specific source layer on a tile (with crossfade)
   * @param {Element} tile - The tile element
   * @param {string|null} sourceToShow - Source to show, or null to hide all
   */
  function showSourceLayer(tile, sourceToShow) {
    const layers = tile.querySelectorAll('.source-layer');
    layers.forEach((layer) => {
      if (layer.dataset.source === sourceToShow) {
        layer.classList.add('active');
      } else {
        layer.classList.remove('active');
      }
    });
  }

  /**
   * Prepare a tile with its image for a specific source
   */
  async function prepareTileImage(artistName, imageUrl, source) {
    const tiles = contentEl.querySelectorAll('.artist');
    for (const tile of tiles) {
      if (tile.dataset.artist === artistName) {
        if (imageUrl) {
          try {
            await preloadImage(imageUrl);
            // Set image on the source layer
            setSourceLayerImage(tile, source, imageUrl);
            // Await luminance analysis so the cache is populated before revealTile
            // calls applyTitleTheme. loadImageForCanvas resolves null (not rejects)
            // for CDNs that don't support CORS, so this never throws.
            await cacheTileLuminance(imageUrl, artistName, source);
            return { tile, success: true, source };
          } catch (e) {
            return { tile, success: false, source };
          }
        }
        return { tile, success: false, source };
      }
    }
    return null;
  }

  /**
   * Reveal a tile after its primary source image loads
   * If the current primary source hasn't fully loaded yet, keep tile in loading state
   * unless the tile has an image for the current primary source
   */
  function revealTile(tile, loadedSource) {
    const currentPrimarySource = CONFIG.imageSources[0];
    const primarySourceLoaded = isSourceFullyLoaded(currentPrimarySource);

    // Check if this tile has an image for the current primary source
    const primaryLayer = tile.querySelector(`.source-layer[data-source="${currentPrimarySource}"]`);
    const hasPrimaryImage = primaryLayer && primaryLayer.dataset.hasImage === 'true';

    // If primary source hasn't fully loaded and this tile doesn't have its image yet,
    // keep the tile in loading state
    if (!primarySourceLoaded && !hasPrimaryImage) {
      // Keep in loading state - don't reveal yet
      return;
    }

    // Remove loading states
    tile.classList.remove('loading-image', 'loading-active');

    // Find the best source to show (primary or fallback)
    // Allow fallback only if primary source has fully loaded
    const allowFallback = primarySourceLoaded;
    const bestSource = getBestSourceForTile(tile, currentPrimarySource, allowFallback);

    if (bestSource) {
      showSourceLayer(tile, bestSource);
      tile.classList.add('image-loaded');
      // Apply adaptive title theme based on image luminance
      applyTitleTheme(tile, bestSource);
    } else {
      tile.classList.add('no-image');
      tile.classList.remove('light-image');
    }
  }

  /**
   * Reveal a row of tiles with fade-in effect
   */
  function revealRow(tiles) {
    tiles.forEach(({ tile, success, source }) => {
      revealTile(tile, source);
    });
  }

  /**
   * Mark a tile as actively loading (triggers pulsing animation)
   */
  function setTileLoadingActive(artistName) {
    const tiles = contentEl.querySelectorAll('.artist');
    for (const tile of tiles) {
      if (tile.dataset.artist === artistName) {
        tile.classList.remove('loading-image');
        tile.classList.add('loading-active');
        break;
      }
    }
  }

  /**
   * Fetch all artist images with two parallel sequential pipelines:
   * 1. iTunes pipeline: processes artists one-by-one through iTunes (no MB dependency)
   * 2. MB pipeline: processes artists one-by-one through MusicBrainz (rate limited)
   * Both pipelines run concurrently. Per-artist, if iTunes finds an image it's used
   * immediately. If not, MB-dependent fallbacks (Discogs, AudioDB) are tried.
   * AudioDB personality data is fetched per-artist as MB data arrives.
   * Personality headline is analyzed once all personality data is collected.
   */
  async function fetchAllArtistImages(artists) {
    // Determine if any configured source needs MusicBrainz data
    const needsMusicBrainz = CONFIG.imageSources.some((s) => s === 'DISCOGS' || s === 'THE_AUDIO_DB');

    // Identify which sources are independent (no MB dependency)
    const independentSources = CONFIG.imageSources.filter((s) => !sourceNeedsMbData(s));

    // --- Pipeline 1: MusicBrainz data (sequential, rate limited) ---
    // Per-artist MB data promises - resolves as each artist's MB data becomes available
    const mbDataPromises = {};

    if (needsMusicBrainz) {
      // Chain MB fetches sequentially but expose individual promises
      let mbChain = Promise.resolve();
      for (const artist of artists) {
        const artistName = artist.name;
        const artistMbid = artist.mbid;

        mbDataPromises[artistName] = new Promise((resolve) => {
          mbChain = mbChain.then(async () => {
            // Check cache first
            if (imageCache[`${artistName}:MB_DATA`] !== undefined) {
              resolve(imageCache[`${artistName}:MB_DATA`]);
              return;
            }
            const data = await getMusicBrainzData(artistName, artistMbid);
            const result = { mbid: data.mbid, discogsId: data.discogsId };
            imageCache[`${artistName}:MB_DATA`] = result;
            resolve(result);
          });
        });
      }
    }

    /**
     * Get MB data for an artist - returns promise from MB pipeline or empty object
     */
    function getMbDataForArtist(artistName) {
      if (!needsMusicBrainz) return Promise.resolve({});
      return mbDataPromises[artistName] || Promise.resolve({});
    }

    // --- Pipeline 2: Independent source images (sequential per-source, no rate limit) ---
    // For each independent source (e.g., iTunes), create a sequential chain that processes
    // artists one-by-one. This avoids flooding any single API with parallel requests.
    // Each artist gets a per-source promise that resolves with the image result.
    const independentImagePromises = {}; // { artistName: { ITUNES: Promise<result>, ... } }

    for (const source of independentSources) {
      let sourceChain = Promise.resolve();
      for (const artist of artists) {
        const artistName = artist.name;
        if (!independentImagePromises[artistName]) {
          independentImagePromises[artistName] = {};
        }

        independentImagePromises[artistName][source] = new Promise((resolve) => {
          sourceChain = sourceChain.then(async () => {
            const result = await fetchImageForSource(artistName, source, {});
            resolve(result);
          });
        });
      }
    }

    // --- Per-artist personality data (incremental, as MB data arrives) ---
    // Collect personality data incrementally so progressive color updates can use
    // whatever data is available so far, without waiting for all artists to complete.
    const resolvedPersonalityMap = {}; // artistName -> personality data (populated as each resolves)

    const personalityDataPromises = artists.map(async (artist) => {
      let data;

      // Check personality cache first (no need to wait for MB)
      if (personalityCache[artist.name]) {
        data = { ...personalityCache[artist.name], playcount: parseInt(artist.playcount, 10) || 1 };
      } else {
        // Wait for this artist's MB data (resolves as soon as this artist's MB call completes)
        const mbData = await getMbDataForArtist(artist.name);

        // Fetch from TheAudioDB if we have MBID
        if (mbData.mbid) {
          const audioDbData = await fetchAudioDBData(mbData.mbid);
          data = {
            name: artist.name,
            genre: audioDbData.genre,
            style: audioDbData.style,
            mood: audioDbData.mood,
            playcount: parseInt(artist.playcount, 10) || 1
          };
          personalityCache[artist.name] = data;
        } else {
          data = {
            name: artist.name,
            genre: null,
            style: null,
            mood: null,
            playcount: parseInt(artist.playcount, 10) || 1
          };
        }
      }

      // Store immediately so progressive color updates can access it
      resolvedPersonalityMap[artist.name] = data;
      return data;
    });

    // Personality analysis runs concurrently with image fetching
    const personalityPromise = Promise.all(personalityDataPromises).then(async (personalityData) => {
      const validData = personalityData.filter((d) => d.genre || d.style || d.mood);
      if (validData.length > 0) {
        const finalMoodCounts = {};
        let finalMoodTotal = 0;
        for (const d of validData) {
          if (d.mood) {
            const pc = d.playcount || 1;
            finalMoodCounts[d.mood] = (finalMoodCounts[d.mood] || 0) + pc;
            finalMoodTotal += pc;
          }
        }
        const finalMoodWeights = {};
        if (finalMoodTotal > 0) {
          for (const [mood, count] of Object.entries(finalMoodCounts)) {
            finalMoodWeights[mood] = count / finalMoodTotal;
          }
        } else {
          finalMoodWeights['relaxed'] = 1;
        }

        const headlineRandom = currentPersonalitySeed ? createSeededRandom(currentPersonalitySeed + 1000) : null;
        const analysis = await analyzePersonality(validData, headlineRandom);
        displayPersonality(analysis.headline);
        const colorRandom = currentPersonalitySeed ? createSeededRandom(currentPersonalitySeed + 2000) : null;
        animateBackgroundColor(generateBlendedColor(colorRandom, finalMoodWeights));

        return { hasPersonality: true };
      }
      return { hasPersonality: false };
    });

    // Track whether personality will set the final color (resolved later)
    let personalityWillSetFinalColor = false;

    personalityPromise.then((result) => {
      personalityWillSetFinalColor = result.hasPersonality;
    });

    // --- Per-artist image resolution: combine both pipelines ---
    // For each artist, try sources in config priority order:
    // - Independent sources (iTunes): await the sequential pipeline promise
    // - Dependent sources (Discogs, AudioDB): await MB data, then fetch sequentially
    // Tiles reveal as each artist's best image is found.
    const loadedArtistNames = [];
    const totalArtists = artists.length;
    let lastProgressiveColorPersonalityCount = 0; // Track how many personality entries drove the last color update

    /**
     * Try to update the background color progressively using whatever personality
     * data and loaded tiles are available right now. Non-blocking — never awaits
     * the full personality promise.
     * @param {boolean} [force=false] - If true, update even if not at a regular interval
     */
    function tryProgressiveColorUpdate(force = false) {
      if (loadedArtistNames.length === 0) return;

      const isLastBatch = loadedArtistNames.length === totalArtists;
      const atInterval = loadedArtistNames.length % 3 === 1;
      const shouldUpdate = force || atInterval || (isLastBatch && !personalityWillSetFinalColor);
      if (!shouldUpdate) return;

      // Gather whatever personality data has resolved so far (non-blocking)
      const availablePersonalityData = loadedArtistNames
        .map((name) => resolvedPersonalityMap[name])
        .filter((d) => d && (d.genre || d.style || d.mood));

      // Only update if we have new personality data since the last color update
      if (availablePersonalityData.length === 0) return;
      if (!force && availablePersonalityData.length === lastProgressiveColorPersonalityCount) return;
      lastProgressiveColorPersonalityCount = availablePersonalityData.length;

      const sortedNames = [...loadedArtistNames].sort();
      const loadedHash = hashString(sortedNames.join('|'));
      const progressiveRandom = createSeededRandom(loadedHash);

      const moodCounts = {};
      let moodTotal = 0;
      for (const d of availablePersonalityData) {
        if (d.mood) {
          const pc = d.playcount || 1;
          moodCounts[d.mood] = (moodCounts[d.mood] || 0) + pc;
          moodTotal += pc;
        }
      }
      const moodWeights = {};
      if (moodTotal > 0) {
        for (const [mood, count] of Object.entries(moodCounts)) {
          moodWeights[mood] = count / moodTotal;
        }
      } else {
        moodWeights['relaxed'] = 1;
      }

      const confidence = loadedArtistNames.length / totalArtists;
      animateBackgroundColor(generateBlendedColor(progressiveRandom, moodWeights, confidence), {
        duration: 2.5
      });
    }

    // Mark all tiles as loading
    for (const artist of artists) {
      setTileLoadingActive(artist.name);
    }

    // As each artist's personality data resolves, trigger a progressive color update
    // if tiles are already loaded. This handles the case where iTunes images appear
    // fast but MB/AudioDB data arrives later — the color starts changing as soon as
    // the first personality data resolves, even if all tiles are already visible.
    for (const pPromise of personalityDataPromises) {
      pPromise.then(() => {
        tryProgressiveColorUpdate(true);
      });
    }

    // Process each artist's image resolution concurrently
    // Each artist awaits its own pipeline promises (not other artists')
    await Promise.all(
      artists.map(async (artist) => {
        let bestResult = null;

        // Try sources in configured priority order
        for (const source of CONFIG.imageSources) {
          if (!sourceNeedsMbData(source)) {
            // Independent source - await the sequential pipeline promise for this artist
            const result = await independentImagePromises[artist.name][source];
            if (result.imageUrl) {
              bestResult = result;
              break;
            }
          } else {
            // MB-dependent source - await MB data first, then fetch
            const mbData = await getMbDataForArtist(artist.name);
            const result = await fetchImageForSource(artist.name, source, mbData);
            if (result.imageUrl) {
              bestResult = result;
              break;
            }
          }
        }

        if (!bestResult) {
          bestResult = { source: CONFIG.imageSources[0], imageUrl: null };
        }

        const tileResult = await prepareTileImage(artist.name, bestResult.imageUrl, bestResult.source);

        // Reveal tile as soon as its image is ready
        if (tileResult) {
          revealRow([tileResult]);

          // Track this artist as loaded
          loadedArtistNames.push(artist.name);

          // Update background color progressively as tiles load.
          // Skip the final update if personality will set the definitive color.
          tryProgressiveColorUpdate();
        }
      })
    );

    // Ensure personality analysis completes before we return
    await personalityPromise;
  }

  /**
   * Render error state
   */
  function renderError(message) {
    contentEl.setAttribute('aria-busy', 'true');
    contentEl.innerHTML = `<div class="error-state" role="alert"><p><em>${sanitize(message)}</em></p></div>`;
    contentEl.removeAttribute('aria-busy');

    // Also update the error container linked to the username input
    if (usernameErrorEl) {
      usernameErrorEl.textContent = message;
    }

    slideDown(contentEl);
  }

  /**
   * Render artist tiles with accessibility support
   * Each tile has 3 source layer divs (one per image source) for smooth crossfading
   */
  function renderArtists(artists, username) {
    // Store artists for potential reload when sources change
    currentArtists = artists;

    // Generate deterministic seed from username + artist data
    // This ensures same user with same listening = same color/personality
    currentPersonalitySeed = generatePersonalitySeed(username, artists);
    const seededRandom = createSeededRandom(currentPersonalitySeed);

    // Get primary source for initial visibility
    const primarySource = CONFIG.imageSources[0];

    const tiles = artists.map((artist, index) => {
      const safeName = sanitize(artist.name);
      const safeUrl = sanitize(artist.url);
      const playcount = parseInt(artist.playcount, 10) || 0;
      const playsText = playcount === 1 ? 'play' : 'plays';

      // Create source layer divs for each image source
      const sourceLayers = ORIGINAL_SOURCE_ORDER.map((source) => {
        const isActive = source === primarySource ? ' active' : '';
        return `<div class="source-layer${isActive}" data-source="${source}"></div>`;
      }).join('');

      // Accessible link with descriptive aria-label; inner content is presentational
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" aria-label="${safeName}, ${playcount} ${playsText} this month"><div class="artist loading-image" data-artist="${safeName}" role="presentation">${sourceLayers}<div class="dark" aria-hidden="true"></div><div class="title" aria-hidden="true">${safeName}<span>${playcount} ${playsText}</span></div></div></a>`;
    });

    // Add heading for screen readers; suppress live region during bulk DOM update
    contentEl.setAttribute('aria-busy', 'true');
    contentEl.innerHTML =
      `<h2 class="visually-hidden" tabindex="-1">Top ${artists.length} artists this month</h2>` + tiles.join('');

    // Clear any previous error state
    if (usernameErrorEl) {
      usernameErrorEl.textContent = '';
    }

    slideDown(contentEl, 1000);

    // Re-enable live region after slide animation completes and announce summary
    setTimeout(() => {
      contentEl.removeAttribute('aria-busy');
      announceToScreenReader(`Loaded top ${artists.length} artists for ${sanitize(username)}`);
    }, 1100);

    fetchAllArtistImages(artists).then(() => {
      // Mark primary source as available for rotation
      addAvailableSource(CONFIG.imageSources[0]);

      // Prefetch images from other sources in background for instant switching
      prefetchOtherSources(artists);
    });

    // Use seeded random for deterministic color (same user data = same color)
    // animateBackgroundColor(generateRandomColor(seededRandom));
  }

  /**
   * Prefetch images from non-primary sources in background
   * This enables instant crossfade when switching sources
   * Also populates the source layer divs for each tile
   */
  async function prefetchOtherSources(artists) {
    const primarySource = CONFIG.imageSources[0];
    const otherSources = ORIGINAL_SOURCE_ORDER.filter((s) => s !== primarySource);

    if (otherSources.length === 0) return;

    // Get MusicBrainz data from cache (should already be there)
    const mbDataMap = {};
    for (const artist of artists) {
      mbDataMap[artist.name] = imageCache[`${artist.name}:MB_DATA`] || {};
    }

    // Get all tiles for updating source layers
    const tiles = contentEl.querySelectorAll('.artist');

    // Prefetch each source sequentially to avoid rate limit issues
    for (const source of otherSources) {
      for (const artist of artists) {
        const mbData = mbDataMap[artist.name];

        // Use fetchImageForSource which handles caching
        const { imageUrl } = await fetchImageForSource(artist.name, source, mbData);

        // If we got an image, set it on the source layer
        if (imageUrl) {
          const tile = Array.from(tiles).find((t) => t.dataset.artist === artist.name);
          if (tile) {
            try {
              await preloadImage(imageUrl);
              setSourceLayerImage(tile, source, imageUrl);
              // Cache luminance for this source so rotation can apply correct theme
              cacheTileLuminance(imageUrl, artist.name, source);
            } catch (e) {
              // Silently fail - this is background prefetch
            }
          }
        }
      }

      // This source is now fully loaded - add to available sources for rotation
      addAvailableSource(source);
    }
  }

  /**
   * Fetch and display top artists for a user
   */
  async function loadUser(username) {
    const sanitizedUsername = sanitize(username);

    // Stop any existing auto-rotation and reset available sources
    stopAutoRotation();
    availableSources = [];
    autoRotationSourceIndex = 0;
    autoRotationDirection = 1;
    autoRotationDisabled = false; // Re-enable auto-rotation for new user

    // Reset image sources to default order (iTunes primary) for new user
    CONFIG.imageSources = [...ORIGINAL_SOURCE_ORDER];
    renderImageSourceRadios();

    updateHeaderSubtitle(username);
    // Wait 1s incase we  error out fast and shouldn't show loading state
    showPersonalityLoadingTimeout = setTimeout(() => showPersonalityLoading(username), 1000);

    const apiUrl = `/api/lastfm/user/${encodeURIComponent(sanitizedUsername)}/topartists?period=${CONFIG.period}&limit=${CONFIG.artistLimit}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      // Stop timeout for delay in showing personality loading state
      if (showPersonalityLoadingTimeout) {
        clearTimeout(showPersonalityLoadingTimeout);
        showPersonalityLoadingTimeout = null;
      }

      if (data.error) {
        hidePersonality();
        renderError("Unable to load this user's listening history.");
        return;
      }

      if (data.topartists && data.topartists.artist && data.topartists.artist.length > 0) {
        showPersonalityLoading(username);
        renderArtists(data.topartists.artist, username);
      } else {
        hidePersonality();
        renderError('No listening data available for this user in the past month.');
      }
    } catch (error) {
      hidePersonality();
      console.error('Last.fm API error:', error);
      renderError('Unable to load listening history. Please try again later.');
    }
  }

  /**
   * Get username from URL path
   */
  function getUsernameFromPath() {
    const path = window.location.pathname.split('/');
    const rawUsername = path[1] && path[1] !== '' ? path[1] : CONFIG.defaultUsername;
    return decodeURIComponent(rawUsername);
  }

  /**
   * Handle username form submission
   */
  function handleUsernameSubmit(event) {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent native form submission
      const inputVal = usernameInput.value.trim();
      if (inputVal) {
        const newUrl = '/' + encodeURIComponent(inputVal);
        window.history.pushState({ username: inputVal }, '', newUrl);
        loadUser(inputVal).then(() => {
          // Move focus to the results heading after content loads
          const heading = contentEl.querySelector('h2');
          if (heading) {
            heading.focus();
          }
        });
        usernameInput.blur();
      }
    }
  }

  /**
   * Handle browser back/forward navigation
   */
  function handlePopState() {
    const username = getUsernameFromPath();
    loadUser(username).then(() => {
      // Move focus to the results heading after content loads
      const heading = contentEl.querySelector('h2');
      if (heading) {
        heading.focus();
      }
    });
  }

  // Display names for image sources
  const SOURCE_NAMES = {
    ITUNES: 'iTunes',
    DISCOGS: 'Discogs',
    THE_AUDIO_DB: 'TheAudioDB'
  };

  /**
   * Render image source radio buttons based on CONFIG.imageSources
   */
  function renderImageSourceRadios() {
    const container = document.querySelector('.image-sources-config');
    if (!container) return;

    const primarySource = CONFIG.imageSources[0];

    // Build HTML: label + radio buttons for each source in config
    let html = '<span class="config-label">Primary Source:</span>';

    CONFIG.imageSources.forEach((source, index) => {
      const displayName = SOURCE_NAMES[source] || source;
      const checked = index === 0 ? ' checked' : '';
      const id = `source-${source.toLowerCase().replace(/_/g, '-')}`;
      html += `<label><input type="radio" name="image-source" id="${id}" value="${source}"${checked}> ${displayName}</label>`;
    });

    container.innerHTML = html;

    // Add event listeners to new radio buttons
    const radios = container.querySelectorAll('input[type="radio"]');
    radios.forEach((radio) => {
      radio.addEventListener('change', handleImageSourceChange);
    });
  }

  /**
   * Stop auto-rotation of images
   * Also cancels any pending timeout to start rotation
   */
  function stopAutoRotation() {
    if (autoRotationStartTimeout) {
      clearTimeout(autoRotationStartTimeout);
      autoRotationStartTimeout = null;
    }
    if (autoRotationInterval) {
      clearInterval(autoRotationInterval);
      autoRotationInterval = null;
    }
  }

  /**
   * Start auto-rotation of images between available sources
   * Cycles: 1 → 2 → 3 → 2 → 1 → 2 → 3 → ...
   */
  function startAutoRotation() {
    // Don't start if already running or less than 2 sources available
    if (autoRotationInterval || availableSources.length < 2) return;

    // Respect prefers-reduced-motion: skip auto-rotation entirely
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Start at the first source
    autoRotationSourceIndex = 0;
    autoRotationDirection = 1;

    // Rotate every 2.5 seconds
    autoRotationInterval = setInterval(() => {
      // Move to next source
      autoRotationSourceIndex += autoRotationDirection;

      // Bounce at ends
      if (autoRotationSourceIndex >= availableSources.length - 1) {
        autoRotationDirection = -1;
      } else if (autoRotationSourceIndex <= 0) {
        autoRotationDirection = 1;
      }

      const targetSource = availableSources[autoRotationSourceIndex];
      rotateToSource(targetSource);
    }, 2500);
  }

  /**
   * Rotate all tiles to show images from a specific source
   * Uses source layers for smooth crossfade transitions
   */
  function rotateToSource(source) {
    // Update radio button to reflect current source (visual feedback)
    const radio = document.querySelector(`.image-sources-config input[value="${source}"]`);
    if (radio && !radio.checked) {
      radio.checked = true;
    }

    if (currentArtists.length === 0) return;

    const tiles = document.querySelectorAll('.artist');

    for (const artist of currentArtists) {
      const tile = Array.from(tiles).find((t) => t.dataset.artist === artist.name);
      if (!tile) continue;

      // Find the best source to show (requested source or fallback)
      const bestSource = getBestSourceForTile(tile, source);

      if (bestSource) {
        showSourceLayer(tile, bestSource);
        tile.classList.remove('no-image');
        tile.classList.add('image-loaded');
        // Re-apply title theme for the new source's luminance
        applyTitleTheme(tile, bestSource);
      }
    }
  }

  /**
   * Add a source to available sources and potentially start rotation
   * Maintains the same order as CONFIG.imageSources for consistent rotation
   * Also updates any tiles waiting for this source (showing loading state)
   */
  function addAvailableSource(source) {
    if (!availableSources.includes(source)) {
      // Insert in the correct position to maintain CONFIG.imageSources order
      const sourceIndex = CONFIG.imageSources.indexOf(source);
      let insertIndex = availableSources.length; // Default to end

      // Find the correct position based on CONFIG.imageSources order
      for (let i = 0; i < availableSources.length; i++) {
        const existingSourceIndex = CONFIG.imageSources.indexOf(availableSources[i]);
        if (sourceIndex < existingSourceIndex) {
          insertIndex = i;
          break;
        }
      }

      availableSources.splice(insertIndex, 0, source);

      // If this source is the currently selected primary source,
      // update any tiles that were showing loading state
      const currentPrimarySource = CONFIG.imageSources[0];
      if (source === currentPrimarySource && currentArtists.length > 0) {
        const tiles = document.querySelectorAll('.artist');
        for (const artist of currentArtists) {
          const tile = Array.from(tiles).find((t) => t.dataset.artist === artist.name);
          if (!tile) continue;

          // Only update tiles that are in loading state
          if (tile.classList.contains('loading-image') || tile.classList.contains('loading-active')) {
            const bestSource = getBestSourceForTile(tile, currentPrimarySource, true);
            if (bestSource) {
              showSourceLayer(tile, bestSource);
              tile.classList.remove('loading-image', 'loading-active', 'no-image');
              tile.classList.add('image-loaded');
              applyTitleTheme(tile, bestSource);
            }
          }
        }
      }

      // Start rotation once we have 2+ sources (unless user manually disabled it)
      if (availableSources.length >= 2 && !autoRotationInterval && !autoRotationStartTimeout && !autoRotationDisabled) {
        // Small delay before starting rotation
        autoRotationStartTimeout = setTimeout(() => {
          autoRotationStartTimeout = null;
          startAutoRotation();
        }, 2000);
      }
    }
  }

  /**
   * Handle image source radio button changes
   * Switches visible source layer on each tile using crossfade
   * If the selected source is still loading, shows loading state instead of falling back
   * Stops auto-rotation when user manually selects a source
   */
  async function handleImageSourceChange() {
    // Stop auto-rotation and prevent it from restarting
    stopAutoRotation();
    autoRotationDisabled = true;

    const selectedRadio = document.querySelector('.image-sources-config input[type="radio"]:checked');
    if (!selectedRadio) return;

    const primarySource = selectedRadio.value;

    // Build new sources array: primary first, then others in original order
    // This ensures consistent fallback behavior regardless of previous selections
    const newSources = [primarySource, ...ORIGINAL_SOURCE_ORDER.filter((s) => s !== primarySource)];

    // Update config
    CONFIG.imageSources = newSources;

    // Check if the selected source has fully loaded
    // If not, we should show loading states instead of falling back
    const sourceFullyLoaded = isSourceFullyLoaded(primarySource);

    // Update images if we have artists loaded
    if (currentArtists.length > 0) {
      const tiles = document.querySelectorAll('.artist');

      // For each tile, show the best available source layer
      for (const artist of currentArtists) {
        const tile = Array.from(tiles).find((t) => t.dataset.artist === artist.name);
        if (!tile) continue;

        // If source is still loading, only use primary source (no fallback)
        // This shows loading state for tiles that don't have the image yet
        const allowFallback = sourceFullyLoaded;
        const bestSource = getBestSourceForTile(tile, primarySource, allowFallback);

        if (bestSource) {
          // Crossfade to the best source layer
          showSourceLayer(tile, bestSource);
          tile.classList.remove('no-image', 'loading-image', 'loading-active');
          tile.classList.add('image-loaded');
          applyTitleTheme(tile, bestSource);
        } else if (!sourceFullyLoaded) {
          // Source is still loading - show loading state
          showSourceLayer(tile, null);
          tile.classList.remove('image-loaded', 'no-image');
          tile.classList.add('loading-image');
        } else {
          // Source is fully loaded but has no image - show no-image state
          showSourceLayer(tile, null);
          tile.classList.remove('image-loaded', 'loading-image', 'loading-active', 'light-image');
          tile.classList.add('no-image');
        }
      }
    }
  }

  /**
   * Initialize the app
   */
  function init() {
    wrapperEl = document.getElementById('wrap');
    contentEl = document.querySelector('.content');
    usernameInput = document.getElementById('lastfm-username');
    headerSubtitle = document.querySelector('header h2');
    personalityEl = document.querySelector('.music-personality');
    srAnnouncerEl = document.getElementById('sr-announcer');
    usernameErrorEl = document.getElementById('username-error');

    if (!wrapperEl || !contentEl) {
      console.error('Required DOM elements not found');
      return;
    }

    // Render image source radio buttons based on CONFIG.imageSources
    // (event listeners are added inside renderImageSourceRadios)
    renderImageSourceRadios();

    const username = getUsernameFromPath();
    loadUser(username);

    if (usernameInput) {
      usernameInput.addEventListener('keydown', handleUsernameSubmit);
    }

    window.addEventListener('popstate', handlePopState);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
