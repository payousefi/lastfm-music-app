/**
 * Music Personality Headlines - Dynamic Generation System
 *
 * Generates descriptive/poetic headlines at runtime by combining:
 * - Mood descriptors (explicit mood naming)
 * - Genre terms (mix of generic and specific)
 * - Imagery (nature/elemental, abstract/emotional, character/archetype)
 * - Templates for varied lengths (2-7 words)
 */

// ═══════════════════════════════════════════════════════════════════════════
// MOOD DESCRIPTORS - Accessible/clear but elevated, with evocative sprinkles
// ═══════════════════════════════════════════════════════════════════════════
const MOOD_DESCRIPTORS = {
  happy: [
    // Clear/accessible
    'Joyful',
    'Bright',
    'Warm',
    'Uplifted',
    'Hopeful',
    'Cheerful',
    'Lighthearted',
    'Content',
    // Elevated
    'Radiant',
    'Blissful',
    'Elated',
    'Euphoric',
    'Exuberant',
    'Jubilant',
    // Evocative sprinkle
    'Sunlit',
    'Golden'
  ],
  sad: [
    // Clear/accessible
    'Sad',
    'Lonely',
    'Heartbroken',
    'Blue',
    'Grieving',
    'Hurt',
    'Lost',
    'Aching',
    // Elevated
    'Melancholic',
    'Wistful',
    'Pensive',
    'Bittersweet',
    'Longing',
    'Tender',
    // Evocative sprinkle
    'Rainy',
    'Faded'
  ],
  angry: [
    // Clear/accessible
    'Angry',
    'Fierce',
    'Defiant',
    'Rebellious',
    'Bold',
    'Intense',
    'Raw',
    'Untamed',
    // Elevated
    'Furious',
    'Raging',
    'Unrelenting',
    'Unyielding',
    'Ferocious',
    'Fiery',
    // Evocative sprinkle
    'Stormy',
    'Burning'
  ],
  relaxed: [
    // Clear/accessible
    'Calm',
    'Peaceful',
    'Mellow',
    'Easy',
    'Gentle',
    'Quiet',
    'Still',
    'Soft',
    // Elevated
    'Serene',
    'Tranquil',
    'Soothing',
    'Placid',
    'Unhurried',
    'Graceful',
    // Evocative sprinkle
    'Moonlit',
    'Drifting'
  ],
  energetic: [
    // Clear/accessible
    'Restless',
    'Driven',
    'Alive',
    'Charged',
    'Fired Up',
    'Eager',
    'Tireless',
    'Unstoppable',
    // Elevated
    'Kinetic',
    'Vibrant',
    'Electric',
    'Pulsing',
    'Relentless',
    'Dynamic',
    // Evocative sprinkle
    'Blazing',
    'Surging'
  ],
  dark: [
    // Clear/accessible
    'Dark',
    'Moody',
    'Brooding',
    'Haunted',
    'Somber',
    'Heavy',
    'Deep',
    'Intense',
    // Elevated
    'Nocturnal',
    'Shadowed',
    'Cryptic',
    'Mysterious',
    'Obscure',
    'Veiled',
    // Evocative sprinkle
    'Midnight',
    'Twilight'
  ]
};

// Mood-specific nouns for templates
const MOOD_NOUNS = {
  happy: ['Joy', 'Light', 'Warmth', 'Hope', 'Bliss', 'Sunshine', 'Radiance', 'Delight'],
  sad: ['Sorrow', 'Longing', 'Heartache', 'Melancholy', 'Rain', 'Tears', 'Loss', 'Ache'],
  angry: ['Fury', 'Fire', 'Rage', 'Defiance', 'Rebellion', 'Storm', 'Thunder', 'Heat'],
  relaxed: ['Peace', 'Calm', 'Stillness', 'Serenity', 'Quiet', 'Ease', 'Drift', 'Flow'],
  energetic: ['Energy', 'Motion', 'Drive', 'Pulse', 'Rush', 'Fire', 'Spark', 'Force'],
  dark: ['Darkness', 'Shadow', 'Night', 'Mystery', 'Depth', 'Void', 'Dusk', 'Gloom']
};

// ═══════════════════════════════════════════════════════════════════════════
// GENRE TERMS - Mix of generic and specific references
// ═══════════════════════════════════════════════════════════════════════════
const GENRE_TERMS = {
  rock: {
    generic: ['Rock', 'Guitar', 'Riff'],
    specific: ['Classic Rock', 'Arena Rock', 'Power Chord', 'Stadium Rock', 'Blues Rock']
  },
  electronic: {
    generic: ['Electronic', 'Synth', 'Beat'],
    specific: ['House', 'Techno', 'Ambient', 'Synthwave', 'IDM', 'Drum & Bass']
  },
  'hip-hop': {
    generic: ['Hip-Hop', 'Rap', 'Rhythm'],
    specific: ['Boom Bap', 'Golden Era', 'Conscious Rap', 'Lo-Fi Hip-Hop', 'East Coast']
  },
  indie: {
    generic: ['Indie', 'Alternative', 'Underground'],
    specific: ['Shoegaze', 'Dream Pop', 'Post-Punk', 'Jangle Pop', 'Lo-Fi Indie']
  },
  pop: {
    generic: ['Pop', 'Melody', 'Hook'],
    specific: ['Synth-Pop', 'Art Pop', 'Chamber Pop', 'Baroque Pop', 'Sophisti-Pop']
  },
  jazz: {
    generic: ['Jazz', 'Swing', 'Improvisation'],
    specific: ['Bebop', 'Cool Jazz', 'Modal Jazz', 'Blue Note', 'Hard Bop', 'Free Jazz']
  },
  metal: {
    generic: ['Metal', 'Heavy', 'Riff'],
    specific: ['Thrash', 'Doom', 'Black Metal', 'Death Metal', 'Progressive Metal', 'Sludge']
  },
  folk: {
    generic: ['Folk', 'Acoustic', 'Roots'],
    specific: ['Americana', 'Bluegrass', 'Celtic', 'Traditional', 'Singer-Songwriter']
  },
  'r&b': {
    generic: ['R&B', 'Soul', 'Groove'],
    specific: ['Neo-Soul', 'Motown', 'Quiet Storm', 'New Jack Swing', 'Philly Soul']
  },
  classical: {
    generic: ['Classical', 'Orchestral', 'Symphony'],
    specific: ['Romantic Era', 'Baroque', 'Chamber Music', 'Impressionist', 'Minimalist']
  },
  country: {
    generic: ['Country', 'Twang', 'Nashville'],
    specific: ['Outlaw Country', 'Honky-Tonk', 'Americana', 'Bluegrass', 'Western Swing']
  },
  eclectic: {
    generic: ['Musical', 'Sonic', 'Sound'],
    specific: ['Genre-Fluid', 'Boundary-Crossing', 'Avant-Garde', 'Experimental', 'Fusion']
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CHARACTER ARCHETYPES - Mix of romantic, adventurer, intellectual
// ═══════════════════════════════════════════════════════════════════════════
const CHARACTERS = [
  // Romantic/artistic
  'Soul',
  'Heart',
  'Spirit',
  'Dreamer',
  'Poet',
  'Romantic',
  'Artist',
  'Muse',
  'Visionary',
  'Idealist',
  // Adventurer/seeker
  'Wanderer',
  'Voyager',
  'Explorer',
  'Pilgrim',
  'Nomad',
  'Seeker',
  'Traveler',
  'Drifter',
  'Rover',
  // Intellectual/philosophical
  'Philosopher',
  'Architect',
  'Scholar',
  'Chronicler',
  'Mystic',
  'Thinker',
  'Observer',
  'Curator',
  // Rebel/outsider
  'Rebel',
  'Outsider',
  'Maverick',
  'Loner',
  'Outcast'
];

// ═══════════════════════════════════════════════════════════════════════════
// HEADLINE TEMPLATES - Patterns for generating varied lengths
// Third person focus (describing them, not addressing them)
//
// genreAsAdjective: true = genre is used before a noun (e.g., "{genre} Heart")
//   - Only works with simple single-word genres like "Rock", "Jazz"
//   - Awkward with multi-word genres: "Avant-Garde Heart", "Drum & Bass Soul"
// genreAsAdjective: false = genre is used as a noun (at end or after preposition)
//   - Works with any genre: "Lost in Avant-Garde", "Shaped by Drum & Bass"
// ═══════════════════════════════════════════════════════════════════════════
const TEMPLATES = {
  // Short templates (2-4 words)
  short: [
    // Genre as ADJECTIVE (before noun) - only for simple genres
    { template: '{mood} {genre} {character}', genreAsAdjective: true }, // "Melancholic Jazz Poet"
    { template: '{mood} {genre} Soul', genreAsAdjective: true }, // "Joyful Rock Soul"
    { template: '{genre} {character}', genreAsAdjective: true }, // "Synth Dreamer"
    { template: '{genre} Heart', genreAsAdjective: true }, // "Folk Heart"
    { template: 'Born {genre} {character}', genreAsAdjective: true }, // "Born Rock Spirit"
    { template: 'True {genre} {character}', genreAsAdjective: true }, // "True Jazz Soul"
    { template: 'The {genre} {character}', genreAsAdjective: true }, // "The Jazz Philosopher"
    { template: 'A {genre} {character}', genreAsAdjective: true }, // "A Folk Dreamer"
    // Genre as NOUN (at end or standalone) - works with any genre
    { template: 'The {mood} {character}', genreAsAdjective: false }, // "The Brooding Wanderer"
    { template: '{mood} {character}', genreAsAdjective: false }, // "Wistful Dreamer"
    { template: 'A {mood} {character}', genreAsAdjective: false }, // "A Lonely Wanderer"
    { template: '{mood} to the Core', genreAsAdjective: false }, // "Melancholic to the Core"
    { template: '{mood} and {genre}', genreAsAdjective: false }, // "Restless and Electronic"
    { template: 'Forever {genre}', genreAsAdjective: false }, // "Forever Jazz" / "Forever Avant-Garde"
    { template: 'Deeply {genre}', genreAsAdjective: false }, // "Deeply Folk" / "Deeply Avant-Garde"
    { template: '{genre} at Heart', genreAsAdjective: false } // "Rock at Heart" / "Avant-Garde at Heart"
  ],
  // Medium templates (4-7 words)
  medium: [
    // Genre as ADJECTIVE (before noun) - only for simple genres
    { template: 'A {mood} {genre} {character} at Heart', genreAsAdjective: true }, // "A Melancholic Jazz Poet at Heart"
    { template: '{character} of the {mood} {genre} Sound', genreAsAdjective: true }, // "Wanderer of the Brooding Metal Sound"
    { template: 'The {mood} {genre} {character}', genreAsAdjective: true }, // "The Restless Electronic Voyager"
    { template: 'The Enduring {genre} {character}', genreAsAdjective: true }, // "The Enduring Rock Soul"
    { template: 'Devoted {genre} {character}', genreAsAdjective: true }, // "Devoted Jazz Soul"
    { template: 'A True {genre} {character}', genreAsAdjective: true }, // "A True Folk Romantic"
    { template: 'Born a {mood} {genre} {character}', genreAsAdjective: true }, // "Born a Restless Rock Rebel"
    { template: '{genre} Flows Through This {character}', genreAsAdjective: true }, // "Jazz Flows Through This Soul"
    { template: '{mood} {genre} Through and Through', genreAsAdjective: true }, // "Joyful Pop Through and Through"
    // Genre as NOUN (at end or after preposition) - works with any genre
    { template: 'A {character} Drawn to {mood} {genre}', genreAsAdjective: false }, // "A Seeker Drawn to Melancholic Folk"
    { template: 'Where {moodNoun} Meets {genre}', genreAsAdjective: false }, // "Where Sorrow Meets Jazz"
    { template: 'The {mood} {character} of {genre}', genreAsAdjective: false }, // "The Restless Voyager of Electronic"
    { template: 'A {mood} {character} in a {genre} World', genreAsAdjective: false }, // "A Tender Soul in a Folk World"
    { template: 'Living for {mood} {genre}', genreAsAdjective: false }, // "Living for Melancholic Jazz"
    { template: 'Lost in {mood} {genre}', genreAsAdjective: false }, // "Lost in Dark Electronic"
    { template: 'The {character} Who Found {genre}', genreAsAdjective: false }, // "The Wanderer Who Found Jazz"
    { template: 'A {character} Shaped by {genre}', genreAsAdjective: false }, // "A Soul Shaped by Folk"
    { template: 'Defined by {mood} {genre}', genreAsAdjective: false }, // "Defined by Melancholic Jazz"
    { template: 'The {mood} Side of {genre}', genreAsAdjective: false }, // "The Dark Side of Electronic"
    { template: 'A {character} at Home in {genre}', genreAsAdjective: false }, // "A Dreamer at Home in Indie"
    { template: 'Rooted in {mood} {genre}', genreAsAdjective: false } // "Rooted in Peaceful Folk"
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// All functions accept an optional randomFn for deterministic generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fix "a/an" grammar in a headline.
 * Converts "A [vowel]..." to "An [vowel]..." and "a [vowel]..." to "an [vowel]..."
 * Handles edge cases like "A Unique" (sounds like consonant) staying as "A"
 */
function fixArticleGrammar(headline) {
  // Words that start with a vowel letter but sound like a consonant (use "a")
  const consonantSoundingVowels = [
    'unique',
    'universal',
    'university',
    'unicorn',
    'uniform',
    'union',
    'united',
    'unity',
    'use',
    'used',
    'useful',
    'user',
    'usual',
    'usually',
    'utopia',
    'euphoric',
    'euphoria',
    'european',
    'one',
    'once'
  ];

  // Words that start with a consonant letter but sound like a vowel (use "an")
  const vowelSoundingConsonants = ['honest', 'honor', 'honour', 'hour', 'heir'];

  // Pattern to match "A " or "a " at word boundaries followed by a word
  // This handles start of string and after spaces
  return headline.replace(/\b(A|a)\s+(\w+)/g, (match, article, nextWord) => {
    const nextWordLower = nextWord.toLowerCase();
    const firstLetter = nextWordLower[0];
    const isVowel = 'aeiou'.includes(firstLetter);

    // Check for consonant-sounding vowel words (keep "a")
    if (isVowel && consonantSoundingVowels.some((w) => nextWordLower.startsWith(w))) {
      return match; // Keep as-is
    }

    // Check for vowel-sounding consonant words (use "an")
    if (!isVowel && vowelSoundingConsonants.some((w) => nextWordLower.startsWith(w))) {
      return article === 'A' ? `An ${nextWord}` : `an ${nextWord}`;
    }

    // Standard rule: vowels get "an", consonants get "a"
    if (isVowel) {
      return article === 'A' ? `An ${nextWord}` : `an ${nextWord}`;
    }

    return match; // Keep as-is for consonants
  });
}

function randomFrom(array, randomFn) {
  const rand = randomFn || Math.random;
  return array[Math.floor(rand() * array.length)];
}

function getGenreTerm(genre, randomFn, preferSpecific = null) {
  const rand = randomFn || Math.random;
  const terms = GENRE_TERMS[genre] || GENRE_TERMS.eclectic;
  // If not specified, randomly choose generic vs specific (50/50)
  const useSpecific = preferSpecific !== null ? preferSpecific : rand() > 0.5;
  return useSpecific ? randomFrom(terms.specific, randomFn) : randomFrom(terms.generic, randomFn);
}

function getMoodDescriptor(mood, randomFn) {
  const descriptors = MOOD_DESCRIPTORS[mood] || MOOD_DESCRIPTORS.happy;
  return randomFrom(descriptors, randomFn);
}

function getMoodNoun(mood, randomFn) {
  const nouns = MOOD_NOUNS[mood] || MOOD_NOUNS.happy;
  return randomFrom(nouns, randomFn);
}

function getCharacter(randomFn) {
  return randomFrom(CHARACTERS, randomFn);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HEADLINE GENERATOR
// Accepts optional randomFn for deterministic generation (seeded random)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a genre term is "simple" (single word, no special characters)
 * Simple genres work with all templates; complex ones need filtering
 */
function isSimpleGenre(genreWord) {
  // Simple if it's a single word with no spaces, hyphens, or ampersands
  return !genreWord.includes(' ') && !genreWord.includes('&') && !genreWord.includes('-');
}

function generateHeadline(mood, genre, randomFn) {
  const rand = randomFn || Math.random;

  // Get genre word first so we can filter templates appropriately
  const genreWord = getGenreTerm(genre, randomFn);
  const genreIsSimple = isSimpleGenre(genreWord);

  // Randomly choose short or medium length (roughly 50/50)
  const useShort = rand() > 0.5;
  const allTemplates = useShort ? TEMPLATES.short : TEMPLATES.medium;

  // Filter templates based on genre complexity
  // Complex genres (multi-word like "Avant-Garde", "Drum & Bass") can only use
  // templates where genre is used as a NOUN (at end or after preposition),
  // not as an ADJECTIVE (before another noun like "Heart" or "Soul")
  const availableTemplates = genreIsSimple
    ? allTemplates
    : allTemplates.filter((t) => !t.genreAsAdjective);

  const templateObj = randomFrom(availableTemplates, randomFn);
  const template = templateObj.template;

  // Get other components
  const moodWord = getMoodDescriptor(mood, randomFn);
  const moodNoun = getMoodNoun(mood, randomFn);
  const character = getCharacter(randomFn);

  // Replace placeholders
  let headline = template
    .replace(/{mood}/g, moodWord)
    .replace(/{moodNoun}/g, moodNoun)
    .replace(/{genre}/g, genreWord)
    .replace(/{character}/g, character);

  // Fix "a/an" grammar (e.g., "A Intense Heart" -> "An Intense Heart")
  headline = fixArticleGrammar(headline);

  return headline;
}

// Generate a headline with fallback
function getPersonalityHeadline(mood, genre, randomFn) {
  // Normalize inputs
  const normalizedMood = mood && MOOD_DESCRIPTORS[mood] ? mood : 'relaxed';
  const normalizedGenre = genre && GENRE_TERMS[genre] ? genre : 'eclectic';

  return generateHeadline(normalizedMood, normalizedGenre, randomFn);
}

// ═══════════════════════════════════════════════════════════════════════════
// GENRE FAMILY MAPPING - Maps specific genres to family categories
// ═══════════════════════════════════════════════════════════════════════════
const GENRE_FAMILY_MAP = {
  // Rock family
  rock: 'rock',
  'alternative rock': 'rock',
  'indie rock': 'indie',
  'punk rock': 'rock',
  punk: 'rock',
  'hard rock': 'rock',
  'classic rock': 'rock',
  'progressive rock': 'rock',
  'prog rock': 'rock',
  'psychedelic rock': 'rock',
  'garage rock': 'rock',
  grunge: 'rock',
  'post-rock': 'rock',
  'post rock': 'rock',
  'art rock': 'rock',
  'glam rock': 'rock',
  'blues rock': 'rock',
  'southern rock': 'rock',
  'stoner rock': 'rock',
  'noise rock': 'indie',
  shoegaze: 'indie',
  'dream pop': 'indie',
  britpop: 'rock',
  'new wave': 'rock',
  'post-punk': 'indie',
  'post punk': 'indie',
  'gothic rock': 'rock',
  emo: 'rock',
  screamo: 'rock',
  'pop punk': 'rock',
  'ska punk': 'rock',
  hardcore: 'rock',
  'hardcore punk': 'rock',
  'post-hardcore': 'rock',

  // Electronic family
  electronic: 'electronic',
  electronica: 'electronic',
  edm: 'electronic',
  house: 'electronic',
  'deep house': 'electronic',
  'tech house': 'electronic',
  'progressive house': 'electronic',
  techno: 'electronic',
  trance: 'electronic',
  psytrance: 'electronic',
  'drum and bass': 'electronic',
  dnb: 'electronic',
  dubstep: 'electronic',
  ambient: 'electronic',
  idm: 'electronic',
  downtempo: 'electronic',
  chillout: 'electronic',
  'trip hop': 'electronic',
  'trip-hop': 'electronic',
  breakbeat: 'electronic',
  jungle: 'electronic',
  garage: 'electronic',
  'uk garage': 'electronic',
  synthwave: 'electronic',
  synthpop: 'electronic',
  'synth-pop': 'electronic',
  electropop: 'electronic',
  industrial: 'electronic',
  ebm: 'electronic',
  darkwave: 'electronic',
  vaporwave: 'electronic',
  'future bass': 'electronic',
  'lo-fi': 'electronic',
  lofi: 'electronic',

  // Hip-hop family
  'hip hop': 'hip-hop',
  'hip-hop': 'hip-hop',
  rap: 'hip-hop',
  trap: 'hip-hop',
  'gangsta rap': 'hip-hop',
  'conscious hip hop': 'hip-hop',
  'underground hip hop': 'hip-hop',
  'alternative hip hop': 'hip-hop',
  'boom bap': 'hip-hop',
  'east coast hip hop': 'hip-hop',
  'west coast hip hop': 'hip-hop',
  'southern hip hop': 'hip-hop',
  'dirty south': 'hip-hop',
  crunk: 'hip-hop',
  grime: 'hip-hop',
  drill: 'hip-hop',
  'cloud rap': 'hip-hop',
  'mumble rap': 'hip-hop',
  'emo rap': 'hip-hop',

  // Indie/Alternative family
  indie: 'indie',
  'indie pop': 'indie',
  'indie folk': 'folk',
  alternative: 'indie',
  'lo-fi indie': 'indie',
  'chamber pop': 'indie',
  'baroque pop': 'indie',
  'art pop': 'indie',
  experimental: 'indie',
  'avant-garde': 'indie',
  'math rock': 'indie',
  'midwest emo': 'indie',
  slowcore: 'indie',
  sadcore: 'indie',

  // Pop family
  pop: 'pop',
  'dance pop': 'pop',
  'teen pop': 'pop',
  'power pop': 'pop',
  'adult contemporary': 'pop',
  'soft rock': 'pop',
  'bubblegum pop': 'pop',
  'k-pop': 'pop',
  'j-pop': 'pop',
  'c-pop': 'pop',
  'latin pop': 'pop',
  europop: 'pop',
  disco: 'pop',
  funk: 'r&b',

  // Jazz family
  jazz: 'jazz',
  'smooth jazz': 'jazz',
  'acid jazz': 'jazz',
  'jazz fusion': 'jazz',
  bebop: 'jazz',
  'hard bop': 'jazz',
  'cool jazz': 'jazz',
  'free jazz': 'jazz',
  'modal jazz': 'jazz',
  swing: 'jazz',
  'big band': 'jazz',
  'latin jazz': 'jazz',
  'bossa nova': 'jazz',
  'nu jazz': 'jazz',

  // Metal family
  metal: 'metal',
  'heavy metal': 'metal',
  'thrash metal': 'metal',
  'death metal': 'metal',
  'black metal': 'metal',
  'doom metal': 'metal',
  'power metal': 'metal',
  'progressive metal': 'metal',
  'prog metal': 'metal',
  'symphonic metal': 'metal',
  'folk metal': 'metal',
  'viking metal': 'metal',
  'gothic metal': 'metal',
  'nu metal': 'metal',
  metalcore: 'metal',
  deathcore: 'metal',
  djent: 'metal',
  'sludge metal': 'metal',
  'stoner metal': 'metal',
  'groove metal': 'metal',
  'speed metal': 'metal',
  grindcore: 'metal',

  // Folk family
  folk: 'folk',
  'folk rock': 'folk',
  americana: 'folk',
  bluegrass: 'folk',
  'country folk': 'folk',
  celtic: 'folk',
  'irish folk': 'folk',
  'scottish folk': 'folk',
  'traditional folk': 'folk',
  'contemporary folk': 'folk',
  'singer-songwriter': 'folk',
  acoustic: 'folk',
  neofolk: 'folk',
  'freak folk': 'folk',
  'anti-folk': 'folk',
  'world music': 'folk',

  // R&B/Soul family
  'r&b': 'r&b',
  rnb: 'r&b',
  'rhythm and blues': 'r&b',
  soul: 'r&b',
  'neo soul': 'r&b',
  'neo-soul': 'r&b',
  motown: 'r&b',
  'contemporary r&b': 'r&b',
  'quiet storm': 'r&b',
  'new jack swing': 'r&b',
  gospel: 'r&b',
  blues: 'r&b',

  // Classical family
  classical: 'classical',
  orchestra: 'classical',
  orchestral: 'classical',
  symphony: 'classical',
  'chamber music': 'classical',
  opera: 'classical',
  baroque: 'classical',
  romantic: 'classical',
  'contemporary classical': 'classical',
  minimalism: 'classical',
  neoclassical: 'classical',
  impressionist: 'classical',

  // Country family
  country: 'country',
  'country rock': 'country',
  'alt-country': 'country',
  'outlaw country': 'country',
  'country pop': 'country',
  'honky tonk': 'country',
  western: 'country',
  'nashville sound': 'country',
  'bro-country': 'country',
  'texas country': 'country',
  'red dirt': 'country'
};

// ═══════════════════════════════════════════════════════════════════════════
// MOOD MAPPING - Maps TheAudioDB mood strings to our 6 normalized categories
// Categories: happy, sad, angry, relaxed, energetic, dark
// ═══════════════════════════════════════════════════════════════════════════
const MOOD_MAP = {
  // Happy family
  happy: 'happy',
  joyful: 'happy',
  cheerful: 'happy',
  uplifting: 'happy',
  upbeat: 'happy',
  euphoric: 'happy',
  elated: 'happy',
  optimistic: 'happy',
  playful: 'happy',
  fun: 'happy',
  celebratory: 'happy',
  triumphant: 'happy',
  bright: 'happy',
  sunny: 'happy',
  positive: 'happy',
  exuberant: 'happy',
  gleeful: 'happy',
  blissful: 'happy',

  // Sad family
  sad: 'sad',
  melancholic: 'sad',
  melancholy: 'sad',
  sorrowful: 'sad',
  mournful: 'sad',
  heartbroken: 'sad',
  lonely: 'sad',
  longing: 'sad',
  wistful: 'sad',
  bittersweet: 'sad',
  nostalgic: 'sad',
  reflective: 'sad',
  yearning: 'sad',
  grieving: 'sad',
  depressed: 'sad',
  blue: 'sad',
  pensive: 'sad',
  tender: 'sad',

  // Angry family
  angry: 'angry',
  aggressive: 'angry',
  intense: 'angry',
  fierce: 'angry',
  furious: 'angry',
  rebellious: 'angry',
  defiant: 'angry',
  confrontational: 'angry',
  hostile: 'angry',
  violent: 'angry',
  rage: 'angry',
  raging: 'angry',
  hateful: 'angry',
  bitter: 'angry',
  raw: 'angry',
  brutal: 'angry',

  // Relaxed family
  relaxed: 'relaxed',
  calm: 'relaxed',
  peaceful: 'relaxed',
  serene: 'relaxed',
  tranquil: 'relaxed',
  mellow: 'relaxed',
  soothing: 'relaxed',
  gentle: 'relaxed',
  soft: 'relaxed',
  easy: 'relaxed',
  'laid-back': 'relaxed',
  chill: 'relaxed',
  ambient: 'relaxed',
  quiet: 'relaxed',
  dreamy: 'relaxed',
  ethereal: 'relaxed',
  meditative: 'relaxed',
  contemplative: 'relaxed',

  // Energetic family
  energetic: 'energetic',
  exciting: 'energetic',
  dynamic: 'energetic',
  powerful: 'energetic',
  driving: 'energetic',
  pumping: 'energetic',
  electric: 'energetic',
  vibrant: 'energetic',
  lively: 'energetic',
  spirited: 'energetic',
  passionate: 'energetic',
  fiery: 'energetic',
  wild: 'energetic',
  hyper: 'energetic',
  thrilling: 'energetic',
  exhilarating: 'energetic',
  urgent: 'energetic',
  restless: 'energetic',

  // Dark family
  dark: 'dark',
  brooding: 'dark',
  moody: 'dark',
  mysterious: 'dark',
  haunting: 'dark',
  eerie: 'dark',
  ominous: 'dark',
  sinister: 'dark',
  gothic: 'dark',
  somber: 'dark',
  gloomy: 'dark',
  bleak: 'dark',
  atmospheric: 'dark',
  shadowy: 'dark',
  nocturnal: 'dark',
  cryptic: 'dark',
  foreboding: 'dark',
  menacing: 'dark'
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY - Static headlines for backwards compatibility
// These are used as fallbacks if dynamic generation fails
// ═══════════════════════════════════════════════════════════════════════════
const PERSONALITY_HEADLINES = {
  happy: {
    rock: [
      'Euphoric Rock Soul',
      'Joyful Guitar Dreamer',
      'A Radiant Classic Rock Heart',
      'The Blissful Riff Wanderer',
      'Where Joy Meets Power Chords'
    ],
    electronic: [
      'Euphoric Synth Dreamer',
      'Blissful House Soul',
      'A Joyful Techno Architect',
      'The Radiant Beat Seeker',
      'Where Euphoria Meets Electronic'
    ],
    'hip-hop': [
      'Joyful Hip-Hop Soul',
      'Euphoric Boom Bap Heart',
      'A Radiant Golden Era Poet',
      'The Blissful Rhythm Seeker',
      'Where Joy Meets the Beat'
    ],
    indie: [
      'Joyful Indie Dreamer',
      'Euphoric Shoegaze Soul',
      'A Radiant Dream Pop Wanderer',
      'The Blissful Alternative Seeker',
      'Where Joy Meets the Underground'
    ],
    pop: [
      'Euphoric Pop Soul',
      'Joyful Melody Dreamer',
      'A Radiant Synth-Pop Heart',
      'The Blissful Hook Seeker',
      'Where Joy Meets the Chorus'
    ],
    jazz: [
      'Joyful Jazz Soul',
      'Euphoric Bebop Dreamer',
      'A Radiant Cool Jazz Poet',
      'The Blissful Swing Seeker',
      'Where Joy Meets Improvisation'
    ],
    metal: [
      'Euphoric Metal Soul',
      'Joyful Heavy Dreamer',
      'A Radiant Thrash Heart',
      'The Blissful Riff Seeker',
      'Where Joy Meets the Heavy'
    ],
    folk: [
      'Joyful Folk Soul',
      'Euphoric Acoustic Dreamer',
      'A Radiant Americana Heart',
      'The Blissful Roots Seeker',
      'Where Joy Meets the Acoustic'
    ],
    'r&b': [
      'Euphoric R&B Soul',
      'Joyful Neo-Soul Dreamer',
      'A Radiant Motown Heart',
      'The Blissful Groove Seeker',
      'Where Joy Meets the Groove'
    ],
    classical: [
      'Joyful Classical Soul',
      'Euphoric Orchestral Dreamer',
      'A Radiant Romantic Era Heart',
      'The Blissful Symphony Seeker',
      'Where Joy Meets the Orchestra'
    ],
    country: [
      'Euphoric Country Soul',
      'Joyful Nashville Dreamer',
      'A Radiant Outlaw Country Heart',
      'The Blissful Twang Seeker',
      'Where Joy Meets the Twang'
    ],
    eclectic: [
      'Joyful Sonic Explorer',
      'Euphoric Genre-Fluid Soul',
      'A Radiant Musical Wanderer',
      'The Blissful Sound Seeker',
      'Where Joy Meets Every Genre'
    ]
  },
  sad: {
    rock: [
      'Melancholic Rock Soul',
      'Wistful Guitar Dreamer',
      'A Sorrowful Classic Rock Heart',
      'The Pensive Riff Wanderer',
      'Where Sorrow Meets Power Chords'
    ],
    electronic: [
      'Melancholic Synth Dreamer',
      'Wistful Ambient Soul',
      'A Sorrowful Techno Architect',
      'The Pensive Beat Seeker',
      'Where Melancholy Meets Electronic'
    ],
    'hip-hop': [
      'Melancholic Hip-Hop Soul',
      'Wistful Boom Bap Heart',
      'A Sorrowful Conscious Rap Poet',
      'The Pensive Rhythm Seeker',
      'Where Sorrow Meets the Beat'
    ],
    indie: [
      'Melancholic Indie Dreamer',
      'Wistful Shoegaze Soul',
      'A Sorrowful Dream Pop Wanderer',
      'The Pensive Alternative Seeker',
      'Where Melancholy Meets the Underground'
    ],
    pop: [
      'Melancholic Pop Soul',
      'Wistful Melody Dreamer',
      'A Sorrowful Synth-Pop Heart',
      'The Pensive Hook Seeker',
      'Where Sorrow Meets the Chorus'
    ],
    jazz: [
      'Melancholic Jazz Soul',
      'Wistful Bebop Dreamer',
      'A Sorrowful Cool Jazz Poet',
      'The Pensive Blue Note Seeker',
      'Where Melancholy Meets Improvisation'
    ],
    metal: [
      'Melancholic Metal Soul',
      'Wistful Doom Dreamer',
      'A Sorrowful Heavy Heart',
      'The Pensive Riff Seeker',
      'Where Sorrow Meets the Heavy'
    ],
    folk: [
      'Melancholic Folk Soul',
      'Wistful Acoustic Dreamer',
      'A Sorrowful Americana Heart',
      'The Pensive Roots Seeker',
      'Where Melancholy Meets the Acoustic'
    ],
    'r&b': [
      'Melancholic R&B Soul',
      'Wistful Neo-Soul Dreamer',
      'A Sorrowful Quiet Storm Heart',
      'The Pensive Groove Seeker',
      'Where Sorrow Meets the Groove'
    ],
    classical: [
      'Melancholic Classical Soul',
      'Wistful Orchestral Dreamer',
      'A Sorrowful Romantic Era Heart',
      'The Pensive Symphony Seeker',
      'Where Melancholy Meets the Orchestra'
    ],
    country: [
      'Melancholic Country Soul',
      'Wistful Nashville Dreamer',
      'A Sorrowful Outlaw Country Heart',
      'The Pensive Twang Seeker',
      'Where Sorrow Meets the Twang'
    ],
    eclectic: [
      'Melancholic Sonic Explorer',
      'Wistful Genre-Fluid Soul',
      'A Sorrowful Musical Wanderer',
      'The Pensive Sound Seeker',
      'Where Melancholy Meets Every Genre'
    ]
  },
  angry: {
    rock: [
      'Furious Rock Soul',
      'Fierce Guitar Rebel',
      'A Defiant Classic Rock Heart',
      'The Raging Riff Warrior',
      'Where Fury Meets Power Chords'
    ],
    electronic: [
      'Furious Synth Rebel',
      'Fierce Techno Soul',
      'A Defiant Industrial Architect',
      'The Raging Beat Warrior',
      'Where Fury Meets Electronic'
    ],
    'hip-hop': [
      'Furious Hip-Hop Soul',
      'Fierce Boom Bap Rebel',
      'A Defiant Conscious Rap Poet',
      'The Raging Rhythm Warrior',
      'Where Fury Meets the Beat'
    ],
    indie: [
      'Furious Indie Rebel',
      'Fierce Post-Punk Soul',
      'A Defiant Noise Rock Wanderer',
      'The Raging Alternative Warrior',
      'Where Fury Meets the Underground'
    ],
    pop: [
      'Furious Pop Soul',
      'Fierce Melody Rebel',
      'A Defiant Synth-Pop Heart',
      'The Raging Hook Warrior',
      'Where Fury Meets the Chorus'
    ],
    jazz: [
      'Furious Jazz Soul',
      'Fierce Free Jazz Rebel',
      'A Defiant Bebop Poet',
      'The Raging Swing Warrior',
      'Where Fury Meets Improvisation'
    ],
    metal: [
      'Furious Metal Soul',
      'Fierce Thrash Rebel',
      'A Defiant Death Metal Heart',
      'The Raging Riff Warrior',
      'Where Fury Meets the Heavy'
    ],
    folk: [
      'Furious Folk Soul',
      'Fierce Protest Song Rebel',
      'A Defiant Americana Heart',
      'The Raging Roots Warrior',
      'Where Fury Meets the Acoustic'
    ],
    'r&b': [
      'Furious R&B Soul',
      'Fierce Neo-Soul Rebel',
      'A Defiant Funk Heart',
      'The Raging Groove Warrior',
      'Where Fury Meets the Groove'
    ],
    classical: [
      'Furious Classical Soul',
      'Fierce Orchestral Rebel',
      'A Defiant Romantic Era Heart',
      'The Raging Symphony Warrior',
      'Where Fury Meets the Orchestra'
    ],
    country: [
      'Furious Country Soul',
      'Fierce Outlaw Country Rebel',
      'A Defiant Nashville Heart',
      'The Raging Twang Warrior',
      'Where Fury Meets the Twang'
    ],
    eclectic: [
      'Furious Sonic Explorer',
      'Fierce Genre-Fluid Rebel',
      'A Defiant Musical Wanderer',
      'The Raging Sound Warrior',
      'Where Fury Meets Every Genre'
    ]
  },
  relaxed: {
    rock: [
      'Serene Rock Soul',
      'Tranquil Guitar Dreamer',
      'A Peaceful Classic Rock Heart',
      'The Mellow Riff Wanderer',
      'Where Peace Meets Power Chords'
    ],
    electronic: [
      'Serene Synth Dreamer',
      'Tranquil Ambient Soul',
      'A Peaceful Chillout Architect',
      'The Mellow Beat Seeker',
      'Where Peace Meets Electronic'
    ],
    'hip-hop': [
      'Serene Hip-Hop Soul',
      'Tranquil Lo-Fi Hip-Hop Heart',
      'A Peaceful Boom Bap Poet',
      'The Mellow Rhythm Seeker',
      'Where Peace Meets the Beat'
    ],
    indie: [
      'Serene Indie Dreamer',
      'Tranquil Dream Pop Soul',
      'A Peaceful Shoegaze Wanderer',
      'The Mellow Alternative Seeker',
      'Where Peace Meets the Underground'
    ],
    pop: [
      'Serene Pop Soul',
      'Tranquil Melody Dreamer',
      'A Peaceful Synth-Pop Heart',
      'The Mellow Hook Seeker',
      'Where Peace Meets the Chorus'
    ],
    jazz: [
      'Serene Jazz Soul',
      'Tranquil Cool Jazz Dreamer',
      'A Peaceful Modal Jazz Poet',
      'The Mellow Swing Seeker',
      'Where Peace Meets Improvisation'
    ],
    metal: [
      'Serene Metal Soul',
      'Tranquil Doom Dreamer',
      'A Peaceful Progressive Metal Heart',
      'The Mellow Riff Seeker',
      'Where Peace Meets the Heavy'
    ],
    folk: [
      'Serene Folk Soul',
      'Tranquil Acoustic Dreamer',
      'A Peaceful Americana Heart',
      'The Mellow Roots Seeker',
      'Where Peace Meets the Acoustic'
    ],
    'r&b': [
      'Serene R&B Soul',
      'Tranquil Quiet Storm Dreamer',
      'A Peaceful Neo-Soul Heart',
      'The Mellow Groove Seeker',
      'Where Peace Meets the Groove'
    ],
    classical: [
      'Serene Classical Soul',
      'Tranquil Orchestral Dreamer',
      'A Peaceful Impressionist Heart',
      'The Mellow Symphony Seeker',
      'Where Peace Meets the Orchestra'
    ],
    country: [
      'Serene Country Soul',
      'Tranquil Nashville Dreamer',
      'A Peaceful Americana Heart',
      'The Mellow Twang Seeker',
      'Where Peace Meets the Twang'
    ],
    eclectic: [
      'Serene Sonic Explorer',
      'Tranquil Genre-Fluid Soul',
      'A Peaceful Musical Wanderer',
      'The Mellow Sound Seeker',
      'Where Peace Meets Every Genre'
    ]
  },
  energetic: {
    rock: [
      'Restless Rock Soul',
      'Kinetic Guitar Rebel',
      'A Vibrant Classic Rock Heart',
      'The Electric Riff Warrior',
      'Where Energy Meets Power Chords'
    ],
    electronic: [
      'Restless Synth Soul',
      'Kinetic Techno Rebel',
      'A Vibrant House Architect',
      'The Electric Beat Warrior',
      'Where Energy Meets Electronic'
    ],
    'hip-hop': [
      'Restless Hip-Hop Soul',
      'Kinetic Boom Bap Rebel',
      'A Vibrant Trap Heart',
      'The Electric Rhythm Warrior',
      'Where Energy Meets the Beat'
    ],
    indie: [
      'Restless Indie Rebel',
      'Kinetic Post-Punk Soul',
      'A Vibrant Garage Rock Wanderer',
      'The Electric Alternative Warrior',
      'Where Energy Meets the Underground'
    ],
    pop: [
      'Restless Pop Soul',
      'Kinetic Dance Pop Rebel',
      'A Vibrant Synth-Pop Heart',
      'The Electric Hook Warrior',
      'Where Energy Meets the Chorus'
    ],
    jazz: [
      'Restless Jazz Soul',
      'Kinetic Bebop Rebel',
      'A Vibrant Hard Bop Poet',
      'The Electric Swing Warrior',
      'Where Energy Meets Improvisation'
    ],
    metal: [
      'Restless Metal Soul',
      'Kinetic Thrash Rebel',
      'A Vibrant Speed Metal Heart',
      'The Electric Riff Warrior',
      'Where Energy Meets the Heavy'
    ],
    folk: [
      'Restless Folk Soul',
      'Kinetic Bluegrass Rebel',
      'A Vibrant Celtic Heart',
      'The Electric Roots Warrior',
      'Where Energy Meets the Acoustic'
    ],
    'r&b': [
      'Restless R&B Soul',
      'Kinetic Funk Rebel',
      'A Vibrant New Jack Swing Heart',
      'The Electric Groove Warrior',
      'Where Energy Meets the Groove'
    ],
    classical: [
      'Restless Classical Soul',
      'Kinetic Orchestral Rebel',
      'A Vibrant Romantic Era Heart',
      'The Electric Symphony Warrior',
      'Where Energy Meets the Orchestra'
    ],
    country: [
      'Restless Country Soul',
      'Kinetic Honky-Tonk Rebel',
      'A Vibrant Outlaw Country Heart',
      'The Electric Twang Warrior',
      'Where Energy Meets the Twang'
    ],
    eclectic: [
      'Restless Sonic Explorer',
      'Kinetic Genre-Fluid Rebel',
      'A Vibrant Musical Wanderer',
      'The Electric Sound Warrior',
      'Where Energy Meets Every Genre'
    ]
  },
  dark: {
    rock: [
      'Brooding Rock Soul',
      'Shadowed Guitar Dreamer',
      'A Nocturnal Classic Rock Heart',
      'The Haunted Riff Wanderer',
      'Where Darkness Meets Power Chords'
    ],
    electronic: [
      'Brooding Synth Dreamer',
      'Shadowed Darkwave Soul',
      'A Nocturnal Industrial Architect',
      'The Haunted Beat Seeker',
      'Where Darkness Meets Electronic'
    ],
    'hip-hop': [
      'Brooding Hip-Hop Soul',
      'Shadowed Boom Bap Heart',
      'A Nocturnal Conscious Rap Poet',
      'The Haunted Rhythm Seeker',
      'Where Darkness Meets the Beat'
    ],
    indie: [
      'Brooding Indie Dreamer',
      'Shadowed Post-Punk Soul',
      'A Nocturnal Shoegaze Wanderer',
      'The Haunted Alternative Seeker',
      'Where Darkness Meets the Underground'
    ],
    pop: [
      'Brooding Pop Soul',
      'Shadowed Melody Dreamer',
      'A Nocturnal Synth-Pop Heart',
      'The Haunted Hook Seeker',
      'Where Darkness Meets the Chorus'
    ],
    jazz: [
      'Brooding Jazz Soul',
      'Shadowed Bebop Dreamer',
      'A Nocturnal Cool Jazz Poet',
      'The Haunted Blue Note Seeker',
      'Where Darkness Meets Improvisation'
    ],
    metal: [
      'Brooding Metal Soul',
      'Shadowed Black Metal Dreamer',
      'A Nocturnal Doom Heart',
      'The Haunted Riff Seeker',
      'Where Darkness Meets the Heavy'
    ],
    folk: [
      'Brooding Folk Soul',
      'Shadowed Acoustic Dreamer',
      'A Nocturnal Dark Folk Heart',
      'The Haunted Roots Seeker',
      'Where Darkness Meets the Acoustic'
    ],
    'r&b': [
      'Brooding R&B Soul',
      'Shadowed Neo-Soul Dreamer',
      'A Nocturnal Quiet Storm Heart',
      'The Haunted Groove Seeker',
      'Where Darkness Meets the Groove'
    ],
    classical: [
      'Brooding Classical Soul',
      'Shadowed Orchestral Dreamer',
      'A Nocturnal Romantic Era Heart',
      'The Haunted Symphony Seeker',
      'Where Darkness Meets the Orchestra'
    ],
    country: [
      'Brooding Country Soul',
      'Shadowed Outlaw Country Dreamer',
      'A Nocturnal Nashville Heart',
      'The Haunted Twang Seeker',
      'Where Darkness Meets the Twang'
    ],
    eclectic: [
      'Brooding Sonic Explorer',
      'Shadowed Genre-Fluid Soul',
      'A Nocturnal Musical Wanderer',
      'The Haunted Sound Seeker',
      'Where Darkness Meets Every Genre'
    ]
  }
};

const FALLBACK_HEADLINES = {
  rock: [
    'Devoted Rock Soul',
    'True Guitar Heart',
    'A Classic Rock Wanderer',
    'The Eternal Riff Seeker',
    'Rock at Heart'
  ],
  electronic: [
    'Devoted Synth Soul',
    'True Electronic Heart',
    'A Techno Wanderer',
    'The Eternal Beat Seeker',
    'Born Electronic'
  ],
  'hip-hop': [
    'Devoted Hip-Hop Soul',
    'True Boom Bap Heart',
    'A Golden Era Wanderer',
    'The Eternal Rhythm Seeker',
    'Hip-Hop at Heart'
  ],
  indie: [
    'Devoted Indie Soul',
    'True Alternative Heart',
    'A Shoegaze Wanderer',
    'The Eternal Underground Seeker',
    'Forever Indie'
  ],
  pop: [
    'Devoted Pop Soul',
    'True Melody Heart',
    'A Synth-Pop Wanderer',
    'The Eternal Hook Seeker',
    'Pop at Heart'
  ],
  jazz: [
    'Devoted Jazz Soul',
    'True Bebop Heart',
    'A Cool Jazz Wanderer',
    'The Eternal Swing Seeker',
    'Forever Jazz'
  ],
  metal: [
    'Devoted Metal Soul',
    'True Heavy Heart',
    'A Thrash Wanderer',
    'The Eternal Riff Seeker',
    'Metal at Heart'
  ],
  folk: [
    'Devoted Folk Soul',
    'True Acoustic Heart',
    'An Americana Wanderer',
    'The Eternal Roots Seeker',
    'Folk at Heart'
  ],
  'r&b': [
    'Devoted R&B Soul',
    'True Neo-Soul Heart',
    'A Motown Wanderer',
    'The Eternal Groove Seeker',
    'Soul at Heart'
  ],
  classical: [
    'Devoted Classical Soul',
    'True Orchestral Heart',
    'A Romantic Era Wanderer',
    'The Eternal Symphony Seeker',
    'Classical at Heart'
  ],
  country: [
    'Devoted Country Soul',
    'True Nashville Heart',
    'An Outlaw Country Wanderer',
    'The Eternal Twang Seeker',
    'Country at Heart'
  ],
  eclectic: [
    'Devoted Sonic Explorer',
    'True Musical Heart',
    'A Genre-Fluid Wanderer',
    'The Eternal Sound Seeker',
    'Music at Heart'
  ]
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PERSONALITY_HEADLINES,
    FALLBACK_HEADLINES,
    GENRE_FAMILY_MAP,
    MOOD_MAP,
    generateHeadline,
    getPersonalityHeadline
  };
}
