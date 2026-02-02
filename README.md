# [music.payamyousefi.com](https://music.payamyousefi.com/)

A web app that displays your Last.fm top artists in a beautiful tiled layout. Enter any username to get a shareable, custom URL.

## Live

[music.payamyousefi.com](https://music.payamyousefi.com/)

## Features

- Dynamic artist tiles with images from multiple sources
- SPA-style navigation using History API
- Responsive design
- Accessible (keyboard navigation, screen reader support, reduced motion)
- No external JavaScript dependencies

## How It Works

1. **Last.fm** — Fetches top artists from the past month
2. **MusicBrainz** — Looks up artist MBIDs and verified Discogs IDs
3. **Discogs** — Primary source for high-quality artist images
4. **TheAudioDB** — Fallback image source using MBID
5. **iTunes** — Final fallback for indie/obscure artists

## Background

"What kind of music do you like?" — a question I could never answer well. This tool solves that by dynamically presenting my recent listening history in a visual format.

## History

- **2014** — Original version
- **2016** — Improved JavaScript, added social sharing
- **2026** — Major rewrite with Claude:
  - Vanilla JS (removed jQuery)
  - Multi-source artist images via MusicBrainz + Discogs + TheAudioDB + iTunes
  - History API for SPA navigation
  - WCAG accessibility improvements

## Stack

- PHP (minimal, for SEO)
- Vanilla JavaScript
- CSS3
- APIs: Last.fm, MusicBrainz, Discogs, TheAudioDB, iTunes

## API Licensing

- **[Last.fm API](https://www.last.fm/api)** — Free for non-commercial use. Requires API key.
- **[MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)** — Free and open. No API key required. Rate limit: 1 request/second.
- **[Discogs API](https://www.discogs.com/developers)** — Free for personal use. Requires key/secret. Rate limit: 60 requests/minute.
- **[TheAudioDB API](https://www.theaudiodb.com/api_guide.php)** — Free tier available with shared API key. No rate limit specified.
- **[iTunes Search API](https://performance-partners.apple.com/search-api)** — Free, no authentication required. ~20 requests/second.
