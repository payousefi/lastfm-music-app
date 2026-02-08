/**
 * iTunes API Proxy
 * Replaces the PHP proxy - routes iTunes API calls to avoid CORS issues
 */

const express = require('express');
const config = require('../../config');

const router = express.Router();

/**
 * GET /api/itunes/search
 * Search iTunes API
 */
router.get('/search', async (req, res) => {
  try {
    const { term, entity, limit } = req.query;

    if (!term) {
      return res.status(400).json({ error: 'Missing term parameter' });
    }

    const url = new URL(`${config.itunes.baseUrl}/search`);
    url.searchParams.set('term', term);
    if (entity) url.searchParams.set('entity', entity);
    if (limit) url.searchParams.set('limit', limit);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json'
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('iTunes API error:', error);
    res.status(502).json({ error: 'Failed to fetch from iTunes API' });
  }
});

/**
 * GET /api/itunes/lookup
 * Lookup iTunes API by ID
 */
router.get('/lookup', async (req, res) => {
  try {
    const { id, entity, limit } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    const url = new URL(`${config.itunes.baseUrl}/lookup`);
    url.searchParams.set('id', id);
    if (entity) url.searchParams.set('entity', entity);
    if (limit) url.searchParams.set('limit', limit);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json'
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('iTunes API error:', error);
    res.status(502).json({ error: 'Failed to fetch from iTunes API' });
  }
});

module.exports = router;
