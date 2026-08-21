const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Render (et la plupart des PaaS) placent l'app derriere un proxy inverse :
// necessaire pour que express-rate-limit et req.ip fonctionnent correctement.
app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, '')) // retire un slash final eventuel (source frequente de mismatch)
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Pas d'origine (ex: appel serveur-a-serveur, Postman, health check) -> autorise
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalized)) return callback(null, true);
      console.warn(
        `[cors] Origine refusee : "${origin}" - autorisee(s) : ${allowedOrigins.join(', ') || '(aucune - FRONTEND_URL non defini ?)'}`
      );
      const err = new Error('Non autorise par la politique CORS');
      err.statusCode = 403;
      return callback(err);
    },
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Limite generale : 300 requetes / 15 min / IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Limite plus stricte sur les routes d'authentification (anti brute-force)
app.use(
  '/api/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false })
);

app.get('/', (req, res) => {
  res.json({ message: 'NONO SMART SARL - API silures & alevins', docs: '/api/health' });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
