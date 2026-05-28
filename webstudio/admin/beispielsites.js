'use strict';

/* Beispiel-Sites.app — Portfolio mit Branchenfilter */

const SITES_KEY = 'webstudio_beispielsites_v1';

const SAMPLE_SITES = [
  {
    id: 's1',
    name: 'Friseur Mauro',
    category: 'Friseur',
    url: 'https://mauro-friseur-duisburg.de',
    desc: 'Alte Tabellen-Site → moderne mobile Anfrage-Seite mit Online-Termin und Bewertungen direkt sichtbar.',
    color: '#a050ff',
    createdAt: Date.now() - 12 * 86400000,
  },
  {
    id: 's2',
    name: 'Schreinerei Becker',
    category: 'Handwerk',
    url: 'https://schreinerei-becker.de',
    desc: 'Dunkles, edles Premium-Design mit großer Holz-Galerie. Anfrage-Conversion verdreifacht.',
    color: '#ff8b3a',
    createdAt: Date.now() - 30 * 86400000,
  },
  {
    id: 's3',
    name: 'Kosmetikstudio Lia',
    category: 'Kosmetik',
    url: 'https://kosmetik-lia.de',
    desc: 'Warmes Rosé-Design + WhatsApp-Termin-Bot. 14 Buchungen außerhalb der Öffnungszeit in Woche 1.',
    color: '#ff5db4',
    createdAt: Date.now() - 45 * 86400000,
  },
];

let sites = [];
let editingId = null;
let activeFilter = '';

/* ── Storage ── */
function loadSites() {
  try {
    const s = localStorage.getItem(SITES_KEY);
    if (s) return JSON.parse(s);
  } catch (_) {}
  return [];
}
function saveSites() {
  localStorage.setItem(SITES_KEY, JSON.stringify(sites));
}
function loadSamples() {
  if (sites.length > 0 && !confirm('Es sind bereits Einträge vorhanden. Beispiele dazu laden?')) return;
  SAMPLE_SITES.forEach(s => {
    if (!sites.find(x => x.id === s.id)) sites.push({ ...s });
  });
  saveSites();
  render();
}

/* ── Toast ── */
function showToast(msg) {
  let t = document.getElementById('osapp-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'osapp-toast';
    t.className = 'osapp-toast';
    document.body.appendChild(t);
  }
  t.innerHTML = `<span class="dot"></span>${msg}`;
  t.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('visible'), 1600);
}

/* ── Render ── */
function render() {
  renderFilter();
  renderGrid();
}

function renderFilter() {
  const categories = [...new Set(sites.map(s => s.category))].sort();
  const el = document.getElementById('filter');
  el.innerHTML = [
    `<button class="beispiel-filter-chip ${activeFilter === '' ? 'active' : ''}" onclick="setFilter('')">Alle (${sites.length})</button>`,
    ...categories.map(c => {
      const count = sites.filter(s => s.category === c).length;
      return `<button class="beispiel-filter-chip ${activeFilter === c ? 'active' : ''}" onclick="setFilter('${esc(c)}')">${esc(c)} (${count})</button>`;
    }),
  ].join('');
}

function renderGrid() {
  const filtered = activeFilter ? sites.filter(s => s.category === activeFilter) : sites;
  const grid = document.getElementById('grid');
  if (filtered.length === 0 && sites.length === 0) {
    grid.innerHTML = `
      <div class="beispiel-add" onclick="openEditor()">
        <span class="beispiel-add-icon">+</span>
        <strong>Erste Website hinzufügen</strong>
        <span style="font-size: 12px;">Oder klick „Beispiele laden" oben rechts.</span>
      </div>`;
    return;
  }
  grid.innerHTML = filtered.map(s => `
    <article class="beispiel-card" onclick="openEditor('${s.id}')">
      <div class="beispiel-thumb">${makeThumb(s)}<span class="beispiel-category">${esc(s.category)}</span></div>
      <div class="beispiel-body">
        <h3 class="beispiel-name">${esc(s.name)}</h3>
        <p class="beispiel-desc">${esc(s.desc)}</p>
        <div class="beispiel-meta">
          <a class="beispiel-url" href="${esc(s.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ besuchen</a>
          <span>${formatDate(s.createdAt)}</span>
        </div>
      </div>
    </article>
  `).join('') + `
    <div class="beispiel-add" onclick="openEditor()">
      <span class="beispiel-add-icon">+</span>
      <strong>Neue Site</strong>
    </div>`;
}

/* Generiert ein abstrakt-stilisiertes Mock-Thumbnail als SVG */
function makeThumb(s) {
  const c = s.color || '#a050ff';
  return `
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="g-${s.id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${c}" stop-opacity="0.6"/>
          <stop offset="1" stop-color="#0a0612" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="url(#g-${s.id})"/>
      <!-- Browser-Bar -->
      <rect x="14" y="14" width="292" height="20" rx="6" fill="rgba(255,255,255,0.1)"/>
      <circle cx="24" cy="24" r="3" fill="#ff5f57"/>
      <circle cx="34" cy="24" r="3" fill="#febc2e"/>
      <circle cx="44" cy="24" r="3" fill="#28c840"/>
      <!-- Header-Linie -->
      <rect x="14" y="48" width="100" height="8" rx="2" fill="rgba(255,255,255,0.4)"/>
      <rect x="262" y="48" width="44" height="14" rx="7" fill="${c}"/>
      <!-- Hero-Headline (zweizeilig) -->
      <rect x="14" y="78" width="180" height="14" rx="2" fill="rgba(255,255,255,0.55)"/>
      <rect x="14" y="98" width="140" height="14" rx="2" fill="rgba(255,255,255,0.55)"/>
      <!-- Sub-Text -->
      <rect x="14" y="120" width="220" height="6" rx="1.5" fill="rgba(255,255,255,0.25)"/>
      <rect x="14" y="132" width="180" height="6" rx="1.5" fill="rgba(255,255,255,0.25)"/>
      <!-- 3 Cards unten -->
      <rect x="14"  y="152" width="92" height="36" rx="6" fill="rgba(255,255,255,0.08)"/>
      <rect x="114" y="152" width="92" height="36" rx="6" fill="rgba(255,255,255,0.08)"/>
      <rect x="214" y="152" width="92" height="36" rx="6" fill="rgba(255,255,255,0.08)"/>
    </svg>
  `;
}

function setFilter(cat) {
  activeFilter = cat;
  render();
}

/* ── Editor ── */
function openEditor(id) {
  editingId = id || null;
  const modal = document.getElementById('editor-modal');
  const title = document.getElementById('editor-title');
  const del = document.getElementById('ed-delete');
  if (id) {
    const s = sites.find(x => x.id === id);
    if (!s) return;
    title.textContent = 'Bearbeiten · ' + s.name;
    document.getElementById('ed-name').value = s.name;
    document.getElementById('ed-category').value = s.category;
    document.getElementById('ed-url').value = s.url;
    document.getElementById('ed-desc').value = s.desc;
    document.getElementById('ed-color').value = s.color || '#a050ff';
    del.style.display = '';
  } else {
    title.textContent = 'Neue Website';
    document.getElementById('ed-name').value = '';
    document.getElementById('ed-category').value = 'Friseur';
    document.getElementById('ed-url').value = '';
    document.getElementById('ed-desc').value = '';
    document.getElementById('ed-color').value = '#a050ff';
    del.style.display = 'none';
  }
  modal.classList.add('is-open');
  setTimeout(() => document.getElementById('ed-name').focus(), 50);
}

function closeEditor() {
  document.getElementById('editor-modal').classList.remove('is-open');
  editingId = null;
}

function saveEntry() {
  const name = document.getElementById('ed-name').value.trim();
  if (!name) { showToast('Bitte Namen eintragen'); return; }
  const data = {
    name,
    category: document.getElementById('ed-category').value,
    url: document.getElementById('ed-url').value.trim(),
    desc: document.getElementById('ed-desc').value.trim(),
    color: document.getElementById('ed-color').value,
  };
  if (editingId) {
    const i = sites.findIndex(s => s.id === editingId);
    if (i >= 0) sites[i] = { ...sites[i], ...data };
  } else {
    sites.unshift({ id: uid(), ...data, createdAt: Date.now() });
  }
  saveSites();
  closeEditor();
  showToast('Gespeichert');
  render();
}

function deleteEntry() {
  if (!editingId) return;
  if (!confirm('Diese Website wirklich aus der Liste entfernen?')) return;
  sites = sites.filter(s => s.id !== editingId);
  saveSites();
  closeEditor();
  showToast('Entfernt');
  render();
}

window.openEditor = openEditor;
window.closeEditor = closeEditor;
window.saveEntry = saveEntry;
window.deleteEntry = deleteEntry;
window.loadSamples = loadSamples;
window.setFilter = setFilter;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  mountTopNav('beispiele');
  sites = loadSites();
  render();
  // Modal-Hintergrund-Klick schließt
  document.getElementById('editor-modal').addEventListener('click', e => {
    if (e.target.id === 'editor-modal') closeEditor();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEditor();
  });
});
