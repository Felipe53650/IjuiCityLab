const express = require('express');
const db = require('../db');
const { str, email, oneOf } = require('../validate');

const router = express.Router();

const AREAS = ['mobilidade', 'energia', 'saude', 'seguranca', 'dados', 'outro'];
const PERFIS = ['startup', 'empresa', 'pesquisador', 'estudante', 'poder-publico', 'outro'];
const ESTAGIOS = ['ideia', 'prototipo', 'piloto', 'escala'];

router.post('/contact', (req, res, next) => {
  try {
    const b = req.body || {};
    const data = {
      name: str(b.name, { label: 'nome', max: 120 }),
      email: email(b.email),
      company: str(b.company, { required: false, label: 'empresa', max: 120 }),
      area: b.area ? oneOf(b.area, AREAS, 'área') : null,
      message: str(b.message, { required: false, label: 'mensagem', max: 4000 }),
    };
    const r = db.prepare(
      `INSERT INTO contacts (name, email, company, area, message) VALUES (?, ?, ?, ?, ?)`
    ).run(data.name, data.email, data.company, data.area, data.message);
    res.status(201).json({ id: r.lastInsertRowid, ok: true });
  } catch (e) { next(e); }
});

router.post('/proposals', (req, res, next) => {
  try {
    const b = req.body || {};
    const data = {
      nome:       str(b.nome, { label: 'nome', max: 120 }),
      email:      email(b.email),
      proponente: str(b.proponente, { label: 'proponente', max: 160 }),
      cnpj:       str(b.cnpj, { required: false, label: 'CNPJ', max: 32 }),
      perfil:     oneOf(b.perfil, PERFIS, 'perfil'),
      area:       oneOf(b.area, AREAS, 'área'),
      estagio:    oneOf(b.estagio, ESTAGIOS, 'estágio'),
      objetivo:   str(b.objetivo, { label: 'objetivo', max: 300 }),
      resumo:     str(b.resumo, { label: 'resumo', min: 20, max: 4000 }),
    };
    const r = db.prepare(
      `INSERT INTO proposals (nome, email, proponente, cnpj, perfil, area, estagio, objetivo, resumo)
       VALUES (@nome, @email, @proponente, @cnpj, @perfil, @area, @estagio, @objetivo, @resumo)`
    ).run(data);
    res.status(201).json({ id: r.lastInsertRowid, ok: true });
  } catch (e) { next(e); }
});

router.get('/options', (_req, res) => {
  res.json({ areas: AREAS, perfis: PERFIS, estagios: ESTAGIOS });
});

module.exports = router;
module.exports.AREAS = AREAS;
module.exports.PERFIS = PERFIS;
module.exports.ESTAGIOS = ESTAGIOS;
