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

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('TheAudioDB API error:', error);
      res.status(502).json({ error: 'Failed to fetch from TheAudioDB API' });
    }
  }
);

module.exports = router;
