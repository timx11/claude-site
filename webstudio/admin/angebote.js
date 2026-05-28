'use strict';

/* Angebote.app — 3 Pakete editieren, lokal speichern */

const OFFERS_KEY = 'webstudio_angebote_v1';

const DEFAULT_OFFERS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Für Solo-Handwerker & kleine Salons',
    price: '490',
    currency: '€',
    features: [
      'Eine schöne One-Pager-Seite',
      'Mobile-optimiert, schnell',
      'Kontakt-Box & Karte',
      'In 1–2 Wochen online',
    ],
    best: false,
    note: 'Perfekt für: kleine Friseursalons, Solo-Handwerker',
  },
  {
    id: 'anfrage',
    name: 'Anfrage-Website',
    tagline: 'Der Standard, mit dem die meisten starten',
    price: '890',
    currency: '€',
    features: [
      'Mehrseitig, klare Anfrage-Logik',
      'Galerie · Bewertungen · FAQ',
      'SEO-Basis & Google-Anbindung',
      'In 2–3 Wochen online',
    ],
    best: true,
    note: 'Perfekt für: Friseursalons, Handwerksbetriebe, Kosmetik',
  },
  {
    id: 'business',
    name: 'Business + KI',
    tagline: 'Mit KI-Bot der nachts Termine annimmt',
    price: '1490',
    currency: '€',
    features: [
      'Alles aus „Anfrage-Website"',
      'KI-Termin- oder Support-Bot',
      'Online-Buchung integriert',
      'Monatlicher Service möglich',
    ],
    best: false,
    note: 'Perfekt für: Salons mit Termin-Stress, Handwerk mit Anfrage-Chaos',
  },
];

let offers = [];

/* ── Storage ─── */
function loadOffers() {
  try {
    const s = localStorage.getItem(OFFERS_KEY);
    if (s) return JSON.parse(s);
  } catch (_) {}
  return DEFAULT_OFFERS.map(o => ({ ...o, features: [...o.features] }));
}
function saveOffers() {
  localStorage.setItem(OFFERS_KEY, JSON.stringify(offers));
  showToast('Gespeichert');
}

/* ── Toast (lokal) ── */
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
  const root = document.getElementById('offers');
  root.innerHTML = offers.map((o, idx) => `
    <article class="offer-card ${o.best ? 'is-best' : ''}" data-i="${idx}">
      ${o.best ? '<span class="offer-best-badge">★ EMPFOHLEN</span>' : ''}
      <button class="offer-toggle-best" onclick="toggleBest(${idx})" title="Als 'Empfohlen' markieren">
        ${o.best ? '★ markiert' : '☆ markieren'}
      </button>

      <input class="offer-name" value="${esc(o.name)}" data-i="${idx}" data-k="name" />
      <input class="offer-tagline" value="${esc(o.tagline)}" data-i="${idx}" data-k="tagline" placeholder="Untertitel…" />

      <div class="offer-price-row">
        <span class="offer-from">ab</span>
        <input class="offer-price" type="text" value="${esc(o.price)}" data-i="${idx}" data-k="price" />
        <input class="offer-currency" type="text" value="${esc(o.currency)}" data-i="${idx}" data-k="currency" maxlength="3" style="width: 32px;" />
      </div>

      <ul class="offer-features">
        ${o.features.map((f, fi) => `
          <li class="offer-feature">
            <span class="offer-feature-check">✓</span>
            <input class="offer-feature-text" value="${esc(f)}" data-i="${idx}" data-fi="${fi}" />
            <button class="offer-feature-rm" onclick="removeFeature(${idx}, ${fi})" title="Entfernen">✕</button>
          </li>
        `).join('')}
      </ul>
      <button class="offer-add-feature" onclick="addFeature(${idx})">+ Feature hinzufügen</button>

      <textarea class="offer-note" data-i="${idx}" data-k="note" placeholder="Interne Notiz…">${esc(o.note)}</textarea>
    </article>
  `).join('');

  // Bind input changes
  root.querySelectorAll('.offer-name, .offer-tagline, .offer-price, .offer-currency, .offer-note').forEach(el => {
    el.addEventListener('input', e => {
      const i = +e.target.dataset.i;
      const k = e.target.dataset.k;
      offers[i][k] = e.target.value;
      saveOffers();
    });
  });
  root.querySelectorAll('.offer-feature-text').forEach(el => {
    el.addEventListener('input', e => {
      const i = +e.target.dataset.i;
      const fi = +e.target.dataset.fi;
      offers[i].features[fi] = e.target.value;
      saveOffers();
    });
  });
}

/* ── Aktionen ── */
function toggleBest(idx) {
  offers.forEach((o, i) => { o.best = (i === idx) ? !o.best : false; });
  saveOffers();
  render();
}
function addFeature(idx) {
  offers[idx].features.push('Neues Feature');
  saveOffers();
  render();
  // Fokus auf das neue Feld
  setTimeout(() => {
    const inputs = document.querySelectorAll(`.offer-feature-text[data-i="${idx}"]`);
    if (inputs.length) {
      const last = inputs[inputs.length - 1];
      last.focus();
      last.select();
    }
  }, 20);
}
function removeFeature(idx, fi) {
  if (offers[idx].features.length <= 1) return;
  offers[idx].features.splice(fi, 1);
  saveOffers();
  render();
}
function resetDefaults() {
  if (!confirm('Auf Standard-Pakete zurücksetzen? Alle Änderungen gehen verloren.')) return;
  offers = DEFAULT_OFFERS.map(o => ({ ...o, features: [...o.features] }));
  saveOffers();
  render();
}

window.toggleBest = toggleBest;
window.addFeature = addFeature;
window.removeFeature = removeFeature;
window.resetDefaults = resetDefaults;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  mountTopNav('angebote');
  offers = loadOffers();
  render();
});
