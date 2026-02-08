/**
 * Music Personality Service - Server-Side Generation
 *
 * This module contains all personality headline generation logic.
 * It is NOT served to the client - keeping the logic private.
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
    'Joyful',
    'Bright',
    'Warm',
    'Uplifted',
    'Hopeful',
    'Cheerful',
    'Lighthearted',
    'Content',
    'Radiant',
    'Blissful',
    'Elated',
    'Euphoric',
    'Exuberant',
    'Jubilant',
    'Sunlit',
    'Golden'
  ],
  sad: [
    'Sad',
    'Lonely',
    'Heartbroken',
    'Blue',
    'Grieving',
    'Hurt',
    'Lost',
    'Aching',
    'Melancholic',
    'Wistful',
    'Pensive',
    'Bittersweet',
    'Longing',
    'Tender',
    'Rainy',
    'Faded'
  ],
  angry: [
    'Angry',
    'Fierce',
    'Defiant',
    'Rebellious',
    'Bold',
    'Intense',
    'Raw',
    'Untamed',
    'Furious',
    'Raging',
    'Unrelenting',
    'Unyielding',
    'Ferocious',
    'Fiery',
    'Stormy',
    'Burning'
  ],
  relaxed: [
    'Calm',
    'Peaceful',
    'Mellow',
    'Easy',
    'Gentle',
    'Quiet',
    'Still',
    'Soft',
    'Serene',
    'Tranquil',
    'Soothing',
    'Placid',
    'Unhurried',
    'Graceful',
    'Moonlit',
    'Drifting'
  ],
  energetic: [
    'Restless',
    'Driven',
    'Alive',
    'Charged',
    'Fired Up',
    'Eager',
    'Tireless',
    'Unstoppable',
    'Kinetic',
    'Vibrant',
    'Electric',
    'Pulsing',
    'Relentless',
    'Dynamic',
    'Blazing',
    'Surging'
  ],
  dark: [
    'Dark',
    'Moody',
    'Brooding',
    'Haunted',
    'Somber',
    'Heavy',
    'Deep',
    'Intense',
    'Nocturnal',
    'Shadowed',
    'Cryptic',
    'Mysterious',
    'Obscure',
    'Veiled',
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
// ═══════════════════════════════════════════════════════════════════════════
const TEMPLATES = {
  short: [
    { template: '{mood} {genre} {character}', genreAsAdjective: true },
    { template: '{mood} {genre} Soul', genreAsAdjective: true },
    { template: '{genre} {character}', genreAsAdjective: true },
    { template: '{genre} Heart', genreAsAdjective: true },
    { template: 'Born {genre} {character}', genreAsAdjective: true },
    { template: 'True {genre} {character}', genreAsAdjective: true },
    { template: 'The {genre} {character}', genreAsAdjective: true },
    { template: 'A {genre} {character}', genreAsAdjective: true },
    { template: 'The {mood} {character}', genreAsAdjective: false },
    { template: '{mood} {character}', genreAsAdjective: false },
    { template: 'A {mood} {character}', genreAsAdjective: false },
    { template: '{mood} to the Core', genreAsAdjective: false },
    { template: '{mood} and {genre}', genreAsAdjective: false },
    { template: 'Forever {genre}', genreAsAdjective: false },
    { template: 'Deeply {genre}', genreAsAdjective: false },
    { template: '{genre} at Heart', genreAsAdjective: false }
  ],
  medium: [
    { template: 'A {mood} {genre} {character} at Heart', genreAsAdjective: true },
    { template: '{character} of the {mood} {genre} Sound', genreAsAdjective: true },
    { template: 'The {mood} {genre} {character}', genreAsAdjective: true },
    { template: 'The Enduring {genre} {character}', genreAsAdjective: true },
    { template: 'Devoted {genre} {character}', genreAsAdjective: true },
    { template: 'A True {genre} {character}', genreAsAdjective: true },
    { template: 'Born a {mood} {genre} {character}', genreAsAdjective: true },
    { template: '{genre} Flows Through This {character}', genreAsAdjective: true },
    { template: '{mood} {genre} Through and Through', genreAsAdjective: true },
    { template: 'A {character} Drawn to {mood} {genre}', genreAsAdjective: false },
    { template: 'Where {moodNoun} Meets {genre}', genreAsAdjective: false },
    { template: 'The {mood} {character} of {genre}', genreAsAdjective: false },
    { template: 'A {mood} {character} in a {genre} World', genreAsAdjective: false },
    { template: 'Living for {mood} {genre}', genreAsAdjective: false },
    { template: 'Lost in {mood} {genre}', genreAsAdjective: false },
    { template: 'The {character} Who Found {genre}', genreAsAdjective: false },
    { template: 'A {character} Shaped by {genre}', genreAsAdjective: false },
    { template: 'Defined by {mood} {genre}', genreAsAdjective: false },
    { template: 'The {mood} Side of {genre}', genreAsAdjective: false },
    { template: 'A {character} at Home in {genre}', genreAsAdjective: false },
    { template: 'Rooted in {mood} {genre}', genreAsAdjective: false }
  ]
};

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
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fix "a/an" grammar in a headline.
 */
function fixArticleGrammar(headline) {
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

  const vowelSoundingConsonants = ['honest', 'honor', 'honour', 'hour', 'heir'];

  return headline.replace(/\b(A|a)\s+(\w+)/g, (match, article, nextWord) => {
    const nextWordLower = nextWord.toLowerCase();
    const firstLetter = nextWordLower[0];
    const isVowel = 'aeiou'.includes(firstLetter);

    if (isVowel && consonantSoundingVowels.some((w) => nextWordLower.startsWith(w))) {
      return match;
    }

    if (!isVowel && vowelSoundingConsonants.some((w) => nextWordLower.startsWith(w))) {
      return article === 'A' ? `An ${nextWord}` : `an ${nextWord}`;
    }

    if (isVowel) {
      return article === 'A' ? `An ${nextWord}` : `an ${nextWord}`;
    }

    return match;
  });
}

function randomFrom(array, randomFn) {
  const rand = randomFn || Math.random;
  return array[Math.floor(rand() * array.length)];
}

function getGenreTerm(genre, randomFn, preferSpecific = null) {
  const rand = randomFn || Math.random;
  const terms = GENRE_TERMS[genre] || GENRE_TERMS.eclectic;
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

function isSimpleGenre(genreWord) {
  return !genreWord.includes(' ') && !genreWord.includes('&') && !genreWord.includes('-');
}

// ═══════════════════════════════════════════════════════════════════════════
// SEEDED RANDOM NUMBER GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simple hash function (djb2) for creating deterministic seeds
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Seeded pseudo-random number generator (mulberry32)
 */
function createSeededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HEADLINE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateHeadline(mood, genre, randomFn) {
  const rand = randomFn || Math.random;

  const genreWord = getGenreTerm(genre, randomFn);
  const genreIsSimple = isSimpleGenre(genreWord);

  const useShort = rand() > 0.5;
  const allTemplates = useShort ? TEMPLATES.short : TEMPLATES.medium;

  const availableTemplates = genreIsSimple
    ? allTemplates
    : allTemplates.filter((t) => !t.genreAsAdjective);

  const templateObj = randomFrom(availableTemplates, randomFn);
  const template = templateObj.template;

  const moodWord = getMoodDescriptor(mood, randomFn);
  const moodNoun = getMoodNoun(mood, randomFn);
  const character = getCharacter(randomFn);

  let headline = template
    .replace(/{mood}/g, moodWord)
    .replace(/{moodNoun}/g, moodNoun)
    .replace(/{genre}/g, genreWord)
    .replace(/{character}/g, character);

  headline = fixArticleGrammar(headline);

  return headline;
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONALITY ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze artist data to determine personality
 * @param {Array} artists - Array of artist objects with mood, genre, playcount
 * @param {number} seed - Optional seed for deterministic generation
 * @returns {Object} Personality analysis result
 */
function analyzePersonality(artists, seed) {
  // Create seeded random if seed provided
  const seededRandom = seed ? createSeededRandom(seed) : null;
  const randomFn = seededRandom || Math.random;

  const moodCounts = {};
  const genreCounts = {};
  let totalPlays = 0;

  // Process each artist
  for (const artist of artists) {
    const weight = artist.playcount || 1;
    totalPlays += weight;

    // Process mood
    if (artist.mood) {
      const normalizedMood = MOOD_MAP[artist.mood.toLowerCase()] || null;
      if (normalizedMood) {
        moodCounts[normalizedMood] = (moodCounts[normalizedMood] || 0) + weight;
      }
    }

    // Process genre
    const genreStr = artist.genre || artist.style;
    if (genreStr) {
      const normalizedGenre = GENRE_FAMILY_MAP[genreStr.toLowerCase()] || null;
      if (normalizedGenre) {
        genreCounts[normalizedGenre] = (genreCounts[normalizedGenre] || 0) + weight;
      }
    }
  }

  // Find dominant mood
  let dominantMood = null;
  let maxMoodCount = 0;
  for (const [mood, count] of Object.entries(moodCounts)) {
    if (count > maxMoodCount) {
      maxMoodCount = count;
      dominantMood = mood;
    }
  }

  // Find dominant genre
  let dominantGenre = 'eclectic';
  let maxGenreCount = 0;
  const genreEntries = Object.entries(genreCounts);

  if (genreEntries.length > 0) {
    for (const [genre, count] of genreEntries) {
      if (count > maxGenreCount) {
        maxGenreCount = count;
        dominantGenre = genre;
      }
    }

    // If we have 3+ genres and no clear dominant (< 50%), use eclectic
    if (genreEntries.length >= 3 && maxGenreCount / totalPlays < 0.5) {
      dominantGenre = 'eclectic';
    }
  }

  // Generate headline
  const normalizedMood = dominantMood || 'relaxed';
  const normalizedGenre = dominantGenre || 'eclectic';
  const headline = generateHeadline(normalizedMood, normalizedGenre, randomFn);

  return {
    headline,
    mood: normalizedMood,
    genre: normalizedGenre,
    moodCounts,
    genreCounts
  };
}

module.exports = {
  analyzePersonality,
  generateHeadline,
  GENRE_FAMILY_MAP,
  MOOD_MAP
};
