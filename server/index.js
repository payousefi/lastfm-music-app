/**
 * Music App Server
 * Express server for Last.fm music personality app
 */

const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Import route modules
const pagesRouter = require('./routes/pages');
const apiRouter = require('./routes/api');

// API routes
app.use('/api', apiRouter);

// Page routes (must be last - catches all other routes for SSR)
app.use('/', pagesRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`🎵 Music app server running at http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
});
