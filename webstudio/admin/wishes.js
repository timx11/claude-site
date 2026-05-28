'use strict';

/* Wunschformular — wird auf Deinem Laptop ausgefüllt (vom Kunden direkt
   oder von Dir per Eingabe).  Speichert die Wünsche am Lead. */

const STYLE_OPTIONS = [
  { k: 'professionell', l: 'Professionell' },
  { k: 'modern',        l: 'Modern' },
  { k: 'klassisch',     l: 'Klassisch' },
  { k: 'auffaellig',    l: 'Auffällig' },
  { k: 'dezent',        l: 'Dezent' },
  { k: 'kuenstlerisch', l: 'Künstlerisch' },
  { k: 'minimalistisch',l: 'Minimalistisch' },
  { k: 'warm',          l: 'Warm · Freundlich' },
  { k: 'edel',          l: 'Edel · Premium' },
  { k: 'sportlich',     l: 'Sportlich · Dynamisch' },
  { k: 'vertrauensvoll',l: 'Vertrauensvoll' },
  { k: 'innovativ',     l: 'Innovativ · Tech' },
];

const SERVICE_OPTIONS = [
  { k: 'kontaktformular', i: '✉️', l: 'Kontakt-Formular',    d: 'Anfragen direkt per Mail' },
  { k: 'termin',          i: '📅', l: 'Online-Termine',       d: 'Buchung mit Kalender' },
  { k: 'shop',            i: '🛒', l: 'Online-Shop',          d: 'Produkte verkaufen' },
  { k: 'galerie',         i: '🖼️', l: 'Foto-Galerie',         d: 'Arbeiten / Räume zeigen' },
  { k: 'speisekarte',     i: '📋', l: 'Speise-/Preisliste',   d: 'Aktuell pflegbar' },
  { k: 'bewertungen',     i: '⭐', l: 'Bewertungen',          d: 'Google-Reviews einbinden' },
  { k: 'mehrsprachig',    i: '🌍', l: 'Mehrsprachig',         d: 'Z.B. DE + EN + TR' },
  { k: 'blog',            i: '✍️', l: 'Blog / News',          d: 'Eigene Artikel posten' },
  { k: 'team',            i: '👥', l: 'Team-Seite',           d: 'Mitarbeiter vorstellen' },
  { k: 'karte',           i: '📍', l: 'Karte / Anfahrt',      d: 'Standort sichtbar' },
  { k: 'newsletter',      i: '📨', l: 'Newsletter',           d: 'Kunden binden' },
  { k: 'mitglieder',      i: '🔐', l: 'Mitglieder-Bereich',   d: 'Login für Stammkunden' },
];

const BOT_OPTIONS = [
  { k: 'support_bot', i: '💬', l: 'Support-Bot',  d: 'Beantwortet 24/7 Fragen wie ein/e Mitarbeiter/in' },
  { k: 'faq_bot',     i: '❓', l: 'FAQ-Bot',      d: 'Erklärt Preise, Öffnungszeiten, Leistungen' },
  { k: 'termin_bot',  i: '📅', l: 'Termin-Bot',   d: 'Bucht direkt im Kalender — kein Anruf nötig' },
  { k: 'anruf_bot',   i: '📞', l: 'Anruf-Bot',    d: 'Nimmt verpasste Anrufe entgegen, mailt Notiz' },
  { k: 'bestell_bot', i: '🛍️', l: 'Bestell-Bot',  d: 'Hilft beim Auswählen und Bestellen' },
  { k: 'lead_bot',    i: '🎯', l: 'Lead-Bot',     d: 'Fragt Bedarf ab, qualifiziert vor' },
];

let leadId = null;
let state = {
  designStyle: [],
  services: [],
  bots: [],
  freetext: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
};

function init() {
  leadId = getQuery('lead');
  const isCustomerMode = getQuery('customer') === '1';
  if (isCustomerMode) document.body.classList.add('wf-customer-mode');

  mountTopNav('wishes');

  const settings = loadSettings();
  document.getElementById('brand-name').textContent = settings.studioName;

  // Lead-spezifisches Anschreiben oben
  if (leadId) {
    const lead = getLead(leadId);
    if (lead) {
      document.getElementById('wf-title').textContent = `Hi ${lead.firma ? lead.firma : ''}! Wie soll Ihre neue Website werden?`;
      document.getElementById('wf-sub').textContent =
        'Wir bauen genau das, was Sie hier markieren. Bitte 2 Minuten — wir freuen uns.';
      // Existierende Wünsche vorbelegen
      if (lead.wishes) state = { ...state, ...lead.wishes };
      // Kontakt vorbelegen
      state.contact_name = state.contact_name || lead.name || '';
      state.contact_phone = state.contact_phone || lead.telefon || '';
      state.contact_email = state.contact_email || lead.email || '';
    }
  }

  renderStyle();
  renderServices();
  renderBots();
  hydrateContact();

  document.getElementById('freetext').addEventListener('input', e => state.freetext = e.target.value);
  document.getElementById('freetext').value = state.freetext;
  document.getElementById('contact-name').addEventListener('input', e => state.contact_name = e.target.value);
  document.getElementById('contact-phone').addEventListener('input', e => state.contact_phone = e.target.value);
  document.getElementById('contact-email').addEventListener('input', e => state.contact_email = e.target.value);

  document.getElementById('btn-submit').addEventListener('click', submit);
}

function hydrateContact() {
  document.getElementById('contact-name').value  = state.contact_name;
  document.getElementById('contact-phone').value = state.contact_phone;
  document.getElementById('contact-email').value = state.contact_email;
}

function renderStyle() {
  document.getElementById('style-chips').innerHTML = STYLE_OPTIONS.map(s => `
    <button type="button"
      class="wf-chip ${state.designStyle.includes(s.k) ? 'on' : ''}"
      data-k="${s.k}"
      onclick="toggleStyle('${s.k}', this)">${esc(s.l)}</button>
  `).join('');
}
function toggleStyle(k, el) {
  const i = state.designStyle.indexOf(k);
  if (i >= 0) state.designStyle.splice(i, 1);
  else        state.designStyle.push(k);
  el.classList.toggle('on');
}

function renderServices() {
  document.getElementById('service-grid').innerHTML = SERVICE_OPTIONS.map(s => `
    <button type="button"
      class="wf-tile ${state.services.includes(s.k) ? 'on' : ''}"
      onclick="toggleService('${s.k}', this)">
      <span class="ic">${s.i}</span>
      <span class="ti">${esc(s.l)}</span>
      <span class="desc">${esc(s.d)}</span>
    </button>
  `).join('');
}
function toggleService(k, el) {
  const i = state.services.indexOf(k);
  if (i >= 0) state.services.splice(i, 1);
  else        state.services.push(k);
  el.classList.toggle('on');
}

function renderBots() {
  document.getElementById('bot-grid').innerHTML = BOT_OPTIONS.map(b => `
    <button type="button"
      class="wf-tile ${state.bots.includes(b.k) ? 'on' : ''}"
      onclick="toggleBot('${b.k}', this)">
      <span class="ic">${b.i}</span>
      <span class="ti">${esc(b.l)}</span>
      <span class="desc">${esc(b.d)}</span>
    </button>
  `).join('');
}
function toggleBot(k, el) {
  const i = state.bots.indexOf(k);
  if (i >= 0) state.bots.splice(i, 1);
  else        state.bots.push(k);
  el.classList.toggle('on');
}

function submit() {
  if (state.designStyle.length === 0 && state.services.length === 0 && state.bots.length === 0 && !state.freetext) {
    toast('Bitte mindestens einen Wunsch markieren', 'error');
    return;
  }

  const wishes = {
    designStyle: state.designStyle.map(k => labelFor(STYLE_OPTIONS, k)),
    designStyleKeys: state.designStyle,
    services: state.services.map(k => labelFor(SERVICE_OPTIONS, k)),
    serviceKeys: state.services,
    bots: state.bots.map(k => labelFor(BOT_OPTIONS, k)),
    botKeys: state.bots,
    freetext: state.freetext,
    contact: {
      name: state.contact_name,
      phone: state.contact_phone,
      email: state.contact_email,
    },
    submittedAt: Date.now(),
  };

  if (leadId) {
    // Lead updaten + Kontaktdaten ggf. ergänzen
    const lead = getLead(leadId);
    const patch = { wishes, status: 'wuensche_da' };
    if (lead && !lead.name && wishes.contact.name) patch.name = wishes.contact.name;
    if (lead && !lead.telefon && wishes.contact.phone) patch.telefon = wishes.contact.phone;
    if (lead && !lead.email && wishes.contact.email) patch.email = wishes.contact.email;
    updateLead(leadId, patch);
  } else {
    // Kein Lead vorhanden — lege neuen an
    const lead = blankLead();
    lead.firma = state.contact_name || 'Wunsch ohne Lead';
    lead.name  = state.contact_name;
    lead.email = state.contact_email;
    lead.telefon = state.contact_phone;
    lead.wishes = wishes;
    lead.status = 'wuensche_da';
    leadId = upsertLead(lead);
  }

  showSuccess();
}

function labelFor(list, k) {
  const o = list.find(x => x.k === k);
  return o ? o.l : k;
}

function showSuccess() {
  document.querySelectorAll('.wf-card, .wf-cta-bar, .wf-header').forEach(n => n.style.display = 'none');
  const s = document.getElementById('success');
  s.style.display = '';
  const isCustomerMode = getQuery('customer') === '1';
  if (!isCustomerMode) {
    document.getElementById('success-text').textContent = `Wünsche am Lead gespeichert. Du kannst jetzt im Cockpit den Build-Plan generieren.`;
    const cta = document.getElementById('success-cta');
    cta.style.display = '';
    cta.href = 'cockpit.html';
    cta.textContent = 'Zum Cockpit →';
  } else {
    document.getElementById('success-text').textContent =
      'Ihre Wünsche sind angekommen. WebStudio meldet sich in den nächsten Tagen mit einem konkreten Entwurf.';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.toggleStyle = toggleStyle;
window.toggleService = toggleService;
window.toggleBot = toggleBot;

document.addEventListener('DOMContentLoaded', init);
