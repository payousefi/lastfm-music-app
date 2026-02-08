/**
 * Last.fm API Proxy
 * Proxies requests to Last.fm API, hiding the API key
 */

const express = require('express');
const config = require('../../config');
const {
  validateParam,
  validateLastfmQuery,
  isValidUsername
} = require('../../middleware/security');

const router = express.Router();

/**
 * GET /api/lastfm/user/:username/topartists
 * Get top artists for a user
 */
router.get(
  '/user/:username/topartists',
  validateParam(
    'username',
    isValidUsername,
    'Invalid username. Must be 1-15 alphanumeric characters, hyphens, or underscores.'
  ),
  validateLastfmQuery,
  async (req, res) => {
    try {
      const { username } = req.params;
      const { period = '1month', limit = 12 } = req.query;

      const url = new URL(config.lastfm.baseUrl);
      url.searchParams.set('method', 'user.gettopartists');
      url.searchParams.set('user', username);
      url.searchParams.set('api_key', config.lastfm.apiKey);
      url.searchParams.set('format', 'json');
      url.searchParams.set('period', period);
      url.searchParams.set('limit', limit);

      const response = await fetch(url.toString());
      const data = await response.json();

      res.json(data);
    } catch (error) {
      console.error('Last.fm API error:', error);
      res.status(502).json({ error: 'Failed to fetch from Last.fm API' });
    }
  }
);

/**
 * GET /api/lastfm/user/:username/info
 * Get user info
 */
router.get(
  '/user/:username/info',
  validateParam(
    'username',
    isValidUsername,
    'Invalid username. Must be 1-15 alphanumeric characters, hyphens, or underscores.'
  ),
  async (req, res) => {
    try {
      const { username } = req.params;

      const url = new URL(config.lastfm.baseUrl);
      url.searchParams.set('method', 'user.getinfo');
      url.searchParams.set('user', username);
      url.searchParams.set('api_key', config.lastfm.apiKey);
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString());
      const data = await response.json();

      res.json(data);
    } catch (error) {
      console.error('Last.fm API error:', error);
      res.status(502).json({ error: 'Failed to fetch from Last.fm API' });
    }
  }
);

module.exports = router;
