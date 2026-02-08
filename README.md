# [music.payamyousefi.com](https://music.payamyousefi.com/)

A web app that displays your Last.fm top artists in a beautiful tiled layout. Enter any username to get a shareable, custom URL.

## Live

[music.payamyousefi.com](https://music.payamyousefi.com/)

## Features

- Generates a unique music personality headline based on listening habits (mood × genre analysis)
- Dynamic artist tiles with images from multiple sources
- Configurable primary image source
- Adaptive rate limiting for Discogs and MusicBrainz APIs
- SPA-style navigation using History API
- Responsive design
- Accessible (keyboard navigation, screen reader support, reduced motion)
- No external JavaScript dependencies

## How It Works

1. **Last.fm** — Fetches top artists from the past month
2. **MusicBrainz** — Looks up artist MBIDs and verified Discogs IDs
3. **Image sources** (configurable order):
   - **iTunes** — Default primary; fast with no rate limit
   - **Discogs** — High-quality artist photos
   - **TheAudioDB** — Fallback using MBID

## Background

"What kind of music do you like?" — a question I could never answer well. This tool solves that by dynamically presenting my recent listening history in a visual format.

## History

- **2014** — Original version
- **2016** — Improved JavaScript, added social sharing
- **2026** — Major rewrite with Claude:
  - Vanilla JS (removed jQuery)
  - Multi-source artist images via MusicBrainz + Discogs + TheAudioDB + iTunes
  - Configurable primary image source
  - Adaptive rate limiting for Discogs and MusicBrainz APIs
  - History API for SPA navigation
  - WCAG accessibility improvements
  - Music Personality feature with dynamic headline generation
  - **Node.js migration** — Replaced PHP with Express.js server
  - Server-side personality generation (logic now private)
  - API proxies to hide API keys from client

## Stack

- **Node.js** with Express.js
- Vanilla JavaScript (frontend)
- CSS3
- APIs: Last.fm, MusicBrainz, Discogs, TheAudioDB, iTunes

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Deployment

1. Run `npm run build` to create `dist/music/` folder
2. Upload contents of `dist/music/` to your server
3. Edit `.env` with your API keys
4. Run `npm install --production`
5. Start with `node server/index.js` or use PM2

For Apache hosting, the included `.htaccess` configures reverse proxy to Node.js on port 3000.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
PORT=3000
NODE_ENV=production
LASTFM_API_KEY=your_key
DISCOGS_KEY=your_key
DISCOGS_SECRET=your_secret
```

## API Licensing

- **[Last.fm API](https://www.last.fm/api)** — Free for non-commercial use. Requires API key.
- **[MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)** — Free and open. No API key required. Rate limit: 1 request/second.
- **[Discogs API](https://www.discogs.com/developers)** — Free for personal use. Requires key/secret. Rate limit: 60 requests/minute.
- **[TheAudioDB API](https://www.theaudiodb.com/api_guide.php)** — Free tier available with shared API key. No rate limit specified.
- **[iTunes Search API](https://performance-partners.apple.com/search-api)** — Free, no authentication required. ~20 requests/second.
