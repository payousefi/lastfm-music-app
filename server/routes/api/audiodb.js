/**
 * TheAudioDB API Proxy
 * Proxies requests to TheAudioDB API
 */

const express = require('express');
const config = require('../../config');
const { validateParam, isValidMBID } = require('../../middleware/security');

const router = express.Router();

/**
 * GET /api/audiodb/artist/:mbid
 * Get artist data from TheAudioDB by MusicBrainz ID
 */
router.get(
  '/artist/:mbid',
  validateParam('mbid', isValidMBID, 'Invalid MusicBrainz ID. Must be a valid UUID.'),
  async (req, res) => {
    try {
      const { mbid } = req.params;

      const url = `${config.audiodb.baseUrl}/artist-mb.php?i=${mbid}`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        // Forward 429 rate-limit responses so the client can respect retryAfter
        if (response.status === 429) {
          let retryAfter = 60; // default fallback
          try {
            const body = await response.json();
            if (body.retryAfter) {
              retryAfter = body.retryAfter;
            }
          } catch (_) {
            // Use default retryAfter
          }
          // Also check the standard Retry-After header
          const headerRetry = response.headers.get('Retry-After');
          if (headerRetry) {
            retryAfter = parseInt(headerRetry, 10) || retryAfter;
          }
          console.warn(`TheAudioDB rate limited — retryAfter: ${retryAfter}s`);
          return res.status(429).json({
            error: 'Too many requests',
            message: 'TheAudioDB rate limit exceeded. Please try again later.',
            retryAfter
          });
        }

        const text = await response.text().catch(() => '');
        console.error(`TheAudioDB API returned ${response.status}: ${text.substring(0, 200)}`);
        return res.status(502).json({ error: `TheAudioDB API returned ${response.status}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('TheAudioDB API error:', error);
      res.status(502).json({ error: 'Failed to fetch from TheAudioDB API' });
    }
  }
);

module.exports = router;
