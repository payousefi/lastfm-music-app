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

  // Configuration
  const CONFIG = {
    lastfmApiKey: '***REMOVED***',
    discogsKey: '***REMOVED***',
    discogsSecret: '***REMOVED***',
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
  // MusicBrainz allows ~1200 requests per time window. We adjust speed based on how many are left.
  const musicBrainzRateLimiter = {
    remaining: 1200,

    async waitIfNeeded() {
      // Adaptive delay based on remaining requests
      // remaining > 600: 100ms (fast - plenty of headroom)
      // remaining 200-600: 500ms (moderate)
      // remaining < 200: 1000ms (slow, conserve)
      let delay;
      if (this.remaining > 600) {
        delay = 100;
      } else if (this.remaining > 200) {
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
    }
  };

  // DOM Elements
  let wrapperEl, contentEl, usernameInput, headerSubtitle, personalityEl;

  // Image cache - keyed by "artistName:SOURCE" for per-source caching
  // Also stores MusicBrainz data keyed by "artistName:MB_DATA"
  const imageCache = {};

  // Personality data cache - stores genre/style/mood per artist
  const personalityCache = {};

  // Current artists (for reloading when sources change)
  let currentArtists = [];

  // Personality loading animation timeout
  let showPersonalityLoadingTimeout = null;
  let personalityAnimationTimeout = null;
  let personalityDisplayTimeout = null; // Timeout for delayed personality reveal

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
   * Uses TheAudioDB genre/style/mood data with Last.fm tags as fallback
   * @param {Array} artistsData - Array of artist data with mood/genre/style
   * @param {function} [seededRandom] - Optional seeded random function for deterministic headlines
   */
  function analyzePersonality(artistsData, seededRandom) {
    // Aggregate moods and genres with weights based on play count
    const moodCounts = {};
    const genreCounts = {};
    let totalPlays = 0;

    for (const data of artistsData) {
      const weight = data.playcount || 1;
      totalPlays += weight;

      // Process mood
      if (data.mood) {
        const normalizedMood = MOOD_MAP[data.mood.toLowerCase()] || null;
        if (normalizedMood) {
          moodCounts[normalizedMood] = (moodCounts[normalizedMood] || 0) + weight;
        }
      }

      // Process genre (try genre first, then style)
      const genreStr = data.genre || data.style;
      if (genreStr) {
        const normalizedGenre = GENRE_FAMILY_MAP[genreStr.toLowerCase()] || null;
        if (normalizedGenre) {
          genreCounts[normalizedGenre] = (genreCounts[normalizedGenre] || 0) + weight;
        }
      }
    }

    // Find dominant mood
    let dominantMood = null;
    let maxMoodCount = 0;
    for (const [mood, count] of Object.entries(moodCounts)) {
      if (count > maxMoodCount) {
        maxMoodCount = count;
        dominantMood = mood;
      }
    }

    // Find dominant genre (or eclectic if diverse)
    let dominantGenre = 'eclectic';
    let maxGenreCount = 0;
    const genreEntries = Object.entries(genreCounts);

    if (genreEntries.length > 0) {
      // Check for diversity - if top genre is less than 40% of total, consider eclectic
      for (const [genre, count] of genreEntries) {
        if (count > maxGenreCount) {
          maxGenreCount = count;
          dominantGenre = genre;
        }
      }

      // If we have 3+ genres and no clear dominant (< 50%), use eclectic
      if (genreEntries.length >= 3 && maxGenreCount / totalPlays < 0.5) {
        dominantGenre = 'eclectic';
      }
    }

    // Generate headline dynamically or fall back to static arrays
    // Use seeded random for deterministic results if provided
    const randomFn = seededRandom || Math.random;
    let headline;
    if (typeof generateHeadline === 'function') {
      // Use dynamic generation with seeded random for deterministic variety
      headline = generateHeadline(dominantMood || 'relaxed', dominantGenre || 'eclectic', randomFn);
    } else {
      // Fallback to static arrays
      let headlines;
      if (
        dominantMood &&
        PERSONALITY_HEADLINES[dominantMood] &&
        PERSONALITY_HEADLINES[dominantMood][dominantGenre]
      ) {
        headlines = PERSONALITY_HEADLINES[dominantMood][dominantGenre];
      } else if (FALLBACK_HEADLINES[dominantGenre]) {
        headlines = FALLBACK_HEADLINES[dominantGenre];
      } else {
        headlines = FALLBACK_HEADLINES.eclectic;
      }
      headline = headlines[Math.floor(randomFn() * headlines.length)];
    }

    return {
      headline,
      mood: dominantMood,
      genre: dominantGenre,
      moodCounts,
      genreCounts
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

    personalityEl.innerHTML = `<span class="personality-label">${whosText} Music Personality</span><span class="personality-content"><span class="personality-rolling"></span><span class="personality-text"></span></span>`;
    personalityEl.style.display = 'block';
    personalityEl.classList.remove('visible');
    personalityEl.classList.add('loading');

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
        personalityEl.innerHTML = `<span class="personality-label">Your Music Personality</span><span class="personality-content"><span class="personality-rolling"></span><span class="personality-text">${sanitize(headline)}</span></span>`;
      }

      // Transition from loading to visible
      personalityEl.classList.remove('loading');
      personalityEl.classList.add('visible');

      // On mobile viewports, smoothly scroll to the main content area
      // so the personality headline is visible after it fades in
      // Only scroll if user hasn't already scrolled past the username section
      if (window.innerWidth <= 768) {
        const usernameSection = document.querySelector('.username-section');
        const mainElement = document.querySelector('main');
        if (usernameSection && mainElement) {
          const usernameSectionBottom = usernameSection.getBoundingClientRect().bottom;
          // Only scroll if the username section is still visible (user is near top)
          if (usernameSectionBottom > 0) {
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
   * Generate a random HSL color for the background
   * If a seeded random function is provided, uses deterministic randomness
   * Otherwise uses crypto.getRandomValues for better randomness distribution
   * Tuned for vivid colors with good white text contrast (WCAG AA)
   * @param {function} [seededRandom] - Optional seeded random function (0-1)
   */
  function generateRandomColor(seededRandom) {
    let random1, random2, random3;

    if (seededRandom) {
      // Use deterministic seeded random
      random1 = seededRandom();
      random2 = seededRandom();
      random3 = seededRandom();
    } else if (window.crypto && window.crypto.getRandomValues) {
      // Use crypto API for better randomness
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
    const saturation = Math.round(random2 * 35 + 55); // 55-90% (more vivid)
    const lightness = Math.round(random3 * 12 + 20); // 20-32% (dark enough for contrast)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Animate background color change
   */
  function animateBackgroundColor(targetColor) {
    document.body.style.transition = 'background-color 0.7s ease-out';
    wrapperEl.style.transition = 'background-color 0.7s ease-out';
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
      const textS = Math.min(Math.max(s * 0.4, 15), 35);

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

      document.documentElement.style.setProperty(
        '--text-primary',
        `hsl(${h}, ${textS}%, ${primaryL}%)`
      );
      document.documentElement.style.setProperty(
        '--text-secondary',
        `hsl(${h}, ${textS}%, ${secondaryL}%)`
      );
      document.documentElement.style.setProperty(
        '--text-tertiary',
        `hsl(${h}, ${textS}%, ${tertiaryL}%)`
      );
      document.documentElement.style.setProperty(
        '--text-muted',
        `hsl(${h}, ${textS}%, ${mutedL}%)`
      );

      // Generate tinted border and background colors
      // Use same hue but high lightness with varying alpha for subtle tinting
      const uiL = 95; // Very light for borders/backgrounds
      document.documentElement.style.setProperty(
        '--border-specular',
        `hsla(${h}, ${textS}%, ${uiL}%, 0.1)`
      );
      document.documentElement.style.setProperty(
        '--border-subtle',
        `hsla(${h}, ${textS}%, ${uiL}%, 0.25)`
      );
      document.documentElement.style.setProperty(
        '--border-medium',
        `hsla(${h}, ${textS}%, ${uiL}%, 0.45)`
      );
      document.documentElement.style.setProperty(
        '--border-strong',
        `hsla(${h}, ${textS}%, ${uiL}%, 0.65)`
      );
      document.documentElement.style.setProperty(
        '--bg-subtle',
        `hsla(${h}, ${textS}%, ${uiL}%, 0.08)`
      );
      document.documentElement.style.setProperty(
        '--bg-medium',
        `hsla(${h}, ${textS}%, ${uiL}%, 0.15)`
      );
      document.documentElement.style.setProperty(
        '--bg-strong',
        `hsla(${h}, ${textS}%, ${uiL}%, 0.25)`
      );
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
      metaDescription.setAttribute(
        'content',
        `Curious about ${whosText} taste in music? Over the past month...`
      );
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

        const searchUrl = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artistName)}&fmt=json&limit=1`;
        const searchResponse = await fetch(searchUrl);

        // Update rate limiter from response headers
        musicBrainzRateLimiter.updateFromHeaders(searchResponse.headers);

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.artists && searchData.artists.length > 0) {
            effectiveMbid = searchData.artists[0].id;
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

      const mbUrl = `https://musicbrainz.org/ws/2/artist/${effectiveMbid}?inc=url-rels&fmt=json`;
      const response = await fetch(mbUrl);

      // Update rate limiter from response headers
      musicBrainzRateLimiter.updateFromHeaders(response.headers);

      if (response.ok) {
        const data = await response.json();

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
   */
  async function fetchAudioDBData(mbid) {
    if (!mbid) {
      return { image: null, genre: null, style: null, mood: null };
    }

    try {
      const url = `https://www.theaudiodb.com/api/v1/json/2/artist-mb.php?i=${mbid}`;
      const response = await fetch(url);

      if (!response.ok) {
        return { image: null, genre: null, style: null, mood: null };
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

      return { image: null, genre: null, style: null, mood: null };
    } catch (error) {
      return { image: null, genre: null, style: null, mood: null };
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
      // Step 1: Search for the artist to get their ID (via proxy)
      const searchUrl = `/api/itunes-proxy.php?endpoint=search&term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`;
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

      // Step 2: Lookup artist's albums to get artwork (via proxy)
      const lookupUrl = `/api/itunes-proxy.php?endpoint=lookup&id=${artistId}&entity=album&limit=1`;
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
      const url = `https://api.discogs.com/artists/${discogsId}?key=${CONFIG.discogsKey}&secret=${CONFIG.discogsSecret}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MusicApp/1.0 +https://music.payamyousefi.com'
        }
      });

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
        const largeImage = validImages.find(
          (img) => img.width >= MIN_SIZE && img.height >= MIN_SIZE
        );

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
   * Prefetch all MusicBrainz data in parallel (no rate limit)
   * Returns map of artistName -> { mbid, discogsId }
   */
  async function prefetchMusicBrainzData(artists) {
    const promises = artists.map(async (artist) => {
      const data = await getMusicBrainzData(artist.name, artist.mbid);
      return { name: artist.name, ...data };
    });

    const results = await Promise.all(promises);
    const dataMap = {};
    for (const result of results) {
      dataMap[result.name] = { mbid: result.mbid, discogsId: result.discogsId };
    }
    return dataMap;
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
   */
  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject();
      img.src = url;
    });
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
    } else {
      tile.classList.add('no-image');
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
   * Shuffle array using Fisher-Yates algorithm
   * Returns a new shuffled array, doesn't modify original
   */
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Fetch all artist images with optimized API calls:
   * 1. Prefetch all MusicBrainz data in parallel (no rate limit) - cached for reuse
   * 2. Fetch TheAudioDB data for personality analysis
   * 3. Fetch images in random order with rate limiting
   * 4. Reveal each tile immediately as its image loads
   * 5. Analyze and display music personality
   */
  async function fetchAllArtistImages(artists) {
    // Shuffle artists for random reveal order
    const shuffledArtists = shuffleArray(artists);

    // Phase 1: Get MusicBrainz data if needed (check cache first)
    const needsMusicBrainz = CONFIG.imageSources.some(
      (s) => s === 'DISCOGS' || s === 'THE_AUDIO_DB'
    );
    let mbDataMap = {};

    if (needsMusicBrainz) {
      // Check if we have cached MB data for all artists
      const uncachedArtists = artists.filter((a) => imageCache[`${a.name}:MB_DATA`] === undefined);

      if (uncachedArtists.length > 0) {
        // Fetch MB data for uncached artists
        const newMbData = await prefetchMusicBrainzData(uncachedArtists);
        // Cache the results
        for (const [name, data] of Object.entries(newMbData)) {
          imageCache[`${name}:MB_DATA`] = data;
        }
      }

      // Build mbDataMap from cache
      for (const artist of artists) {
        mbDataMap[artist.name] = imageCache[`${artist.name}:MB_DATA`] || {};
      }
    }

    // Phase 2: Fetch TheAudioDB data for personality analysis (parallel, no rate limit)
    const personalityDataPromises = artists.map(async (artist) => {
      const mbData = mbDataMap[artist.name] || {};

      // Check personality cache first
      if (personalityCache[artist.name]) {
        return { ...personalityCache[artist.name], playcount: parseInt(artist.playcount, 10) || 1 };
      }

      // Fetch from TheAudioDB if we have MBID
      if (mbData.mbid) {
        const audioDbData = await fetchAudioDBData(mbData.mbid);
        const data = {
          name: artist.name,
          genre: audioDbData.genre,
          style: audioDbData.style,
          mood: audioDbData.mood,
          playcount: parseInt(artist.playcount, 10) || 1
        };
        personalityCache[artist.name] = data;
        return data;
      }

      return {
        name: artist.name,
        genre: null,
        style: null,
        mood: null,
        playcount: parseInt(artist.playcount, 10) || 1
      };
    });

    const personalityData = await Promise.all(personalityDataPromises);

    // Analyze and display personality (with minimum delay for animation effect)
    if (typeof PERSONALITY_HEADLINES !== 'undefined' && typeof GENRE_FAMILY_MAP !== 'undefined') {
      const validData = personalityData.filter((d) => d.genre || d.style || d.mood);
      if (validData.length > 0) {
        // Create seeded random for deterministic headline generation
        // Use a different offset from the seed to get different values than color
        const headlineRandom = currentPersonalitySeed
          ? createSeededRandom(currentPersonalitySeed + 1000)
          : null;
        const analysis = analyzePersonality(validData, headlineRandom);
        // Add a variable delay (2.5-4s) so the rolling text animation plays
        // Variable timing feels more organic, like the app is actually "thinking"
        const thinkingDelay = 2500 + Math.random() * 1500;
        // Store timeout ID so it can be cancelled if user switches before reveal
        personalityDisplayTimeout = setTimeout(() => {
          displayPersonality(analysis.headline);
        }, thinkingDelay);
      }
    }

    // Phase 3: Fetch images in random order, reveal each immediately
    for (const artist of shuffledArtists) {
      const mbData = mbDataMap[artist.name] || {};

      // Mark tile as actively loading (pulsing star)
      setTileLoadingActive(artist.name);

      // Rate limiting is handled inside fetchDiscogsImageById via discogsRateLimiter
      // fetchArtistImageWithData now returns { source, imageUrl }
      const { source, imageUrl } = await fetchArtistImageWithData(artist.name, mbData);
      const result = await prepareTileImage(artist.name, imageUrl, source);

      // Reveal tile immediately
      if (result) {
        revealRow([result]);
      }
    }
  }

  /**
   * Render error state
   */
  function renderError(message) {
    contentEl.innerHTML = `<div class="error-state"><p><em>${sanitize(message)}</em></p></div>`;
    slideDown(contentEl);
  }

  /**
   * Show/hide the rate limit note with delay before hiding
   */
  function toggleRateLimitNote(show, immediate = false) {
    const note = document.querySelector('.rate-limit-note');
    if (!note) return;

    if (show) {
      note.classList.remove('fading');
      note.classList.add('visible');
    } else {
      if (immediate) {
        note.classList.remove('visible', 'fading');
      } else {
        // Add delay before hiding to allow users to finish reading
        setTimeout(() => {
          note.classList.add('fading');
          // After fade animation completes, hide completely
          setTimeout(() => {
            note.classList.remove('visible', 'fading');
          }, 300);
        }, 3000); // 3 second delay before starting fade
      }
    }
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

      // Accessible link with descriptive aria-label
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" aria-label="${safeName}, ${playcount} ${playsText} this month"><div class="artist loading-image" data-artist="${safeName}" role="img" aria-label="${safeName}">${sourceLayers}<div class="dark" aria-hidden="true"></div><div class="title">${safeName}<span>${playcount} ${playsText}</span></div></div></a>`;
    });

    // Add heading for screen readers
    contentEl.innerHTML =
      `<h2 class="visually-hidden">Top ${artists.length} artists this month</h2>` + tiles.join('');
    slideDown(contentEl, 1000);

    // Show rate limit note while loading images
    toggleRateLimitNote(true);

    fetchAllArtistImages(artists).then(() => {
      // Hide rate limit note when all images are loaded
      toggleRateLimitNote(false);

      // Mark primary source as available for rotation
      addAvailableSource(CONFIG.imageSources[0]);

      // Prefetch images from other sources in background for instant switching
      prefetchOtherSources(artists);
    });

    // Use seeded random for deterministic color (same user data = same color)
    animateBackgroundColor(generateRandomColor(seededRandom));
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

    // Cancel any pending personality display from previous user
    if (personalityDisplayTimeout) {
      clearTimeout(personalityDisplayTimeout);
      personalityDisplayTimeout = null;
    }

    // Stop any existing auto-rotation and reset available sources
    stopAutoRotation();
    availableSources = [];
    autoRotationSourceIndex = 0;
    autoRotationDirection = 1;
    autoRotationDisabled = false; // Re-enable auto-rotation for new user

    updateHeaderSubtitle(username);
    // Wait 1s incase we  error out fast and shouldn't show loading state
    showPersonalityLoadingTimeout = setTimeout(() => showPersonalityLoading(username), 1000);
    toggleRateLimitNote(false, true);

    const apiUrl =
      `https://ws.audioscrobbler.com/2.0/?method=user.getTopArtists` +
      `&user=${encodeURIComponent(sanitizedUsername)}` +
      `&api_key=${CONFIG.lastfmApiKey}` +
      `&limit=${CONFIG.artistLimit}` +
      `&period=${CONFIG.period}` +
      `&format=json`;

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
      const inputVal = usernameInput.value.trim();
      if (inputVal) {
        const newUrl = '/' + encodeURIComponent(inputVal);
        window.history.pushState({ username: inputVal }, '', newUrl);
        // contentEl.style.display = 'none';
        // contentEl.innerHTML = '';
        loadUser(inputVal);
      }
    }
  }

  /**
   * Handle browser back/forward navigation
   */
  function handlePopState() {
    const username = getUsernameFromPath();
    // contentEl.style.display = 'none';
    // contentEl.innerHTML = '';
    loadUser(username);
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
          if (
            tile.classList.contains('loading-image') ||
            tile.classList.contains('loading-active')
          ) {
            const bestSource = getBestSourceForTile(tile, currentPrimarySource, true);
            if (bestSource) {
              showSourceLayer(tile, bestSource);
              tile.classList.remove('loading-image', 'loading-active', 'no-image');
              tile.classList.add('image-loaded');
            }
          }
        }
      }

      // Start rotation once we have 2+ sources (unless user manually disabled it)
      if (
        availableSources.length >= 2 &&
        !autoRotationInterval &&
        !autoRotationStartTimeout &&
        !autoRotationDisabled
      ) {
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

    const selectedRadio = document.querySelector(
      '.image-sources-config input[type="radio"]:checked'
    );
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
        } else if (!sourceFullyLoaded) {
          // Source is still loading - show loading state
          showSourceLayer(tile, null);
          tile.classList.remove('image-loaded', 'no-image');
          tile.classList.add('loading-image');
        } else {
          // Source is fully loaded but has no image - show no-image state
          showSourceLayer(tile, null);
          tile.classList.remove('image-loaded', 'loading-image', 'loading-active');
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
      usernameInput.addEventListener('keypress', handleUsernameSubmit);
    }

    window.addEventListener('popstate', handlePopState);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
