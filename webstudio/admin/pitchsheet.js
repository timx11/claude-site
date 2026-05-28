'use strict';

/* Pitch-Sheet: druckbares A4-Blatt aus Lead + Audit + QR-Code zum Wunschformular */

let currentLeadId = null;

function init() {
  mountTopNav('pitchsheet');

  const requested = getQuery('lead');
  populateLeadPicker(requested);

  document.getElementById('lead-picker').addEventListener('change', e => {
    currentLeadId = e.target.value;
    history.replaceState(null, '', `pitchsheet.html?lead=${currentLeadId}`);
    renderSheet();
  });

  document.getElementById('m-date').value =
    new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  document.getElementById('m-date').addEventListener('input', renderSheet);
  document.getElementById('m-invest').addEventListener('input', renderSheet);

  renderSheet();
}

function populateLeadPicker(preselect) {
  const leads = getLeads().filter(l => l.audit); // nur Leads mit Audit
  const sel = document.getElementById('lead-picker');

  if (leads.length === 0) {
    sel.innerHTML = '<option value="">— Kein Lead mit Audit vorhanden —</option>';
    sel.disabled = true;
    currentLeadId = null;
    return;
  }

  sel.disabled = false;
  sel.innerHTML = leads.map(l => `
    <option value="${l.id}">${esc(l.firma || '(unbenannt)')} · ${esc(l.stadt || '')}</option>
  `).join('');

  if (preselect && leads.find(l => l.id === preselect)) {
    sel.value = preselect;
    currentLeadId = preselect;
  } else {
    currentLeadId = leads[0].id;
  }
}

function renderSheet() {
  const sheet = document.getElementById('sheet');
  if (!currentLeadId) {
    sheet.innerHTML = `
      <div style="text-align: center; padding: 60mm 0; color: #6b7280;">
        <div style="font-size: 40pt; margin-bottom: 4mm;">📄</div>
        <h2 style="margin: 0 0 2mm; color: #0f1f3d;">Noch kein Pitch-Sheet möglich</h2>
        <p style="margin: 0;">Erstelle zuerst im <a href="mapscout.html">Map-Scout</a> ein Audit.</p>
      </div>
    `;
    return;
  }

  const lead = getLead(currentLeadId);
  if (!lead || !lead.audit) {
    sheet.innerHTML = '<p>Lead nicht gefunden.</p>';
    return;
  }

  const settings = loadSettings();
  const a = lead.audit;
  const dateStr = document.getElementById('m-date').value;
  const investStr = document.getElementById('m-invest').value || '490 € — 1.490 €';

  const wishesUrlStr = buildWishesUrl(lead.id, settings.wishFormBaseUrl);

  const scoreClass = a.score >= 70 ? 'good' : a.score >= 40 ? 'mid' : 'bad';

  // 4 wichtigste Schwachstellen
  const topIssues = (a.issues || [])
    .slice()
    .sort((x, y) => sevWeight(y.severity) - sevWeight(x.severity))
    .slice(0, 5);

  const topOpps = (a.opportunities || []).slice(0, 4);
  const bots = (a.ai_bot_suggestions || []).slice(0, 3);
  const talking = (a.talking_points || []).slice(0, 4);

  sheet.innerHTML = `
    <header class="sh-header">
      <div class="sh-brand">
        <div class="sh-brand-mark">W</div>
        <div>
          <div class="sh-brand-name">${esc(settings.studioName)}</div>
          <div class="sh-brand-sub">Webdesign &amp; KI-Lösungen · ${esc(settings.studioCity)}</div>
        </div>
      </div>
      <div class="sh-meta">
        <strong>Angebots-Briefing</strong>
        ${esc(dateStr)}<br>
        für: ${esc(lead.firma || '—')}
      </div>
    </header>

    <section class="sh-hero">
      <div class="sh-hero-eyebrow">Vorschlag für ${esc(lead.firma || 'Ihr Unternehmen')}</div>
      <h1>So wird Ihre Online-Präsenz zur Anfrage-Maschine.</h1>
      <p class="sh-hero-sub">
        Eine Schritt-für-Schritt-Analyse Ihrer aktuellen Website${lead.website ? ' (' + esc(lead.website) + ')' : ''} —
        plus konkreter Plan, wie wir Sie in den kommenden 2–4 Wochen modernisieren, sichtbarer machen
        und mit KI-Bots automatisieren.
      </p>
      <div class="sh-hero-row">
        <div><span>Branche</span><strong>${esc(lead.branche || '—')}</strong></div>
        <div><span>Standort</span><strong>${esc([lead.adresse, lead.stadt].filter(Boolean).join(', ') || '—')}</strong></div>
        ${lead.google_rating ? `<div><span>Google</span><strong>⭐ ${esc(lead.google_rating)}${lead.google_reviews_count ? ' (' + esc(lead.google_reviews_count) + ' Bew.)' : ''}</strong></div>` : ''}
      </div>
      <div class="sh-score ${scoreClass}">
        <span class="v">${a.score}</span><span class="m">/ 100 · ${esc(a.score_label || '')}</span>
      </div>
    </section>

    <div class="sh-grid-2">
      <div class="sh-block tinted-warn">
        <h2 class="sh-h2"><span class="num">1</span>Was heute fehlt</h2>
        ${topIssues.map(i => `
          <div class="sh-issue ${(i.severity || 'med') === 'high' ? '' : (i.severity === 'low' ? 'low' : 'med')}">
            <div class="sh-issue-icon">!</div>
            <div>
              <h4>${esc(i.title || '')}</h4>
              <p>${esc(i.description || '')}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="sh-block tinted-good">
        <h2 class="sh-h2"><span class="num">2</span>Was wir bauen werden</h2>
        ${topOpps.map(o => `
          <div class="sh-opp">
            <div class="sh-opp-icon">✓</div>
            <div>
              <h4>${esc(o.title || '')}</h4>
              <p>${esc(o.description || '')}</p>
              ${o.value ? `<p class="val">→ ${esc(o.value)}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${bots.length ? `
      <div class="sh-block tinted-info" style="margin-bottom: 4mm;">
        <h2 class="sh-h2"><span class="num">3</span>KI-Bots für ${esc(lead.firma || 'Sie')}</h2>
        <div style="display: grid; grid-template-columns: repeat(${Math.min(bots.length, 3)}, 1fr); gap: 4mm;">
          ${bots.map(b => `
            <div>
              <h4 style="font-size: 10.5pt; font-weight: 700; margin: 0 0 1mm;">🤖 ${esc(b.name || '')}</h4>
              <p style="font-size: 9.5pt; margin: 0; color: #4b5563;">${esc(b.why || '')}</p>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="sh-block" style="margin-bottom: 4mm;">
      <h2 class="sh-h2"><span class="num">4</span>Pakete &amp; Investition</h2>
      <div class="sh-pkgs">
        <div class="sh-pkg">
          <div class="nm">Starter</div>
          <div class="pr">ab 490 €</div>
          <ul>
            <li>Eine moderne Seite, mobil</li>
            <li>Kontaktbox &amp; Karte</li>
            <li>Schnell online (≤ 2 Wochen)</li>
          </ul>
        </div>
        <div class="sh-pkg best">
          <div style="display:flex; justify-content: space-between;"><div class="nm">Anfrage-Website</div><span class="tag">empfohlen</span></div>
          <div class="pr">ab 890 €</div>
          <ul>
            <li>Mehrseitig · klare Anfrage-Logik</li>
            <li>Galerie · Bewertungen · FAQ</li>
            <li>SEO-Basis &amp; Google-Anbindung</li>
          </ul>
        </div>
        <div class="sh-pkg">
          <div class="nm">Business + KI</div>
          <div class="pr">ab 1.490 €</div>
          <ul>
            <li>Alles aus Anfrage-Paket</li>
            <li>KI-Support- oder Termin-Bot</li>
            <li>Monatlicher Service-Vertrag möglich</li>
          </ul>
        </div>
      </div>
      <p style="font-size: 9pt; color: #6b7280; margin-top: 2mm;">
        Heute besprochener Rahmen: <strong>${esc(investStr)}</strong> · Festpreis nach kurzem Vor-Ort-Termin.
      </p>
    </div>

    ${talking.length ? `
      <div class="sh-talking">
        <h3>Gesprächspunkte für heute</h3>
        <ul>${talking.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    ` : ''}

    <footer class="sh-footer">
      <div>
        <h3>Ihre Wünsche · direkt scannen.</h3>
        <p>Scannen Sie den QR-Code mit der Handy-Kamera und tragen Sie in 2 Minuten ein, was Ihre neue Website können soll — Stil, Funktionen, KI-Bots. Wir bauen genau das.</p>
        <p style="margin-top: 2mm; font-size: 8.5pt; opacity: 0.7;">Alternativ: ${esc(wishesUrlStr)}</p>
      </div>
      <div class="qr-wrap">
        ${QR.svg(wishesUrlStr, 130)}
        <div class="qr-label">Wunschformular</div>
      </div>
    </footer>

    <div class="sh-contact">
      <div><strong>${esc(settings.studioName)}</strong> · ${esc(settings.studioCity)}</div>
      <div>${esc(settings.studioEmail)}</div>
    </div>
  `;
}

function sevWeight(s) {
  return s === 'high' ? 3 : s === 'med' ? 2 : s === 'low' ? 1 : 2;
}

/* Erzeugt die Wunschformular-URL.  Wenn Settings.wishFormBaseUrl gesetzt
   ist (z.B. http://192.168.x.x:8000/webstudio/admin/wishes.html), wird
   die genutzt — sonst die aktuelle Seite umgemodelt. */
function buildWishesUrl(leadId, override) {
  if (override) {
    const u = override.replace(/\?.*$/, '');
    return `${u}?lead=${leadId}&customer=1`;
  }
  const u = new URL(window.location.href);
  u.pathname = u.pathname.replace(/pitchsheet\.html$/, 'wishes.html');
  u.search = `?lead=${leadId}&customer=1`;
  u.hash = '';
  return u.toString();
}

document.addEventListener('DOMContentLoaded', init);
