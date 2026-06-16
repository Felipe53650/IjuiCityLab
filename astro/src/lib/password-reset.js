import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from './db.js';

const DEFAULT_MINUTES = 30;

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function resetPageFor(role) {
  return role === 'admin' ? '/admin' : '/portal';
}

function resetMinutes() {
  const n = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 60) : DEFAULT_MINUTES;
}

function shouldShowLink() {
  return process.env.PASSWORD_RESET_SHOW_LINK !== 'false';
}

export function createPasswordReset({ request, email, role }) {
  db.prepare(`
    DELETE FROM password_reset_tokens
    WHERE used_at IS NOT NULL OR expires_at <= datetime('now', '-1 day')
  `).run();

  const message = 'Se o e-mail existir, enviaremos instrucoes para redefinir a senha.';
  const user = db.prepare('SELECT id, email, role FROM users WHERE email = ? AND role = ?').get(email, role);
  if (!user) return { ok: true, message };

  db.prepare(`
    UPDATE password_reset_tokens SET used_at = datetime('now')
    WHERE user_id = ? AND used_at IS NULL
  `).run(user.id);

  const token = crypto.randomBytes(32).toString('base64url');
  const minutes = resetMinutes();
  const expiresAt = db.prepare(`SELECT datetime('now', ?) AS expires_at`).get(`+${minutes} minutes`).expires_at;

  db.prepare(`
    INSERT INTO password_reset_tokens (user_id, token_hash, requested_role, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(user.id, tokenHash(token), role, expiresAt);

  const result = { ok: true, message, expiresInMinutes: minutes };
  if (shouldShowLink()) {
    const url = new URL(resetPageFor(role), new URL(request.url).origin);
    url.searchParams.set('reset', token);
    url.searchParams.set('email', user.email);
    result.resetToken = token;
    result.resetUrl = url.toString();
  }
  return result;
}

export function resetPassword({ token, password }) {
  const row = db.prepare(`
    SELECT t.id, t.user_id, u.role
    FROM password_reset_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ?
      AND t.used_at IS NULL
      AND t.expires_at > datetime('now')
  `).get(tokenHash(token));

  if (!row) return false;

  const hash = bcrypt.hashSync(password, 10);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
    db.prepare(`
      UPDATE password_reset_tokens SET used_at = datetime('now')
      WHERE user_id = ? AND used_at IS NULL
    `).run(row.user_id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return true;
}
