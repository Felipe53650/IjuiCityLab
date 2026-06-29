const API = '/api';
const TOKEN_KEY = 'icl_admin_token';
const state = { token: null, user: null, participants: [] };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const fmtDate = (s) => {
  if (!s) return '---';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const STATUS_LABEL = {
  submitted: 'Submetida',
  under_review: 'Em analise',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  archived: 'Arquivada',
  new: 'Novo',
  read: 'Lido',
  replied: 'Respondido',
  planning: 'Planejado',
  active: 'Em operacao',
  paused: 'Pausado',
  completed: 'Concluido',
};

const PROPOSAL_STATUS = ['submitted', 'under_review', 'approved', 'rejected', 'archived'];
const CONTACT_STATUS = ['new', 'read', 'replied', 'archived'];
const PROJECT_STATUS = ['planning', 'active', 'paused', 'completed', 'archived'];

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
  if (!res.ok) throw new Error(data?.error || 'Erro de comunicacao');
  return data;
}

function setSession(s) {
  state.token = s.token;
  state.user = s.user;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(s));
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
}

function showAuthMode(mode) {
  const forms = {
    login: '#loginForm',
    forgot: '#forgotForm',
    reset: '#resetForm',
  };
  Object.entries(forms).forEach(([name, selector]) => {
    const form = $(selector);
    if (form) form.hidden = name !== mode;
  });
  $$('.auth-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.authMode === mode);
  });
}

function switchView(name) {
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach((s) => (s.hidden = s.dataset.view !== name));
  if (name === 'dashboard') loadDashboard();
  if (name === 'projects') loadProjects();
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
    setSession(await api('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: f.email.value, password: f.password.value }),
    }));
  } catch (err) {
    fb.textContent = err.message;
    fb.classList.add('error');
  }
});

document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.matches('.tab')) switchView(t.dataset.view);
  if (t.matches('.logout')) clearSession();
  if (t.dataset.authMode) showAuthMode(t.dataset.authMode);
  if (t.dataset.viewShortcut) switchView(t.dataset.viewShortcut);
});

$('#forgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const fb = $('.feedback', f);
  const box = $('#forgotResult');
  const link = $('#forgotResetUrl');
  fb.textContent = '';
  fb.className = 'feedback';
  box.hidden = true;
  link.textContent = '';
  link.removeAttribute('href');
  try {
    const result = await api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: f.email.value, role: 'admin' }),
    });
    fb.textContent = result.message || 'Se o e-mail existir, enviaremos instrucoes.';
    fb.classList.add('ok');
    if (result.resetUrl) {
      link.href = result.resetUrl;
      link.textContent = result.resetUrl;
      box.hidden = false;
    }
  } catch (err) {
    fb.textContent = err.message;
    fb.classList.add('error');
  }
});

$('#resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const fb = $('.feedback', f);
  fb.textContent = '';
  fb.className = 'feedback';
  try {
    await api('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: f.token.value, password: f.password.value }),
    });
    fb.textContent = 'Senha atualizada. Entre com a nova senha.';
    fb.classList.add('ok');
    f.reset();
    history.replaceState(null, '', location.pathname);
    setTimeout(() => showAuthMode('login'), 900);
  } catch (err) {
    fb.textContent = err.message;
    fb.classList.add('error');
  }
});

async function loadDashboard() {
  const stats = await api('/admin/stats');
  const kpis = [
    { label: 'Projetos', val: stats.totalProjects, accent: true },
    { label: 'Em operacao', val: stats.projects.active || 0 },
    { label: 'Propostas em aberto', val: (stats.proposals.under_review || 0) + (stats.proposals.submitted || 0) },
    { label: 'Contatos novos', val: stats.contacts.new || 0 },
    { label: 'Participantes', val: stats.participants },
    { label: 'Pontos de dados', val: stats.dataPoints },
  ];
  $('#kpis').innerHTML = kpis.map((k) => `<div class="kpi"><div class="label">${k.label}</div><div class="val ${k.accent ? 'accent' : ''}">${k.val}</div></div>`).join('');
  const recent = await api('/admin/proposals');
  $('#recentProposals tbody').innerHTML = recent.slice(0, 8).map((p) => `
    <tr><td>#${p.id}</td><td>${esc(p.proponente)}</td><td>${esc(p.area)}</td><td>${esc(p.estagio)}</td>
    <td><span class="status ${p.status}">${STATUS_LABEL[p.status]}</span></td><td>${fmtDate(p.created_at)}</td></tr>`).join('')
    || '<tr><td colspan="6" class="muted">Nenhuma proposta ainda.</td></tr>';
}

async function loadOwners() {
  if (!state.participants.length) state.participants = await api('/admin/participants');
  return state.participants;
}

async function loadProjects() {
  const rows = await api('/admin/projects');
  $('#projectsTable tbody').innerHTML = rows.map((p) => `
    <tr>
      <td><strong>${esc(p.name)}</strong></td>
      <td><code>${esc(p.slug)}</code></td>
      <td>${esc(p.area)}</td>
      <td><span class="status ${p.status}">${STATUS_LABEL[p.status] || p.status}</span></td>
      <td>${p.owner_email ? esc(p.owner_email) : '---'}</td>
      <td>${p.proposal_id ? `Proposta #${p.proposal_id}` : 'Curadoria'}</td>
      <td>${p.is_published ? 'Sim' : 'Nao'}</td>
      <td>${p.data_points}</td>
      <td><button class="btn" data-project="${p.id}">Editar</button></td>
    </tr>`).join('') || '<tr><td colspan="9" class="muted">Nenhum projeto publicado. Abra uma proposta aprovada para publicar o primeiro.</td></tr>';
}

async function openProject(id) {
  const p = await api(`/admin/projects/${id}`);
  await loadOwners();
  const ownerOpts = ['<option value="">Sem dono</option>']
    .concat(state.participants.map((u) => `<option value="${u.id}" ${u.id === p.owner_user_id ? 'selected' : ''}>${esc(u.name)}</option>`)).join('');
  $('#detailContent').innerHTML = `
    <h3>${esc(p.name)} <code>${esc(p.slug)}</code></h3>
    <div class="detail-actions">
      <select id="prStatus">${PROJECT_STATUS.map((s) => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select>
      <select id="prOwner">${ownerOpts}</select>
      <input id="prZone" type="text" placeholder="Zona" value="${esc(p.zone || '')}" />
      <input id="prX" type="number" min="0" max="100" placeholder="Mapa X" value="${p.map_x ?? ''}" />
      <input id="prY" type="number" min="0" max="100" placeholder="Mapa Y" value="${p.map_y ?? ''}" />
      <textarea id="prDesc" placeholder="Descricao">${esc(p.description || '')}</textarea>
      <label class="check"><input type="checkbox" id="prPub" ${p.is_published ? 'checked' : ''} /> Publicado no painel ao vivo</label>
      <button class="btn primary" id="prSave">Salvar</button>
      <button class="btn danger" id="prDel">Excluir</button>
    </div>`;
  if (!$('#detailDialog').open) $('#detailDialog').showModal();
  $('#prSave').onclick = async () => {
    await api(`/admin/projects/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: $('#prStatus').value,
        owner_user_id: $('#prOwner').value || null,
        zone: $('#prZone').value,
        map_x: $('#prX').value || null,
        map_y: $('#prY').value || null,
        description: $('#prDesc').value,
        is_published: $('#prPub').checked,
      }),
    });
    $('#detailDialog').close();
    loadProjects();
    loadDashboard();
  };
  $('#prDel').onclick = async () => {
    if (!confirm('Excluir este projeto? Os dados enviados tambem serao removidos.')) return;
    await api(`/admin/projects/${p.id}`, { method: 'DELETE' });
    $('#detailDialog').close();
    loadProjects();
    loadDashboard();
  };
}

async function loadProposals() {
  const status = $('#proposalsStatus').value;
  const rows = await api(`/admin/proposals${status ? `?status=${status}` : ''}`);
  $('#proposalsTable tbody').innerHTML = rows.map((p) => `
    <tr>
      <td>#${p.id}</td>
      <td><strong>${esc(p.proponente)}</strong><br><span class="muted">${esc(p.nome)}</span></td>
      <td>${esc(p.email)}</td><td>${esc(p.area)}</td><td>${esc(p.estagio)}</td>
      <td><span class="status ${p.status}">${STATUS_LABEL[p.status]}</span></td>
      <td>${fmtDate(p.created_at)}</td>
      <td><button class="btn" data-detail-proposal="${p.id}">Abrir</button></td>
    </tr>`).join('') || '<tr><td colspan="8" class="muted">Nenhuma proposta.</td></tr>';
}
$('#proposalsStatus').addEventListener('change', loadProposals);

async function loadContacts() {
  const status = $('#contactsStatus').value;
  const rows = await api(`/admin/contacts${status ? `?status=${status}` : ''}`);
  $('#contactsTable tbody').innerHTML = rows.map((c) => `
    <tr><td>#${c.id}</td><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(c.company || '---')}</td>
    <td>${esc(c.area || '---')}</td><td><span class="status ${c.status}">${STATUS_LABEL[c.status]}</span></td>
    <td>${fmtDate(c.created_at)}</td><td><button class="btn" data-detail-contact="${c.id}">Abrir</button></td></tr>`).join('')
    || '<tr><td colspan="8" class="muted">Nenhum contato.</td></tr>';
}
$('#contactsStatus').addEventListener('change', loadContacts);

async function loadParticipants() {
  state.participants = await api('/admin/participants');
  $('#participantsTable tbody').innerHTML = state.participants.map((u) => `
    <tr><td>#${u.id}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.company || '---')}</td>
    <td>${u.proposal_count}</td><td>${u.project_count}</td><td>${fmtDate(u.created_at)}</td>
    <td><button class="btn danger" data-del-participant="${u.id}">Excluir</button></td></tr>`).join('')
    || '<tr><td colspan="8" class="muted">Nenhum participante.</td></tr>';
}

document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.project) openProject(t.dataset.project);
  if (t.dataset.detailProposal) openProposal(t.dataset.detailProposal);
  if (t.dataset.detailContact) openContact(t.dataset.detailContact);
  if (t.dataset.delParticipant) {
    if (!confirm('Excluir participante? Esta acao nao pode ser desfeita.')) return;
    await api(`/admin/participants/${t.dataset.delParticipant}`, { method: 'DELETE' });
    loadParticipants();
  }
});

async function openProposal(id) {
  const p = await api(`/admin/proposals/${id}`);
  const hasProject = Boolean(p.project_id);
  const publishLabel = p.status === 'approved' ? 'Publicar como projeto' : 'Aprovar e publicar como projeto';
  $('#detailContent').innerHTML = `
    <h3>Proposta #${p.id} - ${esc(p.proponente)}</h3>
    <dl class="detail-grid">
      <dt>Contato</dt><dd>${esc(p.nome)} - ${esc(p.email)}</dd>
      <dt>CNPJ</dt><dd>${esc(p.cnpj || '---')}</dd>
      <dt>Perfil</dt><dd>${esc(p.perfil)}</dd>
      <dt>Area</dt><dd>${esc(p.area)}</dd>
      <dt>Estagio</dt><dd>${esc(p.estagio)}</dd>
      <dt>Objetivo</dt><dd>${esc(p.objetivo)}</dd>
      <dt>Resumo</dt><dd>${esc(p.resumo)}</dd>
      <dt>Cadastro</dt><dd>${p.user_email ? esc(p.user_email) + ' (autenticado)' : 'Anonimo'}</dd>
      <dt>Projeto</dt><dd>${hasProject ? `Publicado como <code>${esc(p.project_slug)}</code>` : 'Ainda nao publicado'}</dd>
      <dt>Recebida</dt><dd>${fmtDate(p.created_at)}</dd>
    </dl>
    <div class="detail-actions">
      <select id="pStatus">${PROPOSAL_STATUS.map((s) => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select>
      <button class="btn primary" id="pSave">Atualizar status</button>
      ${hasProject ? `<button class="btn" data-project="${p.project_id}">Abrir projeto</button>` : `<button class="btn primary" id="pPublish">${publishLabel}</button>`}
      <button class="btn danger" id="pDel">Excluir</button>
      <textarea id="pNotes" placeholder="Observacoes internas">${esc(p.admin_notes || '')}</textarea>
    </div>`;
  $('#detailDialog').showModal();
  $('#pSave').onclick = async () => {
    await api(`/admin/proposals/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: $('#pStatus').value, admin_notes: $('#pNotes').value }),
    });
    $('#detailDialog').close();
    loadProposals();
    loadDashboard();
  };
  $('#pPublish')?.addEventListener('click', async () => {
    const name = [p.proponente, p.objetivo].filter(Boolean).join(' - ').slice(0, 160);
    await api(`/admin/proposals/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved', admin_notes: $('#pNotes').value }),
    });
    await api('/admin/projects', {
      method: 'POST',
      body: JSON.stringify({
        proposal_id: p.id,
        owner_user_id: p.user_id || null,
        name,
        area: p.area,
        status: 'active',
        description: `${p.objetivo}\n\n${p.resumo}`.trim(),
        is_published: true,
      }),
    });
    $('#detailDialog').close();
    await loadDashboard();
    switchView('projects');
  });
  $('#pDel').onclick = async () => {
    if (!confirm('Excluir esta proposta?')) return;
    await api(`/admin/proposals/${p.id}`, { method: 'DELETE' });
    $('#detailDialog').close();
    loadProposals();
    loadDashboard();
  };
}

async function openContact(id) {
  const all = await api('/admin/contacts');
  const c = all.find((x) => x.id == id);
  if (!c) return;
  $('#detailContent').innerHTML = `
    <h3>Contato #${c.id}</h3>
    <dl class="detail-grid">
      <dt>Nome</dt><dd>${esc(c.name)}</dd>
      <dt>E-mail</dt><dd>${esc(c.email)}</dd>
      <dt>Empresa</dt><dd>${esc(c.company || '---')}</dd>
      <dt>Area</dt><dd>${esc(c.area || '---')}</dd>
      <dt>Mensagem</dt><dd>${esc(c.message || '---')}</dd>
      <dt>Recebido</dt><dd>${fmtDate(c.created_at)}</dd>
    </dl>
    <div class="detail-actions">
      <select id="cStatus">${CONTACT_STATUS.map((s) => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select>
      <button class="btn primary" id="cSave">Atualizar status</button>
      <button class="btn danger" id="cDel">Excluir</button>
      <textarea id="cNotes" placeholder="Observacoes internas">${esc(c.admin_notes || '')}</textarea>
    </div>`;
  $('#detailDialog').showModal();
  $('#cSave').onclick = async () => {
    await api(`/admin/contacts/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: $('#cStatus').value, admin_notes: $('#cNotes').value }),
    });
    $('#detailDialog').close();
    loadContacts();
    loadDashboard();
  };
  $('#cDel').onclick = async () => {
    if (!confirm('Excluir este contato?')) return;
    await api(`/admin/contacts/${c.id}`, { method: 'DELETE' });
    $('#detailDialog').close();
    loadContacts();
    loadDashboard();
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

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

(function restore() {
  const params = new URLSearchParams(location.search);
  const resetToken = params.get('reset');
  if (resetToken) {
    localStorage.removeItem(TOKEN_KEY);
    $('#resetForm').token.value = resetToken;
    showAuthMode('reset');
    return;
  }
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    state.token = s.token;
    state.user = s.user;
    api('/admin/stats').then(showApp).catch(clearSession);
  } catch {
    clearSession();
  }
})();
