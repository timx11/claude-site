'use strict';

/* Cockpit-Logik */

let activeLeadId = null;

function init() {
  mountTopNav('cockpit');
  render();
  // bei Storage-Änderungen (anderer Tab) neu rendern
  window.addEventListener('storage', e => {
    if (e.key === LEADS_KEY || e.key === SETTINGS_KEY) render();
  });
}

function render() {
  renderStats();
  renderPipeline();
  if (activeLeadId) openLead(activeLeadId);
}

function renderStats() {
  const leads = getLeads();
  const items = [
    { label: 'Leads gesamt',     value: leads.length,                       color: 'var(--ad-text)' },
    { label: 'Audit fertig',     value: leads.filter(l => l.audit).length,   color: 'var(--ad-accent)' },
    { label: 'Im Termin',        value: leads.filter(l => l.status === 'im_termin').length, color: 'var(--ad-info)' },
    { label: 'Wünsche erfasst',  value: leads.filter(l => l.wishes).length,  color: 'var(--ad-warning)' },
    { label: 'Build-Plan',       value: leads.filter(l => l.buildPlan).length, color: 'var(--ad-success)' },
  ];
  document.getElementById('stats-grid').innerHTML = items.map(s => `
    <div>
      <div style="font-size:13px; color: var(--ad-text-muted); font-weight: 500;">${esc(s.label)}</div>
      <div style="font-size:32px; font-weight: 800; color:${s.color}; line-height: 1.1; font-family: 'Plus Jakarta Sans', sans-serif;">${s.value}</div>
    </div>
  `).join('');
}

function renderPipeline() {
  const leads = getLeads();
  // Lege Pipeline-Status fest; "neu" enthält alles ohne neueren Status
  const columns = STATUS_PIPELINE.map(s => ({ key: s, label: STATUS_LABEL[s], leads: [] }));

  for (const l of leads) {
    const s = STATUS_PIPELINE.includes(l.status) ? l.status : 'neu';
    const col = columns.find(c => c.key === s);
    if (col) col.leads.push(l);
  }

  document.getElementById('pipeline-meta').textContent =
    `${leads.length} Leads · ${leads.filter(l => l.audit).length} mit Audit · ${leads.filter(l => l.wishes).length} mit Wünschen`;

  document.getElementById('pipeline').innerHTML = columns.map(col => `
    <div class="ad-pl-col">
      <div class="ad-pl-h">
        <span>${esc(col.label)}</span>
        <span class="count">${col.leads.length}</span>
      </div>
      ${col.leads.length === 0
        ? `<div style="font-size:12px; color: var(--ad-text-soft); padding: 8px 4px;">—</div>`
        : col.leads.map(l => leadCard(l)).join('')}
    </div>
  `).join('');
}

function leadCard(l) {
  const auditBadge = l.audit ? `<span class="ad-chip ${l.audit.score >= 70 ? 'ok' : l.audit.score >= 40 ? 'warn' : 'bad'}">Audit ${l.audit.score}</span>` : '';
  const wishesBadge = l.wishes ? `<span class="ad-chip info">🎯 Wünsche</span>` : '';
  const buildBadge = l.buildPlan ? `<span class="ad-chip ok">✨ Plan</span>` : '';
  return `
    <div class="ad-pl-card" onclick="openLead('${l.id}')">
      <h4>${esc(l.firma || '(unbenannt)')}</h4>
      <div class="sub">${esc([l.branche, l.stadt].filter(Boolean).join(' · ') || '—')}</div>
      <div class="meta">${auditBadge}${wishesBadge}${buildBadge}</div>
    </div>
  `;
}

function openLead(id) {
  activeLeadId = id;
  const lead = getLead(id);
  if (!lead) { closeLead(); return; }

  document.getElementById('lead-detail').style.display = '';
  document.getElementById('ld-title').textContent = lead.firma || '(unbenannt)';

  const a = lead.audit;
  const w = lead.wishes;
  const p = lead.buildPlan;

  document.getElementById('ld-body').innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 22px;">
      <div>
        <h3 style="margin: 0 0 8px; font-size: 15px;">Stammdaten</h3>
        <div style="font-size: 14px; line-height: 1.7;">
          <div><strong>${esc(lead.firma || '—')}</strong>${lead.name ? ' · ' + esc(lead.name) : ''}</div>
          <div style="color: var(--ad-text-muted);">${esc([lead.branche, lead.stadt].filter(Boolean).join(' · '))}</div>
          <div style="margin-top: 6px;">📞 ${esc(lead.telefon || '—')}</div>
          <div>✉️ ${lead.email ? `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>` : '—'}</div>
          <div>🌐 ${lead.website ? `<a href="${esc(normalizeUrl(lead.website))}" target="_blank">${esc(lead.website)}</a>` : '—'}</div>
          ${lead.google_rating ? `<div>⭐ ${esc(lead.google_rating)}${lead.google_reviews_count ? ` (${esc(lead.google_reviews_count)} Bew.)` : ''}</div>` : ''}
        </div>
        <div style="margin-top: 14px;">
          <label class="ad-label">Status</label>
          <select class="ad-select" onchange="changeStatus('${lead.id}', this.value)">
            ${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${lead.status === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div>
        <h3 style="margin: 0 0 8px; font-size: 15px;">Aktionen</h3>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <a href="mapscout.html?lead=${lead.id}" class="ad-btn">${a ? '🔁 Audit erneut laufen lassen' : '🔍 Website auditieren'}</a>
          <a href="pitchsheet.html?lead=${lead.id}" class="ad-btn ${!a ? '' : 'ad-btn-primary'}" ${!a ? 'onclick="alert(\'Erst ein Audit erstellen.\'); return false;"' : ''}>📄 Pitch-Sheet öffnen</a>
          <a href="wishes.html?lead=${lead.id}" class="ad-btn">🎯 Wunschformular ausfüllen</a>
          <button class="ad-btn ${w ? 'ad-btn-accent' : ''}" onclick="generateBuildPlan('${lead.id}')" ${!w ? 'disabled title="Erst Kundenwünsche erfassen"' : ''}>
            ✨ Build-Plan mit KI ${p ? '(erneut)' : ''}
          </button>
          <button class="ad-btn ad-btn-danger" onclick="confirmDelete('${lead.id}')">🗑️ Lead löschen</button>
        </div>
      </div>
    </div>

    ${a ? `
      <div style="margin-top: 24px; padding-top: 22px; border-top: 1px solid var(--ad-border-soft);">
        <div style="display: flex; align-items: baseline; gap: 16px; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 15px;">Audit</h3>
          <span class="ad-score ${a.score >= 70 ? 's-good' : a.score >= 40 ? 's-mid' : 's-bad'}">
            <span class="ad-score-num">${a.score}</span><span class="ad-score-max">/ 100 · ${esc(a.score_label || '')}</span>
          </span>
          <span style="font-size:12px; color: var(--ad-text-muted); margin-left: auto;">${formatDateTime(a.runAt)}</span>
        </div>
        <p style="font-size: 14px; color: var(--ad-text-muted); margin: 0 0 12px;">${esc(a.summary || '')}</p>
        ${(a.issues || []).slice(0, 4).map(i => issueHtml(i)).join('')}
        ${(a.issues || []).length > 4 ? `<div style="font-size:13px; color: var(--ad-text-soft); margin-top: 8px;">+ ${(a.issues || []).length - 4} weitere Befunde · siehe Pitch-Sheet</div>` : ''}
      </div>
    ` : ''}

    ${w ? `
      <div style="margin-top: 24px; padding-top: 22px; border-top: 1px solid var(--ad-border-soft);">
        <h3 style="margin: 0 0 8px; font-size: 15px;">Kundenwünsche</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
          ${(w.designStyle || []).map(s => `<span class="ad-chip info">${esc(s)}</span>`).join('')}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
          ${(w.bots || []).map(s => `<span class="ad-chip ok">🤖 ${esc(s)}</span>`).join('')}
          ${(w.services || []).map(s => `<span class="ad-chip neutral">${esc(s)}</span>`).join('')}
        </div>
        ${w.freetext ? `<p style="font-size: 14px; background: var(--ad-bg-sunken); padding: 12px; border-radius: 8px; margin: 0; white-space: pre-wrap;">${esc(w.freetext)}</p>` : ''}
        <div style="font-size: 12px; color: var(--ad-text-soft); margin-top: 8px;">Eingereicht: ${formatDateTime(w.submittedAt)}</div>
      </div>
    ` : ''}

    ${p ? `
      <div style="margin-top: 24px; padding-top: 22px; border-top: 1px solid var(--ad-border-soft);">
        <h3 style="margin: 0 0 8px; font-size: 15px;">✨ Build-Plan (KI)</h3>
        <p style="font-size:14px;">${esc(p.concept_summary || '')}</p>
        <details style="margin-top:10px;">
          <summary style="cursor: pointer; font-size: 13px; color: var(--ad-text-muted);">Vollständiger Plan als JSON anzeigen</summary>
          <pre style="background: var(--ad-bg-sunken); padding: 14px; border-radius: 8px; font-size: 12px; overflow: auto; margin-top: 8px;">${esc(JSON.stringify(p, null, 2))}</pre>
        </details>
      </div>
    ` : ''}
  `;
  document.getElementById('lead-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function issueHtml(i) {
  const sev = (i.severity || 'med').toLowerCase();
  return `
    <div class="ad-issue sev-${sev === 'high' ? 'high' : sev === 'low' ? 'low' : 'med'}">
      <div class="ad-issue-sev"></div>
      <div>
        <h4>${esc(i.title || '')}</h4>
        <p>${esc(i.description || '')}</p>
      </div>
    </div>
  `;
}

function closeLead() {
  activeLeadId = null;
  document.getElementById('lead-detail').style.display = 'none';
}

function changeStatus(id, value) {
  updateLead(id, { status: value });
  toast('Status aktualisiert', 'success');
  render();
}

function confirmDelete(id) {
  if (!confirm('Lead wirklich löschen? Audit, Wünsche und Build-Plan gehen ebenfalls verloren.')) return;
  deleteLead(id);
  toast('Lead gelöscht');
  closeLead();
  render();
}

async function generateBuildPlan(id) {
  const lead = getLead(id);
  if (!lead) return;
  if (!lead.wishes) { toast('Erst Kundenwünsche erfassen.', 'error'); return; }
  if (!hasApiKey())  { toast('API-Key fehlt.', 'error'); openSettingsModal(); return; }

  toast('KI generiert Build-Plan…');
  try {
    const plan = await ClaudeAPI.generateBuildPlan({ lead });
    updateLead(id, { buildPlan: plan, status: 'in_arbeit' });
    toast('Build-Plan fertig', 'success');
    render();
  } catch (e) {
    toast('Fehler: ' + e.message, 'error');
  }
}

window.openLead = openLead;
window.closeLead = closeLead;
window.changeStatus = changeStatus;
window.confirmDelete = confirmDelete;
window.generateBuildPlan = generateBuildPlan;

document.addEventListener('DOMContentLoaded', init);
