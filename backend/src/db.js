const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbFile = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'icl.sqlite');
const dir = path.dirname(dbFile);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('participant','admin')) DEFAULT 'participant',
    company       TEXT,
    cnpj          TEXT,
    phone         TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    company     TEXT,
    area        TEXT,
    message     TEXT,
    status      TEXT NOT NULL CHECK(status IN ('new','read','replied','archived')) DEFAULT 'new',
    admin_notes TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL,
    proponente  TEXT NOT NULL,
    cnpj        TEXT,
    perfil      TEXT NOT NULL,
    area        TEXT NOT NULL,
    estagio     TEXT NOT NULL,
    objetivo    TEXT NOT NULL,
    resumo      TEXT NOT NULL,
    status      TEXT NOT NULL CHECK(status IN ('submitted','under_review','approved','rejected','archived')) DEFAULT 'submitted',
    admin_notes TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_proposals_user ON proposals(user_id);
  CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
  CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
`);

function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Administrador';
  if (!email || !password) return;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return;

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`
  ).run(name, email, hash);
  console.log(`[db] admin inicial criado: ${email}`);
}

bootstrapAdmin();

module.exports = db;
