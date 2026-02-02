(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    lastfmApiKey: '***REMOVED***',
    discogsKey: '***REMOVED***',
    discogsSecret: '***REMOVED***',
    defaultUsername: 'solitude12',
    artistLimit: 12,
    period: '1month',
    imageRequestDelay: 1000, // Discogs rate limit: 60/min = 1 per second
    tileSize: 300 // Tile size in pixels
  };

  // DOM Elements
  let wrapperEl, contentEl, usernameInput, headerSubtitle;

  // Image cache
  const imageCache = {};

  // Loading timer (show spinner only after 2s delay)
  let loadingTimer = null;

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
        const searchUrl = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artistName)}&fmt=json&limit=1`;
        const searchResponse = await fetch(searchUrl);
        
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
      const mbUrl = `https://musicbrainz.org/ws/2/artist/${effectiveMbid}?inc=url-rels&fmt=json`;
      const response = await fetch(mbUrl);
      
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
   * Fetch artist image from Discogs API using verified artist ID
   * Optimizes for images at least 3x tile size (900px) for retina displays
   */
  async function fetchDiscogsImageById(discogsId) {
    if (!discogsId) {
      return null;
    }
    
    const MIN_SIZE = CONFIG.tileSize * 3; // 900px for retina displays
    
    try {
      const url = `https://api.discogs.com/artists/${discogsId}?key=${CONFIG.discogsKey}&secret=${CONFIG.discogsSecret}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MusicApp/1.0 +https://music.payamyousefi.com'
        }
      });
      
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
   * Fetch artist image using pre-fetched MusicBrainz data
   * Only Discogs calls are rate-limited
   */
  async function fetchArtistImageWithData(artistName, mbData) {
    const cacheKey = artistName;
    
    if (imageCache[cacheKey] !== undefined) {
      return imageCache[cacheKey];
    }

    const { mbid, discogsId } = mbData || {};
    
    // Try Discogs first using verified ID (rate-limited call)
    let imageUrl = null;
    if (discogsId) {
      imageUrl = await fetchDiscogsImageById(discogsId);
    }
    
    // Fall back to TheAudioDB using MBID (no rate limit)
    if (!imageUrl && mbid) {
      imageUrl = await fetchAudioDBImage(mbid);
    }
    
    imageCache[cacheKey] = imageUrl;
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
   * Calculate how many tiles fit per row based on viewport width
   */
  function getTilesPerRow() {
    const viewportWidth = window.innerWidth;
    return Math.max(1, Math.floor(viewportWidth / CONFIG.tileSize));
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
   * Get diagonal index for a tile position (for diagonal reveal pattern)
   * Diagonal 0: (0,0)
   * Diagonal 1: (1,0), (0,1)
   * Diagonal 2: (2,0), (1,1), (0,2)
   * etc.
   */
  function getDiagonalIndex(index, tilesPerRow) {
    const row = Math.floor(index / tilesPerRow);
    const col = index % tilesPerRow;
    return row + col;
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
   * Get artists reordered by diagonal pattern
   * For a 3-column grid: [0], [1,3], [2,4,6], [5,7,9], [8,10], [11]
   */
  function getArtistsByDiagonal(artists, tilesPerRow) {
    const totalRows = Math.ceil(artists.length / tilesPerRow);
    const maxDiagonal = (tilesPerRow - 1) + (totalRows - 1);
    const orderedArtists = [];
    
    for (let d = 0; d <= maxDiagonal; d++) {
      for (let row = 0; row < totalRows; row++) {
        const col = d - row;
        if (col >= 0 && col < tilesPerRow) {
          const index = row * tilesPerRow + col;
          if (index < artists.length) {
            orderedArtists.push({ artist: artists[index], originalIndex: index, diagonal: d });
          }
        }
      }
    }
    
    return orderedArtists;
  }

  /**
   * Fetch all artist images with optimized API calls:
   * 1. Prefetch all MusicBrainz data in parallel (no rate limit)
   * 2. Fetch Discogs images sequentially with rate limiting
   * 3. Reveal in diagonal pattern from top-left to bottom-right
   */
  async function fetchAllArtistImages(artists) {
    const tilesPerRow = getTilesPerRow();
    const diagonalOrder = getArtistsByDiagonal(artists, tilesPerRow);
    const diagonalGroups = {};
    
    // Phase 1: Prefetch all MusicBrainz data in parallel (fast!)
    console.log('Prefetching MusicBrainz data for all artists...');
    const mbDataMap = await prefetchMusicBrainzData(artists);
    console.log('MusicBrainz prefetch complete');
    
    // Phase 2: Fetch images in diagonal order (Discogs rate-limited)
    for (let i = 0; i < diagonalOrder.length; i++) {
      const { artist, originalIndex, diagonal } = diagonalOrder[i];
      const mbData = mbDataMap[artist.name];
      
      // Mark tile as actively loading (pulsing star)
      setTileLoadingActive(artist.name);
      
      // Only delay if we have a Discogs ID to fetch (rate-limited)
      // TheAudioDB fallback has no rate limit
      if (i > 0 && mbData && mbData.discogsId) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.imageRequestDelay));
      }
      
      const imageUrl = await fetchArtistImageWithData(artist.name, mbData);
      const result = await prepareTileImage(artist.name, imageUrl);
      
      if (result) {
        if (!diagonalGroups[diagonal]) {
          diagonalGroups[diagonal] = [];
        }
        diagonalGroups[diagonal].push(result);
        
        // Check if this diagonal is complete
        const expectedTiles = getExpectedTilesInDiagonal(diagonal, tilesPerRow, artists.length);
        if (diagonalGroups[diagonal].length >= expectedTiles) {
          revealRow(diagonalGroups[diagonal]);
          diagonalGroups[diagonal] = []; // Mark as revealed
        }
      }
    }
    
    // Reveal any remaining tiles
    for (const d in diagonalGroups) {
      if (diagonalGroups[d] && diagonalGroups[d].length > 0) {
        revealRow(diagonalGroups[d]);
      }
    }
  }

  /**
   * Calculate expected number of tiles in a diagonal
   */
  function getExpectedTilesInDiagonal(diagonalIdx, tilesPerRow, totalTiles) {
    const totalRows = Math.ceil(totalTiles / tilesPerRow);
    let count = 0;
    
    for (let row = 0; row < totalRows; row++) {
      const col = diagonalIdx - row;
      if (col >= 0 && col < tilesPerRow) {
        const index = row * tilesPerRow + col;
        if (index < totalTiles) {
          count++;
        }
      }
    }
    
    return count;
  }

  /**
   * Render error state
   */
  function renderError(message) {
    contentEl.innerHTML = `<div class="error-state"><p><em>${sanitize(message)}</em></p></div>`;
    slideDown(contentEl);
  }

  /**
   * Render artist tiles with accessibility support
   */
  function renderArtists(artists) {
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
    
    fetchAllArtistImages(artists);
    animateBackgroundColor(generateRandomColor());
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
