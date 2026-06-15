const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../auth');
const { str, email, oneOf, httpError } = require('../validate');
const { AREAS, PERFIS, ESTAGIOS } = require('./public');

const router = express.Router();
router.use(requireAuth('participant'));

router.get('/', (req, res) => {
  const user = db.prepare(
    `SELECT id, name, email, role, company, cnpj, phone, created_at FROM users WHERE id = ?`
  ).get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(user);
});

router.patch('/', (req, res, next) => {
  try {
    const b = req.body || {};
    const fields = {};
    if (b.name !== undefined)    fields.name    = str(b.name, { label: 'nome', max: 120 });
    if (b.company !== undefined) fields.company = str(b.company, { required: false, label: 'empresa', max: 160 });
    if (b.cnpj !== undefined)    fields.cnpj    = str(b.cnpj, { required: false, label: 'CNPJ', max: 32 });
    if (b.phone !== undefined)   fields.phone   = str(b.phone, { required: false, label: 'telefone', max: 40 });
    if (Object.keys(fields).length === 0) return res.json({ ok: true });
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE users SET ${sets} WHERE id = @id`).run({ ...fields, id: req.user.sub });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/password', (req, res, next) => {
  try {
    const current = str(req.body?.current, { label: 'senha atual', min: 1, max: 256 });
    const next_   = str(req.body?.next,    { label: 'nova senha', min: 8, max: 128 });
    const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.sub);
    if (!u || !bcrypt.compareSync(current, u.password_hash)) {
      throw httpError(400, 'Senha atual incorreta');
    }
    const hash = bcrypt.hashSync(next_, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.sub);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/proposals', (req, res) => {
  const rows = db.prepare(
    `SELECT id, proponente, area, estagio, objetivo, status, created_at, updated_at, admin_notes
     FROM proposals WHERE user_id = ? ORDER BY created_at DESC`
  ).all(req.user.sub);
  res.json(rows);
});

router.get('/proposals/:id', (req, res) => {
  const row = db.prepare(
    `SELECT * FROM proposals WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'Proposta não encontrada' });
  res.json(row);
});

router.post('/proposals', (req, res, next) => {
  try {
    const b = req.body || {};
    const me = db.prepare('SELECT name, email, company, cnpj FROM users WHERE id = ?').get(req.user.sub);
    const data = {
      user_id:    req.user.sub,
      nome:       str(b.nome ?? me.name, { label: 'nome', max: 120 }),
      email:      email(b.email ?? me.email),
      proponente: str(b.proponente ?? me.company, { label: 'proponente', max: 160 }),
      cnpj:       str(b.cnpj ?? me.cnpj, { required: false, label: 'CNPJ', max: 32 }),
      perfil:     oneOf(b.perfil, PERFIS, 'perfil'),
      area:       oneOf(b.area, AREAS, 'área'),
      estagio:    oneOf(b.estagio, ESTAGIOS, 'estágio'),
      objetivo:   str(b.objetivo, { label: 'objetivo', max: 300 }),
      resumo:     str(b.resumo, { label: 'resumo', min: 20, max: 4000 }),
    };
    const r = db.prepare(
      `INSERT INTO proposals (user_id, nome, email, proponente, cnpj, perfil, area, estagio, objetivo, resumo)
       VALUES (@user_id, @nome, @email, @proponente, @cnpj, @perfil, @area, @estagio, @objetivo, @resumo)`
    ).run(data);
    res.status(201).json({ id: r.lastInsertRowid, ok: true });
  } catch (e) { next(e); }
});

router.patch('/proposals/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM proposals WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.sub);
    if (!row) return res.status(404).json({ error: 'Proposta não encontrada' });
    if (row.status !== 'submitted') {
      throw httpError(403, 'Proposta já em análise — não pode ser editada.');
    }
    const b = req.body || {};
    const editable = ['proponente', 'cnpj', 'perfil', 'area', 'estagio', 'objetivo', 'resumo'];
    const updates = {};
    for (const f of editable) {
      if (b[f] === undefined) continue;
      if (f === 'perfil')      updates[f] = oneOf(b[f], PERFIS, 'perfil');
      else if (f === 'area')   updates[f] = oneOf(b[f], AREAS, 'área');
      else if (f === 'estagio')updates[f] = oneOf(b[f], ESTAGIOS, 'estágio');
      else if (f === 'cnpj')   updates[f] = str(b[f], { required: false, label: 'CNPJ', max: 32 });
      else if (f === 'resumo') updates[f] = str(b[f], { label: 'resumo', min: 20, max: 4000 });
      else                     updates[f] = str(b[f], { label: f, max: 300 });
    }
    if (!Object.keys(updates).length) return res.json({ ok: true });
    updates.id = row.id;
    const sets = Object.keys(updates).filter((k) => k !== 'id').map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE proposals SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(updates);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/proposals/:id', (req, res) => {
  const row = db.prepare('SELECT status FROM proposals WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'Proposta não encontrada' });
  if (row.status !== 'submitted') {
    return res.status(403).json({ error: 'Proposta já em análise — não pode ser excluída.' });
  }
  db.prepare('DELETE FROM proposals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
