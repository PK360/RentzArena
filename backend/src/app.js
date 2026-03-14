const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const rulesetRoutes = require('./routes/rulesetRoutes');
const gameRoutes = require('./routes/gameRoutes');

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || '*'
    })
  );
  app.use(express.json());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/rulesets', rulesetRoutes);
  app.use('/api/games', gameRoutes);

  app.use((error, _req, res, _next) => {
    console.error(error);

    res.status(error.statusCode || 500).json({
      error: error.message || 'Internal server error'
    });
  });

  return app;
}

module.exports = createApp;
