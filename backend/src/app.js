const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/error');
const { ok } = require('./utils/respond');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // style attribute usage (progress bars, charts) needs unsafe-inline
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
}));
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: { code: 'RATE_LIMIT', message: 'Too many requests' }, meta: null },
}));

app.get('/api/health', (req, res) => ok(res, { status: 'ok', env: config.env, time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/gerpi', require('./routes/gerpi.routes'));
app.use('/api/meta', require('./routes/meta.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));

app.use('/api', notFound);

// Static frontend
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendDir));

app.use(errorHandler);

module.exports = app;
