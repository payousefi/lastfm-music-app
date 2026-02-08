/**
 * MusicBrainz API Proxy
 * Proxies requests to MusicBrainz API with proper rate limiting
 */

const express = require('express');
const config = require('../../config');
const {
  validateParam,
  validateMusicbrainzQuery,
  isValidMBID
} = require('../../middleware/security');

const router = express.Router();

/**
 * GET /api/musicbrainz/artist
 * Search for an artist by name
 */
router.get('/artist', validateMusicbrainzQuery, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter' });
    }

    const url = new URL(`${config.musicbrainz.baseUrl}/artist`);
    url.searchParams.set('query', `artist:${query}`);
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': config.musicbrainz.userAgent,
        Accept: 'application/json'
      }
    });

    // Forward rate limit headers to client
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining) {
      res.set('X-RateLimit-Remaining', remaining);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('MusicBrainz API error:', error);
    res.status(502).json({ error: 'Failed to fetch from MusicBrainz API' });
  }
});

/**
 * GET /api/musicbrainz/artist/:mbid
 * Get artist by MBID with relations (for Discogs ID)
 */
router.get(
  '/artist/:mbid',
  validateParam('mbid', isValidMBID, 'Invalid MusicBrainz ID. Must be a valid UUID.'),
  async (req, res) => {
    try {
      const { mbid } = req.params;

      const url = new URL(`${config.musicbrainz.baseUrl}/artist/${mbid}`);
      url.searchParams.set('fmt', 'json');
      url.searchParams.set('inc', 'url-rels');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': config.musicbrainz.userAgent,
          Accept: 'application/json'
        }
      });

      // Forward rate limit headers to client
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining) {
        res.set('X-RateLimit-Remaining', remaining);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('MusicBrainz API error:', error);
      res.status(502).json({ error: 'Failed to fetch from MusicBrainz API' });
    }
  }
);

module.exports = router;
