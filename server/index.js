/**
 * Music App Server
 * Express server for Last.fm music personality app
 */

const express = require('express');
const path = require('path');
const config = require('./config');
const {
  createHelmetMiddleware,
  createCorsMiddleware,
  createGlobalRateLimiter,
  inputSanitizer,
  JSON_BODY_LIMIT
} = require('./middleware/security');

const app = express();

// ─── Security Middleware (applied before any routes) ─────────────────────────

// Trust proxy if behind reverse proxy (Nginx, Cloudflare, etc.)
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// Secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(createHelmetMiddleware());

// CORS - restrict cross-origin API access
app.use(createCorsMiddleware());

// ─── Body Parsing (with size limits) ─────────────────────────────────────────

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// ─── Input Sanitization (strip null bytes, control chars from all inputs) ────

app.use(inputSanitizer);

// ─── Static Files (served before rate limiting — no need to rate-limit CSS/JS/images) ──

app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Routes ──────────────────────────────────────────────────────────────────

const pagesRouter = require('./routes/pages');
const apiRouter = require('./routes/api');

// API routes — rate limited to prevent automated abuse
// (static files and page routes are NOT rate limited)
app.use('/api', createGlobalRateLimiter(), apiRouter);

// Page routes (must be last - catches all other routes for SSR)
app.use('/', pagesRouter);

// ─── Error Handling ──────────────────────────────────────────────────────────

// CORS error handler
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cross-origin request not allowed'
    });
  }
  next(err);
});

// General error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`🎵 Music app server running at http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Security: helmet ✓ | cors ✓ | rate-limit ✓ | input-sanitization ✓`);
});
