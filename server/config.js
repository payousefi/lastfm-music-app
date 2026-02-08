/**
 * Server Configuration
 * Loads environment variables and provides defaults
 */

// Load .env file in development
if (process.env.NODE_ENV !== 'production') {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '.env');

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=');
          if (key && value && !process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (err) {
    console.warn('Could not load .env file:', err.message);
  }
}

const config = {
  // Server settings
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Last.fm API
  lastfm: {
    apiKey: process.env.LASTFM_API_KEY || '',
    baseUrl: 'https://ws.audioscrobbler.com/2.0/'
  },

  // Discogs API
  discogs: {
    key: process.env.DISCOGS_KEY || '',
    secret: process.env.DISCOGS_SECRET || '',
    baseUrl: 'https://api.discogs.com'
  },

  // MusicBrainz API
  musicbrainz: {
    baseUrl: 'https://musicbrainz.org/ws/2',
    userAgent: 'MusicApp/1.0.0 (https://music.payamyousefi.com)'
  },

  // TheAudioDB API
  audiodb: {
    baseUrl: 'https://www.theaudiodb.com/api/v1/json/2'
  },

  // iTunes API
  itunes: {
    baseUrl: 'https://itunes.apple.com'
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  },

  // Default app settings
  defaults: {
    username: 'solitude12',
    artistLimit: 12,
    period: '1month'
  }
};

// Validate required config in production
if (config.nodeEnv === 'production') {
  const required = ['LASTFM_API_KEY', 'DISCOGS_KEY', 'DISCOGS_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

module.exports = config;
