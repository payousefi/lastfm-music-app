/**
 * Personality API
 * Server-side personality headline generation
 */

const express = require('express');
const personalityService = require('../../services/personality');

const router = express.Router();

/**
 * POST /api/personality
 * Generate personality headline from artist data
 */
router.post('/', async (req, res) => {
  try {
    const { username, artists, seed } = req.body;

    if (!artists || !Array.isArray(artists)) {
      return res.status(400).json({ error: 'Missing or invalid artists array' });
    }

    const result = personalityService.analyzePersonality(artists, seed);

    res.json(result);
  } catch (error) {
    console.error('Personality generation error:', error);
    res.status(500).json({ error: 'Failed to generate personality' });
  }
});

module.exports = router;
