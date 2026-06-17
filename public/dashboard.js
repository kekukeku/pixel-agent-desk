const state = {
  agents: new Map(),
  agentHistory: new Map(),
  stats: { total: 0, active: 0, completed: 0, totalTokens: 0, totalCost: 0, errorCount: 0 },
  connected: false,
  currentView: localStorage.getItem('mc-view') || 'office',
  editingId: null,
  editingValue: ''
};

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hasMeteredUsage(ag) {
  if (!ag || !ag.tokenUsage) return false;
  if (ag.usageAvailable || ag.tokenUsage.usageAvailable) return true;
  const total = (ag.tokenUsage.inputTokens || 0) + (ag.tokenUsage.outputTokens || 0);
  if (total > 0 || (ag.tokenUsage.estimatedCost || 0) > 0) return true;
  if (ag.model && /^(claude|gpt|gemini)/i.test(ag.model)) return true;
  return false;
}

const DOM = {
  statusIndicator: document.getElementById('statusIndicator'),
  connectionStatus: document.getElementById('connectionStatus'),
  agentPanel: document.getElementById('agentPanel'),
  standbyMessage: document.getElementById('standbyMessage'),
  kpiActiveAgents: document.getElementById('kpiActiveAgents'),
  kpiTotalAgents: document.getElementById('kpiTotalAgents'),
  kpiTokens: document.getElementById('kpiTokens'),
  kpiCost: document.getElementById('kpiCost'),
  kpiErrors: document.getElementById('kpiErrors'),
  officePanelTitle: document.getElementById('officePanelTitle')
};

// ─── SSE CONNECTION ───
let sseDelay = 1000;
let sseSource = null;

function connectSSE() {
  if (sseSource) { sseSource.close(); sseSource = null; }
  const es = new EventSource('/api/events');
  sseSource = es;

  es.onopen = () => {
    sseDelay = 1000;
    state.connected = true;
    updateConnectionStatus(true);
  };

  es.onerror = () => {
    state.connected = false;
    updateConnectionStatus(false);
    es.close();
    sseSource = null;
    setTimeout(connectSSE, sseDelay);
    sseDelay = Math.min(sseDelay * 2, 30000);
  };

  es.addEventListener('connected', () => fetchInitialData());
  es.addEventListener('agent.created', e => { const d = JSON.parse(e.data).data; updateAgent(d); if (typeof officeOnAgentCreated === 'function') officeOnAgentCreated(d); });
  es.addEventListener('agent.updated', e => { const d = JSON.parse(e.data).data; updateAgent(d); if (typeof officeOnAgentUpdated === 'function') officeOnAgentUpdated(d); });
  es.addEventListener('agent.removed', e => { const d = JSON.parse(e.data).data; removeAgent(d.id); if (typeof officeOnAgentRemoved === 'function') officeOnAgentRemoved(d); });
}

async function fetchInitialData() {
  try {
    const res = await fetch('/api/agents');
    const ags = await res.json();
    for (const a of ags) {
      state.agents.set(a.id, a);
      // Seed timeline history
      if (!state.agentHistory.has(a.id)) {
        state.agentHistory.set(a.id, [{ state: a.status, ts: Date.now() }]);
      }
    }
    recalcStats();
    renderAgentList();
  } catch (e) {
    console.error('Data fetch error:', e);
  }
}

function updateAgent(ag) {
  if (ag.status === 'error') state.stats.errorCount++;
  state.agents.set(ag.id, ag);

  // Track state history for timeline
  const hist = state.agentHistory.get(ag.id) || [];
  const last = hist.length > 0 ? hist[hist.length - 1] : null;
  if (!last || last.state !== ag.status) {
    hist.push({ state: ag.status, ts: Date.now() });
    state.agentHistory.set(ag.id, hist);
  }

  recalcStats();
  updateAgentUI(ag);
}

function removeAgent(id) {
  state.agents.delete(id);
  state.agentHistory.delete(id);
  recalcStats();
  const el = DOM.agentPanel.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
  if (state.agents.size === 0) DOM.standbyMessage.style.display = 'block';
}

// ─── UTILS ───
const formatNum = n => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
};

function recalcStats() {
  const arr = Array.from(state.agents.values());
  state.stats.total = arr.length;
  state.stats.active = arr.filter(a => ['working', 'thinking'].includes(a.status)).length;
  state.stats.totalTokens = arr.reduce((s, a) => s + ((a.tokenUsage?.inputTokens || 0) + (a.tokenUsage?.outputTokens || 0)), 0);
  state.stats.totalCost = arr.reduce((s, a) => s + (a.tokenUsage?.estimatedCost || 0), 0);

  DOM.kpiActiveAgents.innerHTML = `${state.stats.active} <span style="font-size:0.8rem;color:var(--color-text-dark)">/ ${state.stats.total}</span>`;
  
  const activeCount = arr.filter(a => ['working', 'thinking'].includes(a.status)).length;
  DOM.kpiTokens.textContent = activeCount > 0 ? 'Live' : 'Idle';
  DOM.kpiTokens.style.color = activeCount > 0 ? 'var(--color-success)' : 'var(--color-text-muted)';

  DOM.kpiCost.textContent = '--';
  DOM.kpiCost.style.color = 'var(--color-text)';

  DOM.kpiErrors.textContent = state.stats.errorCount.toString();
  if (state.stats.errorCount > 0) DOM.kpiErrors.className = 'kpi-value error';
}

function updateConnectionStatus(up) {
  const b = document.getElementById('disconnectBanner');
  if (up) {
    DOM.statusIndicator.className = 'status-dot connected';
    DOM.connectionStatus.textContent = 'Gateway Online';
    if (b) b.style.display = 'none';
  } else {
    DOM.statusIndicator.className = 'status-dot disconnected';
    DOM.connectionStatus.textContent = 'Disconnected';
    if (b) b.style.display = 'block';
  }
}

// ─── RENDER AGENTS ───
function renderAgentList() {
  if (state.agents.size === 0) {
    DOM.standbyMessage.style.display = 'block';
    return;
  }
  DOM.standbyMessage.style.display = 'none';
  for (const [id, ag] of state.agents) updateAgentUI(ag);
}

// ─── AVATAR OVERRIDES STORAGE ───
function getLocalAvatarOverrides() {
  try {
    const stored = localStorage.getItem('pixel-agent-desk.avatarOverrides.v1');
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Failed to parse avatar overrides:', e);
    return {};
  }
}

function saveAvatarOverride(agentId, avatarIdx) {
  try {
    const overrides = getLocalAvatarOverrides();
    overrides[agentId] = avatarIdx;
    localStorage.setItem('pixel-agent-desk.avatarOverrides.v1', JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save avatar override:', e);
  }
}

function clearAvatarOverride(agentId) {
  try {
    const overrides = getLocalAvatarOverrides();
    delete overrides[agentId];
    localStorage.setItem('pixel-agent-desk.avatarOverrides.v1', JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to clear avatar override:', e);
  }
}

function updateOfficeCharacterAvatar(agentId, avatarIdx) {
  if (typeof officeCharacters !== 'undefined') {
    const char = officeCharacters.characters.get(agentId);
    if (char) {
      char.skinIndex = avatarIdx;
      // ponytail: update both skinIndex and avatarFile to sync canvas character immediately
      char.avatarFile = AVATAR_FILES[avatarIdx] || AVATAR_FILES[0];
    }
  }
}

// ponytail: sprite sheet metadata — keep in sync with public/shared/sprite-frames.json
const SPRITE_SHEET = { cols: 8, rows: 9, frameW: 48, frameH: 64, previewFrame: 0 };

function spritePortraitStyle(sheetFile, displayW) {
  const scale = displayW / SPRITE_SHEET.frameW;
  const displayH = Math.round(SPRITE_SHEET.frameH * scale);
  const sheetW = SPRITE_SHEET.cols * SPRITE_SHEET.frameW * scale;
  const sheetH = SPRITE_SHEET.rows * SPRITE_SHEET.frameH * scale;
  const col = SPRITE_SHEET.previewFrame % SPRITE_SHEET.cols;
  const row = Math.floor(SPRITE_SHEET.previewFrame / SPRITE_SHEET.cols);
  const posX = -col * SPRITE_SHEET.frameW * scale;
  const posY = -row * SPRITE_SHEET.frameH * scale;
  return `width:${displayW}px;height:${displayH}px;background-image:url('/public/characters/${sheetFile}');background-size:${sheetW}px ${sheetH}px;background-position:${posX}px ${posY}px;`;
}

function spritePortraitHtml(sheetFile, className, displayW, label) {
  const style = spritePortraitStyle(sheetFile, displayW);
  const safeLabel = escapeHtml(label);
  return `<div class="${className}" style="${style}" role="img" aria-label="${safeLabel}" title="${safeLabel}"></div>`;
}

function updateAgentUI(ag) {
  DOM.standbyMessage.style.display = 'none';
  const existing = DOM.agentPanel.querySelector(`[data-id="${ag.id}"]`);

  const stClass = ['working', 'thinking', 'error', 'done', 'completed'].includes(ag.status) ? ag.status : 'waiting';
  const stText = ag.status.toUpperCase();
  const typeHtml = ag.metadata?.isSubagent ? '<span class="mc-type-badge">SUB</span>' : '<span class="mc-type-badge main">MAIN</span>';

  const isAct = ['working', 'thinking'].includes(stClass);
  const actText = ag.currentTool ? `<span class="hl">${ag.currentTool}</span>` : (isAct ? stText : 'Idling...');

  const isMetered = hasMeteredUsage(ag);
  const tokens = formatNum((ag.tokenUsage?.inputTokens || 0) + (ag.tokenUsage?.outputTokens || 0));
  const cost = (ag.tokenUsage?.estimatedCost || 0).toFixed(4);

  const ctxPct = ag.tokenUsage?.contextPercent;
  const hasCtx = isMetered && ctxPct != null;
  const ctxColor = !hasCtx ? '' : ctxPct > 85 ? 'ctx-high' : ctxPct > 60 ? 'ctx-mid' : 'ctx-low';
  const ctxValText = hasCtx ? `~${ctxPct}%` : '--';

  // Build timeline segments
  const hist = state.agentHistory.get(ag.id) || [];
  let timelineHtml = '';
  if (hist.length > 0) {
    const now = Date.now();
    const segs = hist.map((h, i) => {
      const end = (i + 1 < hist.length) ? hist[i + 1].ts : now;
      const dur = Math.max(end - h.ts, 1);
      return { state: h.state, dur };
    });
    const segHtml = segs.map(s =>
      `<div class="mc-timeline-seg" style="flex-grow:${s.dur};background:${getStateColor(s.state)}" title="${s.state}"></div>`
    ).join('');
    timelineHtml = `<div class="mc-timeline">${segHtml}</div>`;
  }

  const isEditing = state.editingId === ag.id;
  const nameContent = isEditing
    ? `<form class="mc-name-edit-form" data-id="${ag.id}" style="display: inline-flex; gap: 4px; align-items: center; margin: 0;">
         <input type="text" class="mc-agent-name-input" value="${escapeHtml(state.editingValue)}" maxlength="40" style="font-size: 0.8rem; padding: 2px 4px; background: #161b22; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; width: 100px;" autofocus />
         <button type="submit" class="mc-name-btn save" title="Save" style="background: none; border: none; padding: 2px; cursor: pointer; color: #58a6ff; font-size: 0.9rem;">✓</button>
         <button type="button" class="mc-name-btn cancel" title="Cancel" style="background: none; border: none; padding: 2px; cursor: pointer; color: #f85149; font-size: 0.9rem;">✗</button>
       </form>`
    : `<span class="mc-agent-name-text">${escapeHtml(ag.name || 'Agent')}</span>
       <button class="mc-name-edit-btn" title="Edit Name" style="background: none; border: none; padding: 0 4px; cursor: pointer; color: #8b949e; font-size: 0.75rem; vertical-align: middle;">✎</button>`;

  const metricsHtml = isMetered
    ? `<span>TX: <span class="mc-metric-val">${tokens}</span> tok</span>
       <span>$<span class="mc-metric-val">${cost}</span></span>`
    : `<span>Usage unavailable</span>
       <span>Cost: <span class="mc-metric-val">N/A</span></span>`;

  // Resolve current avatar from localStorage override or default assignments
  const overrides = getLocalAvatarOverrides();
  const hasOverride = overrides[ag.id] !== undefined;
  const currentAvatarIdx = hasOverride ? overrides[ag.id] : (ag.avatarIndex !== undefined && ag.avatarIndex !== null ? ag.avatarIndex : avatarIndexFromId(ag.id));
  const currentAvatarFile = (typeof AVATAR_FILES !== 'undefined' && AVATAR_FILES[currentAvatarIdx]) ? AVATAR_FILES[currentAvatarIdx] : 'avatar_0.webp';

  // Build grid options HTML
  const optionsHtml = (typeof AVATAR_FILES !== 'undefined' ? AVATAR_FILES : []).map((file, idx) => {
    const isSel = idx === currentAvatarIdx;
    return `
      <button class="mc-avatar-option ${isSel ? 'selected' : ''}" data-idx="${idx}" title="Avatar ${idx}">
        ${spritePortraitHtml(file, 'mc-avatar-portrait mc-avatar-portrait-option', 28, `Avatar option ${idx}`)}
      </button>
    `;
  }).join('');

  // Preserve picker open status across rendering ticks
  let isDropdownActive = false;
  if (existing) {
    const dropdown = existing.querySelector('.mc-avatar-picker-dropdown');
    if (dropdown && dropdown.classList.contains('active')) {
      isDropdownActive = true;
    }
  }

  const dropdownHtml = `
    <div class="mc-avatar-picker-dropdown ${isDropdownActive ? 'active' : ''}">
      <div class="mc-avatar-grid">
        ${optionsHtml}
      </div>
      ${hasOverride ? `<button class="mc-avatar-reset-btn">Reset to Default</button>` : ''}
    </div>
  `;

  const html = `
    <div class="mc-agent-card-body">
      <div class="mc-avatar-container" data-id="${ag.id}">
        <button class="mc-avatar-btn" title="Change Avatar">
          ${spritePortraitHtml(currentAvatarFile, 'mc-avatar-portrait mc-avatar-portrait-card', 32, 'Agent avatar')}
          <div class="mc-avatar-edit-overlay">✎</div>
        </button>
        ${dropdownHtml}
      </div>
      <div class="mc-agent-details">
        <div class="mc-agent-header">
          <div class="mc-agent-name">${nameContent} ${typeHtml}</div>
          <div class="mc-agent-status ${stClass}">${stText}</div>
        </div>
        <div class="mc-agent-activity">CMD> ${actText}</div>
      </div>
    </div>
    ${timelineHtml}
    <div class="mc-agent-metrics">
      ${metricsHtml}
    </div>
    <div class="mc-context-gauge ${!hasCtx ? 'disabled' : ''}" title="Approximate context window usage (estimated from input tokens)">
      <span class="ctx-label">~ctx</span>
      <div class="ctx-track"><div class="ctx-fill ${ctxColor}" style="width:${hasCtx ? ctxPct : 0}%"></div></div>
      <span class="ctx-val">${ctxValText}</span>
    </div>
  `;

  let activeElement = document.activeElement;
  let selectionStart = null;
  let selectionEnd = null;
  const isInputActive = activeElement && activeElement.classList.contains('mc-agent-name-input') && activeElement.closest(`[data-id="${ag.id}"]`);
  if (isInputActive) {
    selectionStart = activeElement.selectionStart;
    selectionEnd = activeElement.selectionEnd;
  }

  if (existing) {
    existing.innerHTML = html;
  } else {
    const div = document.createElement('div');
    div.className = 'mc-agent-card';
    div.dataset.id = ag.id;
    div.innerHTML = html;
    DOM.agentPanel.appendChild(div);
  }

  if (isInputActive) {
    const container = existing || DOM.agentPanel.querySelector(`[data-id="${ag.id}"]`);
    if (container) {
      const newInput = container.querySelector('.mc-agent-name-input');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
}

// ─── TIMELINE STATE COLORS ───
function getStateColor(status) {
  const map = {
    working: 'var(--color-state-working)',
    thinking: 'var(--color-state-thinking)',
    waiting: 'var(--color-state-waiting)',
    done: 'var(--color-state-done)',
    completed: 'var(--color-state-done)',
    error: 'var(--color-state-error)',
  };
  return map[status] || 'var(--color-state-waiting)';
}

// ─── OFFICE CHARACTER CLICK POPOVER ───
const popoverEl = document.getElementById('officePopover');

function hitTestOfficeCharacter(canvas, event) {
  if (typeof officeCharacters === 'undefined') return null;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (event.clientX - rect.left) * scaleX;
  const cy = (event.clientY - rect.top) * scaleY;

  const chars = officeCharacters.getCharacterArray();
  // Reverse Y-sort: topmost (highest y) rendered last, so check first
  const sorted = [...chars].sort((a, b) => b.y - a.y);

  const FW = (typeof OFFICE !== 'undefined' && OFFICE.FRAME_W) || 48;
  const FH = (typeof OFFICE !== 'undefined' && OFFICE.FRAME_H) || 64;

  for (const ch of sorted) {
    const left = ch.x - FW / 2;
    const top = ch.y - FH;
    if (cx >= left && cx <= left + FW && cy >= top && cy <= top + FH) {
      return ch;
    }
  }
  return null;
}

function showOfficePopover(canvas, char) {
  const ag = state.agents.get(char.id);
  const name = char.role || (ag && ag.name) || 'Agent';
  const status = (ag && ag.status) || char.agentState || 'idle';
  const stClass = ['working', 'thinking', 'error', 'done', 'completed'].includes(status) ? status : 'waiting';
  const project = (ag && ag.metadata && ag.metadata.projectSlug) || char.metadata?.project || '-';
  const tool = (ag && ag.currentTool) || char.metadata?.tool || '-';
  const model = (ag && ag.model) || '-';
  const inputTok = (ag && ag.tokenUsage?.inputTokens) || 0;
  const outputTok = (ag && ag.tokenUsage?.outputTokens) || 0;
  const cost = (ag && ag.tokenUsage?.estimatedCost) || 0;
  const ctxPct = (ag && ag.tokenUsage?.contextPercent);

  const isMetered = hasMeteredUsage(ag);
  const tokensVal = isMetered ? formatNum(inputTok + outputTok) : 'Usage unavailable';
  const costVal = isMetered ? `$${cost.toFixed(4)}` : 'N/A';
  const ctxValText = isMetered && ctxPct != null ? `~${ctxPct}%` : '-';

  popoverEl.innerHTML = `
    <div class="pop-header">
      <span class="pop-name">${name}</span>
      <div class="mc-agent-status ${stClass}" style="font-size:0.6rem">${status.toUpperCase()}</div>
    </div>
    <div class="pop-row"><span>Project</span><span class="pop-val">${project}</span></div>
    <div class="pop-row"><span>Tool</span><span class="pop-val">${tool}</span></div>
    <div class="pop-row"><span>Model</span><span class="pop-val">${model}</span></div>
    <div class="pop-row"><span>Tokens</span><span class="pop-val">${tokensVal}</span></div>
    <div class="pop-row"><span>Cost</span><span class="pop-val">${costVal}</span></div>
    <div class="pop-row"><span>Context</span><span class="pop-val">${ctxValText}</span></div>
  `;
  popoverEl.style.display = 'block';

  // Position near the character
  const rect = canvas.getBoundingClientRect();
  const FW = (typeof OFFICE !== 'undefined' && OFFICE.FRAME_W) || 48;
  const FH = (typeof OFFICE !== 'undefined' && OFFICE.FRAME_H) || 64;
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  const screenX = rect.left + (char.x - FW / 2) * scaleX;
  const screenY = rect.top + (char.y - FH) * scaleY;

  // Try to position above the character, fall back to below
  const popW = popoverEl.offsetWidth;
  const popH = popoverEl.offsetHeight;
  let left = screenX + (FW * scaleX) / 2 - popW / 2;
  let top = screenY - popH - 8;
  if (top < 4) top = screenY + FH * scaleY + 8;
  left = Math.max(4, Math.min(window.innerWidth - popW - 4, left));
  top = Math.max(4, Math.min(window.innerHeight - popH - 4, top));

  popoverEl.style.left = left + 'px';
  popoverEl.style.top = top + 'px';
}

function hideOfficePopover() {
  popoverEl.style.display = 'none';
}

function setupOfficeClickHandler() {
  const canvas = document.getElementById('office-canvas');
  if (!canvas) return;

  canvas.addEventListener('click', (e) => {
    const char = hitTestOfficeCharacter(canvas, e);
    if (char) {
      showOfficePopover(canvas, char);
    } else {
      hideOfficePopover();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!popoverEl.contains(e.target) && e.target.id !== 'office-canvas') {
      hideOfficePopover();
    }
  });

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideOfficePopover();
  });
}

// ─── MODEL BREAKDOWN (Feature 3 Frontend) ───
const MODEL_COLORS = {
  opus: '#e879a0',
  sonnet: '#2f81f7',
  haiku: '#3fb950',
};

function getModelFamily(modelName) {
  if (!modelName) return null;
  const lower = modelName.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('sonnet')) return 'sonnet';
  if (lower.includes('haiku')) return 'haiku';
  return null;
}

function getModelColor(modelName) {
  const fam = getModelFamily(modelName);
  return (fam && MODEL_COLORS[fam]) || '#8b949e';
}

function getModelDisplayName(modelName) {
  if (!modelName) return 'Unknown';
  // "claude-sonnet-4-6" → "Sonnet 4.6"
  const m = modelName.match(/claude-(\w+)-(\d+)-(\d+)/);
  if (m) return `${m[1].charAt(0).toUpperCase() + m[1].slice(1)} ${m[2]}.${m[3]}`;
  return modelName;
}

function renderModelBreakdown(days) {
  const root = document.getElementById('modelBreakdownRoot');
  const body = document.getElementById('modelBreakdownBody');
  if (!root || !body) return;

  // Aggregate byModel across all days
  const totals = {};
  for (const dayStats of Object.values(days)) {
    if (!dayStats.byModel) continue;
    for (const [model, ms] of Object.entries(dayStats.byModel)) {
      if (!totals[model]) totals[model] = { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
      totals[model].inputTokens += ms.inputTokens || 0;
      totals[model].outputTokens += ms.outputTokens || 0;
      totals[model].estimatedCost += ms.estimatedCost || 0;
    }
  }

  const models = Object.keys(totals);
  if (models.length === 0) {
    root.style.display = 'none';
    return;
  }
  root.style.display = 'block';

  const grandCost = models.reduce((s, m) => s + totals[m].estimatedCost, 0);

  // Build proportional bar
  const barSegs = models.map(m => {
    const pct = grandCost > 0 ? (totals[m].estimatedCost / grandCost) : 0;
    return `<div class="model-seg" style="flex-grow:${Math.max(totals[m].estimatedCost, 0.001)};background:${getModelColor(m)}" title="${getModelDisplayName(m)}: $${totals[m].estimatedCost.toFixed(2)}"></div>`;
  }).join('');

  // Build legend
  const legendItems = models
    .sort((a, b) => totals[b].estimatedCost - totals[a].estimatedCost)
    .map(m => {
      const tok = formatNum(totals[m].inputTokens + totals[m].outputTokens);
      const cost = totals[m].estimatedCost.toFixed(2);
      return `<div class="model-legend-item">
        <div class="model-legend-dot" style="background:${getModelColor(m)}"></div>
        <span>${getModelDisplayName(m)}</span>
        <span class="model-legend-val">${tok} tok</span>
        <span class="model-legend-val">$${cost}</span>
      </div>`;
    }).join('');

  body.innerHTML = `
    <div class="model-bar-container">${barSegs}</div>
    <div class="model-legend">${legendItems}</div>
  `;
}

// ─── HEATMAP & USAGE DATA FETCH ───
const historyState = { data: null, mode: 'weeks' };

async function fetchHistory() {
  if (historyState.data) return;
  try {
    const r = await fetch('/api/heatmap?days=365');
    historyState.data = await r.json();
  } catch (e) { historyState.data = { days: {} }; }
}

// ─── HEATMAP RENDERING ───
async function renderHeatmapView() {
  await fetchHistory();
  const daysArr = historyState.data.days || {};

  // Calculate streaks
  let totSes = 0, actDays = 0, bestStk = 0, curStk = 0;
  let dList = Object.keys(daysArr).sort();
  let tmpStk = 0;

  for (const d of dList) {
    let v = daysArr[d].sessions || 0;
    totSes += v;
    if (v > 0) { actDays++; tmpStk++; if (tmpStk > bestStk) bestStk = tmpStk; }
    else tmpStk = 0;
  }

  document.getElementById('hmStatsRoot').innerHTML = `
    <div class="hm-stat"><span class="hm-stat-lbl">Record Sessions</span><span class="hm-stat-val">${formatNum(totSes)}</span></div>
    <div class="hm-stat"><span class="hm-stat-lbl">Active Days</span><span class="hm-stat-val">${actDays}</span></div>
    <div class="hm-stat"><span class="hm-stat-lbl">Longest Streak</span><span class="hm-stat-val">${bestStk} d</span></div>
  `;

  // Build Grid
  const grid = document.getElementById('heatmapGrid');
  grid.innerHTML = '';

  const t = new Date(); t.setHours(0, 0, 0, 0);
  const start = new Date(t); start.setDate(t.getDate() - (52 * 7 + t.getDay()));

  const allVals = [];
  const cells = [];
  let cur = new Date(start);
  while (cur <= t) {
    const ds = cur.toISOString().slice(0, 10);
    const v = daysArr[ds]?.sessions || 0;
    allVals.push(v);
    cells.push({ d: ds, v: v, dow: cur.getDay() });
    cur.setDate(cur.getDate() + 1);
  }

  const nz = allVals.filter(v => v > 0).sort((a, b) => a - b);
  const getLv = v => {
    if (v === 0 || nz.length === 0) return 0;
    if (v <= nz[Math.floor(nz.length * 0.25)] || 1) return 1;
    if (v <= nz[Math.floor(nz.length * 0.5)] || 1) return 2;
    if (v <= nz[Math.floor(nz.length * 0.75)] || 1) return 3;
    return 4;
  };

  const yLbls = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  grid.appendChild(createDiv('hm-month-lbl', ''));
  for (let i = 0; i < 7; i++) grid.appendChild(createDiv('hm-day-lbl', yLbls[i]));

  let lastM = -1;
  const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  cells.forEach((c, i) => {
    const cd = new Date(c.d + 'T00:00:00');
    if (c.dow === 0 || i === 0) {
      const m = cd.getMonth();
      const p = createDiv('hm-month-lbl', m !== lastM ? mNames[m] : '');
      grid.appendChild(p);
      lastM = m;
    }
    const d = createDiv(`hm-cell l${getLv(c.v)}`, '');
    d.dataset.ds = c.d;
    d.onmouseenter = e => showTooltip(e.target, c.d, daysArr[c.d]);
    d.onmouseleave = hideTooltip;
    grid.appendChild(d);
  });
}

function createDiv(cls, txt) { const d = document.createElement('div'); d.className = cls; d.textContent = txt; return d; }

const tt = document.getElementById('mcTooltip');
function showTooltip(el, dStr, data) {
  const b = el.getBoundingClientRect();
  tt.innerHTML = `<div class="tt-head">${dStr}</div>`;
  if (data) {
    tt.innerHTML += `<div class="tt-row"><span>Sessions</span><span class="tt-val">${data.sessions}</span></div>
                     <div class="tt-row"><span>Tokens</span><span class="tt-val">${formatNum((data.inputTokens || 0) + (data.outputTokens || 0))}</span></div>
                     <div class="tt-row"><span>Cost</span><span class="tt-val">$${(data.estimatedCost || 0).toFixed(2)}</span></div>`;
  } else {
    tt.innerHTML += `<div style="opacity:0.6;font-style:italic">No activity detected.</div>`;
  }
  tt.style.display = 'block';
  let left = b.left + b.width / 2 - tt.offsetWidth / 2;
  tt.style.left = Math.max(10, Math.min(window.innerWidth - tt.offsetWidth - 10, left)) + 'px';
  tt.style.top = (b.top - tt.offsetHeight - 10) + 'px';
}
function hideTooltip() { tt.style.display = 'none'; }

// ─── USAGE CHARTS RENDERING ───
async function renderUsageView() {
  await fetchHistory();
  const days = historyState.data.days || {};
  const mode = historyState.mode;

  let tTok = 0, tCost = 0, tTool = 0, tSes = 0;
  Object.values(days).forEach(d => {
    tTok += (d.inputTokens || 0) + (d.outputTokens || 0);
    tCost += d.estimatedCost || 0;
    tTool += d.toolUses || 0;
    tSes += d.sessions || 0;
  });

  const hasMeteredData = tTok > 0 || tCost > 0;

  document.getElementById('uTotalTokens').textContent = hasMeteredData ? formatNum(tTok) : 'N/A';
  document.getElementById('uTotalCost').textContent = hasMeteredData ? `$${tCost.toFixed(2)}` : 'N/A';
  document.getElementById('uTotalTools').textContent = formatNum(tTool);
  document.getElementById('uTotalSessions').textContent = formatNum(tSes);

  if (hasMeteredData) {
    const tChart = aggChart(days, mode, d => (d.inputTokens || 0) + (d.outputTokens || 0));
    const cChart = aggChart(days, mode, d => d.estimatedCost || 0);

    document.getElementById('chartTokensRoot').innerHTML = buildBars(tChart, 'tokens');
    document.getElementById('chartCostRoot').innerHTML = buildBars(cChart, 'cost', true);

    document.getElementById('chartTokensRoot').parentElement.style.display = 'block';
    document.getElementById('chartCostRoot').parentElement.style.display = 'block';

    const emptyStateEl = document.getElementById('usageEmptyState');
    if (emptyStateEl) emptyStateEl.style.display = 'none';

    renderModelBreakdown(days);
  } else {
    document.getElementById('chartTokensRoot').parentElement.style.display = 'none';
    document.getElementById('chartCostRoot').parentElement.style.display = 'none';
    document.getElementById('modelBreakdownRoot').style.display = 'none';

    let emptyStateEl = document.getElementById('usageEmptyState');
    if (!emptyStateEl) {
      emptyStateEl = document.createElement('div');
      emptyStateEl.id = 'usageEmptyState';
      emptyStateEl.className = 'panel usage-empty-state';
      emptyStateEl.style.padding = '32px';
      emptyStateEl.style.textAlign = 'center';
      emptyStateEl.style.color = 'var(--color-text-muted)';
      emptyStateEl.style.fontSize = '0.9rem';
      emptyStateEl.style.marginTop = '24px';
      emptyStateEl.style.borderColor = 'var(--color-border)';
      document.getElementById('usageView').appendChild(emptyStateEl);
    }
    emptyStateEl.textContent = 'No metered API usage reported. Subscription and TUI agents may not expose token totals.';
    emptyStateEl.style.display = 'block';
  }
}

function aggChart(days, mode, valFn) {
  const res = [];
  const t = new Date(); t.setHours(0, 0, 0, 0);
  if (mode === 'weeks') {
    for (let w = 11; w >= 0; w--) {
      let s = 0;
      const we = new Date(t); we.setDate(t.getDate() - w * 7);
      const ws = new Date(we); ws.setDate(we.getDate() - 6);
      let c = new Date(ws);
      while (c <= we) { s += valFn(days[c.toISOString().slice(0, 10)] || {}); c.setDate(c.getDate() + 1); }
      res.push({ lbl: `W${12 - w}`, val: s });
    }
  } else {
    const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 11; m >= 0; m--) {
      const target = new Date(t.getFullYear(), t.getMonth() - m, 1);
      const y = target.getFullYear(), mo = target.getMonth();
      const dMax = new Date(y, mo + 1, 0).getDate();
      let s = 0;
      for (let dx = 1; dx <= dMax; dx++) {
        s += valFn(days[`${y}-${String(mo + 1).padStart(2, '0')}-${String(dx).padStart(2, '0')}`] || {});
      }
      res.push({ lbl: mn[mo], val: s });
    }
  }
  return res;
}

function buildBars(data, colorClass, isMoney = false) {
  const max = Math.max(...data.map(d => d.val), 1);
  const bars = data.map(d => {
    const h = d.val > 0 ? Math.max(4, Math.round((d.val / max) * 100)) : 0;
    const fmt = d.val === 0 ? '' : (isMoney ? '$' + d.val.toFixed(2) : formatNum(d.val));
    return `<div class="chart-col">
              <div class="chart-val">${fmt}</div>
              <div class="chart-bar ${colorClass}" style="height:${h}%"></div>
              <div class="chart-lbl">${d.lbl}</div>
            </div>`;
  }).join('');
  return `<div class="chart-box">${bars}</div>`;
}

// ─── NAV LOGIC ───
document.querySelectorAll('.usage-btn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.usage-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    historyState.mode = b.dataset.umode;
    renderUsageView();
  }
});

document.querySelectorAll('.nav-item').forEach(b => {
  b.onclick = () => {
    const target = b.dataset.view;
    const oldView = state.currentView;
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    b.classList.add('active');

    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(`${target}View`);
    if (el) el.classList.add('active');

    // Handle canvas switching and replay mode cleanup
    if (target !== 'groupchat' && oldView === 'groupchat') {
      // Switched away from GroupChat
      pauseReplay();
      window.__groupchatReplayActive = false;
      window.__groupchatReplayCharacters = null;
      switchCanvas('office');
    }

    state.currentView = target;
    localStorage.setItem('mc-view', target);

    if (target === 'heatmap') renderHeatmapView();
    else if (target === 'usage') renderUsageView();
    else if (target === 'groupchat') {
      // Switched to GroupChat
      switchCanvas('groupchat');
      loadGroupChatSessions();
    }
  };
});

// ─── PiP TOGGLE & STATE ───
// PiP mode is optional and user-triggered from the main dashboard window.
(function () {
  var pipBtn = document.getElementById('pipToggleBtn');
  var pipPlaceholder = document.getElementById('pipPlaceholder');
  var pipStopBtn = document.getElementById('pipStopBtn');
  var officeCanvas = document.getElementById('office-canvas');

  function setPipState(isOpen) {
    if (pipBtn) pipBtn.classList.toggle('active', isOpen);
    if (pipPlaceholder) pipPlaceholder.style.display = isOpen ? 'flex' : 'none';
    if (officeCanvas) officeCanvas.style.display = isOpen ? 'none' : 'block';
  }

  if (pipBtn) {
    pipBtn.addEventListener('click', function () {
      if (typeof dashboardAPI !== 'undefined' && dashboardAPI.togglePip) {
        dashboardAPI.togglePip();
      }
    });
  }

  if (pipStopBtn) {
    pipStopBtn.addEventListener('click', function () {
      if (typeof dashboardAPI !== 'undefined' && dashboardAPI.togglePip) {
        dashboardAPI.togglePip();
      }
    });
  }

  // Listen for PiP state changes from main process
  if (typeof dashboardAPI !== 'undefined' && dashboardAPI.onPipStateChanged) {
    dashboardAPI.onPipStateChanged(function (isOpen) {
      setPipState(isOpen);
    });
  }
})();

function setupNameEditHandlers() {
  if (!DOM.agentPanel) return;

  DOM.agentPanel.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.mc-name-edit-btn');
    if (editBtn) {
      const card = editBtn.closest('.mc-agent-card');
      const id = card.dataset.id;
      const ag = state.agents.get(id);
      if (ag) {
        state.editingId = id;
        state.editingValue = ag.name || '';
        updateAgentUI(ag);
        const input = card.querySelector('.mc-agent-name-input');
        if (input) {
          input.focus();
          input.select();
        }
      }
      return;
    }

    const cancelBtn = e.target.closest('.mc-name-btn.cancel');
    if (cancelBtn) {
      const card = cancelBtn.closest('.mc-agent-card');
      const id = card.dataset.id;
      state.editingId = null;
      state.editingValue = '';
      const ag = state.agents.get(id);
      if (ag) {
        updateAgentUI(ag);
      }
      return;
    }

    // Avatar button clicked -> toggle picker dropdown
    const avatarBtn = e.target.closest('.mc-avatar-btn');
    if (avatarBtn) {
      e.stopPropagation();
      const container = avatarBtn.closest('.mc-avatar-container');
      const dropdown = container.querySelector('.mc-avatar-picker-dropdown');
      
      // Close other dropdowns
      document.querySelectorAll('.mc-avatar-picker-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('active');
      });
      
      dropdown.classList.toggle('active');
      return;
    }

    // Avatar option selected
    const optionBtn = e.target.closest('.mc-avatar-option');
    if (optionBtn) {
      e.stopPropagation();
      const card = optionBtn.closest('.mc-agent-card');
      const agentId = card.dataset.id;
      const avatarIdx = parseInt(optionBtn.dataset.idx);
      
      saveAvatarOverride(agentId, avatarIdx);
      
      const ag = state.agents.get(agentId);
      if (ag) {
        updateAgentUI(ag);
      }
      updateOfficeCharacterAvatar(agentId, avatarIdx);
      return;
    }

    // Reset button clicked
    const resetBtn = e.target.closest('.mc-avatar-reset-btn');
    if (resetBtn) {
      e.stopPropagation();
      const card = resetBtn.closest('.mc-agent-card');
      const agentId = card.dataset.id;
      
      clearAvatarOverride(agentId);
      
      const ag = state.agents.get(agentId);
      if (ag) {
        updateAgentUI(ag);
      }
      const defaultIdx = (ag.avatarIndex !== undefined && ag.avatarIndex !== null)
        ? ag.avatarIndex : avatarIndexFromId(agentId);
      updateOfficeCharacterAvatar(agentId, defaultIdx);
      return;
    }
  });

  // Close open dropdowns on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.mc-avatar-picker-dropdown').forEach(d => {
      d.classList.remove('active');
    });
  });

  DOM.agentPanel.addEventListener('input', (e) => {
    if (e.target.classList.contains('mc-agent-name-input')) {
      state.editingValue = e.target.value;
    }
  });

  DOM.agentPanel.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('mc-agent-name-input') && e.key === 'Escape') {
      const card = e.target.closest('.mc-agent-card');
      const id = card.dataset.id;
      state.editingId = null;
      state.editingValue = '';
      const ag = state.agents.get(id);
      if (ag) {
        updateAgentUI(ag);
      }
    }
  });

  DOM.agentPanel.addEventListener('submit', async (e) => {
    const form = e.target.closest('.mc-name-edit-form');
    if (form) {
      e.preventDefault();
      const id = form.dataset.id;
      const input = form.querySelector('.mc-agent-name-input');
      const newName = input.value.trim();

      if (newName.length > 40) {
        alert('Name must not exceed 40 characters.');
        return;
      }

      try {
        const res = await fetch(`/api/agents/${id}/name`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: newName })
        });
        if (!res.ok) {
          const err = await res.json();
          alert(`Error: ${err.error || 'Failed to update name'}`);
          return;
        }
        const data = await res.json();
        state.editingId = null;
        state.editingValue = '';

        const ag = state.agents.get(id);
        if (ag) {
          ag.name = data.displayName;
          updateAgentUI(ag);
          if (typeof officeCharacters !== 'undefined') {
            const char = officeCharacters.characters.get(id);
            if (char) {
              char.role = data.displayName;
              char.metadata.name = data.displayName;
            }
          }
        }
      } catch (err) {
        console.error('Failed to update agent name:', err);
        alert('Failed to save name.');
      }
    }
  });
}

// ─── GROUPCHAT REPLAY ───
const replayState = {
  session: null,
  isPlaying: false,
  currentIndex: -1,
  playbackTimer: null,
  speed: 2,
  autoAdvanceDelay: 4000
};

function switchCanvas(targetView) {
  const canvas = document.getElementById('office-canvas');
  if (!canvas) return;

  if (targetView === 'groupchat') {
    const gcContainer = document.getElementById('groupchatCanvasContainer');
    if (gcContainer && canvas.parentElement !== gcContainer) {
      gcContainer.appendChild(canvas);
    }
  } else {
    const liveContainer = document.querySelector('.office-canvas-panel .panel-body');
    if (liveContainer && canvas.parentElement !== liveContainer) {
      const placeholder = document.getElementById('pipPlaceholder');
      if (placeholder) {
        liveContainer.insertBefore(canvas, placeholder);
      } else {
        liveContainer.appendChild(canvas);
      }
    }
  }
}

function initReplayCharacters() {
  const cIndex = typeof avatarIndexFromId === 'function' ? avatarIndexFromId('codex') : 0;
  const bIndex = typeof avatarIndexFromId === 'function' ? avatarIndexFromId('grok-build') : 1;
  const aIndex = typeof avatarIndexFromId === 'function' ? avatarIndexFromId('antigravity') : 2;

  const seats = (typeof GROUPCHAT_REPLAY_SEATS !== 'undefined') ? GROUPCHAT_REPLAY_SEATS : {
    codex: { x: 624, y: 480 },
    'grok-build': { x: 656, y: 448 },
    antigravity: { x: 688, y: 480 }
  };

  window.__groupchatReplayCharacters = [
    {
      id: 'codex',
      x: seats.codex.x,
      y: seats.codex.y,
      path: [],
      pathIndex: 0,
      facingDir: 'right',
      avatarFile: (typeof AVATAR_FILES !== 'undefined' && AVATAR_FILES[cIndex]) ? AVATAR_FILES[cIndex] : 'avatar_0.webp',
      skinIndex: cIndex,
      currentAnim: 'right_idle',
      animFrame: 0,
      animTimer: 0,
      agentState: 'thinking',
      restTimer: 0,
      bubble: null,
      role: '小C',
      metadata: {
        name: '小C',
        project: 'groupchat',
        tool: null,
        type: 'main',
        status: 'thinking',
        lastMessage: null
      }
    },
    {
      id: 'grok-build',
      x: seats['grok-build'].x,
      y: seats['grok-build'].y,
      path: [],
      pathIndex: 0,
      facingDir: 'down',
      avatarFile: (typeof AVATAR_FILES !== 'undefined' && AVATAR_FILES[bIndex]) ? AVATAR_FILES[bIndex] : 'avatar_1.webp',
      skinIndex: bIndex,
      currentAnim: 'down_idle',
      animFrame: 0,
      animTimer: 0,
      agentState: 'working',
      restTimer: 0,
      bubble: null,
      role: '小B',
      metadata: {
        name: '小B',
        project: 'groupchat',
        tool: null,
        type: 'main',
        status: 'working',
        lastMessage: null
      }
    },
    {
      id: 'antigravity',
      x: seats.antigravity.x,
      y: seats.antigravity.y,
      path: [],
      pathIndex: 0,
      facingDir: 'left',
      avatarFile: (typeof AVATAR_FILES !== 'undefined' && AVATAR_FILES[aIndex]) ? AVATAR_FILES[aIndex] : 'avatar_2.webp',
      skinIndex: aIndex,
      currentAnim: 'left_idle',
      animFrame: 0,
      animTimer: 0,
      agentState: 'working',
      restTimer: 0,
      bubble: null,
      role: '小A',
      metadata: {
        name: '小A',
        project: 'groupchat',
        tool: null,
        type: 'main',
        status: 'working',
        lastMessage: null
      }
    }
  ];
}

async function loadGroupChatSessions() {
  try {
    const res = await fetch('/api/planning/sessions' + window.location.search);
    const sessions = await res.json();
    const listEl = document.getElementById('groupchatSessionsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!sessions || sessions.length === 0) {
      listEl.innerHTML = '<div style="font-size:0.8rem;color:var(--color-text-muted);text-align:center;padding:16px;">No planning sessions found.</div>';
      return;
    }

    sessions.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));

    sessions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'groupchat-session-item';
      item.dataset.id = s.sessionId;
      
      const dateStr = s.startedAt ? new Date(s.startedAt).toLocaleString() : 'Unknown Time';
      item.innerHTML = `
        <div class="groupchat-session-title">${escapeHtml(s.title || ('Session ' + s.sessionId))}</div>
        <div class="groupchat-session-meta">
          Task: ${escapeHtml(s.taskNum || 'N/A')} | Messages: ${s.messageCount || 0}<br>
          ${escapeHtml(dateStr)}
        </div>
      `;
      
      item.onclick = () => selectGroupChatSession(s.sessionId);
      listEl.appendChild(item);
    });

    const activeId = localStorage.getItem('mc-selected-groupchat');
    if (activeId && sessions.some(s => s.sessionId === activeId)) {
      selectGroupChatSession(activeId);
    }
  } catch (err) {
    console.error('Failed to load planning sessions:', err);
  }
}

async function selectGroupChatSession(id) {
  document.querySelectorAll('.groupchat-session-item').forEach(x => {
    x.classList.toggle('active', x.dataset.id === id);
  });
  localStorage.setItem('mc-selected-groupchat', id);

  pauseReplay();

  const emptyEl = document.getElementById('groupchatEmptyState');
  const splitEl = document.getElementById('groupchatSplitView');
  if (emptyEl) emptyEl.style.display = 'none';
  if (splitEl) splitEl.style.display = 'flex';

  try {
    const jsonRes = await fetch(`/api/planning/sessions/${id}`);

    if (!jsonRes.ok) {
      let errorMsg = 'Failed to load session details';
      try {
        const errData = await jsonRes.json();
        if (errData && errData.error) {
          errorMsg = errData.error;
        }
      } catch (e) {}
      
      if (splitEl) splitEl.style.display = 'none';
      if (emptyEl) {
        emptyEl.style.display = 'flex';
        const iconEl = document.getElementById('groupchatEmptyIcon');
        const textEl = document.getElementById('groupchatEmptyText');
        if (iconEl) {
          if (errorMsg.includes('Unsupported schema version')) {
            iconEl.textContent = '⚠️';
          } else if (jsonRes.status === 404) {
            iconEl.textContent = '🔍';
          } else {
            iconEl.textContent = '❌';
          }
        }
        if (textEl) {
          if (errorMsg.includes('Unsupported schema version')) {
            textEl.innerHTML = `<span style="color:#ff7b72; font-weight:bold; font-size:1.05rem; display:block; margin-bottom:4px;">Unsupported Schema Version</span>
                                This session uses an incompatible schema. Please update your application to view it.`;
          } else if (jsonRes.status === 404) {
            textEl.innerHTML = `<span style="color:#ff7b72; font-weight:bold; font-size:1.05rem; display:block; margin-bottom:4px;">Session Not Found</span>
                                The selected planning session could not be found.`;
          } else {
            textEl.innerHTML = `<span style="color:#f85149; font-weight:bold; font-size:1.05rem; display:block; margin-bottom:4px;">Failed to Load Session</span>
                                Error: ${escapeHtml(errorMsg)}`;
          }
        }
      }
      return;
    }

    // Reset empty state to default values on success
    if (emptyEl) {
      const iconEl = document.getElementById('groupchatEmptyIcon');
      const textEl = document.getElementById('groupchatEmptyText');
      if (iconEl) iconEl.textContent = '💬';
      if (textEl) textEl.textContent = 'Select a GroupChat session to view details and replay.';
    }

    const sessionData = await jsonRes.json();
    replayState.session = sessionData;
    replayState.currentIndex = -1;

    const transPanel = document.getElementById('groupchatTranscriptPanel');
    if (transPanel) {
      transPanel.innerHTML = '';
      
      const h1 = document.createElement('h1');
      h1.textContent = sessionData.title || `Planning Session ${id}`;
      transPanel.appendChild(h1);

      const metaDiv = document.createElement('div');
      metaDiv.style.cssText = 'font-size:0.8rem;color:var(--color-text-muted);margin-bottom:20px;';
      metaDiv.innerHTML = `
        <strong>Task:</strong> ${escapeHtml(sessionData.taskNum || 'N/A')}<br>
        <strong>Started:</strong> ${sessionData.startedAt ? new Date(sessionData.startedAt).toLocaleString() : 'N/A'}<br>
        <strong>Finished:</strong> ${sessionData.finishedAt ? new Date(sessionData.finishedAt).toLocaleString() : 'N/A'}
      `;
      transPanel.appendChild(metaDiv);

      const msgList = document.createElement('div');
      sessionData.messages.forEach((msg, idx) => {
        const block = document.createElement('div');
        block.className = 'groupchat-message-block';
        block.dataset.msgIdx = idx;
        
        const part = sessionData.participants.find(p => p.speakerId === msg.speakerId);
        const name = part ? part.speakerName : msg.speakerId;
        const speakerClass = msg.speakerId;

        block.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
            <div class="groupchat-speaker-badge ${speakerClass}">${escapeHtml(name)} (${escapeHtml(part?.role || 'participant')})</div>
            <div class="groupchat-message-meta" style="font-size: 0.75rem; color: var(--color-text-muted);">
              Round ${msg.round || 'N/A'} &bull; Step: ${escapeHtml(msg.stepId || 'N/A')} &bull; ${msg.at ? new Date(msg.at).toLocaleTimeString() : 'N/A'}
            </div>
          </div>
          <div class="groupchat-message-content" style="white-space: pre-wrap;">${escapeHtml(msg.content)}</div>
        `;
        
        block.onclick = () => {
          seekTo(idx);
          pauseReplay();
        };
        msgList.appendChild(block);
      });
      transPanel.appendChild(msgList);
    }

    const slider = document.getElementById('gcProgressSlider');
    if (slider) {
      slider.max = sessionData.messages.length - 1;
      slider.value = 0;
    }

    window.__groupchatReplayActive = true;
    initReplayCharacters();

    seekTo(0);

  } catch (err) {
    console.error('Failed to load session details:', err);
  }
}

function seekTo(index) {
  if (!replayState.session || replayState.session.messages.length === 0) return;
  
  index = Math.max(0, Math.min(index, replayState.session.messages.length - 1));
  replayState.currentIndex = index;

  const slider = document.getElementById('gcProgressSlider');
  if (slider) slider.value = index;

  const label = document.getElementById('gcProgressLabel');
  if (label) {
    label.textContent = `${index + 1} / ${replayState.session.messages.length}`;
  }

  document.querySelectorAll('.groupchat-message-block').forEach(x => {
    x.classList.toggle('groupchat-message-highlight', parseInt(x.dataset.msgIdx) === index);
  });

  const activeBlock = document.querySelector(`.groupchat-message-block[data-msg-idx="${index}"]`);
  if (activeBlock) {
    activeBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const msg = replayState.session.messages[index];
  if (window.__groupchatReplayCharacters) {
    window.__groupchatReplayCharacters.forEach(char => {
      if (char.id === msg.speakerId) {
        let dispText = msg.content;
        if (dispText.length >= 200) {
          dispText = dispText.substring(0, 197) + '...';
        }
        char.bubble = {
          text: dispText,
          icon: null,
          expiresAt: Infinity
        };
      } else {
        char.bubble = null;
      }
    });
  }
}

function startReplay() {
  if (replayState.isPlaying) return;
  if (!replayState.session || replayState.session.messages.length === 0) return;

  replayState.isPlaying = true;
  const btn = document.getElementById('gcPlayPauseBtn');
  if (btn) btn.textContent = '⏸';

  if (replayState.currentIndex >= replayState.session.messages.length - 1) {
    seekTo(0);
  }

  runPlaybackTick();
}

function runPlaybackTick() {
  if (!replayState.isPlaying) return;

  const delay = replayState.autoAdvanceDelay / replayState.speed;
  replayState.playbackTimer = setTimeout(() => {
    const nextIdx = replayState.currentIndex + 1;
    if (nextIdx < replayState.session.messages.length) {
      seekTo(nextIdx);
      runPlaybackTick();
    } else {
      pauseReplay();
    }
  }, delay);
}

function pauseReplay() {
  replayState.isPlaying = false;
  const btn = document.getElementById('gcPlayPauseBtn');
  if (btn) btn.textContent = '▶';
  if (replayState.playbackTimer) {
    clearTimeout(replayState.playbackTimer);
    replayState.playbackTimer = null;
  }
}

function stepPrev() {
  pauseReplay();
  seekTo(replayState.currentIndex - 1);
}

function stepNext() {
  pauseReplay();
  seekTo(replayState.currentIndex + 1);
}

function setupGroupChatControls() {
  const playBtn = document.getElementById('gcPlayPauseBtn');
  if (playBtn) {
    playBtn.onclick = () => {
      if (replayState.isPlaying) {
        pauseReplay();
      } else {
        startReplay();
      }
    };
  }

  const prevBtn = document.getElementById('gcStepPrevBtn');
  if (prevBtn) prevBtn.onclick = stepPrev;

  const restartBtn = document.getElementById('gcRestartBtn');
  if (restartBtn) {
    restartBtn.onclick = () => {
      seekTo(0);
      startReplay();
    };
  }

  const nextBtn = document.getElementById('gcStepNextBtn');
  if (nextBtn) nextBtn.onclick = stepNext;

  const slider = document.getElementById('gcProgressSlider');
  if (slider) {
    slider.oninput = (e) => {
      seekTo(parseInt(e.target.value));
      pauseReplay();
    };
  }

  const speedSelect = document.getElementById('gcSpeedSelect');
  if (speedSelect) {
    speedSelect.onchange = (e) => {
      replayState.speed = parseFloat(e.target.value);
      if (replayState.isPlaying) {
        pauseReplay();
        startReplay();
      }
    };
  }
}

async function loadUsername() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data && data.username) {
      if (DOM.officePanelTitle) {
        DOM.officePanelTitle.textContent = `${data.username}'s Office`;
      }
    }
  } catch (e) {
    console.error('Error loading username:', e);
  }
}

// ─── BOOT ───
async function initApp() {
  // Wait for avatar files config first to avoid empty avatar list in initial rendering
  if (typeof loadAvatarFiles === 'function') {
    await loadAvatarFiles();
  }

  // Sync startup view
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  let btn = document.querySelector(`[data-view="${state.currentView}"]`);
  if (!btn) btn = document.querySelector(`[data-view="office"]`);
  btn.classList.add('active');
  bClickObj = btn;
  const target = bClickObj.dataset.view;
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  const tgtEl = document.getElementById(`${target}View`);
  if (tgtEl) tgtEl.classList.add('active');

  setupNameEditHandlers();
  setupGroupChatControls();
  loadUsername();
  connectSSE();
  if (target === 'heatmap') renderHeatmapView();
  else if (target === 'usage') renderUsageView();
  else if (target === 'groupchat') {
    loadGroupChatSessions();
  }

  // We rely on standard office-init.js to boot the canvas logic
  if (typeof initOffice === 'function') setTimeout(() => {
    initOffice().then(() => {
      if (state.currentView === 'groupchat') {
        switchCanvas('groupchat');
      }
    });
    setupOfficeClickHandler();
  }, 100);
}

document.addEventListener('DOMContentLoaded', initApp);
