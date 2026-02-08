/**
 * Discogs API Proxy
 * Proxies requests to Discogs API, hiding API credentials
 */

const express = require('express');
const config = require('../../config');
const { validateParam, isValidDiscogsId } = require('../../middleware/security');

const router = express.Router();

/**
 * GET /api/discogs/artist/:id
 * Get artist data from Discogs
 */
router.get(
  '/artist/:id',
  validateParam('id', isValidDiscogsId, 'Invalid Discogs ID. Must be a numeric value.'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const url = `${config.discogs.baseUrl}/artists/${id}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Discogs key=${config.discogs.key}, secret=${config.discogs.secret}`,
          'User-Agent': 'MusicApp/1.0.0 (+https://music.payamyousefi.com)'
        }
      });

      // Forward rate limit headers to client
      const remaining = response.headers.get('X-Discogs-Ratelimit-Remaining');
      if (remaining) {
        res.set('X-Discogs-Ratelimit-Remaining', remaining);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Discogs API error:', error);
      res.status(502).json({ error: 'Failed to fetch from Discogs API' });
    }
  }
);

module.exports = router;
