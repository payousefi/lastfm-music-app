(function() {
  'use strict';

  // Service identifiers for configurable pipeline
  const SERVICES = {
    // Metadata services (find artist IDs)
    MUSICBRAINZ: 'MUSICBRAINZ',   // Finds MBID + Discogs ID
    
    // Image services (get actual images)
    DISCOGS: 'DISCOGS',           // Needs Discogs ID (from MusicBrainz)
    THE_AUDIO_DB: 'THE_AUDIO_DB', // Needs MBID (from MusicBrainz)
    ITUNES: 'ITUNES'              // Standalone - searches by name, gets album art
  };

  // Configuration
  const CONFIG = {
    lastfmApiKey: '***REMOVED***',
    discogsKey: '***REMOVED***',
    discogsSecret: '***REMOVED***',
    defaultUsername: 'solitude12',
    artistLimit: 12,
    period: '1month',
    tileSize: 250, // Tile size in pixels (matches CSS .artist width/height)
    
    // Image source pipeline - tried in order until image found
    // MusicBrainz is always called first if DISCOGS or THE_AUDIO_DB are in the list
    // Example configs:
    //   Default: ['DISCOGS', 'THE_AUDIO_DB', 'ITUNES']
    //   iTunes only: ['ITUNES']
    //   iTunes first: ['ITUNES', 'DISCOGS', 'THE_AUDIO_DB']
    imageSources:  ['ITUNES', 'DISCOGS', 'THE_AUDIO_DB'],
  };

  // Discogs rate limiter - adaptive delay based on remaining requests from headers
  // Discogs allows 60 requests/minute. We adjust speed based on how many are left.
  const discogsRateLimiter = {
    remaining: 60,
    
    async waitIfNeeded() {
      // Adaptive delay: go faster when we have plenty, slower when running low
      // remaining > 30: 500ms (fast)
      // remaining 10-30: 1000ms (moderate)
      // remaining < 10: 2000ms (slow, conserve)
      let delay;
      if (this.remaining > 30) {
        delay = 500;
      } else if (this.remaining > 10) {
        delay = 1000;
      } else {
        delay = 2000;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    },
    
    updateFromHeaders(headers) {
      const remaining = headers.get('X-Discogs-Ratelimit-Remaining');
      if (remaining !== null) {
        this.remaining = parseInt(remaining, 10);
      }
    }
  };

  // MusicBrainz rate limiter - adaptive delay based on remaining requests from headers
  // MusicBrainz allows ~1200 requests per time window. We adjust speed based on how many are left.
  const musicBrainzRateLimiter = {
    remaining: 1200,
    
    async waitIfNeeded() {
      // Adaptive delay based on remaining requests
      // remaining > 600: 100ms (fast - plenty of headroom)
      // remaining 200-600: 500ms (moderate)
      // remaining < 200: 1000ms (slow, conserve)
      let delay;
      if (this.remaining > 600) {
        delay = 100;
      } else if (this.remaining > 200) {
        delay = 500;
      } else {
        delay = 1000;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    },
    
    updateFromHeaders(headers) {
      const remaining = headers.get('X-RateLimit-Remaining');
      if (remaining !== null) {
        this.remaining = parseInt(remaining, 10);
      }
    }
  };

  // DOM Elements
  let wrapperEl, contentEl, usernameInput, headerSubtitle;

  // Image cache - keyed by "artistName:SOURCE" for per-source caching
  // Also stores MusicBrainz data keyed by "artistName:MB_DATA"
  const imageCache = {};

  // Loading timer (show spinner only after 2s delay)
  let loadingTimer = null;

  // Current artists (for reloading when sources change)
  let currentArtists = [];

  /**
   * Sanitize a string to prevent XSS attacks
   */
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /**
   * Generate a random HSL color for the background
   */
  function generateRandomColor() {
    const hue = Math.round(Math.random() * 359);
    const saturation = Math.round((Math.random() * 30) + 30);
    const lightness = Math.round((Math.random() * 30) + 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Animate background color change
   */
  function animateBackgroundColor(targetColor) {
    document.body.style.transition = 'background-color 0.7s ease-out';
    wrapperEl.style.transition = 'background-color 0.7s ease-out';
    document.body.style.backgroundColor = targetColor;
    wrapperEl.style.backgroundColor = targetColor;
    
    // Set CSS variable for star color to match background (cutout effect)
    // Uses exact same polygon points as the loading star in CSS
    const encodedColor = encodeURIComponent(targetColor);
    const starSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpolygon fill='${encodedColor}' points='50,5 61,40 98,40 68,62 79,97 50,75 21,97 32,62 2,40 39,40'/%3E%3C/svg%3E")`;
    document.documentElement.style.setProperty('--star-bg', starSvg);
  }

  /**
   * Update document title and meta description to match SEO
   */
  function updateDocumentMeta(username) {
    const isDefault = username === CONFIG.defaultUsername;
    const titleName = isDefault ? 'Payam Yousefi' : sanitize(username);
    const whosText = isDefault ? 'my' : `${sanitize(username)}'s`;
    
    // Update title
    document.title = `Music — ${titleName}`;
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', `Curious about ${whosText} taste in music? This past month's top artists are…`);
    }
  }

  /**
   * Update the header subtitle with the current username
   */
  function updateHeaderSubtitle(username) {
    // Update document title and meta description to match SEO
    updateDocumentMeta(username);
    
    if (headerSubtitle) {
      const isDefault = username === CONFIG.defaultUsername;
      const whosText = isDefault
        ? 'my'
        : `<a href="https://last.fm/user/${encodeURIComponent(username)}" target="_blank" rel="noopener noreferrer">${sanitize(username)}</a>'s`;
      headerSubtitle.innerHTML = `Curious about ${whosText} taste in music?<br>This past month's top artists are…`;
    }
  }

  /**
   * Show loading spinner (only after 2s delay)
   */
  function showLoadingDelayed() {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
    }
    loadingTimer = setTimeout(() => {
      contentEl.innerHTML = '<div class="loading-spinner"></div>';
      contentEl.style.display = 'block';
    }, 2000);
  }

  /**
   * Cancel loading spinner
   */
  function cancelLoading() {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
  }

  /**
   * Slide down animation for content
   */
  function slideDown(element, duration = 500) {
    element.style.display = 'block';
    element.style.overflow = 'hidden';
    element.style.height = '0';
    element.style.opacity = '0';
    
    element.offsetHeight;
    const targetHeight = element.scrollHeight;
    
    element.style.transition = `height ${duration}ms ease-out, opacity ${duration}ms ease-out`;
    element.style.height = targetHeight + 'px';
    element.style.opacity = '1';
    
    setTimeout(() => {
      element.style.height = '';
      element.style.overflow = '';
      element.style.transition = '';
    }, duration);
  }

  /**
   * Check if a Discogs image URL is valid (not a placeholder)
   */
  function isValidDiscogsImage(url) {
    if (!url) return false;
    if (url.includes('spacer.gif')) return false;
    if (url === '') return false;
    return true;
  }

  /**
   * Get MBID and Discogs ID from MusicBrainz relations
   * Flow: Last.fm MBID (or name search) → MusicBrainz → { mbid, discogsId }
   */
  async function getMusicBrainzData(artistName, mbid) {
    let effectiveMbid = mbid;
    
    // If no MBID from Last.fm, search MusicBrainz by name
    if (!effectiveMbid || effectiveMbid.length === 0) {
      try {
        // Wait if rate limited
        await musicBrainzRateLimiter.waitIfNeeded();
        
        const searchUrl = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artistName)}&fmt=json&limit=1`;
        const searchResponse = await fetch(searchUrl);
        
        // Update rate limiter from response headers
        musicBrainzRateLimiter.updateFromHeaders(searchResponse.headers);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.artists && searchData.artists.length > 0) {
            effectiveMbid = searchData.artists[0].id;
          }
        }
      } catch (error) {
        // Search failed, continue without MBID
      }
    }
    
    if (!effectiveMbid) {
      return { mbid: null, discogsId: null };
    }
    
    // Fetch MusicBrainz artist with URL relations
    let discogsId = null;
    try {
      // Wait if rate limited
      await musicBrainzRateLimiter.waitIfNeeded();
      
      const mbUrl = `https://musicbrainz.org/ws/2/artist/${effectiveMbid}?inc=url-rels&fmt=json`;
      const response = await fetch(mbUrl);
      
      // Update rate limiter from response headers
      musicBrainzRateLimiter.updateFromHeaders(response.headers);
      
      if (response.ok) {
        const data = await response.json();
        
        // Find Discogs relation and extract artist ID
        if (data.relations) {
          for (const rel of data.relations) {
            if (rel.type === 'discogs' && rel.url && rel.url.resource) {
              const match = rel.url.resource.match(/discogs\.com\/artist\/(\d+)/);
              if (match) {
                discogsId = match[1];
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      // Continue with just MBID
    }
    
    return { mbid: effectiveMbid, discogsId };
  }

  /**
   * Fetch artist image from TheAudioDB using MBID
   */
  async function fetchAudioDBImage(mbid) {
    if (!mbid) {
      return null;
    }
    
    try {
      const url = `https://www.theaudiodb.com/api/v1/json/2/artist-mb.php?i=${mbid}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      if (data.artists && data.artists.length > 0) {
        const artist = data.artists[0];
        // Return thumb or full image
        return artist.strArtistThumb || artist.strArtistFanart || null;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch artist image from iTunes/Apple Music Search API
   * Two-step process: search for artist, then lookup their albums for artwork
   */
  async function fetchiTunesImage(artistName) {
    if (!artistName) {
      return null;
    }
    
    try {
      // Step 1: Search for the artist to get their ID
      const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`;
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) {
        return null;
      }
      
      const searchData = await searchResponse.json();
      
      if (!searchData.results || searchData.results.length === 0) {
        return null;
      }
      
      const artist = searchData.results[0];
      // Verify artist name matches (case-insensitive)
      if (!artist.artistName || artist.artistName.toLowerCase() !== artistName.toLowerCase()) {
        return null;
      }
      
      const artistId = artist.artistId;
      
      // Step 2: Lookup artist's albums to get artwork
      const lookupUrl = `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=1`;
      const lookupResponse = await fetch(lookupUrl);
      
      if (!lookupResponse.ok) {
        return null;
      }
      
      const lookupData = await lookupResponse.json();
      
      // Results include the artist first, then albums
      if (lookupData.results && lookupData.results.length > 1) {
        const album = lookupData.results[1]; // First album after artist
        if (album.artworkUrl100) {
          // Replace 100x100 with 3x tile size for retina displays
          const targetSize = CONFIG.tileSize * 3;
          return album.artworkUrl100.replace('100x100', `${targetSize}x${targetSize}`);
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch artist image from Discogs API using verified artist ID
   * Uses rate limiter to respect API limits while maximizing throughput
   * Optimizes for images at least 3x tile size for retina displays
   */
  async function fetchDiscogsImageById(discogsId) {
    if (!discogsId) {
      return null;
    }
    
    const MIN_SIZE = CONFIG.tileSize * 3; // 750px for retina displays (3x 250px tiles)
    
    // Wait if rate limited
    await discogsRateLimiter.waitIfNeeded();
    
    try {
      const url = `https://api.discogs.com/artists/${discogsId}?key=${CONFIG.discogsKey}&secret=${CONFIG.discogsSecret}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MusicApp/1.0 +https://music.payamyousefi.com'
        }
      });
      
      // Update rate limiter from response headers
      discogsRateLimiter.updateFromHeaders(response.headers);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      if (data.images && data.images.length > 0) {
        // Filter valid images and sort by size preference
        const validImages = data.images.filter(img => isValidDiscogsImage(img.uri));
        
        if (validImages.length === 0) {
          return null;
        }
        
        // Prefer primary image if it meets size requirements
        const primaryImage = validImages.find(img => img.type === 'primary');
        
        // Check if primary image is large enough
        if (primaryImage && primaryImage.width >= MIN_SIZE && primaryImage.height >= MIN_SIZE) {
          return primaryImage.uri;
        }
        
        // Find any image that meets size requirements
        const largeImage = validImages.find(img =>
          img.width >= MIN_SIZE && img.height >= MIN_SIZE
        );
        
        if (largeImage) {
          return largeImage.uri;
        }
        
        // Fall back to primary or first valid image if no large images available
        return (primaryImage || validImages[0]).uri;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Prefetch all MusicBrainz data in parallel (no rate limit)
   * Returns map of artistName -> { mbid, discogsId }
   */
  async function prefetchMusicBrainzData(artists) {
    const promises = artists.map(async (artist) => {
      const data = await getMusicBrainzData(artist.name, artist.mbid);
      return { name: artist.name, ...data };
    });
    
    const results = await Promise.all(promises);
    const dataMap = {};
    for (const result of results) {
      dataMap[result.name] = { mbid: result.mbid, discogsId: result.discogsId };
    }
    return dataMap;
  }

  /**
   * Fetch artist image using configurable source pipeline
   * Sources are tried in order defined by CONFIG.imageSources
   * Images are cached per-source so switching sources uses cached data when available
   */
  async function fetchArtistImageWithData(artistName, mbData) {
    const { mbid, discogsId } = mbData || {};
    let imageUrl = null;
    
    // Try each source in configured order, checking cache first
    for (const source of CONFIG.imageSources) {
      if (imageUrl) break;
      
      const cacheKey = `${artistName}:${source}`;
      
      // Check cache first
      if (imageCache[cacheKey] !== undefined) {
        if (imageCache[cacheKey]) {
          imageUrl = imageCache[cacheKey];
          break;
        }
        // Cached as null/empty means this source has no image, try next
        continue;
      }
      
      // Not in cache, fetch from source
      let fetchedUrl = null;
      
      switch (source) {
        case 'DISCOGS':
          if (discogsId) {
            fetchedUrl = await fetchDiscogsImageById(discogsId);
          }
          break;
          
        case 'THE_AUDIO_DB':
          if (mbid) {
            fetchedUrl = await fetchAudioDBImage(mbid);
          }
          break;
          
        case 'ITUNES':
          fetchedUrl = await fetchiTunesImage(artistName);
          break;
      }
      
      // Cache the result (even if null, to avoid re-fetching)
      imageCache[cacheKey] = fetchedUrl;
      
      if (fetchedUrl) {
        imageUrl = fetchedUrl;
      }
    }
    
    return imageUrl;
  }

  /**
   * Preload an image and return a promise
   */
  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject();
      img.src = url;
    });
  }

  /**
   * Prepare a tile with its image (preload but don't show yet)
   */
  async function prepareTileImage(artistName, imageUrl) {
    const tiles = contentEl.querySelectorAll('.artist');
    for (const tile of tiles) {
      if (tile.dataset.artist === artistName) {
        if (imageUrl) {
          try {
            await preloadImage(imageUrl);
            // Store image URL but don't show yet
            tile.dataset.imageUrl = imageUrl;
            return { tile, success: true };
          } catch (e) {
            return { tile, success: false };
          }
        }
        return { tile, success: false };
      }
    }
    return null;
  }

  /**
   * Reveal a row of tiles with fade-in effect
   */
  function revealRow(tiles) {
    tiles.forEach(({ tile, success }) => {
      // Remove loading states
      tile.classList.remove('loading-image', 'loading-active');
      
      if (success && tile.dataset.imageUrl) {
        tile.style.backgroundImage = `url(${tile.dataset.imageUrl})`;
        tile.classList.add('image-loaded');
      } else {
        tile.classList.add('no-image');
      }
    });
  }

  /**
   * Mark a tile as actively loading (triggers pulsing animation)
   */
  function setTileLoadingActive(artistName) {
    const tiles = contentEl.querySelectorAll('.artist');
    for (const tile of tiles) {
      if (tile.dataset.artist === artistName) {
        tile.classList.remove('loading-image');
        tile.classList.add('loading-active');
        break;
      }
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * Returns a new shuffled array, doesn't modify original
   */
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Fetch all artist images with optimized API calls:
   * 1. Prefetch all MusicBrainz data in parallel (no rate limit) - cached for reuse
   * 2. Fetch images in random order with rate limiting
   * 3. Reveal each tile immediately as its image loads
   */
  async function fetchAllArtistImages(artists) {
    // Shuffle artists for random reveal order
    const shuffledArtists = shuffleArray(artists);
    
    // Phase 1: Get MusicBrainz data if needed (check cache first)
    const needsMusicBrainz = CONFIG.imageSources.some(s => s === 'DISCOGS' || s === 'THE_AUDIO_DB');
    let mbDataMap = {};
    
    if (needsMusicBrainz) {
      // Check if we have cached MB data for all artists
      const uncachedArtists = artists.filter(a => imageCache[`${a.name}:MB_DATA`] === undefined);
      
      if (uncachedArtists.length > 0) {
        // Fetch MB data for uncached artists
        const newMbData = await prefetchMusicBrainzData(uncachedArtists);
        // Cache the results
        for (const [name, data] of Object.entries(newMbData)) {
          imageCache[`${name}:MB_DATA`] = data;
        }
      }
      
      // Build mbDataMap from cache
      for (const artist of artists) {
        mbDataMap[artist.name] = imageCache[`${artist.name}:MB_DATA`] || {};
      }
    }
    
    // Phase 2: Fetch images in random order, reveal each immediately
    for (const artist of shuffledArtists) {
      const mbData = mbDataMap[artist.name] || {};
      
      // Mark tile as actively loading (pulsing star)
      setTileLoadingActive(artist.name);
      
      // Rate limiting is handled inside fetchDiscogsImageById via discogsRateLimiter
      const imageUrl = await fetchArtistImageWithData(artist.name, mbData);
      const result = await prepareTileImage(artist.name, imageUrl);
      
      // Reveal tile immediately
      if (result) {
        revealRow([result]);
      }
    }
  }

  /**
   * Render error state
   */
  function renderError(message) {
    contentEl.innerHTML = `<div class="error-state"><p><em>${sanitize(message)}</em></p></div>`;
    slideDown(contentEl);
  }

  /**
   * Show/hide the rate limit note with delay before hiding
   */
  function showRateLimitNote(show) {
    const note = document.querySelector('.rate-limit-note');
    if (!note) return;
    
    if (show) {
      note.classList.remove('fading');
      note.classList.add('visible');
    } else {
      // Add delay before hiding to allow users to finish reading
      setTimeout(() => {
        note.classList.add('fading');
        // After fade animation completes, hide completely
        setTimeout(() => {
          note.classList.remove('visible', 'fading');
        }, 300);
      }, 3000); // 3 second delay before starting fade
    }
  }

  /**
   * Render artist tiles with accessibility support
   */
  function renderArtists(artists) {
    // Store artists for potential reload when sources change
    currentArtists = artists;
    
    const tiles = artists.map((artist, index) => {
      const safeName = sanitize(artist.name);
      const safeUrl = sanitize(artist.url);
      const playcount = parseInt(artist.playcount, 10) || 0;
      const playsText = playcount === 1 ? 'play' : 'plays';
      
      // Accessible link with descriptive aria-label
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" aria-label="${safeName}, ${playcount} ${playsText} this month"><div class="artist loading-image" data-artist="${safeName}" role="img" aria-label="${safeName}"><div class="title">${safeName}<span>${playcount} ${playsText}</span></div><div class="dark" aria-hidden="true"></div></div></a>`;
    });
    
    // Add heading for screen readers
    contentEl.innerHTML = `<h2 class="visually-hidden">Top ${artists.length} artists this month</h2>` + tiles.join('');
    slideDown(contentEl, 1000);
    
    // Show rate limit note while loading images
    showRateLimitNote(true);
    
    fetchAllArtistImages(artists).then(() => {
      // Hide rate limit note when all images are loaded
      showRateLimitNote(false);
      
      // Prefetch images from other sources in background for instant switching
      prefetchOtherSources(artists);
    });
    animateBackgroundColor(generateRandomColor());
  }

  /**
   * Prefetch images from non-primary sources in background
   * This enables instant crossfade when switching sources
   */
  async function prefetchOtherSources(artists) {
    const primarySource = CONFIG.imageSources[0];
    const otherSources = CONFIG.imageSources.slice(1);
    
    if (otherSources.length === 0) return;
    
    // Get MusicBrainz data from cache (should already be there)
    const mbDataMap = {};
    for (const artist of artists) {
      mbDataMap[artist.name] = imageCache[`${artist.name}:MB_DATA`] || {};
    }
    
    // Prefetch each source sequentially to avoid rate limit issues
    for (const source of otherSources) {
      for (const artist of artists) {
        const cacheKey = `${artist.name}:${source}`;
        
        // Skip if already cached
        if (imageCache[cacheKey] !== undefined) continue;
        
        const mbData = mbDataMap[artist.name];
        let imageUrl = null;
        
        try {
          switch (source) {
            case 'DISCOGS':
              if (mbData.discogsId) {
                imageUrl = await fetchDiscogsImageById(mbData.discogsId);
              }
              break;
            case 'THE_AUDIO_DB':
              if (mbData.mbid) {
                imageUrl = await fetchAudioDBImage(mbData.mbid);
              }
              break;
            case 'ITUNES':
              imageUrl = await fetchiTunesImage(artist.name);
              break;
          }
        } catch (e) {
          // Silently fail - this is background prefetch
        }
        
        // Cache result (even if null)
        imageCache[cacheKey] = imageUrl;
        
        // Preload the image if we got one
        if (imageUrl) {
          preloadImage(imageUrl).catch(() => {});
        }
      }
    }
  }

  /**
   * Fetch and display top artists for a user
   */
  async function loadUser(username) {
    const sanitizedUsername = sanitize(username);
    
    updateHeaderSubtitle(username);
    showLoadingDelayed();
    
    const apiUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getTopArtists` +
                   `&user=${encodeURIComponent(sanitizedUsername)}` +
                   `&api_key=${CONFIG.lastfmApiKey}` +
                   `&limit=${CONFIG.artistLimit}` +
                   `&period=${CONFIG.period}` +
                   `&format=json`;
    
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      cancelLoading();
      
      if (data.error) {
        renderError("Unable to load this user's listening history.");
        return;
      }
      
      if (data.topartists && data.topartists.artist && data.topartists.artist.length > 0) {
        renderArtists(data.topartists.artist);
      } else {
        renderError("No listening data available for this user in the past month.");
      }
    } catch (error) {
      cancelLoading();
      console.error('Last.fm API error:', error);
      renderError("Unable to load listening history. Please try again later.");
    }
  }

  /**
   * Get username from URL path
   */
  function getUsernameFromPath() {
    const path = window.location.pathname.split('/');
    const rawUsername = (path[1] && path[1] !== '') ? path[1] : CONFIG.defaultUsername;
    return decodeURIComponent(rawUsername);
  }

  /**
   * Handle username form submission
   */
  function handleUsernameSubmit(event) {
    if (event.key === 'Enter') {
      const inputVal = usernameInput.value.trim();
      if (inputVal) {
        const newUrl = '/' + encodeURIComponent(inputVal);
        window.history.pushState({ username: inputVal }, '', newUrl);
        contentEl.style.display = 'none';
        contentEl.innerHTML = '';
        loadUser(inputVal);
        usernameInput.value = '';
      }
    }
  }

  /**
   * Handle browser back/forward navigation
   */
  function handlePopState() {
    const username = getUsernameFromPath();
    contentEl.style.display = 'none';
    contentEl.innerHTML = '';
    loadUser(username);
  }

  // Display names for image sources
  const SOURCE_NAMES = {
    'ITUNES': 'iTunes',
    'DISCOGS': 'Discogs',
    'THE_AUDIO_DB': 'TheAudioDB'
  };

  /**
   * Render image source radio buttons based on CONFIG.imageSources
   */
  function renderImageSourceRadios() {
    const container = document.querySelector('.image-sources-config');
    if (!container) return;
    
    const primarySource = CONFIG.imageSources[0];
    
    // Build HTML: label + radio buttons for each source in config
    let html = '<span class="config-label">Primary Source:</span>';
    
    CONFIG.imageSources.forEach((source, index) => {
      const displayName = SOURCE_NAMES[source] || source;
      const checked = index === 0 ? ' checked' : '';
      const id = `source-${source.toLowerCase().replace(/_/g, '-')}`;
      html += `<label><input type="radio" name="image-source" id="${id}" value="${source}"${checked}> ${displayName}</label>`;
    });
    
    container.innerHTML = html;
    
    // Add event listeners to new radio buttons
    const radios = container.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
      radio.addEventListener('change', handleImageSourceChange);
    });
  }

  /**
   * Crossfade a tile to a new image
   * Uses ::before pseudo-element for smooth transition
   */
  function crossfadeTile(tile, newImageUrl) {
    return new Promise(resolve => {
      if (!newImageUrl) {
        // No image - just show no-image state
        tile.classList.remove('image-loaded', 'crossfading');
        tile.classList.add('no-image');
        tile.style.backgroundImage = '';
        resolve();
        return;
      }
      
      // Set the new image on ::before via CSS custom property
      tile.style.setProperty('--crossfade-image', `url(${newImageUrl})`);
      tile.classList.add('crossfading');
      
      // After transition completes, swap images
      setTimeout(() => {
        tile.style.backgroundImage = `url(${newImageUrl})`;
        tile.classList.remove('crossfading', 'no-image');
        tile.classList.add('image-loaded');
        tile.style.removeProperty('--crossfade-image');
        resolve();
      }, 400); // Match CSS transition duration
    });
  }

  /**
   * Handle image source radio button changes
   * Selected source becomes primary, others become fallbacks
   * Prioritizes showing PRIMARY source image, fetches if not cached
   */
  async function handleImageSourceChange() {
    const selectedRadio = document.querySelector('.image-sources-config input[type="radio"]:checked');
    if (!selectedRadio) return;
    
    const primarySource = selectedRadio.value;
    
    // Build new sources array: primary first, then others in their current order
    const newSources = [primarySource, ...CONFIG.imageSources.filter(s => s !== primarySource)];
    
    // Update config
    CONFIG.imageSources = newSources;
    
    // Update images if we have artists loaded
    if (currentArtists.length > 0) {
      const tiles = document.querySelectorAll('.artist');
      const crossfadePromises = [];
      const artistsToFetch = [];
      
      // For each artist, check if PRIMARY source is cached
      for (const artist of currentArtists) {
        const tile = Array.from(tiles).find(t => t.dataset.artist === artist.name);
        if (!tile) continue;
        
        // Check if PRIMARY source has cached image
        const primaryCacheKey = `${artist.name}:${primarySource}`;
        const primaryImage = imageCache[primaryCacheKey];
        
        if (primaryImage) {
          // Primary source cached - crossfade to it
          crossfadePromises.push(crossfadeTile(tile, primaryImage));
        } else if (imageCache[primaryCacheKey] === null) {
          // Primary source was tried but has no image - use fallback
          let fallbackImage = null;
          for (const source of newSources.slice(1)) {
            const cacheKey = `${artist.name}:${source}`;
            if (imageCache[cacheKey]) {
              fallbackImage = imageCache[cacheKey];
              break;
            }
          }
          crossfadePromises.push(crossfadeTile(tile, fallbackImage));
        } else {
          // Primary source not yet tried - fetch it
          artistsToFetch.push(artist);
          tile.classList.remove('image-loaded', 'no-image', 'crossfading');
          tile.classList.add('loading-image');
          tile.style.backgroundImage = '';
        }
      }
      
      // Crossfade cached images immediately
      await Promise.all(crossfadePromises);
      
      // Fetch uncached images if any
      if (artistsToFetch.length > 0) {
        showRateLimitNote(true);
        await fetchAllArtistImages(artistsToFetch);
        showRateLimitNote(false);
      }
    }
  }

  /**
   * Initialize the app
   */
  function init() {
    wrapperEl = document.getElementById('wrap');
    contentEl = document.querySelector('.content');
    usernameInput = document.getElementById('username');
    headerSubtitle = document.querySelector('header h2');
    
    if (!wrapperEl || !contentEl) {
      console.error('Required DOM elements not found');
      return;
    }
    
    // Render image source radio buttons based on CONFIG.imageSources
    // (event listeners are added inside renderImageSourceRadios)
    renderImageSourceRadios();
    
    const username = getUsernameFromPath();
    loadUser(username);
    
    if (usernameInput) {
      usernameInput.addEventListener('keypress', handleUsernameSubmit);
    }
    
    window.addEventListener('popstate', handlePopState);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
