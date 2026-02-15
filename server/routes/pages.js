/**
 * Page Routes
 * Serves HTML pages with SSR meta tags
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Load HTML template
const templatePath = path.join(__dirname, '..', 'templates', 'index.html');
let htmlTemplate = '';

try {
  htmlTemplate = fs.readFileSync(templatePath, 'utf8');
} catch (err) {
  console.error('Failed to load HTML template:', err);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * GET /:username?
 * Serve main page with dynamic meta tags
 *
 * Guard: requests with file extensions (e.g. /favicon.ico, /apple-touch-icon.png)
 * that weren't matched by express.static should 404, not render as a "username".
 */
router.get('/:username?', (req, res, next) => {
  const username = req.params.username || '';

  // If the path looks like a file request, let it 404 naturally
  if (username && /\.\w{2,5}$/.test(username)) {
    return next();
  }
  const escapedUsername = escapeHtml(username);

  let title, whos, description;

  if (username === '') {
    title = 'Payam Yousefi';
    whos = 'my';
    description = `Curious about my taste in music? Discover music personality and more.`;
  } else {
    title = escapedUsername;
    whos = `<a href='https://last.fm/user/${escapedUsername}' target='_blank' rel='noopener noreferrer'>${escapedUsername}</a>'s`;
    description = `Curious about ${escapedUsername}'s taste in music? Discover music personality and more.`;
  }

  // Replace placeholders in template
  const html = htmlTemplate
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{whos\}\}/g, whos)
    .replace(/\{\{whosPlain\}\}/g, username ? `${escapedUsername}'s` : 'my')
    .replace(/\{\{description\}\}/g, description)
    .replace(/\{\{username\}\}/g, escapedUsername)
    .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  res.send(html);
});

module.exports = router;
