'use strict';

/* ───────────────────────────────────────
   Outreach Cockpit — Logik
   ─────────────────────────────────────── */

const STORAGE_KEY = 'webstudio_outreach_v1';

const STATUS_LABEL = {
  neu:          'Neu',
  kontaktiert:  'Kontaktiert',
  folge:        'Follow-up nötig',
  interessiert: 'Interessiert',
  kunde:        'Kunde',
  abgelehnt:    'Abgelehnt',
};

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-1',
    name: 'Erstkontakt — Keine Website',
    subject: 'Schneller Tipp für {firma} — und ein Angebot',
    body: `{anrede},

ich bin Tim von WebStudio Duisburg — wir bauen Websites für lokale Unternehmen in Duisburg und Umgebung. Beim Recherchieren in {stadt} bin ich auf {firma} gestoßen.

Aufgefallen ist mir: Sie haben aktuell scheinbar noch keine eigene Website. Gleichzeitig suchen viele potenzielle Kunden bei Google nach "{branche} {stadt}" — und finden dort andere Anbieter zuerst.

Eine moderne Website ist heute der erste Eindruck — und bringt regelmäßig Anfragen, ohne dass Sie selbst etwas tun müssen.

Wir bieten 3 klare Pakete an, alle mit Festpreis:
• Starter Website ab 490 €
• Anfrage Website ab 890 €
• Business Website Plus ab 1.490 €

Wenn das interessant klingt, antworten Sie einfach kurz — ich melde mich innerhalb von 24 h mit einem konkreten Angebot.

Beste Grüße aus Duisburg
Tim
WebStudio Duisburg
weblabduisburg@gmail.com`,
  },
  {
    id: 'tpl-2',
    name: 'Erstkontakt — Veraltete Website',
    subject: 'Mit der Website von {firma} entgehen Ihnen Anfragen',
    body: `{anrede},

ich habe heute auf {website} vorbeigeschaut und möchte ehrlich sein: Auf dem Handy wirkt die Seite recht veraltet. Bei {branche}-Anfragen kommen heute über 70 % der Kunden vom Handy — und springen ab, wenn die Seite nicht modern und schnell ist.

Bei WebStudio Duisburg modernisieren wir Websites für lokale Betriebe in {stadt} und Umgebung — sauber, mobil, mit klarer Anfrage-Logik. Festpreis zwischen 490 € und 1.490 €, je nach Umfang.

Wenn Sie 10 Minuten Zeit haben, schaue ich mir Ihre Website konkret an und sage Ihnen, was ich konkret verbessern würde — kostenlos und unverbindlich.

Interessiert? Einfach kurz antworten.

Beste Grüße aus Duisburg
Tim
WebStudio Duisburg
weblabduisburg@gmail.com`,
  },
  {
    id: 'tpl-3',
    name: 'Wert-Tipp ohne Verkauf',
    subject: 'Schneller Google-Tipp für {firma}',
    body: `{anrede},

kurzer kostenloser Tipp für Ihren Betrieb in {stadt}:

Suchen Sie mal auf Ihrem Handy nach "{branche} {stadt}". Wo erscheinen Sie? Erste Treffer, Kartenliste, oder gar nicht?

Falls Sie nicht zufrieden sind: Ich kann Ihnen kurz zeigen, wie Sie mit 2–3 einfachen Schritten weiter nach oben kommen — meistens kostet das nichts und dauert 30 Minuten.

Wenn das hilfreich klingt, einfach antworten.

Beste Grüße
Tim
WebStudio Duisburg`,
  },
  {
    id: 'tpl-4',
    name: 'Follow-up nach 1 Woche',
    subject: 'Re: Kurze Frage zu {firma}',
    body: `{anrede},

vor einer Woche hatte ich Ihnen geschrieben. Sie sind sicher beschäftigt, daher melde ich mich kurz nochmal.

Falls eine neue Website für {firma} grade kein Thema ist: Kein Problem, sagen Sie kurz Bescheid, dann lasse ich Sie in Ruhe.

Falls doch interessant: Ich kann Ihnen in 24 h ein konkretes Festpreis-Angebot machen — ohne Verpflichtung.

Beste Grüße aus Duisburg
Tim
WebStudio Duisburg`,
  },
  {
    id: 'tpl-5',
    name: 'Letzte Erinnerung',
    subject: 'Letzte Mail zu Ihrer Website — versprochen',
    body: `{anrede},

das ist meine letzte Mail in dieser Sache.

Falls Sie sich später doch für eine neue Website interessieren, melden Sie sich gerne per Mail (weblabduisburg@gmail.com) oder WhatsApp.

Ansonsten alles Gute für {firma}!

Beste Grüße aus Duisburg
Tim
WebStudio Duisburg`,
  },
];

/* ── State ── */
const state = {
  leads: [],
  templates: [],
  selectedLeadId: null,
  filters: { status: '', branche: '', stadt: '', search: '' },
};

/* ── Storage ── */
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    leads: state.leads,
    templates: state.templates,
  }));
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.leads = d.leads || [];
    state.templates = (d.templates && d.templates.length) ? d.templates : DEFAULT_TEMPLATES.slice();
  } catch (_) {
    state.leads = [];
    state.templates = DEFAULT_TEMPLATES.slice();
  }
}

/* ── Utils ── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'oc-toast visible' + (type ? ' ' + type : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('visible'), 2500);
}

/* ── Personalize templates ── */
function personalize(text, lead) {
  if (!text) return '';
  const anrede = lead?.name ? `Hallo ${lead.name}` : 'Sehr geehrte Damen und Herren';
  const vars = {
    firma:   lead?.firma   || '',
    name:    lead?.name    || '',
    anrede:  anrede,
    branche: (lead?.branche || 'Ihr Geschäft').toLowerCase(),
    stadt:   lead?.stadt   || 'Ihrer Stadt',
    website: lead?.website || '',
  };
  return text.replace(/\{(\w+)\}/g, (m, k) => vars[k] !== undefined ? vars[k] : m);
}

/* ── Render: Stats ── */
function renderStats() {
  const grid = document.getElementById('stats-grid');
  const ls = state.leads;
  const counts = {
    total:        ls.length,
    neu:          ls.filter(l => l.status === 'neu').length,
    kontaktiert:  ls.filter(l => l.status === 'kontaktiert' || l.status === 'folge').length,
    interessiert: ls.filter(l => l.status === 'interessiert').length,
    kunde:        ls.filter(l => l.status === 'kunde').length,
    rate:         (() => {
      const sent = ls.filter(l => l.lastContactedAt).length;
      const positive = ls.filter(l => l.status === 'interessiert' || l.status === 'kunde').length;
      return sent ? Math.round(positive / sent * 100) : 0;
    })(),
  };
  grid.innerHTML = `
    <div class="oc-stat"><span class="oc-stat-value">${counts.total}</span><span class="oc-stat-label">Gesamt</span></div>
    <div class="oc-stat"><span class="oc-stat-value" style="color:#3730a3">${counts.neu}</span><span class="oc-stat-label">Neu</span></div>
    <div class="oc-stat"><span class="oc-stat-value" style="color:#c2410c">${counts.kontaktiert}</span><span class="oc-stat-label">In Kontakt</span></div>
    <div class="oc-stat"><span class="oc-stat-value" style="color:#16a34a">${counts.interessiert}</span><span class="oc-stat-label">Interessiert</span></div>
    <div class="oc-stat"><span class="oc-stat-value" style="color:#064e3b">${counts.kunde}</span><span class="oc-stat-label">Kunden</span></div>
    <div class="oc-stat"><span class="oc-stat-value">${counts.rate}%</span><span class="oc-stat-label">Erfolgsquote</span></div>
  `;
}

/* ── Render: Filters ── */
function renderFilters() {
  const branches = [...new Set(state.leads.map(l => l.branche).filter(Boolean))].sort();
  const staedte = [...new Set(state.leads.map(l => l.stadt).filter(Boolean))].sort();

  const fb = document.getElementById('filter-branche');
  const cur1 = fb.value;
  fb.innerHTML = '<option value="">Alle Branchen</option>' + branches.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
  fb.value = cur1;

  const fs = document.getElementById('filter-stadt');
  const cur2 = fs.value;
  fs.innerHTML = '<option value="">Alle Städte</option>' + staedte.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  fs.value = cur2;
}

/* ── Render: Leads Table ── */
function filteredLeads() {
  const f = state.filters;
  const q = f.search.trim().toLowerCase();
  return state.leads.filter(l => {
    if (f.status && l.status !== f.status) return false;
    if (f.branche && l.branche !== f.branche) return false;
    if (f.stadt && l.stadt !== f.stadt) return false;
    if (q) {
      const blob = [l.firma, l.name, l.email, l.stadt, l.branche, l.notizen].join(' ').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function renderLeads() {
  const tbody = document.getElementById('leads-tbody');
  const empty = document.getElementById('empty-state');
  const leads = filteredLeads();

  if (!state.leads.length) {
    tbody.innerHTML = '';
    empty.classList.add('visible');
    return;
  }
  empty.classList.remove('visible');

  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-3)">Keine Leads passen zum Filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = leads.map(l => `
    <tr class="${l.id === state.selectedLeadId ? 'active' : ''}" data-lead-id="${l.id}">
      <td><span class="oc-status-pill" style="background:${statusColor(l.status)}"></span></td>
      <td class="oc-firma">${esc(l.firma)}${l.name ? `<span class="oc-firma-sub">${esc(l.name)}</span>` : ''}</td>
      <td class="oc-cell-muted">${esc(l.branche || '—')}</td>
      <td class="oc-cell-muted">${esc(l.stadt || '—')}</td>
      <td class="oc-cell-email">${l.email ? `<a href="mailto:${esc(l.email)}" onclick="event.stopPropagation()">${esc(l.email)}</a>` : '—'}</td>
      <td><span class="oc-status oc-status-${l.status}">${STATUS_LABEL[l.status] || l.status}</span></td>
      <td class="oc-cell-muted">${formatDate(l.lastContactedAt)}</td>
      <td><button class="oc-btn-icon" data-action="open">→</button></td>
    </tr>
  `).join('');
}

function statusColor(status) {
  return {
    neu: '#6366f1', kontaktiert: '#f59e0b', folge: '#fb923c',
    interessiert: '#16a34a', kunde: '#059669', abgelehnt: '#ef4444',
  }[status] || '#94a3b8';
}

/* ── Drawer ── */
function openLead(id) {
  const lead = state.leads.find(l => l.id === id);
  if (!lead) return;
  state.selectedLeadId = id;

  document.getElementById('drawer-title').textContent = lead.firma || 'Neuer Lead';
  document.getElementById('drawer-subtitle').textContent = [lead.branche, lead.stadt].filter(Boolean).join(' · ') || '—';

  document.getElementById('d-firma').value    = lead.firma   || '';
  document.getElementById('d-name').value     = lead.name    || '';
  document.getElementById('d-email').value    = lead.email   || '';
  document.getElementById('d-telefon').value  = lead.telefon || '';
  document.getElementById('d-branche').value  = lead.branche || '';
  document.getElementById('d-stadt').value    = lead.stadt   || '';
  document.getElementById('d-website').value  = lead.website || '';
  document.getElementById('d-status').value   = lead.status  || 'neu';
  document.getElementById('d-notizen').value  = lead.notizen || '';

  // Populate templates
  const tplSel = document.getElementById('d-template');
  tplSel.innerHTML = state.templates.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  applyTemplate(state.templates[0]?.id);

  document.getElementById('lead-drawer').classList.add('open');
  renderLeads();
}

function applyTemplate(templateId) {
  const tpl = state.templates.find(t => t.id === templateId);
  const lead = state.leads.find(l => l.id === state.selectedLeadId);
  if (!tpl || !lead) return;
  document.getElementById('d-subject').value = personalize(tpl.subject, lead);
  document.getElementById('d-body').value    = personalize(tpl.body, lead);
  updateMailLinks();
}

function updateMailLinks() {
  const lead = state.leads.find(l => l.id === state.selectedLeadId);
  if (!lead) return;
  const email   = (lead.email || '').trim();
  const subject = document.getElementById('d-subject').value;
  const body    = document.getElementById('d-body').value;

  document.getElementById('btn-open-gmail').href =
    `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.getElementById('btn-open-mailto').href =
    `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function closeDrawer() {
  state.selectedLeadId = null;
  document.getElementById('lead-drawer').classList.remove('open');
  renderLeads();
}

function saveLead() {
  const lead = state.leads.find(l => l.id === state.selectedLeadId);
  if (!lead) return;

  lead.firma    = document.getElementById('d-firma').value.trim();
  lead.name     = document.getElementById('d-name').value.trim();
  lead.email    = document.getElementById('d-email').value.trim();
  lead.telefon  = document.getElementById('d-telefon').value.trim();
  lead.branche  = document.getElementById('d-branche').value.trim();
  lead.stadt    = document.getElementById('d-stadt').value.trim();
  lead.website  = document.getElementById('d-website').value.trim();
  lead.status   = document.getElementById('d-status').value;
  lead.notizen  = document.getElementById('d-notizen').value.trim();
  lead.updatedAt = Date.now();

  persist();
  renderStats();
  renderFilters();
  renderLeads();
  toast('Gespeichert', 'success');

  document.getElementById('drawer-title').textContent = lead.firma || 'Neuer Lead';
  document.getElementById('drawer-subtitle').textContent = [lead.branche, lead.stadt].filter(Boolean).join(' · ') || '—';
}

function deleteLead() {
  const lead = state.leads.find(l => l.id === state.selectedLeadId);
  if (!lead) return;
  if (!confirm(`Lead "${lead.firma}" wirklich löschen?`)) return;
  state.leads = state.leads.filter(l => l.id !== state.selectedLeadId);
  persist();
  closeDrawer();
  renderStats();
  renderFilters();
  renderLeads();
  toast('Gelöscht');
}

function markContacted() {
  const lead = state.leads.find(l => l.id === state.selectedLeadId);
  if (!lead) return;
  lead.lastContactedAt = Date.now();
  lead.updatedAt = Date.now();
  if (lead.status === 'neu') {
    lead.status = 'kontaktiert';
    document.getElementById('d-status').value = 'kontaktiert';
  }
  lead.history = lead.history || [];
  lead.history.push({ at: Date.now(), action: 'contacted' });
  persist();
  renderStats();
  renderLeads();
  toast('Als kontaktiert markiert ✓', 'success');
}

/* ── Add Lead (single + bulk) ── */
function confirmAddSingle() {
  const firma = document.getElementById('add-firma').value.trim();
  const email = document.getElementById('add-email').value.trim();
  if (!firma || !email) { toast('Firma und E-Mail sind Pflicht', 'error'); return; }
  state.leads.push({
    id: uid(),
    firma,
    name:    document.getElementById('add-name').value.trim(),
    email,
    telefon: document.getElementById('add-telefon').value.trim(),
    branche: document.getElementById('add-branche').value.trim(),
    stadt:   document.getElementById('add-stadt').value.trim(),
    website: document.getElementById('add-website').value.trim(),
    notizen: document.getElementById('add-notizen').value.trim(),
    status:  'neu',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastContactedAt: null,
    history: [],
  });
  persist();
  closeModal('modal-add');
  ['add-firma','add-name','add-email','add-telefon','add-branche','add-stadt','add-website','add-notizen'].forEach(id => document.getElementById(id).value = '');
  renderStats();
  renderFilters();
  renderLeads();
  toast('Lead hinzugefügt', 'success');
}

function confirmAddBulk() {
  const text = document.getElementById('bulk-input').value.trim();
  if (!text) return;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let added = 0;
  for (const line of lines) {
    const parts = line.split(/[;\t]|,(?=\s)/).map(p => p.trim());
    if (parts.length < 2) continue;
    const [firma, email, branche = '', stadt = '', telefon = '', website = ''] = parts;
    if (!firma || !email || !email.includes('@')) continue;
    state.leads.push({
      id: uid(), firma, name: '', email, telefon, branche, stadt, website,
      notizen: '', status: 'neu',
      createdAt: Date.now(), updatedAt: Date.now(), lastContactedAt: null, history: [],
    });
    added++;
  }
  persist();
  closeModal('modal-add');
  document.getElementById('bulk-input').value = '';
  renderStats();
  renderFilters();
  renderLeads();
  toast(`${added} Lead${added !== 1 ? 's' : ''} hinzugefügt`, added ? 'success' : 'error');
}

/* ── CSV Export ── */
function csvExport() {
  if (!state.leads.length) { toast('Keine Leads zum Exportieren', 'error'); return; }
  const cols = ['firma','name','email','telefon','branche','stadt','website','status','notizen','lastContactedAt'];
  const head = cols.join(',');
  const rows = state.leads.map(l => cols.map(c => {
    let v = l[c] || '';
    if (c === 'lastContactedAt' && v) v = new Date(v).toISOString().slice(0, 10);
    v = String(v).replace(/"/g, '""');
    return /[,"\n;]/.test(v) ? `"${v}"` : v;
  }).join(','));
  const csv = [head, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `webstudio-leads-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Export gestartet', 'success');
}

/* ── CSV Import ── */
function confirmImport() {
  const file = document.getElementById('csv-file').files[0];
  const pasted = document.getElementById('csv-paste').value.trim();
  if (file) {
    const reader = new FileReader();
    reader.onload = () => parseAndImport(reader.result);
    reader.readAsText(file);
  } else if (pasted) {
    parseAndImport(pasted);
  } else {
    toast('Bitte Datei wählen oder Text einfügen', 'error');
  }
}

function parseAndImport(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { toast('CSV scheint leer zu sein', 'error'); return; }
  const sep = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
  const header = lines[0].split(sep).map(s => s.trim().toLowerCase().replace(/^"|"$/g, ''));
  let added = 0;
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i], sep);
    const obj = {};
    header.forEach((h, idx) => obj[h] = (parts[idx] || '').trim());
    if (!obj.firma || !obj.email) continue;
    state.leads.push({
      id: uid(),
      firma: obj.firma,
      name: obj.name || '',
      email: obj.email,
      telefon: obj.telefon || '',
      branche: obj.branche || '',
      stadt: obj.stadt || '',
      website: obj.website || '',
      notizen: obj.notizen || '',
      status: obj.status || 'neu',
      createdAt: Date.now(), updatedAt: Date.now(), lastContactedAt: null, history: [],
    });
    added++;
  }
  persist();
  closeModal('modal-import');
  document.getElementById('csv-paste').value = '';
  document.getElementById('csv-file').value = '';
  renderStats();
  renderFilters();
  renderLeads();
  toast(`${added} Lead${added !== 1 ? 's' : ''} importiert`, added ? 'success' : 'error');
}

function parseCsvLine(line, sep) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === sep && !inQ) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/* ── Templates ── */
function renderTemplatesList() {
  const list = document.getElementById('templates-list');
  list.innerHTML = state.templates.map(t => `
    <div class="oc-template-card" data-tpl-id="${t.id}">
      <div class="oc-template-card-header">
        <input type="text" value="${esc(t.name)}" data-field="name" placeholder="Name der Vorlage" />
        <button class="oc-btn oc-btn-danger oc-btn-sm" data-action="delete-tpl">✕</button>
      </div>
      <label>Betreff</label>
      <input type="text" value="${esc(t.subject)}" data-field="subject" placeholder="Betreff …" />
      <label>Nachricht</label>
      <textarea data-field="body" rows="9" placeholder="Nachricht …">${esc(t.body)}</textarea>
    </div>
  `).join('');
}

function saveTemplates() {
  document.querySelectorAll('.oc-template-card').forEach(card => {
    const id = card.dataset.tplId;
    const tpl = state.templates.find(t => t.id === id);
    if (!tpl) return;
    tpl.name    = card.querySelector('[data-field="name"]').value;
    tpl.subject = card.querySelector('[data-field="subject"]').value;
    tpl.body    = card.querySelector('[data-field="body"]').value;
  });
  persist();
}

function addTemplate() {
  state.templates.push({ id: uid(), name: 'Neue Vorlage', subject: '', body: '' });
  persist();
  renderTemplatesList();
}

function deleteTemplate(id) {
  if (!confirm('Vorlage löschen?')) return;
  state.templates = state.templates.filter(t => t.id !== id);
  persist();
  renderTemplatesList();
}

/* ── Modal helpers ── */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

/* ── Copy to clipboard ── */
async function copyMail() {
  const subject = document.getElementById('d-subject').value;
  const body    = document.getElementById('d-body').value;
  const text    = `Betreff: ${subject}\n\n${body}`;
  try {
    await navigator.clipboard.writeText(text);
    toast('In Zwischenablage kopiert ✓', 'success');
  } catch (_) {
    toast('Kopieren fehlgeschlagen', 'error');
  }
}

/* ── Events ── */
function bindEvents() {
  // Header buttons
  document.getElementById('btn-add-lead').addEventListener('click', () => openModal('modal-add'));
  document.getElementById('btn-templates').addEventListener('click', () => { renderTemplatesList(); openModal('modal-templates'); });
  document.getElementById('btn-import').addEventListener('click', () => openModal('modal-import'));
  document.getElementById('btn-export').addEventListener('click', csvExport);

  // Modal close buttons + backdrop
  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', e => {
    e.target.closest('.oc-modal').classList.add('hidden');
    if (e.target.closest('#modal-templates')) saveTemplates();
  }));
  document.querySelectorAll('.oc-modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m) {
      m.classList.add('hidden');
      if (m.id === 'modal-templates') saveTemplates();
    }
  }));

  // Add lead tabs
  document.querySelectorAll('.oc-tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.oc-tab').forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.oc-tab-content').forEach(c => c.classList.toggle('active', c.dataset.tabContent === t.dataset.tab));
  }));

  // Add buttons
  document.getElementById('btn-confirm-add').addEventListener('click', confirmAddSingle);
  document.getElementById('btn-confirm-bulk').addEventListener('click', confirmAddBulk);
  document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);

  // Filters
  document.getElementById('search-input').addEventListener('input', e => { state.filters.search = e.target.value; renderLeads(); });
  document.getElementById('filter-status').addEventListener('change', e => { state.filters.status = e.target.value; renderLeads(); });
  document.getElementById('filter-branche').addEventListener('change', e => { state.filters.branche = e.target.value; renderLeads(); });
  document.getElementById('filter-stadt').addEventListener('change', e => { state.filters.stadt = e.target.value; renderLeads(); });
  document.getElementById('btn-clear-filter').addEventListener('click', () => {
    state.filters = { status: '', branche: '', stadt: '', search: '' };
    document.getElementById('search-input').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-branche').value = '';
    document.getElementById('filter-stadt').value = '';
    renderLeads();
  });

  // Lead table click
  document.getElementById('leads-tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-lead-id]');
    if (!tr) return;
    openLead(tr.dataset.leadId);
  });

  // Drawer
  document.getElementById('btn-close-drawer').addEventListener('click', closeDrawer);
  document.getElementById('btn-save-lead').addEventListener('click', saveLead);
  document.getElementById('btn-delete-lead').addEventListener('click', deleteLead);
  document.getElementById('btn-mark-contacted').addEventListener('click', markContacted);

  // Live update mail links as subject/body changes
  document.getElementById('d-subject').addEventListener('input', updateMailLinks);
  document.getElementById('d-body').addEventListener('input', updateMailLinks);
  document.getElementById('d-email').addEventListener('input', updateMailLinks);

  // Template change
  document.getElementById('d-template').addEventListener('change', e => applyTemplate(e.target.value));

  // Mail buttons
  document.getElementById('btn-copy-mail').addEventListener('click', copyMail);

  // Templates modal
  document.getElementById('btn-add-template').addEventListener('click', addTemplate);
  document.getElementById('templates-list').addEventListener('click', e => {
    if (e.target.dataset.action === 'delete-tpl') {
      const id = e.target.closest('[data-tpl-id]').dataset.tplId;
      deleteTemplate(id);
    }
  });
  // Save templates on input change (debounced)
  let saveTimer = null;
  document.getElementById('templates-list').addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveTemplates, 400);
  });

  // Escape key closes modals + drawer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.oc-modal:not(.hidden)').forEach(m => {
        m.classList.add('hidden');
        if (m.id === 'modal-templates') saveTemplates();
      });
      if (document.getElementById('lead-drawer').classList.contains('open')) closeDrawer();
    }
  });
}

/* ── Init ── */
function init() {
  load();
  bindEvents();
  renderStats();
  renderFilters();
  renderLeads();
}

document.addEventListener('DOMContentLoaded', init);
