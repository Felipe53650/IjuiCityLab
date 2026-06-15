const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

function getToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

function requireAuth(roles) {
  const allowed = Array.isArray(roles) ? roles : roles ? [roles] : null;
  return (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Autenticação necessária' });
    try {
      const payload = verify(token);
      if (allowed && !allowed.includes(payload.role)) {
        return res.status(403).json({ error: 'Permissão insuficiente' });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
  };
}

module.exports = { sign, verify, requireAuth };
