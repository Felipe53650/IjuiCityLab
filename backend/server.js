require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const publicRoutes      = require('./src/routes/public');
const authRoutes        = require('./src/routes/auth');
const participantRoutes = require('./src/routes/participant');
const adminRoutes       = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Muitas requisições — tente novamente em alguns minutos.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Muitas tentativas — tente novamente em alguns minutos.' },
});

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api', writeLimiter, publicRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/me', participantRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(ROOT, { extensions: ['html'] }));
app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'ijui-city-lab.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(ROOT, 'admin', 'index.html')));
app.get('/portal', (_req, res) => res.sendFile(path.join(ROOT, 'portal', 'index.html')));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.message || 'Erro interno' });
});

app.listen(PORT, () => {
  console.log(`[ICL] backend ouvindo em http://localhost:${PORT}`);
});
