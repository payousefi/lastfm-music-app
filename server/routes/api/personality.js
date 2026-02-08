/**
 * Personality API
 * Server-side personality headline generation
 * Uses AI (Claude) with fallback to template-based generation
 */

const express = require('express');
const aiPersonality = require('../../services/ai-personality');
const templatePersonality = require('../../services/personality');
const { validatePersonalityInput } = require('../../middleware/security');

const router = express.Router();

/**
 * POST /api/personality
 * Generate personality headline from artist data
 *
 * Request body:
 * - artists: Array of { name, playcount, mood, genre } (name not used for AI)
 * - seed: Optional seed for deterministic template fallback
 *
 * Response:
 * - headline: The generated headline
 * - mood: Dominant mood
 * - genre: Dominant genre
 * - moodCounts: Breakdown of moods
 * - genreCounts: Breakdown of genres
 * - source: 'ai', 'cache', 'template', or 'fallback'
 *
 * Security:
 * - Stricter rate limiting applied at the router level (see api/index.js)
 * - Input validation & prompt injection defense via validatePersonalityInput
 * - Only whitelisted mood/genre values reach the AI prompt
 */
router.post('/', validatePersonalityInput, async (req, res) => {
  try {
    // Note: We intentionally don't accept username - PII-friendly design
    // Only genre/mood data from artists is used for personality generation
    const { artists, seed } = req.body;

    if (!artists || !Array.isArray(artists)) {
      return res.status(400).json({ error: 'Missing or invalid artists array' });
    }

    // Use AI generation with template fallback
    const result = await aiPersonality.generateAIHeadline(
      artists,
      seed,
      templatePersonality.analyzePersonality // Fallback function
    );

    res.json(result);
  } catch (error) {
    console.error('Personality generation error:', error);
    res.status(500).json({ error: 'Failed to generate personality' });
  }
});

module.exports = router;
