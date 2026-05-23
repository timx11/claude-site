'use strict';

const TAG_TYPES = {
  schuss:      { label: 'Schuss',      color: '#f87171', arrow: true },
  '1vs1':      { label: '1vs1',        color: '#fb923c' },
  pass:        { label: 'Pass',        color: '#60a5fa' },
  flanke:      { label: 'Flanke',      color: '#22d3ee', arrow: true },
  vorlage:     { label: 'Vorlage',     color: '#34d399', arrow: true },
  fehler:      { label: 'Fehler',      color: '#94a3b8' },
  markierung:  { label: 'Markierung',  color: '#a78bfa' },
  tor:         { label: 'Tor',         color: '#fbbf24', arrow: true, goalForm: true },
  gegentor:    { label: 'Gegentor',    color: '#f472b6', goalForm: true },
};

const MARK_COLORS = ['#8b5cf6','#ef4444','#3b82f6','#10b981','#f97316','#fbbf24','#ffffff'];

// ── State ──
let state = {
  sessions: [],
  players: [],
  opponents: [],
  currentSessionId: null,
  currentPage: 'sessions',
  pendingTagType: null,
  pendingArrowStart: null,
  markColor: '#8b5cf6',
  filters: { action: '', player: '' },
  playerTab: 'own',
  activePeriodIdx: 0,
  selectedTagId: null,
};

let _playheadRaf = null;
let _goalFormTagId = null;
let _goalFormFoot = '';

function defaultPeriods(mode) {
  if (mode === 'halves') return [
    { label: '1.HZ',      startTime: null, direction: 'ltr' },
    { label: '2.HZ',      startTime: null, direction: 'rtl' },
  ];
  return [
    { label: '1.Drittel', startTime: null, direction: 'ltr' },
    { label: '2.Drittel', startTime: null, direction: 'ltr' },
    { label: '3.Drittel', startTime: null, direction: 'rtl' },
  ];
}

// ── Coordinate helpers ──
function svgToCoord(svgX, svgY) {
  return {
    x: Math.round((svgX - 200) / 388 * 200),
    y: Math.round((svgY - 130) / 248 * 200),
  };
}
function coordToSvg(x, y) {
  return {
    svgX: x / 200 * 388 + 200,
    svgY: y / 200 * 248 + 130,
  };
}
function displayCoord(x, y, direction) {
  const dx = (direction || 'ltr') === 'rtl' ? -x : x;
  return `${dx > 0 ? '+' : ''}${dx}, ${y > 0 ? '+' : ''}${y}`;
}

// ── Arrow SVG helper ──
function arrowSvg(x1, y1, x2, y2, color, w = 2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="5" fill="${color}" opacity="0.85"/>`;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const hl = Math.min(12, len * 0.4), hw = 5;
  const ax = x2 - ux * hl, ay = y2 - uy * hl;
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="${color}" stroke-width="${w}" opacity="0.85" stroke-linecap="round"/>` +
    `<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(ax+nx*hw).toFixed(1)},${(ay+ny*hw).toFixed(1)} ${(ax-nx*hw).toFixed(1)},${(ay-ny*hw).toFixed(1)}" fill="${color}" opacity="0.9"/>`;
}

function updateArrowPreview(x1, y1, x2, y2) {
  const g = document.getElementById('field-arrow-preview');
  if (!g) return;
  const color = TAG_TYPES[state.pendingTagType]?.color || '#fff';
  g.innerHTML = arrowSvg(x1, y1, x2, y2, color, 1.5) +
    `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="4" fill="${color}" opacity="0.7"/>`;
}

// ── Player helpers ──
function findPlayerById(id) {
  if (!id) return null;
  const p = state.players.find(pl => pl.id === id);
  if (p) return p;
  for (const t of (state.opponents || [])) {
    const tp = (t.players || []).find(pl => pl.id === id);
    if (tp) return tp;
  }
  return null;
}

function allPlayers() {
  const opp = (state.opponents || []).flatMap(t =>
    (t.players || []).map(p => ({ ...p, _teamName: t.name })));
  return [...state.players, ...opp];
}

// ── Storage ──
function save() {
  localStorage.setItem('scoutool_v1', JSON.stringify({
    sessions:  state.sessions,
    players:   state.players,
    opponents: state.opponents,
  }));
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('scoutool_v1') || '{}');
    state.sessions  = d.sessions  || [];
    state.players   = d.players   || [];
    state.opponents = d.opponents || [];

    // Migrate legacy opponent players → default opponent team
    const legacyOpp = state.players.filter(p => p.team === 'opponent');
    if (legacyOpp.length) {
      state.opponents.push({ id: uid(), name: 'Gegner', players: legacyOpp });
      state.players = state.players.filter(p => p.team !== 'opponent');
    }

    // Migrate old half1/half2 → periods
    state.sessions.forEach(s => {
      if (!s.periods) {
        s.periodMode = 'halves';
        s.periods = [
          { label: '1.HZ', startTime: s.half1 ?? null, direction: 'ltr' },
          { label: '2.HZ', startTime: s.half2 ?? null, direction: 'rtl' },
        ];
      }
    });
  } catch (_) {}
}

// ── Helpers ──
function currentSession() {
  return state.sessions.find(s => s.id === state.currentSessionId) || null;
}

function formatTime(sec) {
  if (sec == null || isNaN(sec)) return '—';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── Navigation ──
function navigate(page, sessionId) {
  if (state.currentPage === 'analysis' && page !== 'analysis') {
    if (_playheadRaf) { cancelAnimationFrame(_playheadRaf); _playheadRaf = null; }
    state.pendingArrowStart = null;
    state.pendingTagType    = null;
    const prevG = document.getElementById('field-arrow-preview');
    if (prevG) prevG.innerHTML = '';
    document.getElementById('active-tag-bar')?.classList.add('hidden');
    const fh = document.getElementById('field-hint');
    if (fh) fh.textContent = '';
    closeGoalForm();
  }

  if (sessionId) state.currentSessionId = sessionId;
  state.currentPage = page;

  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page').forEach(el =>
    el.classList.toggle('active', el.id === `page-${page}`));

  const renders = { sessions: renderSessions, analysis: renderAnalysis, players: renderPlayers, reports: renderReports };
  renders[page]?.();
  renderSidebar();
}

// ── Sidebar ──
function renderSidebar() {
  const list = document.getElementById('sidebar-session-list');
  if (!list) return;
  if (!state.sessions.length) {
    list.innerHTML = '<div class="sidebar-empty">Noch keine Sessions</div>';
    return;
  }
  list.innerHTML = state.sessions.slice(0, 12).map(s => `
    <div class="sidebar-session ${s.id === state.currentSessionId ? 'active' : ''}"
         onclick="navigate('analysis','${s.id}')">
      <div class="sidebar-session-name">${esc(s.name)}</div>
      <div class="sidebar-session-meta">${s.date} · ${s.tags.length} Tags</div>
    </div>`).join('');
}

// ── Sessions Page ──
function renderSessions() {
  const grid = document.getElementById('sessions-grid');
  if (!grid) return;
  if (!state.sessions.length) {
    grid.innerHTML = `<div class="empty-state">
      <h3>Noch keine Sessions</h3>
      <p>Erstelle deine erste Session, um mit der Analyse zu beginnen.</p>
      <button class="btn btn-primary" onclick="showNewSessionModal()">+ Neue Session</button>
    </div>`;
    return;
  }
  grid.innerHTML = state.sessions.map(s => {
    const shots  = s.tags.filter(t => t.type === 'schuss').length;
    const goals  = s.tags.filter(t => t.type === 'tor').length;
    const gegen  = s.tags.filter(t => t.type === 'gegentor').length;
    const errors = s.tags.filter(t => t.type === 'fehler').length;
    const pInfo  = s.periodMode === 'thirds' ? '3 Drittel' : '2 Halbzeiten';
    return `<div class="session-row" onclick="navigate('analysis','${s.id}')">
      <div class="session-row-type">
        <span class="session-type-badge">${esc(s.type)}</span>
      </div>
      <div class="session-row-main">
        <div class="session-row-name">${esc(s.name)}</div>
        ${s.opponent ? `<div class="session-row-opp">vs. ${esc(s.opponent)}</div>` : ''}
      </div>
      <div class="session-row-stats">
        <span>${s.tags.length} Tags</span>
        <span>${goals}:${gegen} Tore</span>
        <span>${shots} Schüsse · ${errors} Fehler</span>
        <span style="color:var(--text3)">${pInfo}</span>
      </div>
      <div class="session-row-date">${s.date}</div>
    </div>`;
  }).join('');
}

// ── Analysis Page ──
function renderAnalysis() {
  const session = currentSession();
  const hint    = document.getElementById('no-session-hint');
  const layout  = document.getElementById('analysis-layout');
  const infoEl  = document.getElementById('session-info');
  const metaEl  = document.getElementById('session-meta');

  if (!session) {
    hint?.style.setProperty('display', 'block');
    if (layout) layout.style.display = 'none';
    if (infoEl) infoEl.textContent = 'Keine Session aktiv';
    if (metaEl) metaEl.textContent = '';
    document.getElementById('stats-cards').innerHTML = '';
    return;
  }

  hint?.style.setProperty('display', 'none');
  if (layout) layout.style.display = 'flex';

  if (infoEl) infoEl.textContent = session.name;
  if (metaEl) metaEl.textContent = [session.date, session.opponent ? `vs. ${session.opponent}` : '', session.type].filter(Boolean).join(' · ');

  refreshPlayerSelects();
  renderPeriodBar();
  renderTagList();
  renderTimelinePro();
  renderStatsCards();
  renderFieldDots();
  renderGoalLabels();
  startPlayheadUpdate();
}

function refreshPlayerSelects() {
  const ownOpts = state.players.map(p =>
    `<option value="${p.id}">${p.number ? '#' + p.number + ' ' : ''}${esc(p.name)}</option>`).join('');

  const oppOpts = (state.opponents || []).flatMap(t =>
    (t.players || []).map(p =>
      `<option value="${p.id}">${p.number ? '#' + p.number + ' ' : ''}${esc(p.name)} (${esc(t.name)})</option>`)
  ).join('');

  const allOpts = ownOpts + (oppOpts ? `<optgroup label="Gegner">${oppOpts}</optgroup>` : '');

  const tagSel = document.getElementById('tag-player-select');
  if (tagSel) { const v = tagSel.value; tagSel.innerHTML = '<option value="">— kein Spieler —</option>' + allOpts; tagSel.value = v; }

  const filtSel = document.getElementById('filter-player');
  if (filtSel) { const v = filtSel.value; filtSel.innerHTML = '<option value="">Alle Spieler</option>' + allOpts; filtSel.value = v; }
}

function filteredTags() {
  const s = currentSession();
  if (!s) return [];
  return s.tags.filter(t => {
    if (state.filters.action && t.type !== state.filters.action) return false;
    if (state.filters.player && t.playerId !== state.filters.player) return false;
    return true;
  }).sort((a, b) => a.time - b.time);
}

function renderTagList() {
  const list = document.getElementById('tag-list');
  if (!list) return;
  const tags = filteredTags();
  if (!tags.length) {
    list.innerHTML = '<div class="tag-list-empty">Noch keine Tags — Aktion wählen und Feld klicken</div>';
    return;
  }
  list.innerHTML = `<table class="tag-table">
    <thead><tr><th>Zeit</th><th>HZ</th><th>Aktion</th><th>Koordinate</th><th>Spieler</th><th></th></tr></thead>
    <tbody>${tags.map(t => {
      const tt    = TAG_TYPES[t.type] || { label: t.type, color: '#666' };
      const pl    = findPlayerById(t.playerId);
      const dot   = t.markColor ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.markColor};margin-right:4px;vertical-align:middle"></span>` : '';
      const coord = t.x != null ? displayCoord(t.x, t.y, t.direction) : (t.zone || '—');
      const coord2 = t.x2 != null ? ` → ${displayCoord(t.x2, t.y2, t.direction)}` : '';
      const assistPl = findPlayerById(t.assistPlayerId);
      const footLabel = t.foot ? t.foot.charAt(0).toUpperCase() + t.foot.slice(1) : '';
      const goalExtra = (t.type === 'tor' || t.type === 'gegentor')
        ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${footLabel}${assistPl ? (footLabel ? ' · ' : '') + 'Vorlage: ' + esc(assistPl.name) : ''}</div>`
        : '';
      return `<tr class="tag-row${t.id === state.selectedTagId ? ' selected' : ''}" data-tag-id="${t.id}" onclick="selectTag('${t.id}')">
        <td class="tag-time">${formatTime(t.time)}</td>
        <td>${t.periodLabel || t.half || '—'}</td>
        <td>${dot}<span class="tag-badge" style="background:${tt.color}22;color:${tt.color};border-color:${tt.color}55">${tt.label}</span>${goalExtra}</td>
        <td style="font-size:10px;font-family:monospace">${coord}${coord2}</td>
        <td style="font-size:11px">${pl ? (pl.number ? '#' + pl.number + ' ' : '') + esc(pl.name) : '—'}</td>
        <td><button class="btn-delete" title="Tag löschen" onclick="event.stopPropagation();removeTag('${t.id}')">×</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function renderTimelinePro() {
  const session  = currentSession();
  const video    = document.getElementById('video-player');
  const duration = (video && !isNaN(video.duration) && video.duration > 0) ? video.duration : 0;
  const maxT     = duration || (session?.tags.length ? Math.max(...session.tags.map(t => t.time), 5400) : 5400);

  const rulerEl = document.getElementById('tl-ruler');
  if (rulerEl) {
    const interval = maxT <= 600 ? 60 : maxT <= 3600 ? 300 : 600;
    let rulerHtml = '';
    for (let t = 0; t <= maxT; t += interval) {
      const pct     = (t / maxT * 100).toFixed(2);
      const isMajor = t % (interval * 2) === 0 || interval >= 300;
      rulerHtml += `<div class="tl-tick" style="left:${pct}%">
        <div class="tl-tick-line" style="height:${isMajor ? 6 : 4}px"></div>
        ${isMajor ? `<span class="tl-tick-label">${formatTime(t)}</span>` : ''}
      </div>`;
    }
    rulerEl.innerHTML = rulerHtml;
  }

  const bandsEl = document.getElementById('tl-period-bands');
  if (bandsEl && session) {
    const periods    = (session.periods || []).filter(p => p.startTime != null).sort((a,b) => a.startTime - b.startTime);
    const bandColors = ['rgba(139,92,246,1)', 'rgba(59,130,246,1)', 'rgba(16,185,129,1)'];
    let bandsHtml = '';
    periods.forEach((p, i) => {
      const x1   = (p.startTime / maxT * 100).toFixed(2);
      const next = periods[i + 1];
      const x2   = next ? (next.startTime / maxT * 100).toFixed(2) : '100';
      const w    = (parseFloat(x2) - parseFloat(x1)).toFixed(2);
      bandsHtml += `<div class="tl-period-band" style="left:${x1}%;width:${w}%;background:${bandColors[i % bandColors.length]}"></div>`;
      bandsHtml += `<div class="tl-period-line" style="left:${x1}%"></div>`;
      bandsHtml += `<div class="tl-period-label" style="left:${(parseFloat(x1) + parseFloat(w)/2).toFixed(1)}%">${p.label}</div>`;
    });
    bandsEl.innerHTML = bandsHtml;
  }

  const markersEl = document.getElementById('tl-markers');
  if (markersEl && session) {
    markersEl.innerHTML = session.tags.map(t => {
      const pct   = (t.time / maxT * 100).toFixed(2);
      const color = t.markColor || TAG_TYPES[t.type]?.color || '#aaa';
      const label = TAG_TYPES[t.type]?.label || t.type;
      const sel   = t.id === state.selectedTagId ? ' selected' : '';
      return `<div class="tl-marker${sel}" data-tag-id="${t.id}" style="left:${pct}%;background:${color}"
        title="${label}  ${formatTime(t.time)}" onclick="selectTag('${t.id}')">
        <button class="tl-marker-del" title="Löschen" onclick="event.stopPropagation();removeTag('${t.id}')">×</button>
      </div>`;
    }).join('');
  }

  const tl = document.getElementById('timeline-pro');
  if (tl && !tl._seekBound) {
    tl._seekBound = true;
    tl.addEventListener('click', e => {
      if (e.target.classList.contains('tl-marker')) return;
      const v = document.getElementById('video-player');
      if (!v || !v.duration) return;
      const rect = tl.getBoundingClientRect();
      v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
    });
  }
}

function startPlayheadUpdate() {
  if (_playheadRaf) cancelAnimationFrame(_playheadRaf);
  const video = document.getElementById('video-player');
  const head  = document.getElementById('tl-playhead');
  if (!video || !head) return;
  function tick() {
    if (video.duration > 0) {
      const pct = video.currentTime / video.duration * 100;
      head.style.left = pct.toFixed(3) + '%';
    }
    _playheadRaf = requestAnimationFrame(tick);
  }
  tick();
}

// ── Period bar ──
function renderPeriodBar() {
  const session = currentSession();
  if (!session) return;
  if (!session.periods) { session.periodMode = 'halves'; session.periods = defaultPeriods('halves'); }

  document.getElementById('pfmt-halves')?.classList.toggle('active', session.periodMode !== 'thirds');
  document.getElementById('pfmt-thirds')?.classList.toggle('active', session.periodMode === 'thirds');

  const pills = document.getElementById('period-pills');
  if (!pills) return;
  pills.innerHTML = session.periods.map((p, i) => `
    <button class="period-pill ${i === state.activePeriodIdx ? 'active' : ''}" onclick="selectPeriod(${i})">
      <span class="pp-label">${p.label}</span>
      <span class="pp-time">${p.startTime != null ? formatTime(p.startTime) : '—'}</span>
      <span class="pp-dir-group">
        <button class="pp-dir ${p.direction === 'ltr' ? 'active' : ''}" onclick="event.stopPropagation();setPeriodDir(${i},'ltr')" title="Links nach Rechts">→</button>
        <button class="pp-dir ${p.direction === 'rtl' ? 'active' : ''}" onclick="event.stopPropagation();setPeriodDir(${i},'rtl')" title="Rechts nach Links">←</button>
      </span>
    </button>`).join('');
}

function setPeriodMode(mode) {
  const session = currentSession();
  if (!session) return;
  session.periodMode = mode;
  session.periods    = defaultPeriods(mode);
  state.activePeriodIdx = 0;
  save();
  renderPeriodBar();
  renderTimelinePro();
}

function selectPeriod(idx) {
  state.activePeriodIdx = idx;
  renderPeriodBar();
  renderGoalLabels();
}

function setPeriodDir(idx, dir) {
  const session = currentSession();
  if (!session?.periods?.[idx]) return;
  session.periods[idx].direction = dir;
  save();
  renderPeriodBar();
  renderFieldDots();
  renderGoalLabels();
}

function renderStatsCards() {
  const el = document.getElementById('stats-cards');
  if (!el) return;
  const session = currentSession();
  if (!session) { el.innerHTML = ''; return; }
  const tags = session.tags;
  el.innerHTML = [
    { label: 'Schüsse',   type: 'schuss',   color: '#f87171' },
    { label: 'Pässe',     type: 'pass',     color: '#60a5fa' },
    { label: '1vs1',      type: '1vs1',     color: '#fb923c' },
    { label: 'Flanken',   type: 'flanke',   color: '#22d3ee' },
    { label: 'Fehler',    type: 'fehler',   color: '#94a3b8' },
    { label: 'Tore',      type: 'tor',      color: '#fbbf24' },
    { label: 'Gegentore', type: 'gegentor', color: '#f472b6' },
    { label: 'Gesamt',    type: null,       color: 'var(--text2)' },
  ].map(s => {
    const v = s.type ? tags.filter(t => t.type === s.type).length : tags.length;
    return `<div class="stat-card">
      <div class="stat-value" style="color:${s.color}">${v}</div>
      <div class="stat-label">${s.label}</div>
    </div>`;
  }).join('');
}

function renderFieldDots() {
  const dotsG   = document.getElementById('field-dots');
  const arrowsG = document.getElementById('field-arrows');
  if (!dotsG) return;
  const session = currentSession();
  if (!session) { dotsG.innerHTML = ''; if (arrowsG) arrowsG.innerHTML = ''; return; }

  const t = state.selectedTagId ? session.tags.find(tag => tag.id === state.selectedTagId) : null;
  if (!t || t.x == null) {
    dotsG.innerHTML = '';
    if (arrowsG) arrowsG.innerHTML = '';
    return;
  }

  const dir   = t.direction || 'ltr';
  const rx    = dir === 'rtl' ? -t.x : t.x;
  const { svgX, svgY } = coordToSvg(rx, t.y);
  const color = t.markColor || TAG_TYPES[t.type]?.color || '#aaa';

  let dotsHtml = '', arrowsHtml = '';
  if (t.x2 != null && t.y2 != null) {
    const rx2 = dir === 'rtl' ? -t.x2 : t.x2;
    const { svgX: sx2, svgY: sy2 } = coordToSvg(rx2, t.y2);
    arrowsHtml += arrowSvg(svgX, svgY, sx2, sy2, color, 2.5);
    arrowsHtml += `<circle cx="${svgX.toFixed(1)}" cy="${svgY.toFixed(1)}" r="5" fill="${color}" opacity="0.9"/>`;
  } else {
    const r = t.type === 'markierung' ? 6 : 8;
    dotsHtml += `<circle cx="${svgX.toFixed(1)}" cy="${svgY.toFixed(1)}" r="${r}"
      fill="${color}" fill-opacity="0.85" stroke="${color}" stroke-width="2" pointer-events="none"/>`;
  }

  dotsG.innerHTML  = dotsHtml;
  if (arrowsG) arrowsG.innerHTML = arrowsHtml;
}

function renderGoalLabels() {
  const legend  = document.querySelector('.field-legend');
  const session = currentSession();
  const period  = session?.periods?.[state.activePeriodIdx];
  const dir     = period?.direction || 'ltr';

  const leftIsOwn  = dir === 'ltr';
  const leftLabel  = leftIsOwn ? 'Eigenes Tor'      : 'Gegnerisches Tor';
  const rightLabel = leftIsOwn ? 'Gegnerisches Tor' : 'Eigenes Tor';
  const leftColor  = leftIsOwn ? '#10b981' : '#ef4444';
  const rightColor = leftIsOwn ? '#ef4444' : '#10b981';

  if (legend) {
    legend.innerHTML = `
      <span style="color:${leftColor}">← ${leftLabel}</span>
      <span style="color:${rightColor}">${rightLabel} →</span>
    `;
  }
}

function jumpToTag(tagId) {
  const session = currentSession();
  if (!session) return;
  const tag   = session.tags.find(t => t.id === tagId);
  const video = document.getElementById('video-player');
  if (tag && video) { try { video.currentTime = tag.time; } catch (_) {} }
}

// ── Tag actions ──
function tagHintText(type, step) {
  if (!type) return '';
  if (TAG_TYPES[type]?.arrow) return step === 2 ? '2. Klick: Endpunkt setzen' : '1. Klick: Startpunkt setzen';
  return 'Punkt auf dem Spielfeld setzen';
}

function setActiveTag(type) {
  state.pendingTagType    = type;
  state.pendingArrowStart = null;
  const prevG = document.getElementById('field-arrow-preview');
  if (prevG) prevG.innerHTML = '';

  document.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  const field = document.getElementById('football-field');
  field?.classList.toggle('awaiting-zone', !!type);

  // Active tag bar
  const atb   = document.getElementById('active-tag-bar');
  const badge = document.getElementById('atb-badge');
  if (atb && badge) {
    if (type) {
      const tt = TAG_TYPES[type];
      badge.textContent   = tt.label;
      badge.style.cssText = `background:${tt.color}22;color:${tt.color};border-color:${tt.color}55`;
      atb.classList.remove('hidden');
      refreshPlayerSelects();
    } else {
      atb.classList.add('hidden');
    }
  }

  // Field hint (right panel, above SVG)
  const fh = document.getElementById('field-hint');
  if (fh) fh.textContent = type ? tagHintText(type, 1) : '';

  const mc = document.getElementById('mark-colors');
  if (mc) mc.classList.toggle('visible', type === 'markierung');
}

function setMarkColor(color) {
  state.markColor = color;
  document.querySelectorAll('.mark-color-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.color === color));
}

function getActivePeriod(session, time) {
  const sorted = (session.periods || [])
    .filter(p => p.startTime != null)
    .sort((a, b) => a.startTime - b.startTime);
  let current = sorted[0] || session.periods?.[0];
  for (const p of sorted) { if (time >= p.startTime) current = p; }
  return current;
}

function addTag(svgX, svgY, svgX2, svgY2) {
  const session = currentSession();
  if (!session || !state.pendingTagType) return;
  const video       = document.getElementById('video-player');
  const time        = (video && !isNaN(video.currentTime)) ? video.currentTime : 0;
  const period      = getActivePeriod(session, time);
  const direction   = period?.direction || 'ltr';
  const periodLabel = period?.label || '—';
  const { x, y }   = svgToCoord(svgX, svgY);
  const playerId    = document.getElementById('tag-player-select')?.value || '';
  const markColor   = state.pendingTagType === 'markierung' ? state.markColor : undefined;

  const tag = { id: uid(), type: state.pendingTagType, x, y, playerId, time, direction, periodLabel, markColor };

  if (svgX2 != null && svgY2 != null) {
    const end = svgToCoord(svgX2, svgY2);
    tag.x2 = end.x;
    tag.y2 = end.y;
  }

  session.tags.push(tag);
  save();
  renderAnalysis();

  const prevG = document.getElementById('field-arrow-preview');
  if (prevG) prevG.innerHTML = '';

  if (TAG_TYPES[state.pendingTagType]?.goalForm) {
    showGoalForm(tag.id);
  }
}

function removeTag(id) {
  const session = currentSession();
  if (!session) return;
  session.tags = session.tags.filter(t => t.id !== id);
  if (state.selectedTagId === id) state.selectedTagId = null;
  save();
  renderAnalysis();
}

function selectTag(id) {
  state.selectedTagId = (state.selectedTagId === id) ? null : id;
  renderFieldDots();
  document.querySelectorAll('.tag-row[data-tag-id]').forEach(row =>
    row.classList.toggle('selected', row.dataset.tagId === state.selectedTagId));
  document.querySelectorAll('.tl-marker[data-tag-id]').forEach(m =>
    m.classList.toggle('selected', m.dataset.tagId === state.selectedTagId));
  if (state.selectedTagId) jumpToTag(state.selectedTagId);
}

// ── Goal form ──
function showGoalForm(tagId) {
  _goalFormTagId = tagId;
  _goalFormFoot  = '';
  const session = currentSession();
  const tag     = session?.tags.find(t => t.id === tagId);
  if (!tag) return;

  const gf = document.getElementById('goal-form');
  if (!gf) return;

  const titleEl = document.getElementById('gf-title');
  if (titleEl) titleEl.textContent = tag.type === 'tor' ? 'Tor — Details' : 'Gegentor — Details';

  const assistSel = document.getElementById('gf-assist');
  if (assistSel) {
    const ownOpts = state.players.map(p =>
      `<option value="${p.id}">${p.number ? '#' + p.number + ' ' : ''}${esc(p.name)}</option>`).join('');
    const oppOpts = (state.opponents || []).flatMap(t =>
      (t.players || []).map(p =>
        `<option value="${p.id}">${p.number ? '#' + p.number + ' ' : ''}${esc(p.name)} (${esc(t.name)})</option>`)
    ).join('');
    assistSel.innerHTML = '<option value="">— kein Assist —</option>' + ownOpts +
      (oppOpts ? `<optgroup label="Gegner">${oppOpts}</optgroup>` : '');
    assistSel.value = '';
  }

  document.querySelectorAll('.gf-foot-btn').forEach(b => b.classList.toggle('active', b.dataset.foot === ''));
  gf.classList.remove('hidden');
}

function closeGoalForm() {
  _goalFormTagId = null;
  _goalFormFoot  = '';
  document.getElementById('goal-form')?.classList.add('hidden');
}

function saveGoalForm() {
  const session = currentSession();
  if (session && _goalFormTagId) {
    const tag = session.tags.find(t => t.id === _goalFormTagId);
    if (tag) {
      tag.assistPlayerId = document.getElementById('gf-assist')?.value || '';
      tag.foot           = _goalFormFoot;
      save();
      renderTagList();
    }
  }
  closeGoalForm();
}

// ── Players Page ──
function renderPlayers() {
  const container = document.getElementById('players-grid');
  if (!container) return;

  const addBtn = document.getElementById('btn-add-player');
  if (addBtn) {
    addBtn.textContent = state.playerTab === 'opponents' ? '+ Gegner-Team' : '+ Spieler hinzufügen';
  }

  const tabHtml = `<div class="tab-bar">
    <button class="tab-btn ${state.playerTab === 'own' ? 'active' : ''}" onclick="setPlayerTab('own')">
      Eigenes Team <span style="margin-left:4px;font-size:11px;opacity:0.6">${state.players.length}</span>
    </button>
    <button class="tab-btn ${state.playerTab === 'opponents' ? 'active' : ''}" onclick="setPlayerTab('opponents')">
      Gegner-Teams <span style="margin-left:4px;font-size:11px;opacity:0.6">${state.opponents.length}</span>
    </button>
  </div>`;

  if (state.playerTab === 'own') {
    renderOwnTeam(container, tabHtml);
  } else {
    renderOpponentTeams(container, tabHtml);
  }
}

function renderOwnTeam(container, tabHtml) {
  if (!state.players.length) {
    container.innerHTML = tabHtml + `<div class="empty-state">
      <h3>Noch keine Spieler</h3>
      <p>Füge deine Spieler hinzu, um sie beim Taggen zu verknüpfen.</p>
      <button class="btn btn-primary" onclick="showAddPlayerModal()">+ Spieler hinzufügen</button>
    </div>`;
    return;
  }

  const allTags = state.sessions.flatMap(s => s.tags);
  const cardsHtml = `<div class="players-grid">${state.players.map(p => {
    const tagCount = allTags.filter(t => t.playerId === p.id).length;
    const goals    = allTags.filter(t => t.playerId === p.id && t.type === 'tor').length;
    const assists  = allTags.filter(t => t.assistPlayerId === p.id).length;
    return `<div class="player-card" onclick="showPlayerDetail('${p.id}')" style="cursor:pointer">
      <button class="btn-delete" onclick="event.stopPropagation();deletePlayer('${p.id}')">✕</button>
      <div class="player-number">${esc(p.number || '?')}</div>
      <div class="player-info">
        <div class="player-name">${esc(p.name)}</div>
        <div class="player-pos">${esc(p.position || '—')}</div>
        <div class="player-tags">${tagCount} Tags</div>
        ${goals   ? `<div style="font-size:10px;color:#fbbf24;margin-top:2px">${goals} Tor${goals > 1 ? 'e' : ''}</div>` : ''}
        ${assists ? `<div style="font-size:10px;color:#10b981;margin-top:2px">${assists} Assist${assists > 1 ? 's' : ''}</div>` : ''}
        ${p.notes ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">Notiz vorhanden</div>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;

  container.innerHTML = tabHtml + cardsHtml;
}

function renderOpponentTeams(container, tabHtml) {
  if (!state.opponents.length) {
    container.innerHTML = tabHtml + `<div class="empty-state">
      <h3>Noch keine Gegner-Teams</h3>
      <p>Füge Gegner-Teams hinzu, um deren Kader zu verwalten.</p>
      <button class="btn btn-primary" onclick="showAddOpponentTeamModal()">+ Gegner-Team hinzufügen</button>
    </div>`;
    return;
  }

  const allTags = state.sessions.flatMap(s => s.tags);
  const cardsHtml = `<div class="sessions-grid">${state.opponents.map(t => {
    const playerIds  = (t.players || []).map(p => p.id);
    const teamTags   = allTags.filter(tag => playerIds.includes(tag.playerId));
    const teamGoals  = teamTags.filter(tag => tag.type === 'tor').length;
    return `<div class="session-card" onclick="showOpponentTeamModal('${t.id}')" style="position:relative">
      <button class="btn-delete" onclick="event.stopPropagation();deleteOpponentTeam('${t.id}')" style="position:absolute;top:10px;right:10px;opacity:0">✕</button>
      <div class="session-card-header">
        <span class="session-type-badge" style="background:rgba(239,68,68,0.12);color:#ef4444">Gegner</span>
        <span class="session-date">${(t.players || []).length} Spieler</span>
      </div>
      <h3 class="session-name">${esc(t.name)}</h3>
      <div class="session-stats">
        <span>${teamTags.length} Tags</span>
        ${teamGoals ? `<span>${teamGoals} Gegentore</span>` : ''}
        <span style="color:var(--accent)">Kader ansehen</span>
      </div>
    </div>`;
  }).join('')}</div>`;

  container.innerHTML = tabHtml + cardsHtml;
}

function setPlayerTab(tab) {
  state.playerTab = tab;
  renderPlayers();
}

function deletePlayer(id) {
  state.players = state.players.filter(p => p.id !== id);
  save();
  renderPlayers();
  refreshPlayerSelects();
}

function deleteOpponentTeam(teamId) {
  state.opponents = state.opponents.filter(t => t.id !== teamId);
  save();
  renderPlayers();
  refreshPlayerSelects();
}

function deleteOpponentPlayer(teamId, playerId) {
  const team = state.opponents.find(t => t.id === teamId);
  if (!team) return;
  team.players = (team.players || []).filter(p => p.id !== playerId);
  save();
  refreshPlayerSelects();
  showOpponentTeamModal(teamId);
}

// ── Opponent team modal ──
function showOpponentTeamModal(teamId) {
  const team    = state.opponents.find(t => t.id === teamId);
  if (!team) return;
  const players = team.players || [];
  const allTags = state.sessions.flatMap(s => s.tags);

  const rosterHtml = players.length
    ? players.map(p => {
        const tagCount = allTags.filter(t => t.playerId === p.id).length;
        const goals    = allTags.filter(t => t.playerId === p.id && t.type === 'tor').length;
        return `<div class="opp-player-row">
          <div class="opp-player-num">${esc(p.number || '?')}</div>
          <div class="opp-player-info">
            <span class="opp-player-name">${esc(p.name)}</span>
            <span class="opp-player-pos">${esc(p.position || '—')}</span>
          </div>
          <div class="opp-player-stats">
            ${tagCount ? `<span class="opp-player-tag-count">${tagCount} Tags</span>` : ''}
            ${goals    ? `<span style="color:#fbbf24;font-size:10px">${goals} Tore</span>` : ''}
          </div>
          <button class="btn-delete" onclick="deleteOpponentPlayer('${teamId}','${p.id}')">✕</button>
        </div>`;
      }).join('')
    : `<p style="color:var(--text3);font-size:12px;padding:8px 0">Noch kein Spieler im Kader.</p>`;

  showModal(
    esc(team.name),
    `<div style="display:flex;flex-direction:column;gap:10px">
      <div class="opp-player-list">${rosterHtml}</div>
      <button class="btn btn-secondary btn-sm" style="align-self:flex-start"
        onclick="showAddOpponentPlayerModal('${teamId}')">+ Spieler hinzufügen</button>
    </div>`,
    null
  );
}

function showAddOpponentTeamModal() {
  showModal('Gegner-Team hinzufügen', `
    <div class="modal-form">
      <div class="form-group"><label>Team-Name *</label>
        <input id="f-tname" type="text" placeholder="z.B. FC Bayern" autofocus /></div>
    </div>`, () => {
    const name = document.getElementById('f-tname').value.trim();
    if (!name) return;
    state.opponents.push({ id: uid(), name, players: [] });
    save();
    closeModal();
    renderPlayers();
    refreshPlayerSelects();
  });
}

function showAddOpponentPlayerModal(teamId) {
  const team = state.opponents.find(t => t.id === teamId);
  if (!team) return;
  closeModal();
  setTimeout(() => {
    showModal(`Spieler — ${esc(team.name)}`, `
      <div class="modal-form">
        <div class="form-group"><label>Name *</label>
          <input id="f-opname" type="text" placeholder="z.B. Müller" /></div>
        <div class="form-group"><label>Trikotnummer</label>
          <input id="f-opnum" type="number" min="1" max="99" placeholder="z.B. 9" /></div>
        <div class="form-group"><label>Position</label>
          <select id="f-oppos">
            <option value="">—</option>
            <option>Torwart</option><option>Innenverteidiger</option><option>Außenverteidiger</option>
            <option>Defensives Mittelfeld</option><option>Zentrales Mittelfeld</option>
            <option>Offensives Mittelfeld</option><option>Flügelspieler</option><option>Stürmer</option>
          </select></div>
      </div>`, () => {
      const name = document.getElementById('f-opname').value.trim();
      if (!name) return;
      if (!team.players) team.players = [];
      team.players.push({
        id:       uid(),
        name,
        number:   document.getElementById('f-opnum').value,
        position: document.getElementById('f-oppos').value,
      });
      save();
      closeModal();
      refreshPlayerSelects();
      if (state.currentPage === 'players') renderPlayers();
      setTimeout(() => showOpponentTeamModal(teamId), 80);
    });
  }, 50);
}

// ── Own player detail ──
function showPlayerDetail(id) {
  const p = state.players.find(pl => pl.id === id);
  if (!p) return;
  p.notes      = p.notes      || '';
  p.strengths  = p.strengths  || '';
  p.weaknesses = p.weaknesses || '';
  p.pdfs       = p.pdfs       || [];

  const allTags = state.sessions.flatMap(s => s.tags);
  const pt      = allTags.filter(t => t.playerId === id);
  const goals   = pt.filter(t => t.type === 'tor').length;
  const assists = allTags.filter(t => t.assistPlayerId === id).length;

  const statRows = Object.entries(TAG_TYPES).map(([type, info]) => {
    const n = pt.filter(t => t.type === type).length;
    return n ? `<span class="pd-stat" style="background:${info.color}18;color:${info.color};border-color:${info.color}44">${info.label}: ${n}</span>` : '';
  }).join('');

  const goalAssistRow = (goals || assists) ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${goals   ? `<span class="pd-stat" style="background:#fbbf2418;color:#fbbf24;border-color:#fbbf2444">Tore: ${goals}</span>` : ''}
      ${assists ? `<span class="pd-stat" style="background:#10b98118;color:#10b981;border-color:#10b98144">Assists: ${assists}</span>` : ''}
    </div>` : '';

  showModal(
    `${p.number ? '#' + p.number + ' ' : ''}${esc(p.name)}`,
    `<div style="display:flex;flex-direction:column;gap:14px">
      <div class="player-detail-stats">${statRows || '<span style="color:var(--text3);font-size:12px">Noch keine Tags</span>'}</div>
      ${goalAssistRow}
      <div class="form-group"><label>Notizen</label>
        <textarea id="pd-notes" rows="3" placeholder="Beobachtungen, Taktik...">${esc(p.notes)}</textarea></div>
      <div class="form-group"><label>Stärken</label>
        <textarea id="pd-strengths" rows="2" placeholder="z.B. Zweikampf, Pressing...">${esc(p.strengths)}</textarea></div>
      <div class="form-group"><label>Schwächen</label>
        <textarea id="pd-weaknesses" rows="2" placeholder="z.B. Rückwärtsbewegung...">${esc(p.weaknesses)}</textarea></div>
      <div class="form-group">
        <label>PDF-Dokumente</label>
        <div class="pdf-list" id="pd-pdf-list">${renderPdfList(p)}</div>
        <label class="btn btn-secondary btn-sm" style="width:fit-content" for="pd-pdf-upload">
          + PDF hinzufügen
          <input type="file" id="pd-pdf-upload" accept=".pdf" hidden />
        </label>
      </div>
    </div>`,
    () => {
      p.notes      = document.getElementById('pd-notes')?.value      || '';
      p.strengths  = document.getElementById('pd-strengths')?.value  || '';
      p.weaknesses = document.getElementById('pd-weaknesses')?.value || '';
      save(); closeModal(); renderPlayers();
    }
  );
  document.querySelector('.modal-confirm').textContent = 'Speichern';
  setTimeout(() => {
    document.getElementById('pd-pdf-upload')?.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      p.pdfs.push({ name: f.name, url: URL.createObjectURL(f) });
      save();
      document.getElementById('pd-pdf-list').innerHTML = renderPdfList(p);
    });
  }, 50);
}

function renderPdfList(p) {
  return (p.pdfs || []).map((pdf, i) =>
    `<div class="pdf-item">
      <a href="${pdf.url}" target="_blank">${esc(pdf.name)}</a>
      <button class="btn-delete" onclick="removePlayerPdf('${p.id}',${i})">✕</button>
    </div>`
  ).join('') || '<span style="font-size:12px;color:var(--text3)">Keine PDFs</span>';
}

function removePlayerPdf(playerId, index) {
  const p = state.players.find(pl => pl.id === playerId);
  if (!p) return;
  p.pdfs.splice(index, 1);
  save();
  const el = document.getElementById('pd-pdf-list');
  if (el) el.innerHTML = renderPdfList(p);
}

// ── Reports Page ──
function renderReports() {
  const el = document.getElementById('reports-content');
  if (!el) return;
  const allTags = state.sessions.flatMap(s => s.tags);

  if (!allTags.length && !state.sessions.length) {
    el.innerHTML = `<div class="empty-state">
      <h3>Noch keine Daten</h3>
      <p>Erstelle Sessions und setze Tags, um hier Insights zu sehen.</p>
    </div>`;
    return;
  }

  const playerStats = allPlayers().map(p => {
    const pt      = allTags.filter(t => t.playerId === p.id);
    const goals   = pt.filter(t => t.type === 'tor').length;
    const assists = allTags.filter(t => t.assistPlayerId === p.id).length;
    return { p, total: pt.length,
      schuss: pt.filter(t => t.type === 'schuss').length,
      goals, assists,
      fehler: pt.filter(t => t.type === 'fehler').length };
  }).filter(x => x.total > 0 || x.assists > 0).sort((a, b) => b.total - a.total);

  const goalTags = allTags
    .filter(t => t.type === 'tor' || t.type === 'gegentor')
    .sort((a, b) => b.time - a.time);

  const maxTagCount = Math.max(1, ...Object.keys(TAG_TYPES).map(type => allTags.filter(t => t.type === type).length));

  // Per-session stats
  const sessionRows = state.sessions.map(s => {
    const shots   = s.tags.filter(t => t.type === 'schuss').length;
    const passes  = s.tags.filter(t => t.type === 'pass').length;
    const goals   = s.tags.filter(t => t.type === 'tor').length;
    const against = s.tags.filter(t => t.type === 'gegentor').length;
    const total   = s.tags.length;
    const typeBadge = s.type === 'Training' ? 'badge-training' : 'badge-spiel';
    return `<div class="srr" onclick="navigate('analysis','${s.id}')">
      <div class="srr-info">
        <span class="srr-name">${esc(s.name)}</span>
        <span class="srr-meta">${s.date}${s.opponent ? ' · vs. ' + esc(s.opponent) : ''} · <span class="session-type-badge ${typeBadge}">${esc(s.type)}</span></span>
      </div>
      <div class="srr-stats">
        <div class="srr-stat"><div class="srr-val" style="color:#ef4444">${shots}</div><div class="srr-lbl">Schüsse</div></div>
        <div class="srr-stat"><div class="srr-val" style="color:#3b82f6">${passes}</div><div class="srr-lbl">Pässe</div></div>
        <div class="srr-stat"><div class="srr-val" style="color:#fbbf24">${goals}</div><div class="srr-lbl">Tore</div></div>
        <div class="srr-stat"><div class="srr-val" style="color:#dc2626">${against}</div><div class="srr-lbl">Gegen</div></div>
        <div class="srr-stat srr-total"><div class="srr-val">${total}</div><div class="srr-lbl">Tags</div></div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="reports-overview-row">
      <div class="overview-card">
        <div class="overview-card-value">${state.sessions.length}</div>
        <div class="overview-card-label">Sessions</div>
      </div>
      <div class="overview-card">
        <div class="overview-card-value">${allTags.length}</div>
        <div class="overview-card-label">Tags gesamt</div>
      </div>
      <div class="overview-card">
        <div class="overview-card-value" style="color:#fbbf24">${allTags.filter(t=>t.type==='tor').length}</div>
        <div class="overview-card-label">Tore</div>
      </div>
      <div class="overview-card">
        <div class="overview-card-value" style="color:#dc2626">${allTags.filter(t=>t.type==='gegentor').length}</div>
        <div class="overview-card-label">Gegentore</div>
      </div>
    </div>

    <div class="reports-section">
      <div class="reports-section-title">Tag-Übersicht</div>
      <div class="report-card">
        <div class="tag-overview-grid">
          ${Object.entries(TAG_TYPES).map(([type, info]) => {
            const count = allTags.filter(t => t.type === type).length;
            const pct   = (count / maxTagCount * 100).toFixed(1);
            return `<div class="tag-ov-row">
              <span class="tag-ov-badge" style="background:${info.color}22;color:${info.color};border-color:${info.color}44">${info.label}</span>
              <div class="tag-ov-bar"><div class="tag-ov-fill" style="width:${pct}%;background:${info.color}"></div></div>
              <span class="tag-ov-count" style="color:${info.color}">${count}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    ${state.sessions.length ? `
    <div class="reports-section">
      <div class="reports-section-title">Sessions</div>
      <div class="srr-list">${sessionRows}</div>
    </div>` : ''}

    <div class="reports-section">
      <div class="reports-section-title">Tore &amp; Assists</div>
      <div class="report-card">
        <div class="goal-log">
          ${goalTags.length ? goalTags.slice(0, 12).map(t => {
            const scorer = findPlayerById(t.playerId);
            const assist = findPlayerById(t.assistPlayerId);
            const foot   = t.foot ? ' · ' + t.foot.charAt(0).toUpperCase() + t.foot.slice(1) : '';
            const isGoal = t.type === 'tor';
            return `<div class="goal-log-entry">
              <span class="gl-type-badge" style="background:${isGoal?'rgba(251,191,36,0.12)':'rgba(220,38,38,0.12)'};color:${isGoal?'#fbbf24':'#dc2626'};border-color:${isGoal?'rgba(251,191,36,0.3)':'rgba(220,38,38,0.3)'}">${isGoal?'Tor':'Gegentor'}</span>
              <span class="gl-time">${formatTime(t.time)}</span>
              <span class="gl-scorer">${scorer ? esc(scorer.name) + foot : '—'}</span>
              ${assist ? `<span class="gl-assist">Vorlage: ${esc(assist.name)}</span>` : ''}
            </div>`;
          }).join('') : '<span style="font-size:12px;color:var(--text3)">Keine Tore erfasst</span>'}
        </div>
      </div>
    </div>

    ${playerStats.length ? `
    <div class="reports-section">
      <div class="reports-section-title">Spieler-Statistiken</div>
      <div class="report-card">
        <table class="report-table">
          <thead><tr>
            <th>Spieler</th><th>Schüsse</th><th>Tore</th><th>Assists</th><th>Fehler</th><th>Gesamt</th>
          </tr></thead>
          <tbody>${playerStats.map(ps => `<tr>
            <td>${ps.p.number ? '<span style="color:var(--accent);font-weight:700">#' + ps.p.number + '</span> ' : ''}${esc(ps.p.name)}${ps.p._teamName ? `<span style="font-size:10px;color:var(--text3)"> · ${esc(ps.p._teamName)}</span>` : ''}</td>
            <td><span style="color:#ef4444">${ps.schuss}</span></td>
            <td><span style="color:#fbbf24">${ps.goals}</span></td>
            <td><span style="color:#10b981">${ps.assists}</span></td>
            <td><span style="color:#eab308">${ps.fehler}</span></td>
            <td><strong style="color:var(--text)">${ps.total}</strong></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
  `;
}

// ── Modals ──
function showModal(title, body, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-overlay').classList.remove('hidden');
  if (onConfirm) {
    const btn = Object.assign(document.createElement('button'), { className: 'btn btn-primary modal-confirm', textContent: 'Erstellen' });
    btn.onclick = onConfirm;
    document.getElementById('modal-body').appendChild(btn);
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function showNewSessionModal() {
  showModal('Neue Session', `
    <div class="modal-form">
      <div class="form-group"><label>Name *</label>
        <input id="f-name" type="text" placeholder="z.B. Heimspiel vs. FC Bayern" /></div>
      <div class="form-group"><label>Datum *</label>
        <input id="f-date" type="date" value="${new Date().toISOString().slice(0,10)}" /></div>
      <div class="form-group"><label>Gegner</label>
        <input id="f-opp" type="text" placeholder="z.B. FC Bayern" /></div>
      <div class="form-group"><label>Typ</label>
        <select id="f-type"><option value="Spiel">Spiel</option><option value="Training">Training</option></select></div>
    </div>`, () => {
    const name = document.getElementById('f-name').value.trim();
    const date = document.getElementById('f-date').value;
    if (!name || !date) return;
    const session = { id: uid(), name, date,
      opponent:   document.getElementById('f-opp').value.trim(),
      type:       document.getElementById('f-type').value,
      tags:       [],
      periodMode: 'halves',
      periods:    defaultPeriods('halves') };
    state.sessions.unshift(session);
    save();
    closeModal();
    navigate('analysis', session.id);
  });
}

function showAddPlayerModal() {
  showModal('Spieler hinzufügen', `
    <div class="modal-form">
      <div class="form-group"><label>Name *</label>
        <input id="f-pname" type="text" placeholder="z.B. Müller" /></div>
      <div class="form-group"><label>Trikotnummer (1–99)</label>
        <input id="f-pnum" type="number" min="1" max="99" placeholder="z.B. 10" /></div>
      <div class="form-group"><label>Position</label>
        <select id="f-ppos">
          <option value="">—</option>
          <option>Torwart</option><option>Innenverteidiger</option><option>Außenverteidiger</option>
          <option>Defensives Mittelfeld</option><option>Zentrales Mittelfeld</option>
          <option>Offensives Mittelfeld</option><option>Flügelspieler</option><option>Stürmer</option>
        </select></div>
    </div>`, () => {
    const name = document.getElementById('f-pname').value.trim();
    if (!name) return;
    state.players.push({ id: uid(), name,
      number:   document.getElementById('f-pnum').value,
      position: document.getElementById('f-ppos').value });
    save();
    closeModal();
    renderPlayers();
    refreshPlayerSelects();
  });
}

// ── Anleitung ──
function showAnleitung() {
  showModal('Anleitung', `
    <div style="display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--text2);line-height:1.7">
      <div>
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">Sessions</div>
        Erstelle eine Session pro Spiel oder Training. Jede Session enthält Video, Tags und Perioden.
      </div>
      <div>
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">Video &amp; Perioden</div>
        Lade ein Video hoch und setze die Startzeiten der Halbzeiten mit "Zeit setzen". Wähle zwischen 2 Halbzeiten oder 3 Dritteln. Die Spielrichtung pro Periode ist per Pfeil-Button einstellbar.
      </div>
      <div>
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">Tags setzen</div>
        Wähle einen Tag-Typ (Schuss, Pass, …) und klicke auf das Spielfeld. Bei Schuss, Flanke und Tor: 2 Klicks für einen Richtungspfeil. ESC bricht den aktiven Tag ab.
      </div>
      <div>
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">Spieler &amp; Tor-Details</div>
        Nach dem Setzen eines Tags den beteiligten Spieler in der Leiste auswählen. Bei Tor/Gegentor können Vorlage und Art (Stark/Schwach/Kopf) ergänzt werden.
      </div>
      <div>
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">Timeline</div>
        Klick auf einen Marker oder direkt in die Timeline springt das Video zur entsprechenden Stelle. Video-Geschwindigkeit im Header einstellbar.
      </div>
    </div>
  `);
}

// ── Video speed ──
function setVideoSpeed(speed) {
  const video = document.getElementById('video-player');
  if (video) video.playbackRate = speed;
  document.querySelectorAll('.speed-btn').forEach(b =>
    b.classList.toggle('active', Number(b.dataset.speed) === speed));
}

// ── Escape HTML ──
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Excel Export ──
function exportExcel() {
  if (typeof XLSX === 'undefined') { alert('Excel-Bibliothek lädt noch — bitte kurz warten.'); return; }
  const wb = XLSX.utils.book_new();
  const allTagsFlat = state.sessions.flatMap(s => s.tags);

  // Sheet 1: Session-Übersicht
  const s1 = [['Session','Datum','Typ','Gegner','Modus','Schüsse','Pässe','Flanken','Vorlagen','1vs1','Fehler','Markierungen','Tore','Gegentore','Gesamt']];
  state.sessions.forEach(s => {
    const t = s.tags;
    s1.push([s.name, s.date, s.type, s.opponent||'—',
      s.periodMode==='thirds'?'3 Drittel':'2 Halbzeiten',
      t.filter(x=>x.type==='schuss').length,
      t.filter(x=>x.type==='pass').length,
      t.filter(x=>x.type==='flanke').length,
      t.filter(x=>x.type==='vorlage').length,
      t.filter(x=>x.type==='1vs1').length,
      t.filter(x=>x.type==='fehler').length,
      t.filter(x=>x.type==='markierung').length,
      t.filter(x=>x.type==='tor').length,
      t.filter(x=>x.type==='gegentor').length,
      t.length,
    ]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(s1);
  ws1['!cols'] = [20,12,10,16,14,9,7,9,9,7,8,13,7,10,8].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws1, 'Sessions');

  // Sheet 2: Alle Tags (Detailansicht)
  const s2 = [['Session','Datum','Zeit','Periode','Aktion','Spieler','Start-Koordinate','End-Koordinate','Fuß','Vorlage von']];
  state.sessions.forEach(s => {
    s.tags.slice().sort((a,b)=>a.time-b.time).forEach(t => {
      const pl  = findPlayerById(t.playerId);
      const ast = findPlayerById(t.assistPlayerId);
      const tt  = TAG_TYPES[t.type];
      s2.push([
        s.name, s.date,
        formatTime(t.time),
        t.periodLabel || t.half || '—',
        tt?.label || t.type,
        pl ? (pl.number?'#'+pl.number+' ':'')+pl.name : '—',
        t.x  != null ? displayCoord(t.x,  t.y,  t.direction) : '—',
        t.x2 != null ? displayCoord(t.x2, t.y2, t.direction) : '—',
        t.foot || '—',
        ast ? ast.name : '—',
      ]);
    });
  });
  const ws2 = XLSX.utils.aoa_to_sheet(s2);
  ws2['!cols'] = [20,12,7,10,12,16,16,16,8,16].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws2, 'Alle Tags');

  // Sheet 3: Spieler-Statistiken
  const players = allPlayers().map(p => {
    const pt  = allTagsFlat.filter(t=>t.playerId===p.id);
    const ast = allTagsFlat.filter(t=>t.assistPlayerId===p.id).length;
    return { p, pt, ast };
  }).filter(x=>x.pt.length>0||x.ast>0).sort((a,b)=>b.pt.length-a.pt.length);

  if (players.length) {
    const s3 = [['Spieler','#','Position','Schüsse','Tore','Assists','Pässe','Flanken','Vorlagen','1vs1','Fehler','Gesamt']];
    players.forEach(({p,pt,ast}) => s3.push([
      p.name, p.number||'—', p.position||'—',
      pt.filter(t=>t.type==='schuss').length,
      pt.filter(t=>t.type==='tor').length,
      ast,
      pt.filter(t=>t.type==='pass').length,
      pt.filter(t=>t.type==='flanke').length,
      pt.filter(t=>t.type==='vorlage').length,
      pt.filter(t=>t.type==='1vs1').length,
      pt.filter(t=>t.type==='fehler').length,
      pt.length,
    ]));
    const ws3 = XLSX.utils.aoa_to_sheet(s3);
    ws3['!cols'] = [16,5,14,9,7,8,7,9,9,7,8,8].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb, ws3, 'Spieler');
  }

  const date = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `scoutingtoolz_${date}.xlsx`);
}

// ── Init ──
function init() {
  load();

  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); }));

  document.getElementById('btn-new-session').addEventListener('click', showNewSessionModal);
  document.getElementById('btn-create-session').addEventListener('click', showNewSessionModal);
  document.getElementById('btn-open-session')?.addEventListener('click', showNewSessionModal);
  document.getElementById('btn-anleitung')?.addEventListener('click', showAnleitung);

  document.getElementById('btn-add-player').addEventListener('click', () => {
    if (state.playerTab === 'opponents') showAddOpponentTeamModal();
    else showAddPlayerModal();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  document.getElementById('video-upload').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const video = document.getElementById('video-player');
    const ph    = document.getElementById('video-placeholder');
    video.src = URL.createObjectURL(file);
    video.style.display = 'block';
    ph.style.display    = 'none';
    video.addEventListener('loadedmetadata', () => { renderTimelinePro(); startPlayheadUpdate(); });
  });

  document.getElementById('btn-set-period').addEventListener('click', () => {
    const s = currentSession(); if (!s) return;
    const v = document.getElementById('video-player');
    const t = (v && !isNaN(v.currentTime)) ? v.currentTime : 0;
    if (!s.periods) { s.periodMode = 'halves'; s.periods = defaultPeriods('halves'); }
    s.periods[state.activePeriodIdx].startTime = t;
    save(); renderPeriodBar(); renderTimelinePro();
  });

  document.querySelectorAll('.tag-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      if (!currentSession()) { showNewSessionModal(); return; }
      setActiveTag(state.pendingTagType === btn.dataset.type ? null : btn.dataset.type);
    }));

  // Goal form
  document.getElementById('gf-save')?.addEventListener('click', saveGoalForm);
  document.getElementById('gf-skip')?.addEventListener('click', closeGoalForm);
  document.querySelectorAll('.gf-foot-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      _goalFormFoot = btn.dataset.foot;
      document.querySelectorAll('.gf-foot-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.foot === _goalFormFoot));
    }));

  // Speed controls
  document.querySelectorAll('.speed-btn').forEach(btn =>
    btn.addEventListener('click', () => setVideoSpeed(Number(btn.dataset.speed))));

  // Field overlay
  const overlay  = document.getElementById('field-overlay');
  const svg      = document.getElementById('football-field');
  const cursor   = document.getElementById('field-cursor');
  const coordTxt = document.getElementById('field-coords');

  overlay.addEventListener('click', e => {
    if (!state.pendingTagType) return;
    const pt      = screenToSvg(svg, e.clientX, e.clientY);
    const tagInfo = TAG_TYPES[state.pendingTagType];

    if (tagInfo?.arrow) {
      if (!state.pendingArrowStart) {
        state.pendingArrowStart = { svgX: pt.x, svgY: pt.y };
        const fh = document.getElementById('field-hint');
        if (fh) fh.textContent = tagHintText(state.pendingTagType, 2);
        updateArrowPreview(pt.x, pt.y, pt.x, pt.y);
      } else {
        const start = state.pendingArrowStart;
        state.pendingArrowStart = null;
        addTag(start.svgX, start.svgY, pt.x, pt.y);
        const fh = document.getElementById('field-hint');
        if (fh && state.pendingTagType) fh.textContent = tagHintText(state.pendingTagType, 1);
      }
    } else {
      addTag(pt.x, pt.y);
      cursor.setAttribute('r', '14');
      cursor.style.stroke = tagInfo?.color || '#fff';
      setTimeout(() => cursor.setAttribute('r', '6'), 300);
    }
  });

  overlay.addEventListener('mousemove', e => {
    if (!state.pendingTagType) {
      cursor.setAttribute('opacity', '0');
      coordTxt.setAttribute('opacity', '0');
      return;
    }
    const pt       = screenToSvg(svg, e.clientX, e.clientY);
    const { x, y } = svgToCoord(pt.x, pt.y);
    const session  = currentSession();
    const video    = document.getElementById('video-player');
    const curTime  = (video && !isNaN(video.currentTime)) ? video.currentTime : 0;
    const period   = getActivePeriod(session, curTime);
    const dir      = period?.direction || 'ltr';
    const dx       = dir === 'rtl' ? -x : x;

    cursor.setAttribute('cx', pt.x.toFixed(1));
    cursor.setAttribute('cy', pt.y.toFixed(1));
    cursor.setAttribute('r', '6');
    cursor.setAttribute('opacity', '1');
    cursor.style.stroke = TAG_TYPES[state.pendingTagType]?.color || 'white';
    coordTxt.setAttribute('x', pt.x.toFixed(1));
    coordTxt.setAttribute('y', (pt.y - 10).toFixed(1));
    coordTxt.setAttribute('opacity', '1');
    coordTxt.textContent = `${dx > 0 ? '+' : ''}${dx}, ${y > 0 ? '+' : ''}${y}`;

    if (state.pendingArrowStart) {
      updateArrowPreview(state.pendingArrowStart.svgX, state.pendingArrowStart.svgY, pt.x, pt.y);
    }
  });

  overlay.addEventListener('mouseleave', () => {
    cursor.setAttribute('opacity', '0');
    coordTxt.setAttribute('opacity', '0');
    if (!state.pendingArrowStart) {
      const g = document.getElementById('field-arrow-preview');
      if (g) g.innerHTML = '';
    }
  });

  document.querySelectorAll('.mark-color-btn').forEach(btn =>
    btn.addEventListener('click', () => setMarkColor(btn.dataset.color)));

  document.getElementById('filter-action').addEventListener('change', e => { state.filters.action = e.target.value; renderTagList(); });
  document.getElementById('filter-player').addEventListener('change', e => { state.filters.player = e.target.value; renderTagList(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.pendingTagType) setActiveTag(null);
  });

  navigate('sessions');
}

function screenToSvg(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width  * 400,
    y: (clientY - rect.top)  / rect.height * 260,
  };
}

function goToAnalysisFilter(action, half, player) {
  state.filters.action = action  || '';
  state.filters.player = player  || '';
  navigate('analysis');
  setTimeout(() => {
    const fa = document.getElementById('filter-action');
    const fp = document.getElementById('filter-player');
    if (fa) fa.value = state.filters.action;
    if (fp) fp.value = state.filters.player;
    renderTagList();
  }, 50);
}

// ── Password gate ──
const APP_PASSWORD = 'tim1898';

function checkPassword() {
  if (sessionStorage.getItem('stz_auth') === '1') { init(); return; }
  const overlay = document.createElement('div');
  overlay.id = 'pw-overlay';
  overlay.innerHTML = `
    <div id="pw-box">
      <svg width="40" height="40" viewBox="0 0 34 34" fill="none" style="margin-bottom:8px">
        <defs>
          <linearGradient id="pw-g" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
        </defs>
        <circle cx="17" cy="17" r="15.5" fill="rgba(10,12,24,0.95)" stroke="url(#pw-g)" stroke-width="2"/>
        <path d="M17 1.5 A15.5 15.5 0 0 0 1.5 17" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <path d="M32.5 17 A15.5 15.5 0 0 0 17 32.5" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <circle cx="17" cy="17" r="3.5" fill="url(#pw-g)"/><circle cx="17" cy="17" r="1.5" fill="white" opacity="0.95"/>
      </svg>
      <div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.4px">scouting<span style="color:#ef4444">toolz</span></div>
      <div style="font-size:11px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;margin-bottom:20px">Analyse · Scouting</div>
      <input id="pw-input" type="password" placeholder="Passwort" autocomplete="current-password"/>
      <div id="pw-error"></div>
      <button id="pw-btn">Einloggen</button>
    </div>`;
  document.body.appendChild(overlay);

  const attempt = () => {
    if (document.getElementById('pw-input').value === APP_PASSWORD) {
      sessionStorage.setItem('stz_auth', '1');
      overlay.remove();
      init();
    } else {
      const err = document.getElementById('pw-error');
      err.textContent = 'Falsches Passwort';
      document.getElementById('pw-input').value = '';
      document.getElementById('pw-input').focus();
      setTimeout(() => { err.textContent = ''; }, 2000);
    }
  };
  document.getElementById('pw-btn').addEventListener('click', attempt);
  document.getElementById('pw-input').addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  document.getElementById('pw-input').focus();
}

document.addEventListener('DOMContentLoaded', checkPassword);
