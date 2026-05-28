'use strict';

/* Map-Scout: Screenshot → KI-Extraktion → Website-Audit */

let lead = blankLead();
let mapsImageData = null; // { base64, dataUrl, mimeType }
let websiteHtmlCondensed = null;

function init() {
  mountTopNav('mapscout');

  // Wenn ?lead=ID gesetzt, bestehenden Lead laden
  const id = getQuery('lead');
  if (id) {
    const existing = getLead(id);
    if (existing) {
      lead = existing;
      hydrateForm();
      if (lead.audit) showAudit(lead.audit);
    }
  }

  bindDropzone();
  bindButtons();
  bindFormChanges();
  bindPaste();
}

/* ── Formular ⇄ State ────────────────────────────────────────── */
function hydrateForm() {
  document.getElementById('f-firma').value    = lead.firma   || '';
  document.getElementById('f-branche').value  = lead.branche || '';
  document.getElementById('f-adresse').value  = lead.adresse || '';
  document.getElementById('f-plz').value      = lead.plz     || '';
  document.getElementById('f-stadt').value    = lead.stadt   || '';
  document.getElementById('f-telefon').value  = lead.telefon || '';
  document.getElementById('f-email').value    = lead.email   || '';
  document.getElementById('f-website').value  = lead.website || '';
  document.getElementById('f-rating').value   = lead.google_rating || '';
  document.getElementById('f-reviews').value  = lead.google_reviews_count || '';
  document.getElementById('f-notizen').value  = lead.notizen || '';

  if (lead.mapsScreenshot) {
    renderDropzonePreview(lead.mapsScreenshot);
  }
  refreshSaveState();
  refreshAuditButton();
}

function collectForm() {
  lead.firma   = document.getElementById('f-firma').value.trim();
  lead.branche = document.getElementById('f-branche').value.trim();
  lead.adresse = document.getElementById('f-adresse').value.trim();
  lead.plz     = document.getElementById('f-plz').value.trim();
  lead.stadt   = document.getElementById('f-stadt').value.trim();
  lead.telefon = document.getElementById('f-telefon').value.trim();
  lead.email   = document.getElementById('f-email').value.trim();
  lead.website = document.getElementById('f-website').value.trim();
  lead.google_rating = document.getElementById('f-rating').value.trim();
  lead.google_reviews_count = document.getElementById('f-reviews').value.trim();
  lead.notizen = document.getElementById('f-notizen').value.trim();
}

/* ── Dropzone für Screenshot ─────────────────────────────────── */
function bindDropzone() {
  const dz = document.getElementById('dropzone');
  const fi = document.getElementById('file-input');

  dz.addEventListener('click', e => {
    if (e.target.closest('.ad-dropzone-x')) return;
    fi.click();
  });
  fi.addEventListener('change', () => { if (fi.files[0]) handleFile(fi.files[0]); });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('is-drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('is-drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('is-drag');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  });
}

function bindPaste() {
  document.addEventListener('paste', e => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) handleFile(f);
        break;
      }
    }
  });
}

async function handleFile(file) {
  try {
    const data = await fileToBase64(file);
    mapsImageData = data;
    lead.mapsScreenshot = data.dataUrl;
    renderDropzonePreview(data.dataUrl);
    document.getElementById('btn-extract').disabled = false;
    toast('Bild geladen — jetzt "Mit KI auslesen" klicken', 'success');
  } catch (e) {
    toast('Datei konnte nicht gelesen werden', 'error');
  }
}

function renderDropzonePreview(dataUrl) {
  const dz = document.getElementById('dropzone');
  dz.innerHTML = `
    <div class="ad-dropzone-preview">
      <img src="${dataUrl}" alt="Maps-Screenshot">
      <button type="button" class="ad-dropzone-x" title="Entfernen" onclick="event.stopPropagation(); clearScreenshot();">✕</button>
    </div>
    <p style="margin-top: 12px; font-size: 13px; color: var(--ad-text-muted);">
      Klick um ein anderes Bild zu wählen
    </p>
  `;
}

function clearScreenshot() {
  mapsImageData = null;
  lead.mapsScreenshot = null;
  document.getElementById('btn-extract').disabled = true;
  const dz = document.getElementById('dropzone');
  dz.innerHTML = `
    <div class="ad-dropzone-icon">📍</div>
    <h3>Screenshot hier ablegen</h3>
    <p>Oder klicken um Datei zu wählen · Strg+V zum Einfügen</p>
    <input type="file" id="file-input" accept="image/*" style="display:none">
  `;
  bindDropzone();
}

/* ── Buttons ─────────────────────────────────────────────────── */
function bindButtons() {
  document.getElementById('btn-extract').addEventListener('click', runExtract);
  document.getElementById('btn-fetch').addEventListener('click', runFetch);
  document.getElementById('btn-audit').addEventListener('click', runAudit);
  document.getElementById('btn-save').addEventListener('click', save);
}

function bindFormChanges() {
  ['f-firma','f-branche','f-adresse','f-plz','f-stadt','f-telefon','f-email','f-website','f-rating','f-reviews','f-notizen']
    .forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        refreshSaveState();
        refreshAuditButton();
      });
    });
}

function refreshSaveState() {
  collectForm();
  document.getElementById('save-state').textContent =
    lead.id ? `Gespeichert · zuletzt ${formatDateTime(lead.updatedAt)}` : 'Noch nicht gespeichert';
  const link = document.getElementById('link-pitch');
  if (lead.id && lead.audit) {
    link.style.display = '';
    link.href = `pitchsheet.html?lead=${lead.id}`;
  } else {
    link.style.display = 'none';
  }
}

function refreshAuditButton() {
  const url = document.getElementById('f-website').value.trim();
  document.getElementById('btn-audit').disabled = !url && !document.getElementById('f-manual-html').value.trim();
}

/* ── 1. KI: Maps-Screenshot auslesen ─────────────────────────── */
async function runExtract() {
  if (!mapsImageData) return;
  if (!hasApiKey()) { toast('API-Key fehlt.', 'error'); openSettingsModal(); return; }
  const btn = document.getElementById('btn-extract');
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="ad-spin"></span> KI liest…';
  try {
    const data = await ClaudeAPI.extractFromMapsScreenshot(mapsImageData.base64, mapsImageData.mimeType);
    applyExtracted(data);
    toast(`Daten ausgelesen (${data.confidence || 'mid'} confidence)`, 'success');
  } catch (e) {
    toast('Fehler: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function applyExtracted(d) {
  const set = (id, v) => { if (v) document.getElementById(id).value = v; };
  set('f-firma',   d.firma);
  set('f-branche', d.branche);
  set('f-adresse', d.adresse);
  set('f-plz',     d.plz);
  set('f-stadt',   d.stadt);
  set('f-telefon', d.telefon);
  set('f-email',   d.email);
  set('f-website', d.website);
  set('f-rating',  d.google_rating);
  set('f-reviews', d.google_reviews_count);

  if (d.oeffnungszeiten_text) {
    const cur = document.getElementById('f-notizen').value;
    document.getElementById('f-notizen').value = (cur ? cur + '\n\n' : '') + 'Öffnungszeiten: ' + d.oeffnungszeiten_text;
  }
  refreshSaveState();
  refreshAuditButton();
}

/* ── 2. Website-Inhalt holen ─────────────────────────────────── */
async function runFetch() {
  const url = document.getElementById('f-website').value.trim();
  if (!url) { toast('Bitte Website-URL eintragen', 'error'); return; }
  const status = document.getElementById('audit-status');
  status.innerHTML = '<span class="ad-spin" style="vertical-align:middle"></span> Lade Inhalt…';
  try {
    const res = await fetchWebsiteHtml(url);
    if (!res) {
      status.innerHTML = '<span style="color: var(--ad-warning)">⚠️ Inhalt konnte nicht geladen werden (CORS).</span> Du kannst manuell einfügen oder den Audit trotzdem starten.';
      websiteHtmlCondensed = null;
      return;
    }
    websiteHtmlCondensed = condenseHtml(res.html);
    status.innerHTML = `<span style="color: var(--ad-success)">✓ Inhalt geladen</span> (${websiteHtmlCondensed.length} Zeichen kondensiert).`;
  } catch (e) {
    status.textContent = 'Fehler: ' + e.message;
  }
}

/* ── 3. Audit starten ────────────────────────────────────────── */
async function runAudit() {
  if (!hasApiKey()) { toast('API-Key fehlt.', 'error'); openSettingsModal(); return; }
  collectForm();
  const manual = document.getElementById('f-manual-html').value.trim();
  const excerpt = manual ? condenseHtml(manual) : (websiteHtmlCondensed || '');

  const btn = document.getElementById('btn-audit');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="ad-spin"></span> KI analysiert…';
  const status = document.getElementById('audit-status');
  status.innerHTML = '<span class="ad-spin" style="vertical-align:middle"></span> Audit läuft…';

  try {
    const audit = await ClaudeAPI.auditWebsite({
      url: lead.website,
      htmlExcerpt: excerpt,
      branche: lead.branche,
      stadt: lead.stadt,
    });
    audit.runAt = Date.now();
    lead.audit = audit;
    showAudit(audit);
    status.innerHTML = `<span style="color: var(--ad-success)">✓ Audit fertig (Score ${audit.score})</span>`;
    toast('Audit fertig — jetzt speichern!', 'success');
    refreshSaveState();
  } catch (e) {
    status.textContent = 'Fehler: ' + e.message;
    toast('Fehler: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function showAudit(a) {
  const box = document.getElementById('audit-result');
  box.style.display = '';
  document.getElementById('audit-meta').textContent =
    `Score ${a.score} / 100 · ${a.score_label || ''} · ${formatDateTime(a.runAt)}`;
  document.getElementById('audit-body').innerHTML = `
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 14px;">${esc(a.summary || '')}</p>

    <h4 style="margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ad-text-muted);">Schwachstellen</h4>
    ${(a.issues || []).map(i => `
      <div class="ad-issue sev-${(i.severity || 'med') === 'high' ? 'high' : (i.severity === 'low') ? 'low' : 'med'}">
        <div class="ad-issue-sev"></div>
        <div>
          <h4>${esc(i.title || '')} <span class="ad-chip neutral" style="font-size: 10px; margin-left: 4px;">${esc(i.category || '')}</span></h4>
          <p>${esc(i.description || '')}</p>
        </div>
      </div>
    `).join('')}

    <h4 style="margin: 18px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ad-text-muted);">Chancen / Zusatzleistungen</h4>
    ${(a.opportunities || []).map(o => `
      <div style="padding: 12px 14px; background: #f0f7ff; border-left: 3px solid var(--ad-accent); border-radius: 6px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <strong style="font-size: 14px;">${esc(o.title || '')}</strong>
          <span class="ad-chip info" style="font-size: 10px;">${esc(o.category || '')}</span>
        </div>
        <p style="font-size: 13px; margin: 0; color: var(--ad-text-muted);">${esc(o.description || '')}</p>
        ${o.value ? `<p style="font-size: 12px; margin: 4px 0 0; font-style: italic; color: var(--ad-primary);">→ ${esc(o.value)}</p>` : ''}
      </div>
    `).join('')}

    ${(a.ai_bot_suggestions || []).length ? `
      <h4 style="margin: 18px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ad-text-muted);">🤖 KI-Bot-Empfehlungen</h4>
      ${(a.ai_bot_suggestions || []).map(b => `
        <div style="padding: 10px 14px; background: #fef3c7; border-radius: 6px; margin-bottom: 6px;">
          <strong style="font-size: 14px;">${esc(b.name || '')}</strong>
          <p style="font-size: 13px; margin: 2px 0 0; color: var(--ad-text-muted);">${esc(b.why || '')}</p>
        </div>
      `).join('')}
    ` : ''}

    ${(a.talking_points || []).length ? `
      <h4 style="margin: 18px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ad-text-muted);">💬 Termin-Gesprächspunkte</h4>
      <ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.6;">
        ${a.talking_points.map(t => `<li>${esc(t)}</li>`).join('')}
      </ul>
    ` : ''}
  `;
}

/* ── Speichern ───────────────────────────────────────────────── */
function save() {
  collectForm();
  if (!lead.firma && !lead.website) {
    toast('Mindestens Firma oder Website angeben', 'error');
    return;
  }
  const id = upsertLead(lead);
  lead = getLead(id);
  history.replaceState(null, '', `mapscout.html?lead=${id}`);
  toast('Lead gespeichert', 'success');
  refreshSaveState();
}

window.clearScreenshot = clearScreenshot;
document.addEventListener('DOMContentLoaded', init);
