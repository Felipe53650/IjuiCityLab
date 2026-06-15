const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../auth');
const { str, email, oneOf, httpError } = require('../validate');

const router = express.Router();
router.use(requireAuth('admin'));

const PROPOSAL_STATUS = ['submitted', 'under_review', 'approved', 'rejected', 'archived'];
const CONTACT_STATUS  = ['new', 'read', 'replied', 'archived'];

router.get('/stats', (_req, res) => {
  const proposals = db.prepare(
    `SELECT status, COUNT(*) AS n FROM proposals GROUP BY status`
  ).all();
  const contacts = db.prepare(
    `SELECT status, COUNT(*) AS n FROM contacts GROUP BY status`
  ).all();
  const participants = db.prepare(
    `SELECT COUNT(*) AS n FROM users WHERE role = 'participant'`
  ).get().n;
  res.json({
    participants,
    proposals: Object.fromEntries(proposals.map((r) => [r.status, r.n])),
    contacts:  Object.fromEntries(contacts.map((r) => [r.status, r.n])),
    totalProposals: proposals.reduce((a, r) => a + r.n, 0),
    totalContacts:  contacts.reduce((a, r) => a + r.n, 0),
  });
});

router.get('/contacts', (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare(`SELECT * FROM contacts WHERE status = ? ORDER BY created_at DESC`).all(status)
    : db.prepare(`SELECT * FROM contacts ORDER BY created_at DESC`).all();
  res.json(rows);
});

router.patch('/contacts/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Contato não encontrado' });
    const b = req.body || {};
    const updates = {};
    if (b.status !== undefined) updates.status = oneOf(b.status, CONTACT_STATUS, 'status');
    if (b.admin_notes !== undefined) {
      updates.admin_notes = str(b.admin_notes, { required: false, label: 'observações', max: 4000 });
    }
    if (!Object.keys(updates).length) return res.json({ ok: true });
    updates.id = row.id;
    const sets = Object.keys(updates).filter((k) => k !== 'id').map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE contacts SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(updates);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/contacts/:id', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/proposals', (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare(`SELECT p.*, u.email AS user_email FROM proposals p LEFT JOIN users u ON u.id = p.user_id
                  WHERE p.status = ? ORDER BY p.created_at DESC`).all(status)
    : db.prepare(`SELECT p.*, u.email AS user_email FROM proposals p LEFT JOIN users u ON u.id = p.user_id
                  ORDER BY p.created_at DESC`).all();
  res.json(rows);
});

router.get('/proposals/:id', (req, res) => {
  const row = db.prepare(
    `SELECT p.*, u.email AS user_email, u.name AS user_name
     FROM proposals p LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Proposta não encontrada' });
  res.json(row);
});

router.patch('/proposals/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT id FROM proposals WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Proposta não encontrada' });
    const b = req.body || {};
    const updates = {};
    if (b.status !== undefined) updates.status = oneOf(b.status, PROPOSAL_STATUS, 'status');
    if (b.admin_notes !== undefined) {
      updates.admin_notes = str(b.admin_notes, { required: false, label: 'observações', max: 4000 });
    }
    if (!Object.keys(updates).length) return res.json({ ok: true });
    updates.id = row.id;
    const sets = Object.keys(updates).filter((k) => k !== 'id').map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE proposals SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(updates);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/proposals/:id', (req, res) => {
  db.prepare('DELETE FROM proposals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/participants', (_req, res) => {
  const rows = db.prepare(
    `SELECT u.id, u.name, u.email, u.company, u.cnpj, u.phone, u.created_at,
            (SELECT COUNT(*) FROM proposals p WHERE p.user_id = u.id) AS proposal_count
     FROM users u WHERE u.role = 'participant' ORDER BY u.created_at DESC`
  ).all();
  res.json(rows);
});

router.delete('/participants/:id', (req, res) => {
  db.prepare(`DELETE FROM users WHERE id = ? AND role = 'participant'`).run(req.params.id);
  res.json({ ok: true });
});

router.post('/admins', (req, res, next) => {
  try {
    const b = req.body || {};
    const name = str(b.name, { label: 'nome', max: 120 });
    const mail = email(b.email);
    const password = str(b.password, { label: 'senha', min: 8, max: 128 });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(mail);
    if (existing) throw httpError(409, 'E-mail já cadastrado');
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`
    ).run(name, mail, hash);
    res.status(201).json({ id: r.lastInsertRowid, ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
