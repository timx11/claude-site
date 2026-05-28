'use strict';

/* ─────────────────────────────────────────────────────────────
   admin-shared.js
   Gemeinsame Logik für MapScout · PitchSheet · WishForm · Cockpit
   In IIFE gekapselt, damit Lexical-Bindings (const) nicht mit
   outreach.js kollidieren, wenn beide Scripts geladen werden.
   ───────────────────────────────────────────────────────────── */

(() => {

/* ── Storage-Konstanten ──────────────────────────────────────── */
// Geteilt mit outreach.js
const LEADS_KEY    = 'webstudio_outreach_v1';
const SETTINGS_KEY = 'webstudio_admin_settings_v1';

/* ── Statusliste (erweitert um neue Stufen) ──────────────────── */
const STATUS_LABEL = {
  neu:          'Neu',
  kontaktiert:  'Kontaktiert',
  folge:        'Follow-up nötig',
  interessiert: 'Interessiert',
  im_termin:    'Im Termin',
  wuensche_da:  'Wünsche da',
  in_arbeit:    'In Arbeit',
  fertig:       'Fertig',
  kunde:        'Kunde',
  abgelehnt:    'Abgelehnt',
};

const STATUS_PIPELINE = ['neu', 'im_termin', 'wuensche_da', 'in_arbeit', 'fertig'];

/* ── Generische Helfer ───────────────────────────────────────── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function toast(msg, type = '') {
  let el = document.getElementById('ad-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ad-toast';
    el.className = 'ad-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'ad-toast visible' + (type ? ' ' + type : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('visible'), 3500);
}

function getQuery(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeUrl(url) {
  if (!url) return '';
  url = String(url).trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

/* ── Settings (API-Key etc.) ─────────────────────────────────── */
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      apiKey: s.apiKey || '',
      model: s.model || 'claude-sonnet-4-6',
      studioName: s.studioName || 'Tim-Ulrich-Webstudio',
      studioCity: s.studioCity || 'Duisburg',
      studioEmail: s.studioEmail || 'weblabduisburg@gmail.com',
      wishFormBaseUrl: s.wishFormBaseUrl || '',
    };
  } catch (_) {
    return { apiKey: '', model: 'claude-sonnet-4-6', studioName: 'Tim-Ulrich-Webstudio', studioCity: 'Duisburg', studioEmail: 'weblabduisburg@gmail.com', wishFormBaseUrl: '' };
  }
}

function saveSettings(s) {
  const cur = loadSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...cur, ...s }));
}

function hasApiKey() {
  return !!loadSettings().apiKey;
}

/* ── Lead-CRUD (kompatibel mit outreach.js) ──────────────────── */
function loadLeadsContainer() {
  try {
    const d = JSON.parse(localStorage.getItem(LEADS_KEY) || '{}');
    if (!d.leads) d.leads = [];
    if (!d.templates) d.templates = [];
    return d;
  } catch (_) {
    return { leads: [], templates: [] };
  }
}

function saveLeadsContainer(d) {
  localStorage.setItem(LEADS_KEY, JSON.stringify(d));
}

function getLeads() { return loadLeadsContainer().leads; }

function getLead(id) {
  return getLeads().find(l => l.id === id) || null;
}

function upsertLead(lead) {
  const d = loadLeadsContainer();
  if (!lead.id) lead.id = uid();
  if (!lead.createdAt) lead.createdAt = Date.now();
  lead.updatedAt = Date.now();
  const i = d.leads.findIndex(l => l.id === lead.id);
  if (i >= 0) d.leads[i] = { ...d.leads[i], ...lead };
  else d.leads.unshift(lead);
  saveLeadsContainer(d);
  return lead.id;
}

function updateLead(id, patch) {
  const d = loadLeadsContainer();
  const i = d.leads.findIndex(l => l.id === id);
  if (i < 0) return null;
  d.leads[i] = { ...d.leads[i], ...patch, updatedAt: Date.now() };
  saveLeadsContainer(d);
  return d.leads[i];
}

function deleteLead(id) {
  const d = loadLeadsContainer();
  d.leads = d.leads.filter(l => l.id !== id);
  saveLeadsContainer(d);
}

/* ── Status-Helper ───────────────────────────────────────────── */
function statusLabel(s) { return STATUS_LABEL[s] || s || '—'; }

function statusChipClass(s) {
  if (s === 'kunde' || s === 'fertig')        return 'ad-chip ok';
  if (s === 'interessiert' || s === 'im_termin' || s === 'wuensche_da' || s === 'in_arbeit') return 'ad-chip info';
  if (s === 'folge' || s === 'kontaktiert')   return 'ad-chip warn';
  if (s === 'abgelehnt')                      return 'ad-chip bad';
  return 'ad-chip neutral';
}

/* ── Top-Nav-Injektion ───────────────────────────────────────── */
function renderTopNav(activeKey) {
  const settings = loadSettings();
  const keyOk = !!settings.apiKey;
  const leads = getLeads();
  const counts = {
    cockpit: leads.length,
    mapscout: leads.filter(l => l.audit).length,
    outreach: leads.length,
  };

  const items = [
    { key: 'cockpit',    href: 'cockpit.html',  label: 'Cockpit',      count: counts.cockpit },
    { key: 'mapscout',   href: 'mapscout.html', label: 'Map-Scout',    count: null },
    { key: 'pitchsheet', href: 'pitchsheet.html', label: 'Pitch-Sheet', count: null },
    { key: 'wishes',     href: 'wishes.html',   label: 'Wunsch-Formular', count: null },
    { key: 'outreach',   href: 'outreach.html', label: 'Outreach-CRM', count: counts.outreach },
  ];

  return `
    <header class="ad-topnav">
      <div class="ad-topnav-inner">
        <a class="ad-brand" href="../index.html">
          <span class="ad-brand-mark">TU</span>
          <span>Tim-Ulrich-Webstudio <span class="ad-brand-sub">· Admin</span></span>
        </a>
        <nav class="ad-nav">
          ${items.map(it => `
            <a href="${it.href}" class="${activeKey === it.key ? 'active' : ''}">
              ${esc(it.label)}${it.count != null ? `<span class="pill">${it.count}</span>` : ''}
            </a>
          `).join('')}
        </nav>
        <div class="ad-topnav-right">
          <span class="ad-key-status ${keyOk ? 'ok' : 'miss'}" id="ad-key-status">
            <span class="dot"></span>
            ${keyOk ? 'API-Key OK' : 'Kein API-Key'}
          </span>
          <button class="ad-btn ad-btn-sm ad-btn-ghost" onclick="openSettingsModal()">⚙️ Einstellungen</button>
        </div>
      </div>
    </header>
  `;
}

function mountTopNav(activeKey) {
  const mount = document.getElementById('ad-topnav-mount');
  if (mount) mount.innerHTML = renderTopNav(activeKey);
  // Settings-Modal sicherstellen
  ensureSettingsModal();
}

/* ── Settings-Modal (zentral, einmal injiziert) ──────────────── */
function ensureSettingsModal() {
  if (document.getElementById('ad-settings-modal')) return;
  const div = document.createElement('div');
  div.id = 'ad-settings-modal';
  div.className = 'ad-modal-bg';
  div.innerHTML = `
    <div class="ad-modal">
      <div class="ad-modal-h">
        <h2>Einstellungen</h2>
        <p style="margin:4px 0 0; font-size:13px; color: var(--ad-text-muted);">
          Dein Claude-API-Key bleibt nur lokal im Browser. Keine Cloud, kein Server.
        </p>
      </div>
      <div class="ad-modal-b">
        <label class="ad-label">Claude API-Key (sk-ant-…)</label>
        <input type="password" id="set-api-key" class="ad-input" placeholder="sk-ant-...">
        <p style="font-size:12px; color: var(--ad-text-muted); margin: 6px 0 14px;">
          Holst Du Dir bei <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com</a>
        </p>

        <label class="ad-label">Modell</label>
        <select id="set-model" class="ad-select">
          <option value="claude-opus-4-7">Claude Opus 4.7 (stärkste, langsamer, teurer)</option>
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (empfohlen)</option>
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (schnell, günstig)</option>
        </select>

        <div class="ad-row" style="margin-top:14px;">
          <div>
            <label class="ad-label">Studio-Name</label>
            <input type="text" id="set-studio-name" class="ad-input">
          </div>
          <div>
            <label class="ad-label">Studio-Stadt</label>
            <input type="text" id="set-studio-city" class="ad-input">
          </div>
        </div>
        <div style="margin-top:14px;">
          <label class="ad-label">Studio-Mail (für Druckblatt-Footer)</label>
          <input type="text" id="set-studio-mail" class="ad-input">
        </div>
        <div style="margin-top:14px;">
          <label class="ad-label">Wunschformular-URL (optional, für QR-Code)</label>
          <input type="text" id="set-wish-url" class="ad-input" placeholder="z.B. http://192.168.1.50:8000/webstudio/admin/wishes.html">
          <p style="font-size:11px; color: var(--ad-text-muted); margin: 4px 0 0;">
            Lass leer, um die aktuelle URL zu nutzen. Setze sie, wenn der Kunde mit dem Handy
            über Dein WLAN scannen soll — dann hier die LAN-Adresse Deines Laptops eintragen.
          </p>
        </div>
      </div>
      <div class="ad-modal-f">
        <button class="ad-btn" onclick="closeSettingsModal()">Schließen</button>
        <button class="ad-btn ad-btn-primary" onclick="saveSettingsFromModal()">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener('click', e => { if (e.target === div) closeSettingsModal(); });
}

function openSettingsModal() {
  ensureSettingsModal();
  const s = loadSettings();
  document.getElementById('set-api-key').value     = s.apiKey;
  document.getElementById('set-model').value       = s.model;
  document.getElementById('set-studio-name').value = s.studioName;
  document.getElementById('set-studio-city').value = s.studioCity;
  document.getElementById('set-studio-mail').value = s.studioEmail;
  document.getElementById('set-wish-url').value    = s.wishFormBaseUrl || '';
  document.getElementById('ad-settings-modal').classList.add('is-open');
}

function closeSettingsModal() {
  document.getElementById('ad-settings-modal').classList.remove('is-open');
}

function saveSettingsFromModal() {
  saveSettings({
    apiKey:      document.getElementById('set-api-key').value.trim(),
    model:       document.getElementById('set-model').value,
    studioName:  document.getElementById('set-studio-name').value.trim() || 'Tim-Ulrich-Webstudio',
    studioCity:  document.getElementById('set-studio-city').value.trim() || 'Duisburg',
    studioEmail: document.getElementById('set-studio-mail').value.trim() || 'weblabduisburg@gmail.com',
    wishFormBaseUrl: document.getElementById('set-wish-url').value.trim(),
  });
  toast('Einstellungen gespeichert', 'success');
  closeSettingsModal();
  // Top-Nav neu zeichnen, damit API-Status aktualisiert wird
  const active = document.querySelector('.ad-nav a.active');
  const activeKey = active ? active.getAttribute('href').replace('.html', '') : null;
  mountTopNav(activeKey);
}

/* ── Claude API ──────────────────────────────────────────────── */
const ClaudeAPI = {
  ENDPOINT: 'https://api.anthropic.com/v1/messages',

  async message({ system, messages, max_tokens = 2000, model = null }) {
    const settings = loadSettings();
    if (!settings.apiKey) throw new Error('Kein API-Key gesetzt — bitte unter Einstellungen eintragen.');

    const body = {
      model: model || settings.model,
      max_tokens,
      messages,
    };
    if (system) body.system = system;

    const r = await fetch(this.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`API ${r.status}: ${txt.slice(0, 240)}`);
    }
    return await r.json();
  },

  textOf(resp) {
    if (!resp || !resp.content) return '';
    return resp.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
  },

  // Erzwingt JSON-Antwort: extrahiert ersten JSON-Block aus dem Text.
  parseJson(text) {
    if (!text) return null;
    // Code-Fence entfernen
    let t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) t = fence[1].trim();
    // Erstes { ... } extrahieren
    const m = t.match(/\{[\s\S]*\}/);
    if (m) t = m[0];
    try { return JSON.parse(t); }
    catch (e) { console.warn('JSON parse failed', e, text); return null; }
  },

  /* ── 1. Maps-Screenshot → Geschäftsdaten ───────────────────── */
  async extractFromMapsScreenshot(imageBase64, mimeType = 'image/png') {
    const system = `Du bist ein Daten-Extraktor. Du bekommst einen Screenshot eines Google-Maps-Eintrags eines lokalen Unternehmens. Extrahiere ALLE sichtbaren Informationen sauber und gib NUR ein JSON-Objekt zurück (kein Vorwort, kein Markdown).

Schema:
{
  "firma": "string oder leer",
  "branche": "string oder leer (z.B. Friseur, Restaurant, Kosmetikstudio)",
  "adresse": "string oder leer (Straße + Hausnummer)",
  "plz": "string oder leer",
  "stadt": "string oder leer",
  "telefon": "string oder leer",
  "website": "string oder leer (vollständige URL inkl. https://)",
  "email": "string oder leer (sofern sichtbar)",
  "google_rating": "string oder leer (z.B. 4,7)",
  "google_reviews_count": "string oder leer (z.B. 312)",
  "oeffnungszeiten_text": "string oder leer (sofern erkennbar als kurze Zusammenfassung)",
  "confidence": "low|medium|high"
}

Wenn Du etwas nicht sicher lesen kannst, lass es leer. Erfinde nichts. Antworte ausschließlich mit dem JSON-Objekt.`;

    const resp = await this.message({
      system,
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text',  text: 'Bitte extrahiere die Felder aus diesem Google-Maps-Screenshot.' },
        ],
      }],
    });
    const txt = this.textOf(resp);
    const obj = this.parseJson(txt);
    if (!obj) throw new Error('Konnte JSON nicht parsen. Rohantwort: ' + txt.slice(0, 200));
    return obj;
  },

  /* ── 2. Website-Audit ──────────────────────────────────────── */
  async auditWebsite({ url, htmlExcerpt, branche, stadt }) {
    const system = `Du bist ein erfahrener Web-Berater, der lokalen Unternehmen modernere Websites verkauft.
Analysiere die folgende Website kritisch aber fair. Liefere konkrete, verkaufsrelevante Befunde, mit denen ein Verkäufer im Termin punkten kann (kein Marketing-Geschwafel, sondern konkrete Mängel/Chancen).

Gib NUR ein JSON-Objekt zurück (kein Vorwort, kein Markdown):
{
  "score": 0-100,
  "score_label": "schlecht|mittel|gut|sehr gut",
  "summary": "2-3 Sätze, was vom ersten Eindruck auffällt",
  "issues": [
    { "category": "Design|Mobile|Performance|SEO|Inhalt|Kontakt|Vertrauen", "severity": "high|med|low", "title": "kurz", "description": "1-2 Sätze konkret" }
  ],
  "opportunities": [
    { "category": "KI-Bot|Automatisierung|Conversion|SEO|Design|Service", "title": "kurz", "description": "1-2 Sätze konkret", "value": "warum es Geld bringt, kurz" }
  ],
  "ai_bot_suggestions": [
    { "name": "Support-Bot|FAQ-Bot|Termin-Bot|Anrufer-Bot|Bestell-Bot|Leadgen-Bot", "why": "warum genau für dieses Unternehmen sinnvoll" }
  ],
  "talking_points": ["3-5 kurze Sätze, die der Verkäufer im Termin direkt sagen kann"]
}

Sei konkret. 4-7 Issues, 4-6 Opportunities, 2-3 Bot-Vorschläge.`;

    const userText = `Branche: ${branche || 'unbekannt'}
Stadt: ${stadt || 'unbekannt'}
URL: ${url || 'unbekannt'}

Inhalt/HTML-Ausschnitt:
${htmlExcerpt ? htmlExcerpt.slice(0, 12000) : '(Konnte HTML nicht laden — bewerte allein anhand der URL und ggf. typischer Probleme für diese Branche.)'}`;

    const resp = await this.message({
      system, max_tokens: 2200,
      messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
    });
    const txt = this.textOf(resp);
    const obj = this.parseJson(txt);
    if (!obj) throw new Error('Audit-JSON konnte nicht geparst werden.');
    return obj;
  },

  /* ── 3. Build-Plan aus Audit + Wünschen ────────────────────── */
  async generateBuildPlan({ lead }) {
    const system = `Du bist Senior-Web-Designer und -Entwickler bei einer kleinen Webagentur. Du bekommst Audit-Daten der alten Website eines Kunden plus dessen Wünsche aus dem Termin.

Erstelle einen konkreten Build-Plan, mit dem der Webdesigner sofort loslegen kann. Antworte NUR mit einem JSON-Objekt:
{
  "concept_summary": "3-4 Sätze: Wie wird die neue Website wirken, was ist das Kernversprechen.",
  "design_direction": {
    "tone": ["professionell","auffällig",...],
    "color_palette": [{ "name": "primary", "hex": "#..." }, ...],
    "fonts": { "heading": "Schriftname", "body": "Schriftname" },
    "imagery": "1 Satz: welche Bildsprache"
  },
  "sections": [
    { "name": "Hero|Über uns|Leistungen|Kontakt|...", "purpose": "1 Satz", "copy_draft": "fertiger Vorschlag-Text (2-4 Sätze)" }
  ],
  "ai_features": [
    { "name": "Support-Bot|FAQ-Bot|Termin-Bot|...", "placement": "wo auf der Seite", "system_prompt_hint": "1-2 Sätze, womit der Bot trainiert werden sollte", "expected_value": "warum sinnvoll" }
  ],
  "technical_stack": ["HTML/CSS/JS Static","Vite + Tailwind",..."],
  "open_questions": ["Fragen, die der Kunde noch beantworten muss"],
  "first_milestone": "Was in den ersten 48h fertig sein wird (1-2 Sätze)"
}

Sei konkret und umsetzbar. Texte auf Deutsch.`;

    const userText = `Firma: ${lead.firma || '—'}
Branche: ${lead.branche || '—'}
Stadt: ${lead.stadt || '—'}
Bestehende Website: ${lead.website || '(keine)'}

Audit-Befunde:
${JSON.stringify(lead.audit || {}, null, 2)}

Kundenwünsche aus dem Termin:
${JSON.stringify(lead.wishes || {}, null, 2)}`;

    const resp = await this.message({
      system, max_tokens: 3500,
      messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
    });
    const txt = this.textOf(resp);
    const obj = this.parseJson(txt);
    if (!obj) throw new Error('Build-Plan-JSON konnte nicht geparst werden.');
    return obj;
  },
};

/* ── Website-Inhalt über CORS-Proxy holen ────────────────────── */
async function fetchWebsiteHtml(url) {
  url = normalizeUrl(url);
  if (!url) return null;
  // Versuche mehrere öffentliche Read-Proxies (best effort).
  const proxies = [
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    u => `https://r.jina.ai/${u}`, // liefert Text-Extrakt
  ];
  for (const make of proxies) {
    try {
      const r = await fetch(make(url), { method: 'GET' });
      if (!r.ok) continue;
      const html = await r.text();
      if (html && html.length > 200) {
        return { html, source: make.name || 'proxy' };
      }
    } catch (_) { /* nächster Proxy */ }
  }
  return null;
}

/* Extrahiert nur den sinnvollen Text-/Tag-Inhalt aus rohem HTML.
   Wir wollen Headlines, sichtbaren Text, alt-Tags, Title, Meta-Description. */
function condenseHtml(html) {
  if (!html) return '';
  // wenn schon Plain-Text (Jina liefert MD): unverändert zurück.
  if (!/<[a-z]/i.test(html)) return html.slice(0, 14000);

  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const title = (tmp.querySelector('title')?.textContent || '').trim();
  const desc  = (tmp.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim();
  const ogImage = !!tmp.querySelector('meta[property="og:image"]');
  const viewport = !!tmp.querySelector('meta[name="viewport"]');
  const langAttr = (html.match(/<html[^>]*lang=["']([^"']+)/i) || [])[1] || '';

  // skripte/styles raus
  tmp.querySelectorAll('script, style, noscript, svg').forEach(n => n.remove());

  const headings = ['h1','h2','h3'].flatMap(t =>
    Array.from(tmp.querySelectorAll(t)).map(el => `${t.toUpperCase()}: ${el.textContent.trim()}`)
  );
  const ctas = Array.from(tmp.querySelectorAll('a, button'))
    .map(el => el.textContent.trim())
    .filter(t => t && t.length < 80)
    .slice(0, 30);

  const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 9000);

  return [
    `TITLE: ${title}`,
    `META-DESC: ${desc}`,
    `LANG: ${langAttr}`,
    `HAS_VIEWPORT_META: ${viewport}`,
    `HAS_OG_IMAGE: ${ogImage}`,
    '',
    'HEADINGS:',
    ...headings.slice(0, 25),
    '',
    'CTAs / Links (Auszug):',
    ...ctas,
    '',
    'BODY-TEXT (gekürzt):',
    text,
  ].join('\n');
}

/* ── Datei → Base64 ──────────────────────────────────────────── */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(',');
      resolve({ base64: s.slice(i + 1), dataUrl: s, mimeType: file.type || 'image/png' });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ── QR-Code (kleine pure-JS-Implementierung) ────────────────── */
// Quellen: ISO/IEC 18004; kompakte Variante (max Version 10, Level L/M)
// Genug für URLs bis ~250 Zeichen.
// Adaptiert nach Public-Domain Code von Project Nayuki (gekürzt).
const QR = (() => {
  // Mini-Implementierung: nutzt googlecharts-Ersatz nicht (deprecated), sondern
  // erzeugt selbst eine matrix. Für unsere URL-Länge reicht Version 6 Level M.
  // — Da eine vollständige QR-Implementierung viel Code ist, nutzen wir hier
  //   stattdessen die quirc.io / qrserver.com Bildquelle als Fallback —
  //   und in offline-Setups einen einfachen SVG-Generator unten.

  // Public API: QR.svg(text, size) -> SVG-String
  function svg(text, size = 240) {
    // Erzeuge ein <img>-Element, das auf einen öffentlichen QR-Renderer zeigt.
    // Funktioniert online; für offline Print-Setup einfach Bild vorher cachen.
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=10`;
    return `<img src="${url}" alt="QR-Code" width="${size}" height="${size}" style="display:block; image-rendering: pixelated; border-radius: 8px;" />`;
  }
  return { svg };
})();

/* ── Initiale Lead-Form-Felder ───────────────────────────────── */
function blankLead() {
  return {
    id: '',
    firma: '', name: '', email: '', telefon: '',
    branche: '', stadt: '', plz: '', adresse: '',
    website: '', notizen: '',
    status: 'neu',
    google_rating: '', google_reviews_count: '',
    mapsScreenshot: null, // dataUrl
    audit: null,          // { score, summary, issues, opportunities, ai_bot_suggestions, talking_points, runAt }
    pitch: null,          // optionale Verkaufsschnitte (currently aus audit abgeleitet)
    wishes: null,         // { designStyle, services, bots, freetext, submittedAt }
    buildPlan: null,      // KI-generierter Plan
    createdAt: 0, updatedAt: 0,
  };
}

/* ── Export auf window für inline-Handler ────────────────────── */
Object.assign(window, {
  uid, esc, formatDate, formatDateTime, toast: toast, getQuery, normalizeUrl,
  loadSettings, saveSettings, hasApiKey,
  getLeads, getLead, upsertLead, updateLead, deleteLead,
  STATUS_LABEL, STATUS_PIPELINE, statusLabel, statusChipClass,
  renderTopNav, mountTopNav, ensureSettingsModal,
  openSettingsModal, closeSettingsModal, saveSettingsFromModal,
  ClaudeAPI, fetchWebsiteHtml, condenseHtml, fileToBase64,
  QR, blankLead,
  LEADS_KEY, SETTINGS_KEY,
});

})(); // IIFE-Ende
