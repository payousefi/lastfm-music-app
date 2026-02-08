/**
 * API Routes Aggregator
 * Combines all API route modules with security middleware
 */

const express = require('express');
const { createAIRateLimiter } = require('../../middleware/security');

const router = express.Router();

// Import API route modules
const lastfmRouter = require('./lastfm');
const musicbrainzRouter = require('./musicbrainz');
const discogsRouter = require('./discogs');
const audiodbRouter = require('./audiodb');
const itunesRouter = require('./itunes');
const personalityRouter = require('./personality');

// Mount API routes
router.use('/lastfm', lastfmRouter);
router.use('/musicbrainz', musicbrainzRouter);
router.use('/discogs', discogsRouter);
router.use('/audiodb', audiodbRouter);
router.use('/itunes', itunesRouter);

// Personality endpoint gets stricter rate limiting (AI calls are expensive)
router.use('/personality', createAIRateLimiter(), personalityRouter);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
