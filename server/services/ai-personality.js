/**
 * AI-Powered Personality Headline Generation
 * Uses Claude 3.5 Haiku to generate creative, contextual headlines
 * Falls back to template-based generation if AI is unavailable
 */

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

// In-memory cache for headlines (keyed by mood+genre hash)
const headlineCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a cache key from mood and genre profile
 * PII-friendly: no usernames or artist names in the key
 */
function generateCacheKey(moodProfile, genreProfile) {
  // Create a deterministic key from the profile
  const moodKey = Object.entries(moodProfile)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${Math.round(v * 100)}`)
    .join('|');

  const genreKey = Object.entries(genreProfile)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${Math.round(v * 100)}`)
    .join('|');

  return `${moodKey}::${genreKey}`;
}

/**
 * Build the prompt for Claude
 * Only uses mood/genre percentages - no PII, no artist names
 */
function buildPrompt(moodProfile, genreProfile) {
  // Format mood breakdown
  const moodBreakdown = Object.entries(moodProfile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([mood, pct]) => `${Math.round(pct * 100)}% ${mood}`)
    .join(', ');

  // Format genre breakdown
  const genreBreakdown = Object.entries(genreProfile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([genre, pct]) => `${Math.round(pct * 100)}% ${genre}`)
    .join(', ');

  return `Generate a short, creative music personality headline (3-5 words, max 35 characters) for someone with this listening profile:

Mood breakdown: ${moodBreakdown}
Genre breakdown: ${genreBreakdown}

The headline should:
- Be evocative, almost magic, and poetic, not generic, but still natural
- Can be any style: noun phrase, metaphorical, mood-first, or creative, but should still be understandable and not too cryptic
- Capture the essence of their musical taste
- Be memorable and shareable
- MUST be 35 characters or fewer

Return ONLY the headline text, nothing else. No quotes, no explanation.`;
}

/**
 * Generate headline using Claude AI
 */
async function generateWithAI(moodProfile, genreProfile) {
  if (!config.anthropic.apiKey) {
    return null; // No API key, skip AI generation
  }

  try {
    const client = new Anthropic({
      apiKey: config.anthropic.apiKey
    });

    const message = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: buildPrompt(moodProfile, genreProfile)
        }
      ]
    });

    // Extract the text from the response
    const headline = message.content[0]?.text?.trim();

    if (headline && headline.length > 0 && headline.length < 100) {
      return headline;
    }

    return null;
  } catch (error) {
    console.error('AI headline generation failed:', error.message);
    return null;
  }
}

/**
 * Calculate mood and genre profiles from artist data
 * Returns normalized percentages (0-1)
 */
function calculateProfiles(artists) {
  const moodCounts = {};
  const genreCounts = {};
  let totalPlaycount = 0;

  for (const artist of artists) {
    const playcount = artist.playcount || 1;
    totalPlaycount += playcount;

    // Count moods
    if (artist.mood) {
      moodCounts[artist.mood] = (moodCounts[artist.mood] || 0) + playcount;
    }

    // Count genres
    if (artist.genre) {
      genreCounts[artist.genre] = (genreCounts[artist.genre] || 0) + playcount;
    }
  }

  // Normalize to percentages
  const moodProfile = {};
  for (const [mood, count] of Object.entries(moodCounts)) {
    moodProfile[mood] = count / totalPlaycount;
  }

  const genreProfile = {};
  for (const [genre, count] of Object.entries(genreCounts)) {
    genreProfile[genre] = count / totalPlaycount;
  }

  return { moodProfile, genreProfile, moodCounts, genreCounts };
}

/**
 * Get dominant mood and genre from profiles
 */
function getDominant(profile) {
  let dominant = null;
  let maxValue = 0;

  for (const [key, value] of Object.entries(profile)) {
    if (value > maxValue) {
      maxValue = value;
      dominant = key;
    }
  }

  return dominant || 'eclectic';
}

/**
 * Main function: Generate AI-powered personality headline
 * Falls back to template-based generation if AI fails
 */
async function generateAIHeadline(artists, seed, templateFallback) {
  // Calculate profiles from artist data
  const { moodProfile, genreProfile, moodCounts, genreCounts } = calculateProfiles(artists);

  const dominantMood = getDominant(moodProfile);
  const dominantGenre = getDominant(genreProfile);

  // Check cache first
  const cacheKey = generateCacheKey(moodProfile, genreProfile);
  const cached = headlineCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      headline: cached.headline,
      mood: dominantMood,
      genre: dominantGenre,
      moodCounts,
      genreCounts,
      source: 'cache'
    };
  }

  // Try AI generation
  const aiHeadline = await generateWithAI(moodProfile, genreProfile);

  if (aiHeadline) {
    // Cache the result
    headlineCache.set(cacheKey, {
      headline: aiHeadline,
      timestamp: Date.now()
    });

    return {
      headline: aiHeadline,
      mood: dominantMood,
      genre: dominantGenre,
      moodCounts,
      genreCounts,
      source: 'ai'
    };
  }

  // Fallback to template-based generation
  if (templateFallback) {
    const templateResult = templateFallback(artists, seed);
    return {
      ...templateResult,
      source: 'template'
    };
  }

  // Ultimate fallback
  return {
    headline: 'A Musical Soul',
    mood: dominantMood,
    genre: dominantGenre,
    moodCounts,
    genreCounts,
    source: 'fallback'
  };
}

module.exports = {
  generateAIHeadline,
  calculateProfiles,
  generateCacheKey
};
