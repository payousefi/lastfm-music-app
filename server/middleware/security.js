/**
 * Security Middleware
 * Comprehensive security layer: rate limiting, CORS, headers, input sanitization
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const config = require('../config');

// ═══════════════════════════════════════════════════════════════════════════
// HELMET - Secure HTTP headers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configures helmet for secure HTTP response headers:
 * - Content-Security-Policy: restricts resource loading origins
 * - X-Content-Type-Options: prevents MIME sniffing
 * - X-Frame-Options: prevents clickjacking
 * - Strict-Transport-Security: enforces HTTPS
 * - X-XSS-Protection: legacy XSS filter
 * - Referrer-Policy: controls referrer information
 */
function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for Google Analytics inline snippet
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com'
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com' // Google Fonts stylesheets
        ],
        imgSrc: [
          "'self'",
          'data:',
          'https://lastfm.freetls.fastly.net',
          'https://is1-ssl.mzstatic.com',
          'https://is2-ssl.mzstatic.com',
          'https://is3-ssl.mzstatic.com',
          'https://is4-ssl.mzstatic.com',
          'https://is5-ssl.mzstatic.com',
          'https://www.theaudiodb.com',
          'https://r2.theaudiodb.com',
          'https://i.discogs.com',
          'https://*.discogs.com',
          'https://www.google-analytics.com',
          'https://www.googletagmanager.com'
        ],
        connectSrc: [
          "'self'",
          'https://www.google-analytics.com', // GA event/pageview beacons
          'https://www.googletagmanager.com',
          'https://*.google-analytics.com',
          'https://*.analytics.google.com',
          'https://*.googletagmanager.com'
        ],
        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com' // Google Fonts font files
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false, // Allow loading cross-origin images/fonts
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CORS - Cross-Origin Resource Sharing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configures CORS to restrict which origins can call our APIs.
 * In production, only the app's own origin is allowed.
 * In development, localhost origins are permitted.
 */
function createCorsMiddleware() {
  const allowedOrigins = config.security.allowedOrigins;

  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (same-origin requests, server-to-server, curl)
      // Same-origin fetch() calls typically don't include an Origin header
      if (!origin) {
        return callback(null, true);
      }

      // Always allow configured origins (production domain)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development, allow any localhost/127.0.0.1 origin
      if (config.nodeEnv === 'development') {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
      }

      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: false,
    maxAge: 86400 // Cache preflight for 24 hours
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Global rate limiter - applies to all routes
 * Prevents general abuse and DDoS
 */
function createGlobalRateLimiter() {
  return rateLimit({
    windowMs: config.security.rateLimit.windowMs,
    max: config.security.rateLimit.maxRequests,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: {
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil(config.security.rateLimit.windowMs / 1000)
    }
    // Uses default keyGenerator (req.ip) which handles IPv6 correctly
  });
}

/**
 * Strict rate limiter for the AI personality endpoint
 * AI calls are expensive - tighter limits prevent abuse and cost overruns
 */
function createAIRateLimiter() {
  return rateLimit({
    windowMs: config.security.aiRateLimit.windowMs,
    max: config.security.aiRateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'AI rate limit exceeded',
      message: 'Too many personality generation requests. Please wait before trying again.',
      retryAfter: Math.ceil(config.security.aiRateLimit.windowMs / 1000)
    }
    // Uses default keyGenerator (req.ip) which handles IPv6 correctly
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Strips potentially dangerous characters from a string value.
 * Removes null bytes, control characters, and trims whitespace.
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;

  return value
    .replace(/\0/g, '') // Null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control chars (keep \t, \n, \r)
    .trim();
}

/**
 * Recursively sanitize all string values in an object/array
 */
function sanitizeDeep(obj) {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeDeep);
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeDeep(value);
    }
    return sanitized;
  }
  return obj;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params
 */
function inputSanitizer(req, res, next) {
  if (req.body) req.body = sanitizeDeep(req.body);
  if (req.query) req.query = sanitizeDeep(req.query);
  if (req.params) req.params = sanitizeDeep(req.params);
  next();
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST SIZE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Limits JSON body size to prevent memory exhaustion attacks.
 * The personality endpoint accepts artist arrays, but they should never be huge.
 */
const JSON_BODY_LIMIT = '50kb';

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETER VALIDATORS
// ═══════════════════════════════════════════════════════════════════════════

/** Allowed Last.fm time periods */
const VALID_PERIODS = ['overall', '7day', '1month', '3month', '6month', '12month'];

/** Allowed iTunes entity types */
const VALID_ITUNES_ENTITIES = ['musicArtist', 'album', 'song', 'musicTrack', 'mix', 'musicVideo'];

/**
 * Validates a Last.fm username:
 * - 2-15 characters
 * - Only alphanumeric, hyphens, underscores
 */
function isValidUsername(username) {
  return /^[a-zA-Z0-9_-]{1,15}$/.test(username);
}

/**
 * Validates a MusicBrainz ID (UUID format)
 */
function isValidMBID(mbid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mbid);
}

/**
 * Validates a Discogs numeric ID
 */
function isValidDiscogsId(id) {
  return /^\d{1,10}$/.test(id);
}

/**
 * Validates a numeric limit parameter
 */
function isValidLimit(limit) {
  const num = parseInt(limit, 10);
  return !isNaN(num) && num >= 1 && num <= 50;
}

/**
 * Validates a search term (no script tags, reasonable length)
 */
function isValidSearchTerm(term) {
  if (!term || typeof term !== 'string') return false;
  if (term.length > 200) return false;
  // Block obvious script injection attempts
  if (/<script|javascript:|on\w+\s*=/i.test(term)) return false;
  return true;
}

/**
 * Middleware factory: validates a route parameter against a validator function
 */
function validateParam(paramName, validatorFn, errorMessage) {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || !validatorFn(value)) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: errorMessage || `Invalid ${paramName}`
      });
    }
    next();
  };
}

/**
 * Middleware: validates query parameters for Last.fm top artists
 */
function validateLastfmQuery(req, res, next) {
  const { period, limit } = req.query;

  if (period && !VALID_PERIODS.includes(period)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`
    });
  }

  if (limit && !isValidLimit(limit)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'Invalid limit. Must be a number between 1 and 50.'
    });
  }

  next();
}

/**
 * Middleware: validates iTunes query parameters
 */
function validateItunesQuery(req, res, next) {
  const { term, entity, limit, id } = req.query;

  // For search endpoint
  if (term !== undefined && !isValidSearchTerm(term)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'Invalid search term'
    });
  }

  // For lookup endpoint
  if (id !== undefined && !/^\d{1,15}$/.test(id)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'Invalid iTunes ID'
    });
  }

  if (entity && !VALID_ITUNES_ENTITIES.includes(entity)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: `Invalid entity. Must be one of: ${VALID_ITUNES_ENTITIES.join(', ')}`
    });
  }

  if (limit && !isValidLimit(limit)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'Invalid limit. Must be a number between 1 and 50.'
    });
  }

  next();
}

/**
 * Middleware: validates MusicBrainz search query
 */
function validateMusicbrainzQuery(req, res, next) {
  const { query } = req.query;

  if (query !== undefined && !isValidSearchTerm(query)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'Invalid search query'
    });
  }

  next();
}

// ═══════════════════════════════════════════════════════════════════════════
// AI PROMPT INJECTION DEFENSE
// ═══════════════════════════════════════════════════════════════════════════

/** Known mood values that the app uses */
const ALLOWED_MOODS = [
  'happy',
  'sad',
  'angry',
  'relaxed',
  'energetic',
  'dark',
  // Extended moods from TheAudioDB that map to the above
  'joyful',
  'cheerful',
  'uplifting',
  'upbeat',
  'euphoric',
  'elated',
  'optimistic',
  'playful',
  'fun',
  'celebratory',
  'triumphant',
  'bright',
  'sunny',
  'positive',
  'exuberant',
  'gleeful',
  'blissful',
  'melancholic',
  'melancholy',
  'sorrowful',
  'mournful',
  'heartbroken',
  'lonely',
  'longing',
  'wistful',
  'bittersweet',
  'nostalgic',
  'reflective',
  'yearning',
  'grieving',
  'depressed',
  'blue',
  'pensive',
  'tender',
  'aggressive',
  'intense',
  'fierce',
  'furious',
  'rebellious',
  'defiant',
  'confrontational',
  'hostile',
  'violent',
  'rage',
  'raging',
  'hateful',
  'bitter',
  'raw',
  'brutal',
  'calm',
  'peaceful',
  'serene',
  'tranquil',
  'mellow',
  'soothing',
  'gentle',
  'soft',
  'easy',
  'laid-back',
  'chill',
  'ambient',
  'quiet',
  'dreamy',
  'ethereal',
  'meditative',
  'contemplative',
  'exciting',
  'dynamic',
  'powerful',
  'driving',
  'pumping',
  'electric',
  'vibrant',
  'lively',
  'spirited',
  'passionate',
  'fiery',
  'wild',
  'hyper',
  'thrilling',
  'exhilarating',
  'urgent',
  'restless',
  'brooding',
  'moody',
  'mysterious',
  'haunting',
  'eerie',
  'ominous',
  'sinister',
  'gothic',
  'somber',
  'gloomy',
  'bleak',
  'atmospheric',
  'shadowy',
  'nocturnal',
  'cryptic',
  'foreboding',
  'menacing'
];

/** Known genre values (from GENRE_FAMILY_MAP keys + family names) */
const ALLOWED_GENRES = [
  'rock',
  'electronic',
  'hip-hop',
  'indie',
  'pop',
  'jazz',
  'metal',
  'folk',
  'r&b',
  'classical',
  'country',
  'eclectic',
  'alternative rock',
  'indie rock',
  'punk rock',
  'punk',
  'hard rock',
  'classic rock',
  'progressive rock',
  'prog rock',
  'psychedelic rock',
  'garage rock',
  'grunge',
  'post-rock',
  'post rock',
  'art rock',
  'glam rock',
  'blues rock',
  'southern rock',
  'stoner rock',
  'noise rock',
  'shoegaze',
  'dream pop',
  'britpop',
  'new wave',
  'post-punk',
  'post punk',
  'gothic rock',
  'emo',
  'screamo',
  'pop punk',
  'ska punk',
  'hardcore',
  'hardcore punk',
  'post-hardcore',
  'electronica',
  'edm',
  'house',
  'deep house',
  'tech house',
  'progressive house',
  'techno',
  'trance',
  'psytrance',
  'drum and bass',
  'dnb',
  'dubstep',
  'ambient',
  'idm',
  'downtempo',
  'chillout',
  'trip hop',
  'trip-hop',
  'breakbeat',
  'jungle',
  'garage',
  'uk garage',
  'synthwave',
  'synthpop',
  'synth-pop',
  'electropop',
  'industrial',
  'ebm',
  'darkwave',
  'vaporwave',
  'future bass',
  'lo-fi',
  'lofi',
  'hip hop',
  'rap',
  'trap',
  'gangsta rap',
  'conscious hip hop',
  'underground hip hop',
  'alternative hip hop',
  'boom bap',
  'east coast hip hop',
  'west coast hip hop',
  'southern hip hop',
  'dirty south',
  'crunk',
  'grime',
  'drill',
  'cloud rap',
  'mumble rap',
  'emo rap',
  'indie pop',
  'indie folk',
  'alternative',
  'lo-fi indie',
  'chamber pop',
  'baroque pop',
  'art pop',
  'experimental',
  'avant-garde',
  'math rock',
  'midwest emo',
  'slowcore',
  'sadcore',
  'dance pop',
  'teen pop',
  'power pop',
  'adult contemporary',
  'soft rock',
  'bubblegum pop',
  'k-pop',
  'j-pop',
  'c-pop',
  'latin pop',
  'europop',
  'disco',
  'funk',
  'smooth jazz',
  'acid jazz',
  'jazz fusion',
  'bebop',
  'hard bop',
  'cool jazz',
  'free jazz',
  'modal jazz',
  'swing',
  'big band',
  'latin jazz',
  'bossa nova',
  'nu jazz',
  'heavy metal',
  'thrash metal',
  'death metal',
  'black metal',
  'doom metal',
  'power metal',
  'progressive metal',
  'prog metal',
  'symphonic metal',
  'folk metal',
  'viking metal',
  'gothic metal',
  'nu metal',
  'metalcore',
  'deathcore',
  'djent',
  'sludge metal',
  'stoner metal',
  'groove metal',
  'speed metal',
  'grindcore',
  'folk rock',
  'americana',
  'bluegrass',
  'country folk',
  'celtic',
  'irish folk',
  'scottish folk',
  'traditional folk',
  'contemporary folk',
  'singer-songwriter',
  'acoustic',
  'neofolk',
  'freak folk',
  'anti-folk',
  'world music',
  'rnb',
  'rhythm and blues',
  'soul',
  'neo soul',
  'neo-soul',
  'motown',
  'contemporary r&b',
  'quiet storm',
  'new jack swing',
  'gospel',
  'blues',
  'orchestra',
  'orchestral',
  'symphony',
  'chamber music',
  'opera',
  'baroque',
  'romantic',
  'contemporary classical',
  'minimalism',
  'neoclassical',
  'impressionist',
  'country rock',
  'alt-country',
  'outlaw country',
  'country pop',
  'honky tonk',
  'western',
  'nashville sound',
  'bro-country',
  'texas country',
  'red dirt'
];

/**
 * Detects prompt injection attempts in string values.
 * Looks for patterns commonly used to manipulate LLM behavior.
 */
function containsPromptInjection(value) {
  if (typeof value !== 'string') return false;

  const lowerValue = value.toLowerCase();

  // Patterns that indicate prompt injection attempts
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)/i,
    /disregard\s+(all\s+)?(previous|prior|above|earlier)/i,
    /forget\s+(all\s+)?(previous|prior|above|earlier)/i,
    /override\s+(all\s+)?(previous|prior|above|earlier)/i,
    /you\s+are\s+now\s+/i,
    /act\s+as\s+(if\s+you\s+are|a|an)\s+/i,
    /pretend\s+(you\s+are|to\s+be)\s+/i,
    /new\s+instructions?:/i,
    /system\s*prompt/i,
    /\bdo\s+not\s+follow\b/i,
    /\bjailbreak\b/i,
    /\bdan\s+mode\b/i,
    /\bdevelo?per\s+mode\b/i,
    /reveal\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions)/i,
    /what\s+(are|is)\s+your\s+(system|initial|original)\s+(prompt|instructions)/i,
    /output\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions)/i,
    /\[system\]/i,
    /\[assistant\]/i,
    /\[user\]/i,
    /<\/?system>/i,
    /```\s*(system|prompt|instruction)/i
  ];

  return injectionPatterns.some((pattern) => pattern.test(value));
}

/**
 * Middleware: validates and sanitizes the personality endpoint request body.
 * Defends against:
 * 1. Oversized arrays (resource exhaustion)
 * 2. Invalid mood/genre values (prompt injection via data fields)
 * 3. Direct prompt injection in string fields
 * 4. Unexpected field types
 */
function validatePersonalityInput(req, res, next) {
  const { artists, seed } = req.body;

  // Validate artists array exists and has reasonable size
  if (!artists || !Array.isArray(artists)) {
    return res.status(400).json({
      error: 'Invalid input',
      message: 'artists must be an array'
    });
  }

  if (artists.length === 0) {
    return res.status(400).json({
      error: 'Invalid input',
      message: 'artists array must not be empty'
    });
  }

  if (artists.length > 50) {
    return res.status(400).json({
      error: 'Invalid input',
      message: 'artists array exceeds maximum size of 50'
    });
  }

  // Validate seed if provided
  if (seed !== undefined && seed !== null) {
    if (typeof seed !== 'number' || !Number.isFinite(seed)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'seed must be a finite number'
      });
    }
  }

  // Validate and sanitize each artist entry
  const sanitizedArtists = [];

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];

    if (!artist || typeof artist !== 'object' || Array.isArray(artist)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: `artists[${i}] must be an object`
      });
    }

    const sanitized = {};

    // Validate playcount (must be a positive number)
    if (artist.playcount !== undefined) {
      const playcount = Number(artist.playcount);
      if (!Number.isFinite(playcount) || playcount < 0) {
        return res.status(400).json({
          error: 'Invalid input',
          message: `artists[${i}].playcount must be a non-negative number`
        });
      }
      sanitized.playcount = Math.floor(playcount);
    }

    // Validate mood (must be from allowed list)
    if (artist.mood !== undefined && artist.mood !== null) {
      if (typeof artist.mood !== 'string') {
        return res.status(400).json({
          error: 'Invalid input',
          message: `artists[${i}].mood must be a string`
        });
      }

      const moodLower = artist.mood.toLowerCase().trim();

      // Check for prompt injection in mood field
      if (containsPromptInjection(artist.mood)) {
        return res.status(400).json({
          error: 'Invalid input',
          message: `artists[${i}].mood contains invalid content`
        });
      }

      if (moodLower.length > 30 || !ALLOWED_MOODS.includes(moodLower)) {
        // Don't reject - just skip unknown moods (they'll be ignored by the AI anyway)
        // This is more resilient than rejecting, since new moods could come from TheAudioDB
        sanitized.mood = null;
      } else {
        sanitized.mood = moodLower;
      }
    }

    // Validate genre (must be from allowed list or reasonable string)
    if (artist.genre !== undefined && artist.genre !== null) {
      if (typeof artist.genre !== 'string') {
        return res.status(400).json({
          error: 'Invalid input',
          message: `artists[${i}].genre must be a string`
        });
      }

      const genreLower = artist.genre.toLowerCase().trim();

      // Check for prompt injection in genre field
      if (containsPromptInjection(artist.genre)) {
        return res.status(400).json({
          error: 'Invalid input',
          message: `artists[${i}].genre contains invalid content`
        });
      }

      if (genreLower.length > 50 || !ALLOWED_GENRES.includes(genreLower)) {
        // Skip unknown genres rather than rejecting
        sanitized.genre = null;
      } else {
        sanitized.genre = genreLower;
      }
    }

    // Validate name (optional, used for template fallback only)
    if (artist.name !== undefined && artist.name !== null) {
      if (typeof artist.name !== 'string') {
        return res.status(400).json({
          error: 'Invalid input',
          message: `artists[${i}].name must be a string`
        });
      }

      if (containsPromptInjection(artist.name)) {
        return res.status(400).json({
          error: 'Invalid input',
          message: `artists[${i}].name contains invalid content`
        });
      }

      // Truncate overly long names
      sanitized.name = artist.name.slice(0, 100);
    }

    sanitizedArtists.push(sanitized);
  }

  // Replace the body with sanitized data
  req.body.artists = sanitizedArtists;
  next();
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  createHelmetMiddleware,
  createCorsMiddleware,
  createGlobalRateLimiter,
  createAIRateLimiter,
  inputSanitizer,
  validateParam,
  validateLastfmQuery,
  validateItunesQuery,
  validateMusicbrainzQuery,
  validatePersonalityInput,
  containsPromptInjection,
  isValidUsername,
  isValidMBID,
  isValidDiscogsId,
  isValidLimit,
  isValidSearchTerm,
  JSON_BODY_LIMIT,
  ALLOWED_MOODS,
  ALLOWED_GENRES
};
