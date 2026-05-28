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

/* ════════════════════════════════════════════════════════════
   QUICK-SITE-GENERATOR
   ════════════════════════════════════════════════════════════ */
let lastGenerated = null;

function openGenerator() {
  document.getElementById('gen-modal').classList.add('is-open');
  setTimeout(() => document.getElementById('gen-name').focus(), 50);
}
function closeGenerator() {
  document.getElementById('gen-modal').classList.remove('is-open');
}

// Stil-Chip-Toggle
document.addEventListener('click', e => {
  const chip = e.target.closest('#gen-style .gen-chip');
  if (!chip) return;
  document.querySelectorAll('#gen-style .gen-chip').forEach(c => c.classList.remove('is-on'));
  chip.classList.add('is-on');
});

// Color-Picker sync
document.addEventListener('input', e => {
  if (e.target.id === 'gen-color') {
    document.getElementById('gen-color-text').value = e.target.value;
  } else if (e.target.id === 'gen-color-text') {
    const v = e.target.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) document.getElementById('gen-color').value = v;
  }
});

function runGenerator() {
  const name = document.getElementById('gen-name').value.trim();
  if (!name) { showToast('Bitte Namen eintragen'); return; }
  const data = {
    name,
    branche:   document.getElementById('gen-branche').value,
    style:     document.querySelector('#gen-style .gen-chip.is-on')?.dataset.v || 'modern',
    color:     document.getElementById('gen-color').value,
    images:    parseInt(document.getElementById('gen-images').value) || 6,
    headline:  document.getElementById('gen-headline').value.trim(),
    cta:       document.getElementById('gen-cta').value.trim() || 'Termin sichern',
    sub:       document.getElementById('gen-sub').value.trim(),
    phone:     document.getElementById('gen-phone').value.trim(),
    email:     document.getElementById('gen-email').value.trim(),
    address:   document.getElementById('gen-address').value.trim(),
    hasGallery: document.getElementById('gen-gallery').checked,
    hasReviews: document.getElementById('gen-reviews').checked,
    hasFaq:    document.getElementById('gen-faq').checked,
    hasMap:    document.getElementById('gen-map').checked,
  };
  const html = generateSiteHTML(data);
  lastGenerated = { data, html };

  document.getElementById('preview-title').textContent = data.name;
  document.getElementById('preview-meta').textContent = `${data.branche} · ${styleLabel(data.style)} · ${data.images} Bilder`;
  document.getElementById('preview-frame').srcdoc = html;
  document.getElementById('preview-modal').classList.add('is-open');
  closeGenerator();
}

function closePreview() {
  document.getElementById('preview-modal').classList.remove('is-open');
  // iframe leeren, damit Audio/Animationen aufhören
  document.getElementById('preview-frame').srcdoc = '';
}

function downloadGenerated() {
  if (!lastGenerated) return;
  const slug = lastGenerated.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([lastGenerated.html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (slug || 'website') + '.html';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Heruntergeladen');
}

function openInNewTab() {
  if (!lastGenerated) return;
  const blob = new Blob([lastGenerated.html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function saveGenerated() {
  if (!lastGenerated) return;
  const d = lastGenerated.data;
  sites.unshift({
    id: uid(),
    name: d.name,
    category: d.branche,
    url: '(generierte Vorschau)',
    desc: d.sub || `Schnell-generierte Vorschau-Site (${styleLabel(d.style)}, ${d.images} Bilder).`,
    color: d.color,
    createdAt: Date.now(),
    generatedHtml: lastGenerated.html,
  });
  saveSites();
  render();
  showToast('Im Portfolio gespeichert');
}

function styleLabel(s) {
  return { modern: 'Modern Clean', edel: 'Edel Premium', warm: 'Warm Freundlich', bold: 'Bold Auffällig' }[s] || s;
}

window.openGenerator = openGenerator;
window.closeGenerator = closeGenerator;
window.runGenerator = runGenerator;
window.closePreview = closePreview;
window.downloadGenerated = downloadGenerated;
window.openInNewTab = openInNewTab;
window.saveGenerated = saveGenerated;

/* ── HTML-Generator (komplette eigenständige Website) ─────── */
function generateSiteHTML(d) {
  const accent = d.color;
  const darkAccent = shade(accent, -0.25);
  const lightAccent = shade(accent, 0.85);

  const styleConfig = {
    modern: {
      bg: '#ffffff', surface: '#f7f8fb', text: '#0f1224', muted: '#5a6577',
      headingFont: '"Inter", system-ui, sans-serif',
      bodyFont:    '"Inter", system-ui, sans-serif',
      titleSize: '46px', radius: '14px', vibe: 'modern',
    },
    edel: {
      bg: '#0e0c14', surface: '#171522', text: '#f5f0e6', muted: '#a8a4bc',
      headingFont: '"Fraunces", "Times New Roman", serif',
      bodyFont:    '"Inter", system-ui, sans-serif',
      titleSize: '54px', radius: '6px', vibe: 'dark-elegant',
    },
    warm: {
      bg: '#fbf6ec', surface: '#f3ead6', text: '#2a1d12', muted: '#5a4633',
      headingFont: '"Fraunces", serif',
      bodyFont:    '"Inter", system-ui, sans-serif',
      titleSize: '50px', radius: '18px', vibe: 'warm-cream',
    },
    bold: {
      bg: '#0a0a14', surface: '#161324', text: '#ffffff', muted: '#a0a0bc',
      headingFont: '"Inter", system-ui, sans-serif',
      bodyFont:    '"Inter", system-ui, sans-serif',
      titleSize: '64px', radius: '4px', vibe: 'bold',
    },
  };
  const s = styleConfig[d.style] || styleConfig.modern;

  const headline = d.headline || defaultHeadline(d.branche, d.style);
  const subline  = d.sub      || defaultSub(d.branche);

  const services = defaultServices(d.branche);

  const galleryHtml = d.hasGallery && d.images > 0 ? `
    <section class="section section-gallery">
      <div class="container">
        <span class="kicker">Galerie</span>
        <h2>${esc(d.name)} in Bildern</h2>
        <div class="gallery">
          ${Array.from({ length: d.images }, (_, i) => `
            <div class="g-tile" style="background: ${tileGradient(accent, i, d.images)};">
              <div class="g-tile-inner"></div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  ` : '';

  const reviewsHtml = d.hasReviews ? `
    <section class="section section-reviews">
      <div class="container">
        <span class="kicker">Bewertungen</span>
        <h2>Was Kunden sagen</h2>
        <div class="reviews">
          ${defaultReviews(d.branche).map(r => `
            <div class="review">
              <div class="stars">★★★★★</div>
              <p>"${esc(r.text)}"</p>
              <div class="r-meta"><strong>${esc(r.name)}</strong> · ${esc(r.city)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  ` : '';

  const faqHtml = d.hasFaq ? `
    <section class="section section-faq">
      <div class="container faq-container">
        <span class="kicker">FAQ</span>
        <h2>Häufige Fragen</h2>
        <div class="faq-list">
          ${defaultFaq(d.branche).map(f => `
            <details class="faq">
              <summary>${esc(f.q)}</summary>
              <p>${esc(f.a)}</p>
            </details>
          `).join('')}
        </div>
      </div>
    </section>
  ` : '';

  const mapHtml = d.hasMap ? `
    <div class="map-box">
      <div class="map-grid"></div>
      <div class="map-pin">📍</div>
      <div class="map-label">${esc(d.address || d.name)}</div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(d.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,400..700&display=swap">
<style>
  :root {
    --accent: ${accent};
    --accent-dark: ${darkAccent};
    --accent-light: ${lightAccent};
    --bg: ${s.bg};
    --surface: ${s.surface};
    --text: ${s.text};
    --muted: ${s.muted};
    --radius: ${s.radius};
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: ${s.bodyFont};
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent); text-decoration: none; }
  .container { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

  /* Nav */
  .site-nav {
    position: sticky; top: 0; z-index: 50;
    background: ${hexA(s.bg, 0.85)};
    backdrop-filter: blur(12px);
    border-bottom: 1px solid ${hexA(s.text, 0.08)};
    padding: 16px 0;
  }
  .nav-inner { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .brand {
    font-family: ${s.headingFont};
    font-weight: 700;
    font-size: 20px;
    color: var(--text);
    letter-spacing: -0.02em;
  }
  .brand-dot { color: var(--accent); }
  .nav-links { display: flex; gap: 6px; }
  .nav-links a {
    color: var(--muted);
    font-size: 14px; font-weight: 500;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.15s;
  }
  .nav-links a:hover { color: var(--text); background: ${hexA(s.text, 0.05)}; }
  .nav-cta {
    background: var(--accent); color: ${contrastOn(accent)};
    padding: 9px 18px;
    border-radius: 99px;
    font-weight: 600; font-size: 14px;
    transition: all 0.15s;
    box-shadow: 0 4px 14px ${hexA(accent, 0.3)};
  }
  .nav-cta:hover { background: var(--accent-dark); transform: translateY(-1px); }

  /* Hero */
  .hero {
    padding: 80px 0 90px;
    position: relative;
    overflow: hidden;
  }
  .hero::before {
    content: ""; position: absolute;
    inset: -100px;
    background: radial-gradient(ellipse 60% 50% at 70% 30%, ${hexA(accent, 0.18)} 0%, transparent 60%);
    pointer-events: none;
  }
  .hero-inner { position: relative; display: grid; grid-template-columns: 1.05fr 1fr; gap: 60px; align-items: center; }
  @media (max-width: 900px) { .hero-inner { grid-template-columns: 1fr; gap: 40px; } }
  .hero-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 600;
    padding: 6px 14px;
    background: ${hexA(accent, 0.1)};
    color: var(--accent);
    border: 1px solid ${hexA(accent, 0.2)};
    border-radius: 99px;
    margin-bottom: 22px;
  }
  .hero-eyebrow .dot { width: 6px; height: 6px; background: var(--accent); border-radius: 50%; }
  .hero h1 {
    font-family: ${s.headingFont};
    font-weight: 600;
    font-size: ${s.titleSize};
    line-height: 1.05;
    letter-spacing: -0.025em;
    margin: 0 0 22px;
    color: var(--text);
  }
  .hero h1 em { font-style: italic; color: var(--accent); font-weight: 500; }
  .hero p.lead {
    font-size: 18px; line-height: 1.55;
    color: var(--muted);
    margin: 0 0 30px;
    max-width: 520px;
  }
  .hero-cta-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 13px 24px;
    border-radius: 99px;
    font-weight: 600; font-size: 15px;
    border: 1.5px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
  }
  .btn-primary { background: var(--accent); color: ${contrastOn(accent)}; box-shadow: 0 8px 20px ${hexA(accent, 0.3)}; }
  .btn-primary:hover { background: var(--accent-dark); transform: translateY(-1px); box-shadow: 0 12px 28px ${hexA(accent, 0.4)}; }
  .btn-ghost { background: transparent; color: var(--text); border-color: ${hexA(s.text, 0.18)}; }
  .btn-ghost:hover { background: ${hexA(s.text, 0.06)}; }

  .hero-art {
    aspect-ratio: 4 / 3;
    border-radius: var(--radius);
    background:
      linear-gradient(135deg, ${hexA(accent, 0.9)} 0%, ${hexA(darkAccent, 0.95)} 100%),
      var(--accent);
    position: relative;
    overflow: hidden;
    box-shadow: 0 30px 60px ${hexA(accent, 0.3)};
  }
  .hero-art::after {
    content: ""; position: absolute; inset: 0;
    background:
      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 50%),
      radial-gradient(circle at 70% 80%, rgba(0,0,0,0.18) 0%, transparent 50%);
  }
  .hero-art-mark {
    position: absolute; inset: 0;
    display: grid; place-items: center;
    font-family: ${s.headingFont};
    font-size: 120px; font-weight: 700;
    color: ${hexA('#ffffff', 0.85)};
    letter-spacing: -0.04em;
    text-shadow: 0 8px 30px rgba(0,0,0,0.3);
  }

  /* Sections */
  .section { padding: 80px 0; }
  .section-services { background: var(--surface); }
  .kicker {
    display: inline-block;
    font-size: 13px; font-weight: 600;
    padding: 6px 14px;
    background: ${hexA(accent, 0.1)};
    color: var(--accent);
    border-radius: 99px;
    margin-bottom: 16px;
  }
  .section h2 {
    font-family: ${s.headingFont};
    font-weight: 600;
    font-size: 36px;
    letter-spacing: -0.025em;
    line-height: 1.1;
    margin: 0 0 14px;
  }
  .section-lead { color: var(--muted); font-size: 17px; max-width: 600px; margin: 0 0 50px; }

  .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 22px; }
  .service {
    background: var(--bg);
    border: 1px solid ${hexA(s.text, 0.08)};
    border-radius: var(--radius);
    padding: 28px;
    transition: all 0.2s;
  }
  .service:hover {
    transform: translateY(-3px);
    box-shadow: 0 18px 40px ${hexA(s.text, 0.1)};
    border-color: ${hexA(accent, 0.4)};
  }
  .service-icon {
    width: 48px; height: 48px;
    border-radius: 12px;
    background: ${hexA(accent, 0.12)};
    color: var(--accent);
    display: grid; place-items: center;
    font-size: 22px; font-weight: 700;
    margin-bottom: 18px;
  }
  .service h3 {
    font-family: ${s.headingFont};
    font-weight: 600; font-size: 19px;
    margin: 0 0 8px;
  }
  .service p { font-size: 14px; color: var(--muted); margin: 0; }

  /* Gallery */
  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
  }
  .g-tile {
    aspect-ratio: 1;
    border-radius: var(--radius);
    position: relative;
    overflow: hidden;
    transition: transform 0.25s;
  }
  .g-tile:hover { transform: scale(1.02); }
  .g-tile-inner {
    position: absolute; inset: 0;
    background:
      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), transparent 50%),
      radial-gradient(circle at 70% 80%, rgba(0,0,0,0.2), transparent 50%);
  }

  /* Reviews */
  .section-reviews { background: var(--surface); }
  .reviews { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 22px; }
  .review {
    background: var(--bg);
    border: 1px solid ${hexA(s.text, 0.08)};
    border-radius: var(--radius);
    padding: 28px;
  }
  .stars { color: ${accent}; font-size: 18px; margin-bottom: 12px; letter-spacing: 2px; }
  .review p {
    font-family: ${s.headingFont};
    font-style: italic; font-size: 16px;
    line-height: 1.55; margin: 0 0 16px;
  }
  .r-meta { font-size: 13px; color: var(--muted); padding-top: 14px; border-top: 1px dashed ${hexA(s.text, 0.15)}; }
  .r-meta strong { color: var(--text); }

  /* FAQ */
  .faq-container { max-width: 760px; }
  .faq-list { display: flex; flex-direction: column; gap: 10px; }
  .faq {
    background: var(--surface);
    border: 1px solid ${hexA(s.text, 0.08)};
    border-radius: var(--radius);
    padding: 4px 22px;
    transition: background 0.15s;
  }
  .faq[open] { background: var(--bg); border-color: ${hexA(accent, 0.3)}; }
  .faq summary {
    cursor: pointer;
    font-family: ${s.headingFont};
    font-weight: 600;
    font-size: 16px;
    padding: 18px 0;
    list-style: none;
    display: flex; justify-content: space-between; align-items: center;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::after { content: "+"; color: var(--accent); font-size: 22px; transition: transform 0.2s; }
  .faq[open] summary::after { transform: rotate(45deg); }
  .faq p { padding: 0 0 18px; color: var(--muted); font-size: 15px; margin: 0; }

  /* Contact */
  .section-contact {
    background: linear-gradient(135deg, ${hexA(accent, 0.08)} 0%, transparent 100%), var(--surface);
  }
  .contact-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 50px; align-items: start; }
  @media (max-width: 900px) { .contact-grid { grid-template-columns: 1fr; } }
  .contact-card {
    display: flex; gap: 14px;
    padding: 16px;
    background: var(--bg);
    border: 1px solid ${hexA(s.text, 0.08)};
    border-radius: var(--radius);
    margin-bottom: 12px;
  }
  .contact-icon {
    width: 42px; height: 42px;
    background: ${hexA(accent, 0.12)};
    color: var(--accent);
    border-radius: 10px;
    display: grid; place-items: center;
    font-size: 18px;
    flex-shrink: 0;
  }
  .contact-card-l { font-size: 12px; color: var(--muted); margin-bottom: 2px; }
  .contact-card-v { font-weight: 600; color: var(--text); font-size: 15px; word-break: break-word; }
  .map-box {
    aspect-ratio: 4 / 3;
    border-radius: var(--radius);
    background: ${hexA(accent, 0.12)};
    border: 1px solid ${hexA(accent, 0.25)};
    position: relative;
    overflow: hidden;
  }
  .map-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(${hexA(s.text, 0.06)} 1px, transparent 1px),
      linear-gradient(90deg, ${hexA(s.text, 0.06)} 1px, transparent 1px);
    background-size: 28px 28px;
  }
  .map-pin {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -100%);
    font-size: 40px;
    filter: drop-shadow(0 4px 10px ${hexA(accent, 0.5)});
  }
  .map-label {
    position: absolute; bottom: 16px; left: 50%;
    transform: translateX(-50%);
    background: var(--bg);
    padding: 8px 16px;
    border-radius: 99px;
    font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 12px ${hexA(s.text, 0.15)};
  }

  /* Footer */
  .footer {
    background: ${s.vibe === 'dark-elegant' || s.vibe === 'bold' ? '#000' : 'var(--surface)'};
    color: ${s.vibe === 'dark-elegant' || s.vibe === 'bold' ? 'rgba(255,255,255,0.7)' : 'var(--muted)'};
    padding: 50px 0 24px;
    font-size: 14px;
  }
  .footer-inner { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px; margin-bottom: 30px; }
  .footer-bottom { padding-top: 24px; border-top: 1px solid ${hexA(s.text, 0.1)}; opacity: 0.6; font-size: 12px; }

  /* Mobile */
  @media (max-width: 720px) {
    .hero h1 { font-size: 34px; }
    .section h2 { font-size: 28px; }
    .nav-links { display: none; }
    .section { padding: 60px 0; }
    .hero { padding: 50px 0 60px; }
  }
</style>
</head>
<body>

<header class="site-nav">
  <div class="container nav-inner">
    <span class="brand">${esc(d.name)}<span class="brand-dot">.</span></span>
    <nav class="nav-links">
      ${d.hasGallery ? '<a href="#galerie">Galerie</a>' : ''}
      ${d.hasReviews ? '<a href="#bewertungen">Bewertungen</a>' : ''}
      ${d.hasFaq ? '<a href="#faq">FAQ</a>' : ''}
      <a href="#kontakt">Kontakt</a>
    </nav>
    <a href="#kontakt" class="nav-cta">${esc(d.cta)}</a>
  </div>
</header>

<section class="hero">
  <div class="container hero-inner">
    <div>
      <div class="hero-eyebrow">
        <span class="dot"></span>
        <span>${esc(d.branche)}${d.address ? ' · ' + esc(d.address) : ''}</span>
      </div>
      <h1>${headlineWithEm(headline)}</h1>
      <p class="lead">${esc(subline)}</p>
      <div class="hero-cta-row">
        <a href="#kontakt" class="btn btn-primary">${esc(d.cta)} →</a>
        ${d.hasGallery ? '<a href="#galerie" class="btn btn-ghost">Galerie ansehen</a>' : ''}
      </div>
    </div>
    <div class="hero-art">
      <div class="hero-art-mark">${esc(initials(d.name))}</div>
    </div>
  </div>
</section>

<section class="section section-services" id="services">
  <div class="container">
    <span class="kicker">Was wir anbieten</span>
    <h2>Unsere ${esc(d.branche)}-Leistungen</h2>
    <p class="section-lead">Alles aus einer Hand. Sauber, schnell, mit echter Beratung.</p>
    <div class="services-grid">
      ${services.map(svc => `
        <div class="service">
          <div class="service-icon">${esc(svc.i)}</div>
          <h3>${esc(svc.t)}</h3>
          <p>${esc(svc.d)}</p>
        </div>
      `).join('')}
    </div>
  </div>
</section>

${galleryHtml ? galleryHtml.replace('<section class="section section-gallery">', '<section class="section section-gallery" id="galerie">') : ''}
${reviewsHtml ? reviewsHtml.replace('<section class="section section-reviews">', '<section class="section section-reviews" id="bewertungen">') : ''}
${faqHtml ? faqHtml.replace('<section class="section section-faq">', '<section class="section section-faq" id="faq">') : ''}

<section class="section section-contact" id="kontakt">
  <div class="container">
    <span class="kicker">Kontakt</span>
    <h2>So erreichen Sie uns</h2>
    <p class="section-lead">Schreiben Sie kurz, was Sie brauchen — wir antworten innerhalb 24h.</p>
    <div class="contact-grid">
      <div>
        ${d.phone ? `
          <a class="contact-card" href="tel:${esc(d.phone.replace(/\\s+/g,''))}">
            <div class="contact-icon">📞</div>
            <div>
              <div class="contact-card-l">Telefon</div>
              <div class="contact-card-v">${esc(d.phone)}</div>
            </div>
          </a>` : ''}
        ${d.email ? `
          <a class="contact-card" href="mailto:${esc(d.email)}">
            <div class="contact-icon">✉️</div>
            <div>
              <div class="contact-card-l">E-Mail</div>
              <div class="contact-card-v">${esc(d.email)}</div>
            </div>
          </a>` : ''}
        ${d.address ? `
          <div class="contact-card">
            <div class="contact-icon">📍</div>
            <div>
              <div class="contact-card-l">Adresse</div>
              <div class="contact-card-v">${esc(d.address)}</div>
            </div>
          </div>` : ''}
      </div>
      ${mapHtml}
    </div>
  </div>
</section>

<footer class="footer">
  <div class="container">
    <div class="footer-inner">
      <div>
        <strong style="font-family: ${s.headingFont}; font-size: 18px; color: ${s.vibe === 'dark-elegant' || s.vibe === 'bold' ? '#fff' : 'var(--text)'};">${esc(d.name)}<span style="color: var(--accent);">.</span></strong>
        <div style="margin-top: 4px; opacity: 0.7;">${esc(d.branche)}${d.address ? ' · ' + esc(d.address) : ''}</div>
      </div>
      <div>
        ${d.phone ? esc(d.phone) + ' · ' : ''}${d.email ? esc(d.email) : ''}
      </div>
    </div>
    <div class="container footer-bottom">
      © ${new Date().getFullYear()} ${esc(d.name)} · Website by Tim-Ulrich-Webstudio
    </div>
  </div>
</footer>

</body>
</html>`;
}

/* ── Hilfs-Funktionen für den Generator ─────────────── */

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function initials(name) {
  const w = name.trim().split(/\s+/);
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}
function shade(hex, amount) {
  // amount: -1..1
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return rgbToHex(f(r), f(g), f(b));
}
function hexA(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}
function contrastOn(hex) {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b);
  return lum > 150 ? '#1a1410' : '#ffffff';
}
function tileGradient(base, i, n) {
  const phase = (i / Math.max(1, n - 1));
  const a1 = shade(base,  0.1 + phase * 0.4);
  const a2 = shade(base, -0.2 - phase * 0.3);
  const ang = 90 + (i * 17) % 180;
  return `linear-gradient(${ang}deg, ${a1} 0%, ${a2} 100%)`;
}

function headlineWithEm(text) {
  // Letztes Wort wird kursiv hervorgehoben
  const words = text.split(' ');
  if (words.length < 2) return esc(text);
  const last = words.pop();
  return esc(words.join(' ')) + ' <em>' + esc(last) + '</em>';
}

function defaultHeadline(branche, style) {
  const map = {
    Friseur:      'Schöne Haare. Echte Beratung.',
    Handwerk:     'Sauber gemacht. Wie es sein soll.',
    Kosmetik:     'Zeit für Ihre Haut.',
    Gastro:       'Frisch. Ehrlich. Lecker.',
    Fahrschule:   'Führerschein, endlich entspannt.',
    Dienstleister:'Verlässlich. Persönlich. Vor Ort.',
  };
  return map[branche] || 'Willkommen.';
}
function defaultSub(branche) {
  const map = {
    Friseur:      'Wir nehmen uns Zeit für ein ehrliches Gespräch, bevor wir loslegen. Schnitt, Farbe, Pflege — auf den Punkt für Sie.',
    Handwerk:     'Festpreis vor Beginn. Wir kommen pünktlich, machen sauber zu Ende, und räumen auf.',
    Kosmetik:     'Eine Stunde, in der Sie nur an sich denken müssen. Mit Hautanalyse, Beratung und einem Plan für Zuhause.',
    Gastro:       'Regionale Zutaten, ehrliche Küche. Familien-Restaurant seit Jahren — und es schmeckt immer noch wie früher.',
    Fahrschule:   'Geduldig, modern, mit klarer Struktur. In Theorie und Praxis kein Stress, sondern Spaß am Lernen.',
    Dienstleister:'Wir sind nicht die billigsten — aber wir sind diejenigen, die Sie das nächste Mal wieder anrufen.',
  };
  return map[branche] || 'Wir machen das, was wir können, einfach gut.';
}
function defaultServices(branche) {
  const map = {
    Friseur: [
      { i: '✂️', t: 'Schnitt', d: 'Klassisch oder modern — passend zu Gesicht und Stil.' },
      { i: '🎨', t: 'Farbe', d: 'Strähnen, Vollton, Balayage — mit Schonbehandlung.' },
      { i: '💆', t: 'Pflege', d: 'Kopfhaut, Spitzen, Glanz. Das volle Programm.' },
      { i: '👰', t: 'Anlass', d: 'Hochzeit, Abi-Ball, Fotoshooting — Termin früh sichern.' },
    ],
    Handwerk: [
      { i: '🔨', t: 'Neubau', d: 'Vom Plan zur Ausführung. Sauber, terminierbar, festpreis.' },
      { i: '🛠️', t: 'Reparatur', d: 'Defekt? Wir kommen, schauen, sagen ehrlich was Sache ist.' },
      { i: '🏠', t: 'Renovierung', d: 'Komplett oder einzelne Räume. Mit Material-Beratung.' },
      { i: '⚡', t: 'Notdienst', d: 'In 24 Stunden vor Ort, bei Wasser oder Strom auch nachts.' },
    ],
    Kosmetik: [
      { i: '✨', t: 'Gesichtsbehandlung', d: 'Reinigung, Massage, Maske — abgestimmt auf Ihre Haut.' },
      { i: '💅', t: 'Maniküre', d: 'Pflege, Lack, Shellac. Auch French und Nail-Art.' },
      { i: '🌸', t: 'Wellness', d: 'Anti-Aging, Akne-Behandlung, Microdermabrasion.' },
      { i: '👁️', t: 'Brauen & Wimpern', d: 'Färben, Lifting, Extensions — natürlich oder voll.' },
    ],
    Gastro: [
      { i: '🍽️', t: 'À-la-carte', d: 'Wechselnde Karte mit regionalen Klassikern und Saison-Specials.' },
      { i: '🎉', t: 'Feiern', d: 'Hochzeit, Geburtstag, Firmenfeier — bis 60 Personen.' },
      { i: '☕', t: 'Mittagstisch', d: 'Mo–Fr · zwei Gerichte, je 9,90 €. Frisch gekocht.' },
      { i: '🥡', t: 'To Go', d: 'Bestellung per Telefon — in 30 Minuten abholbereit.' },
    ],
    Fahrschule: [
      { i: '🚗', t: 'Klasse B', d: 'PKW-Führerschein, klassisch oder Automatik.' },
      { i: '🏍️', t: 'Klasse A', d: 'Motorrad — A1, A2, A. Mit eigener Übungsfläche.' },
      { i: '🚛', t: 'Anhänger', d: 'BE / B96 — kurz und kompakt, perfekt für den Urlaub.' },
      { i: '📚', t: 'Theorie online', d: 'Eigene App, Lernkarten, Prüfungssimulator inklusive.' },
    ],
    Dienstleister: [
      { i: '⭐', t: 'Beratung', d: 'Erstgespräch kostenlos — wir hören erst zu, bevor wir vorschlagen.' },
      { i: '✅', t: 'Umsetzung', d: 'Nach Plan, mit klaren Meilensteinen. Immer ansprechbar.' },
      { i: '💬', t: 'Support', d: 'Auch nach Abschluss erreichbar. Persönlich, nicht über Bots.' },
      { i: '🤝', t: 'Garantie', d: 'Was wir versprechen, halten wir. Schriftlich, nicht nur mündlich.' },
    ],
  };
  return map[branche] || map.Dienstleister;
}
function defaultReviews(branche) {
  const map = {
    Friseur: [
      { text: 'Ich gehe seit zwei Jahren her und wurde noch nie enttäuscht. Endlich jemand, der zuhört, bevor er die Schere ansetzt.', name: 'Maria S.', city: 'Duisburg' },
      { text: 'Termin online buchen ist super einfach. Sauberer Salon, freundliches Team, faire Preise.', name: 'Andreas B.', city: 'Mülheim' },
      { text: 'Beste Färbung seit Jahren. Genau die Farbe, die ich wollte — beim ersten Mal.', name: 'Lia T.', city: 'Oberhausen' },
    ],
    Handwerk: [
      { text: 'Termin gehalten, sauber gearbeitet, alles weggeräumt. So muss Handwerk sein.', name: 'Markus K.', city: 'Duisburg' },
      { text: 'Festpreis war Festpreis. Keine Überraschungen. Klare Empfehlung.', name: 'Sandra M.', city: 'Moers' },
      { text: 'Notdienst in 2h vor Ort gewesen, Schaden in 30 Min behoben. Lebensretter.', name: 'Klaus B.', city: 'Rheinhausen' },
    ],
    Kosmetik: [
      { text: 'Endlich jemand, der auf meine Haut eingeht statt 0815-Behandlung. Fühl mich danach immer wie neu.', name: 'Julia R.', city: 'Duisburg' },
      { text: 'Saubere Räume, gute Musik, fairer Preis. Ich komme regelmäßig.', name: 'Daniela K.', city: 'Oberhausen' },
      { text: 'Die Brauen-Behandlung ist der Wahnsinn. Mein Mann sagt sogar was, und das heißt was.', name: 'Sophie L.', city: 'Mülheim' },
    ],
    Gastro: [
      { text: 'Lieblings-Restaurant der Familie. Schmeckt immer, Bedienung freundlich, Preise fair.', name: 'Familie Schmitz', city: 'Duisburg' },
      { text: 'Hochzeit dort gefeiert — Essen Top, Service Top, alles geklappt. Danke!', name: 'M. & T. Becker', city: 'Mülheim' },
      { text: 'Bester Mittagstisch der Stadt für unter 10 €.', name: 'Stefan M.', city: 'Duisburg' },
    ],
    Fahrschule: [
      { text: 'Habe als 28-Jähriger spät angefangen. Hier hat man mir nie das Gefühl gegeben, dass das peinlich ist. Klasse B beim ersten Mal bestanden.', name: 'Mike R.', city: 'Duisburg' },
      { text: 'Die App ist Gold wert. Hab fast nur damit gelernt und die Theorie sofort geschafft.', name: 'Lea P.', city: 'Mülheim' },
      { text: 'Mein Fahrlehrer war ruhig und geduldig. Ich war nervös, er hat das echt gut aufgefangen.', name: 'Jasmin K.', city: 'Oberhausen' },
    ],
    Dienstleister: [
      { text: 'Persönlich, schnell erreichbar, hält Wort. Genau wonach man sucht.', name: 'Andrea W.', city: 'Duisburg' },
      { text: 'Klare Empfehlung. Beratung war ehrlich, nicht aufdringlich.', name: 'Tom B.', city: 'Moers' },
      { text: 'Lange nicht so jemand fairen erlebt. Auch nach Abschluss noch da, wenn was war.', name: 'Petra K.', city: 'Mülheim' },
    ],
  };
  return map[branche] || map.Dienstleister;
}
function defaultFaq(branche) {
  return [
    { q: 'Brauche ich einen Termin?', a: 'Wir empfehlen eine Buchung — so haben Sie die Zeit, die Sie verdienen. Spontan kommen geht auch, aber dann ggf. mit Wartezeit.' },
    { q: 'Was kostet das ungefähr?', a: 'Hängt vom Umfang ab — eine grobe Einschätzung geben wir gern am Telefon oder bei einem kurzen Vor-Ort-Termin. Festpreis schriftlich vor Beginn.' },
    { q: 'Wie kann ich bezahlen?', a: 'Bar, EC-Karte, Überweisung — alles möglich. Bei größeren Aufträgen auch in Raten nach Absprache.' },
    { q: 'Kann ich kurzfristig absagen?', a: 'Klar — bis 24h vorher problemlos kostenlos. Danach wird leider eine kleine Pauschale fällig, damit wir die Zeit anders füllen können.' },
  ];
}

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
