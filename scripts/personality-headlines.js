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
    'Joyful', 'Bright', 'Warm', 'Uplifted', 'Hopeful', 'Cheerful', 'Lighthearted', 'Content',
    // Elevated
    'Radiant', 'Blissful', 'Elated', 'Euphoric', 'Exuberant', 'Jubilant',
    // Evocative sprinkle
    'Sunlit', 'Golden'
  ],
  sad: [
    // Clear/accessible
    'Sad', 'Lonely', 'Heartbroken', 'Blue', 'Grieving', 'Hurt', 'Lost', 'Aching',
    // Elevated
    'Melancholic', 'Wistful', 'Pensive', 'Bittersweet', 'Longing', 'Tender',
    // Evocative sprinkle
    'Rainy', 'Faded'
  ],
  angry: [
    // Clear/accessible
    'Angry', 'Fierce', 'Defiant', 'Rebellious', 'Bold', 'Intense', 'Raw', 'Untamed',
    // Elevated
    'Furious', 'Raging', 'Unrelenting', 'Unyielding', 'Ferocious', 'Fiery',
    // Evocative sprinkle
    'Stormy', 'Burning'
  ],
  relaxed: [
    // Clear/accessible
    'Calm', 'Peaceful', 'Mellow', 'Easy', 'Gentle', 'Quiet', 'Still', 'Soft',
    // Elevated
    'Serene', 'Tranquil', 'Soothing', 'Placid', 'Unhurried', 'Graceful',
    // Evocative sprinkle
    'Moonlit', 'Drifting'
  ],
  energetic: [
    // Clear/accessible
    'Restless', 'Driven', 'Alive', 'Charged', 'Fired Up', 'Eager', 'Tireless', 'Unstoppable',
    // Elevated
    'Kinetic', 'Vibrant', 'Electric', 'Pulsing', 'Relentless', 'Dynamic',
    // Evocative sprinkle
    'Blazing', 'Surging'
  ],
  dark: [
    // Clear/accessible
    'Dark', 'Moody', 'Brooding', 'Haunted', 'Somber', 'Heavy', 'Deep', 'Intense',
    // Elevated
    'Nocturnal', 'Shadowed', 'Cryptic', 'Mysterious', 'Obscure', 'Veiled',
    // Evocative sprinkle
    'Midnight', 'Twilight'
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
  'Soul', 'Heart', 'Spirit', 'Dreamer', 'Poet', 'Romantic', 'Artist', 'Muse', 'Visionary', 'Idealist',
  // Adventurer/seeker
  'Wanderer', 'Voyager', 'Explorer', 'Pilgrim', 'Nomad', 'Seeker', 'Traveler', 'Drifter', 'Rover',
  // Intellectual/philosophical
  'Philosopher', 'Architect', 'Scholar', 'Chronicler', 'Mystic', 'Thinker', 'Observer', 'Curator',
  // Rebel/outsider
  'Rebel', 'Outsider', 'Maverick', 'Loner', 'Outcast'
];

// ═══════════════════════════════════════════════════════════════════════════
// HEADLINE TEMPLATES - Patterns for generating varied lengths
// Third person focus (describing them, not addressing them)
// ═══════════════════════════════════════════════════════════════════════════
const TEMPLATES = {
  // Short templates (2-4 words)
  short: [
    '{mood} {genre} {character}',           // "Melancholic Jazz Poet"
    '{mood} {genre} Soul',                  // "Joyful Rock Soul"
    '{genre} {character}',                  // "Synth Dreamer"
    'The {mood} {character}',               // "The Brooding Wanderer"
    '{mood} {character}',                   // "Wistful Dreamer"
    '{genre} Heart',                        // "Folk Heart"
    'Born {genre} {character}',             // "Born Rock Spirit"
    'True {genre} {character}',             // "True Jazz Soul"
    'A {mood} {character}',                 // "A Lonely Wanderer"
    '{mood} and {genre}',                   // "Restless and Electric"
    'Forever {genre}',                      // "Forever Jazz"
    'Deeply {genre}',                       // "Deeply Folk"
    '{genre} at Heart',                     // "Rock at Heart"
    'The {genre} {character}',              // "The Jazz Philosopher"
    'A {genre} {character}',                // "A Folk Dreamer"
    '{mood} to the Core',                   // "Melancholic to the Core"
  ],
  // Medium templates (4-7 words)
  medium: [
    'A {mood} {genre} {character} at Heart',           // "A Melancholic Jazz Poet at Heart"
    '{character} of the {mood} {genre} Sound',         // "Wanderer of the Brooding Metal Sound"
    'The {mood} {genre} {character}',                  // "The Restless Electronic Voyager"
    'A {character} Drawn to {mood} {genre}',           // "A Seeker Drawn to Melancholic Folk"
    'Where {moodNoun} Meets {genre}',                  // "Where Sorrow Meets Jazz"
    'The {mood} {character} of {genre}',               // "The Restless Voyager of Electronic"
    'A {mood} {character} in a {genre} World',         // "A Tender Soul in a Folk World"
    'The Enduring {genre} {character}',                // "The Enduring Rock Soul"
    'Devoted {genre} {character}',                     // "Devoted Jazz Soul"
    'Living for {mood} {genre}',                       // "Living for Melancholic Jazz"
    'Lost in {mood} {genre}',                          // "Lost in Dark Electronic"
    'A True {genre} {character}',                      // "A True Folk Romantic"
    'Born a {mood} {genre} {character}',               // "Born a Restless Rock Rebel"
    'The {character} Who Found {genre}',               // "The Wanderer Who Found Jazz"
    '{genre} Flows Through This {character}',          // "Jazz Flows Through This Soul"
    'A {character} Shaped by {genre}',                 // "A Soul Shaped by Folk"
    'Defined by {mood} {genre}',                       // "Defined by Melancholic Jazz"
    'The {mood} Side of {genre}',                      // "The Dark Side of Electronic"
    'A {character} at Home in {genre}',                // "A Dreamer at Home in Indie"
    'Rooted in {mood} {genre}',                        // "Rooted in Peaceful Folk"
    '{mood} {genre} Through and Through',              // "Joyful Pop Through and Through"
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getGenreTerm(genre, preferSpecific = null) {
  const terms = GENRE_TERMS[genre] || GENRE_TERMS.eclectic;
  // If not specified, randomly choose generic vs specific (50/50)
  const useSpecific = preferSpecific !== null ? preferSpecific : Math.random() > 0.5;
  return useSpecific ? randomFrom(terms.specific) : randomFrom(terms.generic);
}

function getMoodDescriptor(mood) {
  const descriptors = MOOD_DESCRIPTORS[mood] || MOOD_DESCRIPTORS.happy;
  return randomFrom(descriptors);
}

function getMoodNoun(mood) {
  const nouns = MOOD_NOUNS[mood] || MOOD_NOUNS.happy;
  return randomFrom(nouns);
}

function getCharacter() {
  return randomFrom(CHARACTERS);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HEADLINE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateHeadline(mood, genre) {
  // Randomly choose short or medium length (roughly 50/50)
  const useShort = Math.random() > 0.5;
  const templates = useShort ? TEMPLATES.short : TEMPLATES.medium;
  const template = randomFrom(templates);
  
  // Get components
  const moodWord = getMoodDescriptor(mood);
  const moodNoun = getMoodNoun(mood);
  const genreWord = getGenreTerm(genre);
  const character = getCharacter();
  
  // Replace placeholders
  let headline = template
    .replace(/{mood}/g, moodWord)
    .replace(/{moodNoun}/g, moodNoun)
    .replace(/{genre}/g, genreWord)
    .replace(/{character}/g, character);
  
  return headline;
}

// Generate a headline with fallback
function getPersonalityHeadline(mood, genre) {
  // Normalize inputs
  const normalizedMood = mood && MOOD_DESCRIPTORS[mood] ? mood : 'relaxed';
  const normalizedGenre = genre && GENRE_TERMS[genre] ? genre : 'eclectic';
  
  return generateHeadline(normalizedMood, normalizedGenre);
}

// ═══════════════════════════════════════════════════════════════════════════
// GENRE FAMILY MAPPING - Maps specific genres to family categories
// ═══════════════════════════════════════════════════════════════════════════
const GENRE_FAMILY_MAP = {
  // Rock family
  'rock': 'rock', 'alternative rock': 'rock', 'indie rock': 'indie',
  'punk rock': 'rock', 'punk': 'rock', 'hard rock': 'rock',
  'classic rock': 'rock', 'progressive rock': 'rock', 'prog rock': 'rock',
  'psychedelic rock': 'rock', 'garage rock': 'rock', 'grunge': 'rock',
  'post-rock': 'rock', 'post rock': 'rock', 'art rock': 'rock',
  'glam rock': 'rock', 'blues rock': 'rock', 'southern rock': 'rock',
  'stoner rock': 'rock', 'noise rock': 'indie', 'shoegaze': 'indie',
  'dream pop': 'indie', 'britpop': 'rock', 'new wave': 'rock',
  'post-punk': 'indie', 'post punk': 'indie', 'gothic rock': 'rock',
  'emo': 'rock', 'screamo': 'rock', 'pop punk': 'rock', 'ska punk': 'rock',
  'hardcore': 'rock', 'hardcore punk': 'rock', 'post-hardcore': 'rock',
  
  // Electronic family
  'electronic': 'electronic', 'electronica': 'electronic', 'edm': 'electronic',
  'house': 'electronic', 'deep house': 'electronic', 'tech house': 'electronic',
  'progressive house': 'electronic', 'techno': 'electronic', 'trance': 'electronic',
  'psytrance': 'electronic', 'drum and bass': 'electronic', 'dnb': 'electronic',
  'dubstep': 'electronic', 'ambient': 'electronic', 'idm': 'electronic',
  'downtempo': 'electronic', 'chillout': 'electronic', 'trip hop': 'electronic',
  'trip-hop': 'electronic', 'breakbeat': 'electronic', 'jungle': 'electronic',
  'garage': 'electronic', 'uk garage': 'electronic', 'synthwave': 'electronic',
  'synthpop': 'electronic', 'synth-pop': 'electronic', 'electropop': 'electronic',
  'industrial': 'electronic', 'ebm': 'electronic', 'darkwave': 'electronic',
  'vaporwave': 'electronic', 'future bass': 'electronic',
  'lo-fi': 'electronic', 'lofi': 'electronic',
  
  // Hip-hop family
  'hip hop': 'hip-hop', 'hip-hop': 'hip-hop', 'rap': 'hip-hop', 'trap': 'hip-hop',
  'gangsta rap': 'hip-hop', 'conscious hip hop': 'hip-hop',
  'underground hip hop': 'hip-hop', 'alternative hip hop': 'hip-hop',
  'boom bap': 'hip-hop', 'east coast hip hop': 'hip-hop',
  'west coast hip hop': 'hip-hop', 'southern hip hop': 'hip-hop',
  'dirty south': 'hip-hop', 'crunk': 'hip-hop', 'grime': 'hip-hop',
  'drill': 'hip-hop', 'cloud rap': 'hip-hop', 'mumble rap': 'hip-hop',
  'emo rap': 'hip-hop',
  
  // Indie/Alternative family
  'indie': 'indie', 'indie pop': 'indie', 'indie folk': 'folk',
  'alternative': 'indie', 'lo-fi indie': 'indie', 'chamber pop': 'indie',
  'baroque pop': 'indie', 'art pop': 'indie', 'experimental': 'indie',
  'avant-garde': 'indie', 'math rock': 'indie', 'midwest emo': 'indie',
  'slowcore': 'indie', 'sadcore': 'indie',
  
  // Pop family
  'pop': 'pop', 'dance pop': 'pop', 'teen pop': 'pop', 'power pop': 'pop',
  'adult contemporary': 'pop', 'soft rock': 'pop', 'bubblegum pop': 'pop',
  'k-pop': 'pop', 'j-pop': 'pop', 'c-pop': 'pop', 'latin pop': 'pop',
  'europop': 'pop', 'disco': 'pop', 'funk': 'r&b',
  
  // Jazz family
  'jazz': 'jazz', 'smooth jazz': 'jazz', 'acid jazz': 'jazz',
  'jazz fusion': 'jazz', 'bebop': 'jazz', 'hard bop': 'jazz',
  'cool jazz': 'jazz', 'free jazz': 'jazz', 'modal jazz': 'jazz',
  'swing': 'jazz', 'big band': 'jazz', 'latin jazz': 'jazz',
  'bossa nova': 'jazz', 'nu jazz': 'jazz',
  
  // Metal family
  'metal': 'metal', 'heavy metal': 'metal', 'thrash metal': 'metal',
  'death metal': 'metal', 'black metal': 'metal', 'doom metal': 'metal',
  'power metal': 'metal', 'progressive metal': 'metal', 'prog metal': 'metal',
  'symphonic metal': 'metal', 'folk metal': 'metal', 'viking metal': 'metal',
  'gothic metal': 'metal', 'nu metal': 'metal', 'metalcore': 'metal',
  'deathcore': 'metal', 'djent': 'metal', 'sludge metal': 'metal',
  'stoner metal': 'metal', 'groove metal': 'metal', 'speed metal': 'metal',
  'grindcore': 'metal',
  
  // Folk family
  'folk': 'folk', 'folk rock': 'folk', 'americana': 'folk', 'bluegrass': 'folk',
  'country folk': 'folk', 'celtic': 'folk', 'irish folk': 'folk',
  'scottish folk': 'folk', 'traditional folk': 'folk', 'contemporary folk': 'folk',
  'singer-songwriter': 'folk', 'acoustic': 'folk', 'neofolk': 'folk',
  'freak folk': 'folk', 'anti-folk': 'folk', 'world music': 'folk',
  
  // R&B/Soul family
  'r&b': 'r&b', 'rnb': 'r&b', 'rhythm and blues': 'r&b', 'soul': 'r&b',
  'neo soul': 'r&b', 'neo-soul': 'r&b', 'motown': 'r&b',
  'contemporary r&b': 'r&b', 'quiet storm': 'r&b', 'new jack swing': 'r&b',
  'gospel': 'r&b', 'blues': 'r&b',
  
  // Classical family
  'classical': 'classical', 'orchestra': 'classical', 'orchestral': 'classical',
  'symphony': 'classical', 'chamber music': 'classical', 'opera': 'classical',
  'baroque': 'classical', 'romantic': 'classical', 'contemporary classical': 'classical',
  'minimalism': 'classical', 'neoclassical': 'classical', 'impressionist': 'classical',
  
  // Country family
  'country': 'country', 'country rock': 'country', 'alt-country': 'country',
  'outlaw country': 'country', 'country pop': 'country', 'honky tonk': 'country',
  'western': 'country', 'nashville sound': 'country', 'bro-country': 'country',
  'texas country': 'country', 'red dirt': 'country'
};

// ═══════════════════════════════════════════════════════════════════════════
// MOOD MAPPING - Determines mood from valence/energy values
// ═══════════════════════════════════════════════════════════════════════════
const MOOD_MAP = {
  getMood: function(valence, energy) {
    if (valence > 0.6 && energy > 0.6) return 'happy';
    if (valence > 0.6 && energy <= 0.6) return 'relaxed';
    if (valence <= 0.4 && energy > 0.6) return 'angry';
    if (valence <= 0.4 && energy <= 0.4) return 'sad';
    if (energy > 0.7) return 'energetic';
    if (valence <= 0.3) return 'dark';
    return 'relaxed';
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY - Static headlines for backwards compatibility
// These are used as fallbacks if dynamic generation fails
// ═══════════════════════════════════════════════════════════════════════════
const PERSONALITY_HEADLINES = {
  happy: {
    rock: ["Euphoric Rock Soul", "Joyful Guitar Dreamer", "A Radiant Classic Rock Heart", "The Blissful Riff Wanderer", "Where Joy Meets Power Chords"],
    electronic: ["Euphoric Synth Dreamer", "Blissful House Soul", "A Joyful Techno Architect", "The Radiant Beat Seeker", "Where Euphoria Meets Electronic"],
    'hip-hop': ["Joyful Hip-Hop Soul", "Euphoric Boom Bap Heart", "A Radiant Golden Era Poet", "The Blissful Rhythm Seeker", "Where Joy Meets the Beat"],
    indie: ["Joyful Indie Dreamer", "Euphoric Shoegaze Soul", "A Radiant Dream Pop Wanderer", "The Blissful Alternative Seeker", "Where Joy Meets the Underground"],
    pop: ["Euphoric Pop Soul", "Joyful Melody Dreamer", "A Radiant Synth-Pop Heart", "The Blissful Hook Seeker", "Where Joy Meets the Chorus"],
    jazz: ["Joyful Jazz Soul", "Euphoric Bebop Dreamer", "A Radiant Cool Jazz Poet", "The Blissful Swing Seeker", "Where Joy Meets Improvisation"],
    metal: ["Euphoric Metal Soul", "Joyful Heavy Dreamer", "A Radiant Thrash Heart", "The Blissful Riff Seeker", "Where Joy Meets the Heavy"],
    folk: ["Joyful Folk Soul", "Euphoric Acoustic Dreamer", "A Radiant Americana Heart", "The Blissful Roots Seeker", "Where Joy Meets the Acoustic"],
    'r&b': ["Euphoric R&B Soul", "Joyful Neo-Soul Dreamer", "A Radiant Motown Heart", "The Blissful Groove Seeker", "Where Joy Meets the Groove"],
    classical: ["Joyful Classical Soul", "Euphoric Orchestral Dreamer", "A Radiant Romantic Era Heart", "The Blissful Symphony Seeker", "Where Joy Meets the Orchestra"],
    country: ["Euphoric Country Soul", "Joyful Nashville Dreamer", "A Radiant Outlaw Country Heart", "The Blissful Twang Seeker", "Where Joy Meets the Twang"],
    eclectic: ["Joyful Sonic Explorer", "Euphoric Genre-Fluid Soul", "A Radiant Musical Wanderer", "The Blissful Sound Seeker", "Where Joy Meets Every Genre"]
  },
  sad: {
    rock: ["Melancholic Rock Soul", "Wistful Guitar Dreamer", "A Sorrowful Classic Rock Heart", "The Pensive Riff Wanderer", "Where Sorrow Meets Power Chords"],
    electronic: ["Melancholic Synth Dreamer", "Wistful Ambient Soul", "A Sorrowful Techno Architect", "The Pensive Beat Seeker", "Where Melancholy Meets Electronic"],
    'hip-hop': ["Melancholic Hip-Hop Soul", "Wistful Boom Bap Heart", "A Sorrowful Conscious Rap Poet", "The Pensive Rhythm Seeker", "Where Sorrow Meets the Beat"],
    indie: ["Melancholic Indie Dreamer", "Wistful Shoegaze Soul", "A Sorrowful Dream Pop Wanderer", "The Pensive Alternative Seeker", "Where Melancholy Meets the Underground"],
    pop: ["Melancholic Pop Soul", "Wistful Melody Dreamer", "A Sorrowful Synth-Pop Heart", "The Pensive Hook Seeker", "Where Sorrow Meets the Chorus"],
    jazz: ["Melancholic Jazz Soul", "Wistful Bebop Dreamer", "A Sorrowful Cool Jazz Poet", "The Pensive Blue Note Seeker", "Where Melancholy Meets Improvisation"],
    metal: ["Melancholic Metal Soul", "Wistful Doom Dreamer", "A Sorrowful Heavy Heart", "The Pensive Riff Seeker", "Where Sorrow Meets the Heavy"],
    folk: ["Melancholic Folk Soul", "Wistful Acoustic Dreamer", "A Sorrowful Americana Heart", "The Pensive Roots Seeker", "Where Melancholy Meets the Acoustic"],
    'r&b': ["Melancholic R&B Soul", "Wistful Neo-Soul Dreamer", "A Sorrowful Quiet Storm Heart", "The Pensive Groove Seeker", "Where Sorrow Meets the Groove"],
    classical: ["Melancholic Classical Soul", "Wistful Orchestral Dreamer", "A Sorrowful Romantic Era Heart", "The Pensive Symphony Seeker", "Where Melancholy Meets the Orchestra"],
    country: ["Melancholic Country Soul", "Wistful Nashville Dreamer", "A Sorrowful Outlaw Country Heart", "The Pensive Twang Seeker", "Where Sorrow Meets the Twang"],
    eclectic: ["Melancholic Sonic Explorer", "Wistful Genre-Fluid Soul", "A Sorrowful Musical Wanderer", "The Pensive Sound Seeker", "Where Melancholy Meets Every Genre"]
  },
  angry: {
    rock: ["Furious Rock Soul", "Fierce Guitar Rebel", "A Defiant Classic Rock Heart", "The Raging Riff Warrior", "Where Fury Meets Power Chords"],
    electronic: ["Furious Synth Rebel", "Fierce Techno Soul", "A Defiant Industrial Architect", "The Raging Beat Warrior", "Where Fury Meets Electronic"],
    'hip-hop': ["Furious Hip-Hop Soul", "Fierce Boom Bap Rebel", "A Defiant Conscious Rap Poet", "The Raging Rhythm Warrior", "Where Fury Meets the Beat"],
    indie: ["Furious Indie Rebel", "Fierce Post-Punk Soul", "A Defiant Noise Rock Wanderer", "The Raging Alternative Warrior", "Where Fury Meets the Underground"],
    pop: ["Furious Pop Soul", "Fierce Melody Rebel", "A Defiant Synth-Pop Heart", "The Raging Hook Warrior", "Where Fury Meets the Chorus"],
    jazz: ["Furious Jazz Soul", "Fierce Free Jazz Rebel", "A Defiant Bebop Poet", "The Raging Swing Warrior", "Where Fury Meets Improvisation"],
    metal: ["Furious Metal Soul", "Fierce Thrash Rebel", "A Defiant Death Metal Heart", "The Raging Riff Warrior", "Where Fury Meets the Heavy"],
    folk: ["Furious Folk Soul", "Fierce Protest Song Rebel", "A Defiant Americana Heart", "The Raging Roots Warrior", "Where Fury Meets the Acoustic"],
    'r&b': ["Furious R&B Soul", "Fierce Neo-Soul Rebel", "A Defiant Funk Heart", "The Raging Groove Warrior", "Where Fury Meets the Groove"],
    classical: ["Furious Classical Soul", "Fierce Orchestral Rebel", "A Defiant Romantic Era Heart", "The Raging Symphony Warrior", "Where Fury Meets the Orchestra"],
    country: ["Furious Country Soul", "Fierce Outlaw Country Rebel", "A Defiant Nashville Heart", "The Raging Twang Warrior", "Where Fury Meets the Twang"],
    eclectic: ["Furious Sonic Explorer", "Fierce Genre-Fluid Rebel", "A Defiant Musical Wanderer", "The Raging Sound Warrior", "Where Fury Meets Every Genre"]
  },
  relaxed: {
    rock: ["Serene Rock Soul", "Tranquil Guitar Dreamer", "A Peaceful Classic Rock Heart", "The Mellow Riff Wanderer", "Where Peace Meets Power Chords"],
    electronic: ["Serene Synth Dreamer", "Tranquil Ambient Soul", "A Peaceful Chillout Architect", "The Mellow Beat Seeker", "Where Peace Meets Electronic"],
    'hip-hop': ["Serene Hip-Hop Soul", "Tranquil Lo-Fi Hip-Hop Heart", "A Peaceful Boom Bap Poet", "The Mellow Rhythm Seeker", "Where Peace Meets the Beat"],
    indie: ["Serene Indie Dreamer", "Tranquil Dream Pop Soul", "A Peaceful Shoegaze Wanderer", "The Mellow Alternative Seeker", "Where Peace Meets the Underground"],
    pop: ["Serene Pop Soul", "Tranquil Melody Dreamer", "A Peaceful Synth-Pop Heart", "The Mellow Hook Seeker", "Where Peace Meets the Chorus"],
    jazz: ["Serene Jazz Soul", "Tranquil Cool Jazz Dreamer", "A Peaceful Modal Jazz Poet", "The Mellow Swing Seeker", "Where Peace Meets Improvisation"],
    metal: ["Serene Metal Soul", "Tranquil Doom Dreamer", "A Peaceful Progressive Metal Heart", "The Mellow Riff Seeker", "Where Peace Meets the Heavy"],
    folk: ["Serene Folk Soul", "Tranquil Acoustic Dreamer", "A Peaceful Americana Heart", "The Mellow Roots Seeker", "Where Peace Meets the Acoustic"],
    'r&b': ["Serene R&B Soul", "Tranquil Quiet Storm Dreamer", "A Peaceful Neo-Soul Heart", "The Mellow Groove Seeker", "Where Peace Meets the Groove"],
    classical: ["Serene Classical Soul", "Tranquil Orchestral Dreamer", "A Peaceful Impressionist Heart", "The Mellow Symphony Seeker", "Where Peace Meets the Orchestra"],
    country: ["Serene Country Soul", "Tranquil Nashville Dreamer", "A Peaceful Americana Heart", "The Mellow Twang Seeker", "Where Peace Meets the Twang"],
    eclectic: ["Serene Sonic Explorer", "Tranquil Genre-Fluid Soul", "A Peaceful Musical Wanderer", "The Mellow Sound Seeker", "Where Peace Meets Every Genre"]
  },
  energetic: {
    rock: ["Restless Rock Soul", "Kinetic Guitar Rebel", "A Vibrant Classic Rock Heart", "The Electric Riff Warrior", "Where Energy Meets Power Chords"],
    electronic: ["Restless Synth Soul", "Kinetic Techno Rebel", "A Vibrant House Architect", "The Electric Beat Warrior", "Where Energy Meets Electronic"],
    'hip-hop': ["Restless Hip-Hop Soul", "Kinetic Boom Bap Rebel", "A Vibrant Trap Heart", "The Electric Rhythm Warrior", "Where Energy Meets the Beat"],
    indie: ["Restless Indie Rebel", "Kinetic Post-Punk Soul", "A Vibrant Garage Rock Wanderer", "The Electric Alternative Warrior", "Where Energy Meets the Underground"],
    pop: ["Restless Pop Soul", "Kinetic Dance Pop Rebel", "A Vibrant Synth-Pop Heart", "The Electric Hook Warrior", "Where Energy Meets the Chorus"],
    jazz: ["Restless Jazz Soul", "Kinetic Bebop Rebel", "A Vibrant Hard Bop Poet", "The Electric Swing Warrior", "Where Energy Meets Improvisation"],
    metal: ["Restless Metal Soul", "Kinetic Thrash Rebel", "A Vibrant Speed Metal Heart", "The Electric Riff Warrior", "Where Energy Meets the Heavy"],
    folk: ["Restless Folk Soul", "Kinetic Bluegrass Rebel", "A Vibrant Celtic Heart", "The Electric Roots Warrior", "Where Energy Meets the Acoustic"],
    'r&b': ["Restless R&B Soul", "Kinetic Funk Rebel", "A Vibrant New Jack Swing Heart", "The Electric Groove Warrior", "Where Energy Meets the Groove"],
    classical: ["Restless Classical Soul", "Kinetic Orchestral Rebel", "A Vibrant Romantic Era Heart", "The Electric Symphony Warrior", "Where Energy Meets the Orchestra"],
    country: ["Restless Country Soul", "Kinetic Honky-Tonk Rebel", "A Vibrant Outlaw Country Heart", "The Electric Twang Warrior", "Where Energy Meets the Twang"],
    eclectic: ["Restless Sonic Explorer", "Kinetic Genre-Fluid Rebel", "A Vibrant Musical Wanderer", "The Electric Sound Warrior", "Where Energy Meets Every Genre"]
  },
  dark: {
    rock: ["Brooding Rock Soul", "Shadowed Guitar Dreamer", "A Nocturnal Classic Rock Heart", "The Haunted Riff Wanderer", "Where Darkness Meets Power Chords"],
    electronic: ["Brooding Synth Dreamer", "Shadowed Darkwave Soul", "A Nocturnal Industrial Architect", "The Haunted Beat Seeker", "Where Darkness Meets Electronic"],
    'hip-hop': ["Brooding Hip-Hop Soul", "Shadowed Boom Bap Heart", "A Nocturnal Conscious Rap Poet", "The Haunted Rhythm Seeker", "Where Darkness Meets the Beat"],
    indie: ["Brooding Indie Dreamer", "Shadowed Post-Punk Soul", "A Nocturnal Shoegaze Wanderer", "The Haunted Alternative Seeker", "Where Darkness Meets the Underground"],
    pop: ["Brooding Pop Soul", "Shadowed Melody Dreamer", "A Nocturnal Synth-Pop Heart", "The Haunted Hook Seeker", "Where Darkness Meets the Chorus"],
    jazz: ["Brooding Jazz Soul", "Shadowed Bebop Dreamer", "A Nocturnal Cool Jazz Poet", "The Haunted Blue Note Seeker", "Where Darkness Meets Improvisation"],
    metal: ["Brooding Metal Soul", "Shadowed Black Metal Dreamer", "A Nocturnal Doom Heart", "The Haunted Riff Seeker", "Where Darkness Meets the Heavy"],
    folk: ["Brooding Folk Soul", "Shadowed Acoustic Dreamer", "A Nocturnal Dark Folk Heart", "The Haunted Roots Seeker", "Where Darkness Meets the Acoustic"],
    'r&b': ["Brooding R&B Soul", "Shadowed Neo-Soul Dreamer", "A Nocturnal Quiet Storm Heart", "The Haunted Groove Seeker", "Where Darkness Meets the Groove"],
    classical: ["Brooding Classical Soul", "Shadowed Orchestral Dreamer", "A Nocturnal Romantic Era Heart", "The Haunted Symphony Seeker", "Where Darkness Meets the Orchestra"],
    country: ["Brooding Country Soul", "Shadowed Outlaw Country Dreamer", "A Nocturnal Nashville Heart", "The Haunted Twang Seeker", "Where Darkness Meets the Twang"],
    eclectic: ["Brooding Sonic Explorer", "Shadowed Genre-Fluid Soul", "A Nocturnal Musical Wanderer", "The Haunted Sound Seeker", "Where Darkness Meets Every Genre"]
  }
};

const FALLBACK_HEADLINES = {
  rock: ["Devoted Rock Soul", "True Guitar Heart", "A Classic Rock Wanderer", "The Eternal Riff Seeker", "Rock at Heart"],
  electronic: ["Devoted Synth Soul", "True Electronic Heart", "A Techno Wanderer", "The Eternal Beat Seeker", "Born Electronic"],
  'hip-hop': ["Devoted Hip-Hop Soul", "True Boom Bap Heart", "A Golden Era Wanderer", "The Eternal Rhythm Seeker", "Hip-Hop at Heart"],
  indie: ["Devoted Indie Soul", "True Alternative Heart", "A Shoegaze Wanderer", "The Eternal Underground Seeker", "Forever Indie"],
  pop: ["Devoted Pop Soul", "True Melody Heart", "A Synth-Pop Wanderer", "The Eternal Hook Seeker", "Pop at Heart"],
  jazz: ["Devoted Jazz Soul", "True Bebop Heart", "A Cool Jazz Wanderer", "The Eternal Swing Seeker", "Forever Jazz"],
  metal: ["Devoted Metal Soul", "True Heavy Heart", "A Thrash Wanderer", "The Eternal Riff Seeker", "Metal at Heart"],
  folk: ["Devoted Folk Soul", "True Acoustic Heart", "An Americana Wanderer", "The Eternal Roots Seeker", "Folk at Heart"],
  'r&b': ["Devoted R&B Soul", "True Neo-Soul Heart", "A Motown Wanderer", "The Eternal Groove Seeker", "Soul at Heart"],
  classical: ["Devoted Classical Soul", "True Orchestral Heart", "A Romantic Era Wanderer", "The Eternal Symphony Seeker", "Classical at Heart"],
  country: ["Devoted Country Soul", "True Nashville Heart", "An Outlaw Country Wanderer", "The Eternal Twang Seeker", "Country at Heart"],
  eclectic: ["Devoted Sonic Explorer", "True Musical Heart", "A Genre-Fluid Wanderer", "The Eternal Sound Seeker", "Music at Heart"]
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
