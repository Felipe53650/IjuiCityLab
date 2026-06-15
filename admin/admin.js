const API = '/api';
const TOKEN_KEY = 'icl_admin_token';

const state = { token: null, user: null };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const STATUS_LABEL = {
  submitted: 'Submetida', under_review: 'Em análise',
  approved: 'Aprovada', rejected: 'Rejeitada', archived: 'Arquivada',
  new: 'Novo', read: 'Lido', replied: 'Respondido',
};

const PROPOSAL_STATUS = ['submitted', 'under_review', 'approved', 'rejected', 'archived'];
const CONTACT_STATUS  = ['new', 'read', 'replied', 'archived'];

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || 'Erro de comunicação');
  return data;
}

function setSession(session) {
  state.token = session.token;
  state.user = session.user;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
  showApp();
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
}

function showApp() {
  $('.login-wrap').hidden = true;
  $('.topbar').hidden = false;
  $('.app-wrap').hidden = false;
  $('.user-name').textContent = state.user?.name || '';
  switchView('dashboard');
  loadDashboard();
}

function switchView(name) {
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach((s) => (s.hidden = s.dataset.view !== name));
  if (name === 'dashboard') loadDashboard();
  if (name === 'proposals') loadProposals();
  if (name === 'contacts') loadContacts();
  if (name === 'participants') loadParticipants();
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const fb = $('.feedback', f);
  fb.textContent = '';
  fb.className = 'feedback';
  try {
    const data = await api('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: f.email.value, password: f.password.value }),
    });
    setSession(data);
  } catch (err) {
    fb.textContent = err.message;
    fb.classList.add('error');
  }
});

document.addEventListener('click', (e) => {
  if (e.target.matches('.tab')) switchView(e.target.dataset.view);
  if (e.target.matches('.logout')) clearSession();
});

async function loadDashboard() {
  const stats = await api('/admin/stats');
  const kpis = [
    { label: 'Propostas totais', val: stats.totalProposals, accent: true },
    { label: 'Em análise', val: (stats.proposals.under_review || 0) + (stats.proposals.submitted || 0) },
    { label: 'Aprovadas', val: stats.proposals.approved || 0 },
    { label: 'Contatos novos', val: stats.contacts.new || 0 },
    { label: 'Participantes', val: stats.participants },
  ];
  $('#kpis').innerHTML = kpis.map((k) => `
    <div class="kpi"><div class="label">${k.label}</div><div class="val ${k.accent ? 'accent' : ''}">${k.val}</div></div>
  `).join('');

  const recent = await api('/admin/proposals');
  const tbody = $('#recentProposals tbody');
  tbody.innerHTML = recent.slice(0, 8).map((p) => `
    <tr><td>#${p.id}</td><td>${escapeHtml(p.proponente)}</td><td>${escapeHtml(p.area)}</td>
    <td>${escapeHtml(p.estagio)}</td><td><span class="status ${p.status}">${STATUS_LABEL[p.status]}</span></td>
    <td>${fmtDate(p.created_at)}</td></tr>
  `).join('') || '<tr><td colspan="6" class="muted">Nenhuma proposta ainda.</td></tr>';
}

async function loadProposals() {
  const status = $('#proposalsStatus').value;
  const rows = await api(`/admin/proposals${status ? `?status=${status}` : ''}`);
  $('#proposalsTable tbody').innerHTML = rows.map((p) => `
    <tr>
      <td>#${p.id}</td>
      <td><strong>${escapeHtml(p.proponente)}</strong><br><span class="muted">${escapeHtml(p.nome)}</span></td>
      <td>${escapeHtml(p.email)}</td>
      <td>${escapeHtml(p.area)}</td>
      <td>${escapeHtml(p.estagio)}</td>
      <td><span class="status ${p.status}">${STATUS_LABEL[p.status]}</span></td>
      <td>${fmtDate(p.created_at)}</td>
      <td><button class="btn" data-detail-proposal="${p.id}">Abrir</button></td>
    </tr>
  `).join('') || '<tr><td colspan="8" class="muted">Nenhuma proposta encontrada.</td></tr>';
}
$('#proposalsStatus').addEventListener('change', loadProposals);

async function loadContacts() {
  const status = $('#contactsStatus').value;
  const rows = await api(`/admin/contacts${status ? `?status=${status}` : ''}`);
  $('#contactsTable tbody').innerHTML = rows.map((c) => `
    <tr>
      <td>#${c.id}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.email)}</td>
      <td>${escapeHtml(c.company || '—')}</td><td>${escapeHtml(c.area || '—')}</td>
      <td><span class="status ${c.status}">${STATUS_LABEL[c.status]}</span></td>
      <td>${fmtDate(c.created_at)}</td>
      <td><button class="btn" data-detail-contact="${c.id}">Abrir</button></td>
    </tr>
  `).join('') || '<tr><td colspan="8" class="muted">Nenhum contato.</td></tr>';
}
$('#contactsStatus').addEventListener('change', loadContacts);

async function loadParticipants() {
  const rows = await api('/admin/participants');
  $('#participantsTable tbody').innerHTML = rows.map((u) => `
    <tr>
      <td>#${u.id}</td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(u.company || '—')}</td><td>${u.proposal_count}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td><button class="btn danger" data-del-participant="${u.id}">Excluir</button></td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="muted">Nenhum participante.</td></tr>';
}

document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.detailProposal) openProposal(t.dataset.detailProposal);
  if (t.dataset.detailContact)  openContact(t.dataset.detailContact);
  if (t.dataset.delParticipant) {
    if (!confirm('Excluir participante? Esta ação não pode ser desfeita.')) return;
    await api(`/admin/participants/${t.dataset.delParticipant}`, { method: 'DELETE' });
    loadParticipants();
  }
});

async function openProposal(id) {
  const p = await api(`/admin/proposals/${id}`);
  $('#detailContent').innerHTML = `
    <h3>Proposta #${p.id} — ${escapeHtml(p.proponente)}</h3>
    <dl class="detail-grid">
      <dt>Contato</dt><dd>${escapeHtml(p.nome)} · ${escapeHtml(p.email)}</dd>
      <dt>CNPJ</dt><dd>${escapeHtml(p.cnpj || '—')}</dd>
      <dt>Perfil</dt><dd>${escapeHtml(p.perfil)}</dd>
      <dt>Área</dt><dd>${escapeHtml(p.area)}</dd>
      <dt>Estágio</dt><dd>${escapeHtml(p.estagio)}</dd>
      <dt>Objetivo</dt><dd>${escapeHtml(p.objetivo)}</dd>
      <dt>Resumo</dt><dd>${escapeHtml(p.resumo)}</dd>
      <dt>Cadastro</dt><dd>${p.user_email ? escapeHtml(p.user_email) + ' (autenticado)' : 'Anônimo'}</dd>
      <dt>Recebida</dt><dd>${fmtDate(p.created_at)}</dd>
    </dl>
    <div class="detail-actions">
      <select id="pStatus">${PROPOSAL_STATUS.map((s) => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select>
      <button class="btn primary" id="pSave">Atualizar status</button>
      <button class="btn danger" id="pDel">Excluir</button>
      <textarea id="pNotes" placeholder="Observações internas">${escapeHtml(p.admin_notes || '')}</textarea>
    </div>
  `;
  $('#detailDialog').showModal();
  $('#pSave').onclick = async () => {
    await api(`/admin/proposals/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: $('#pStatus').value, admin_notes: $('#pNotes').value }),
    });
    $('#detailDialog').close();
    loadProposals(); loadDashboard();
  };
  $('#pDel').onclick = async () => {
    if (!confirm('Excluir esta proposta?')) return;
    await api(`/admin/proposals/${p.id}`, { method: 'DELETE' });
    $('#detailDialog').close();
    loadProposals(); loadDashboard();
  };
}

async function openContact(id) {
  const all = await api('/admin/contacts');
  const c = all.find((x) => x.id == id);
  if (!c) return;
  $('#detailContent').innerHTML = `
    <h3>Contato #${c.id}</h3>
    <dl class="detail-grid">
      <dt>Nome</dt><dd>${escapeHtml(c.name)}</dd>
      <dt>E-mail</dt><dd>${escapeHtml(c.email)}</dd>
      <dt>Empresa</dt><dd>${escapeHtml(c.company || '—')}</dd>
      <dt>Área</dt><dd>${escapeHtml(c.area || '—')}</dd>
      <dt>Mensagem</dt><dd>${escapeHtml(c.message || '—')}</dd>
      <dt>Recebido</dt><dd>${fmtDate(c.created_at)}</dd>
    </dl>
    <div class="detail-actions">
      <select id="cStatus">${CONTACT_STATUS.map((s) => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select>
      <button class="btn primary" id="cSave">Atualizar status</button>
      <button class="btn danger" id="cDel">Excluir</button>
      <textarea id="cNotes" placeholder="Observações internas">${escapeHtml(c.admin_notes || '')}</textarea>
    </div>
  `;
  $('#detailDialog').showModal();
  $('#cSave').onclick = async () => {
    await api(`/admin/contacts/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: $('#cStatus').value, admin_notes: $('#cNotes').value }),
    });
    $('#detailDialog').close();
    loadContacts(); loadDashboard();
  };
  $('#cDel').onclick = async () => {
    if (!confirm('Excluir este contato?')) return;
    await api(`/admin/contacts/${c.id}`, { method: 'DELETE' });
    $('#detailDialog').close();
    loadContacts(); loadDashboard();
  };
}

$('#newAdminForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const fb = $('.feedback', f);
  fb.textContent = '';
  fb.className = 'feedback';
  try {
    await api('/admin/admins', {
      method: 'POST',
      body: JSON.stringify({ name: f.name.value, email: f.email.value, password: f.password.value }),
    });
    fb.textContent = 'Administrador adicionado.';
    fb.classList.add('ok');
    f.reset();
  } catch (err) {
    fb.textContent = err.message;
    fb.classList.add('error');
  }
});

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

(function restore() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return;
  try {
    const session = JSON.parse(raw);
    state.token = session.token;
    state.user = session.user;
    api('/admin/stats').then(showApp).catch(clearSession);
  } catch { clearSession(); }
})();
