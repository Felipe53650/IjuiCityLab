const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign } = require('../auth');
const { str, email, httpError } = require('../validate');

const router = express.Router();

function buildSession(user) {
  const token = sign({ sub: user.id, role: user.role, name: user.name, email: user.email });
  return {
    token,
    user: {
      id: user.id, name: user.name, email: user.email,
      role: user.role, company: user.company, cnpj: user.cnpj, phone: user.phone,
    },
  };
}

router.post('/register', (req, res, next) => {
  try {
    const b = req.body || {};
    const name = str(b.name, { label: 'nome', max: 120 });
    const mail = email(b.email);
    const password = str(b.password, { label: 'senha', min: 8, max: 128 });
    const company = str(b.company, { required: false, label: 'empresa', max: 160 });
    const cnpj    = str(b.cnpj,    { required: false, label: 'CNPJ', max: 32 });
    const phone   = str(b.phone,   { required: false, label: 'telefone', max: 40 });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(mail);
    if (existing) throw httpError(409, 'E-mail já cadastrado');

    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare(
      `INSERT INTO users (name, email, password_hash, role, company, cnpj, phone)
       VALUES (?, ?, ?, 'participant', ?, ?, ?)`
    ).run(name, mail, hash, company, cnpj, phone);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(buildSession(user));
  } catch (e) { next(e); }
});

router.post('/login', (req, res, next) => {
  try {
    const mail = email(req.body?.email);
    const password = str(req.body?.password, { label: 'senha', min: 1, max: 256 });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(mail);
    if (!user || user.role !== 'participant') {
      throw httpError(401, 'Credenciais inválidas');
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      throw httpError(401, 'Credenciais inválidas');
    }
    res.json(buildSession(user));
  } catch (e) { next(e); }
});

router.post('/admin/login', (req, res, next) => {
  try {
    const mail = email(req.body?.email);
    const password = str(req.body?.password, { label: 'senha', min: 1, max: 256 });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(mail);
    if (!user || user.role !== 'admin') {
      throw httpError(401, 'Credenciais inválidas');
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      throw httpError(401, 'Credenciais inválidas');
    }
    res.json(buildSession(user));
  } catch (e) { next(e); }
});

module.exports = router;
