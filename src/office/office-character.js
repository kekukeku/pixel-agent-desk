/**
 * Office Character — Agent ↔ character mapping, movement, state→zone logic
 * Ported from pixel_office renderer.ts (agent management parts)
 */

/* eslint-disable no-unused-vars */

var officeCharacters = {
  characters: new Map(),
  seatAssignments: new Map(), // deskIndex → agentId

  /** Dashboard SSE agent → office character */
  addCharacter: function (agentData) {
    if (this.characters.has(agentData.id)) {
      this.updateCharacter(agentData);
      return;
    }

    // Map dashboard status to office state
    const officeState = this._mapStatus(agentData.status);

    // Prefer browser local storage override, then server-assigned avatarIndex, fallback: hash calculation
    let avatarIdx;
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('pixel-agent-desk.avatarOverrides.v1');
        if (stored) {
          const overrides = JSON.parse(stored);
          if (overrides[agentData.id] !== undefined) {
            avatarIdx = overrides[agentData.id];
          }
        }
      } catch (e) {
        console.error('[OfficeCharacter] Failed to load local avatar overrides:', e);
      }
    }
    // ponytail: fallback to server-assigned or hash-based defaults if no override is set
    if (avatarIdx === undefined) {
      avatarIdx = (agentData.avatarIndex !== undefined && agentData.avatarIndex !== null)
        ? agentData.avatarIndex : avatarIndexFromId(agentData.id);
    }
    const avatarFile = AVATAR_FILES[avatarIdx] || AVATAR_FILES[0];

    const char = {
      id: agentData.id,
      x: (officeLayers.width  || 800) / 2 + (Math.random() - 0.5) * 80,
      y: (officeLayers.height || 800) / 2 + (Math.random() - 0.5) * 80,
      path: [],
      pathIndex: 0,
      facingDir: 'down',
      avatarFile: avatarFile,
      skinIndex: avatarIdx, // kept for compat
      deskIndex: undefined,
      currentAnim: 'down_idle',
      animFrame: 0,
      animTimer: 0,
      agentState: officeState,
      restTimer: 0,
      bubble: null,
      role: agentData.agentName || agentData.name || 'Spirit',
      metadata: {
        name: agentData.agentName || agentData.name || 'Spirit',
        project: agentData.projectLabel !== undefined ? agentData.projectLabel : (agentData.project !== undefined ? agentData.project : ''),
        tool: agentData.currentTool || null,
        publicActivityText: agentData.publicActivityText || null,
        type: agentData.type || 'main',
        status: agentData.status || 'idle',
        lastMessage: agentData.lastMessage || null,
      },
    };

    this.characters.set(agentData.id, char);

    // Assign desk if needed
    if (STATE_ZONE_MAP[officeState] === 'desk') {
      this.assignDesk(agentData.id);
    }

    this._updateTarget(char);
    this._setBubble(char, agentData);

  },

  updateCharacter: function (agentData) {
    const char = this.characters.get(agentData.id);
    if (!char) {
      this.addCharacter(agentData);
      return;
    }

    const oldState = char.agentState;
    const newState = this._mapStatus(agentData.status);
    char.agentState = newState;
    char.role = agentData.agentName || agentData.name || char.role;
    char.metadata.name = agentData.agentName || agentData.name || char.metadata.name;
    char.metadata.project = agentData.projectLabel !== undefined
      ? agentData.projectLabel
      : (agentData.project !== undefined ? agentData.project : char.metadata.project);
    char.metadata.tool = agentData.currentTool || null;
    char.metadata.publicActivityText = agentData.publicActivityText !== undefined
      ? agentData.publicActivityText
      : char.metadata.publicActivityText;
    char.metadata.status = agentData.status || 'idle';
    char.metadata.type = agentData.type || char.metadata.type;
    char.metadata.lastMessage = agentData.lastMessage || char.metadata.lastMessage;

    // State change → zone transition
    if (oldState !== newState) {
      const oldZone = STATE_ZONE_MAP[oldState] || 'idle';
      const newZone = STATE_ZONE_MAP[newState] || 'idle';

      if (newZone === 'desk' && char.deskIndex === undefined) {
        this.assignDesk(agentData.id);
      } else if (newZone === 'idle' && oldZone === 'desk') {
        this.releaseDesk(agentData.id);
      }

      // Trigger effect on state change
      if (typeof officeRenderer !== 'undefined') {
        const stateColor = STATE_COLORS[newState] || '#94a3b8';
        officeRenderer.spawnEffect('stateChange', char.x, char.y - 32, stateColor);
        if (newState === 'done') {
          officeRenderer.spawnEffect('confetti', char.x, char.y - 45);
        } else if (newState === 'error') {
          officeRenderer.spawnEffect('warning', char.x, char.y - 65);
        }
      }
    }

    this._setBubble(char, agentData);
  },

  removeCharacter: function (agentId) {
    this.releaseDesk(agentId);
    this.characters.delete(agentId);
  },

  assignDesk: function (agentId) {
    const char = this.characters.get(agentId);
    if (!char || char.deskIndex !== undefined) return;

    // Collect available seats
    const usedDesks = new Set(this.seatAssignments.keys());
    const deskCoords = officeCoords.desk || [];
    const available = [];
    for (let i = 0; i < deskCoords.length; i++) {
      if (!usedDesks.has(i)) available.push(i);
    }

    if (available.length === 0) {
      // D6: Seats exceeded — overflow handling
      char.deskOverflow = true;
      return;
    }

    // Deterministic random based on agent ID (same agent gets same preference)
    const hash = avatarIndexFromId(agentId);
    const idx = available[hash % available.length];
    char.deskIndex = idx;
    this.seatAssignments.set(idx, agentId);
  },

  releaseDesk: function (agentId) {
    const char = this.characters.get(agentId);
    if (!char) return;
    if (char.deskIndex !== undefined) {
      this.seatAssignments.delete(char.deskIndex);
      char.deskIndex = undefined;
    }
    char.deskOverflow = false;
  },

  updateAll: function (deltaSec, deltaMs) {
    const self = this;

    // Refresh expired bubbles before rendering this frame
    self.refreshBubbles();

    this.characters.forEach(function (char) {
      self._updateTarget(char);
      self._updateMovement(char, deltaSec);
      tickOfficeAnimation(char, deltaMs);

      // Working sparkles
      if (char.agentState === 'working' && Math.random() < 0.05) {
        if (typeof officeRenderer !== 'undefined') {
          officeRenderer.spawnEffect('focus', char.x, char.y - 40);
        }
      }
    });
  },

  _updateTarget: function (char) {
    const coords = officeCoords;
    if (!coords || !coords.desk || !coords.idle) return;

    // WORKING / THINKING / HELP / ERROR → desk
    if (char.agentState === 'working' || char.agentState === 'thinking' ||
        char.agentState === 'error' || char.agentState === 'help') {
      char.restTimer = 0;

      // D6: Overflow agent — move to idle coords near desk (standing work)
      if (char.deskOverflow) {
        if (char.path.length > 0 && char.pathIndex < char.path.length) return;
        // Select one of the idle coords near the desk area
        const nearIdle = this._findNearDeskIdleSpot(char);
        if (nearIdle) {
          if (Math.abs(char.x - nearIdle.x) < 5 && Math.abs(char.y - nearIdle.y) < 5) return;
          char.path = officePathfinder.findPath(char.x, char.y, nearIdle.x, nearIdle.y);
          char.pathIndex = 0;
        }
        return;
      }

      if (char.deskIndex !== undefined && char.deskIndex < coords.desk.length) {
        const target = coords.desk[char.deskIndex];
        const tx = Math.floor(target.x);
        const ty = Math.floor(target.y);

        if (char.path.length === 0 && Math.floor(char.x) === tx && Math.floor(char.y) === ty) return;
        if (char.path.length > 0) {
          const last = char.path[char.path.length - 1];
          if (Math.floor(last.x) === tx && Math.floor(last.y) === ty) return;
        }

        const found = officePathfinder.findPath(char.x, char.y, tx, ty);
        char.path = found;
        char.pathIndex = 0;
      }
      return;
    }

    // IDLE / WAITING / DONE → idle zone
    if (char.path.length > 0 && char.pathIndex < char.path.length) return;

    const isAtIdle = coords.idle.some(function (p) {
      return Math.abs(p.x - char.x) < 5 && Math.abs(p.y - char.y) < 5;
    });

    if (isAtIdle) return;

    // Find unoccupied idle spot
    const occupied = {};
    const self = this;
    this.characters.forEach(function (a) {
      if (a.id === char.id) return;
      let ax = Math.floor(a.x), ay = Math.floor(a.y);
      if (a.path.length > 0) {
        const t = a.path[a.path.length - 1];
        ax = Math.floor(t.x);
        ay = Math.floor(t.y);
      }
      occupied[ax + ',' + ay] = true;
    });

    const valid = coords.idle.filter(function (p) {
      return !occupied[Math.floor(p.x) + ',' + Math.floor(p.y)];
    });

    if (valid.length > 0) {
      const dest = valid[Math.floor(Math.random() * valid.length)];
      char.path = officePathfinder.findPath(char.x, char.y, dest.x, dest.y);
      char.pathIndex = 0;
    }
  },

  _updateMovement: function (char, deltaSec) {
    const isArrived = char.path.length === 0 || char.pathIndex >= char.path.length;

    const speedMultiplier = char.agentState === 'playing' ? 2.0 : 1.0;
    if (isArrived) {
      // Apply seat config
      const allSpots = (officeCoords.desk || []).concat(officeCoords.idle || []);
      let currentSpot = null;
      for (let i = 0; i < allSpots.length; i++) {
        if (Math.abs(allSpots[i].x - char.x) < 5 && Math.abs(allSpots[i].y - char.y) < 5) {
          currentSpot = allSpots[i];
          break;
        }
      }

      if (char.agentState === 'done' || char.agentState === 'completed') {
        if (currentSpot && currentSpot.type === 'idle') {
          const entry = IDLE_SEAT_MAP[currentSpot.id];
          char.currentAnim = (entry === 'dance') ? 'dance' : 'sit_' + (entry || 'down');
        } else {
          char.currentAnim = 'sit_' + (char.facingDir || 'down');
        }
      } else if (char.deskOverflow) {
        // D6: Overflow agent uses standing work pose
        char.facingDir = 'down';
        char.currentAnim = 'down_idle';
      } else if (char.agentState === 'error') {
        char.currentAnim = 'alert_jump';
      } else if (currentSpot && currentSpot.type === 'idle') {
        // Idle zone: sit based on seat config (stand only for animType:'stand' spots)
        const idleConfig = getSeatConfig(currentSpot.id);
        char.facingDir = idleConfig.dir;
        char.currentAnim = idleConfig.animType === 'sit' ? 'sit_' + idleConfig.dir : idleConfig.dir + '_idle';
      } else {
        // Desk spot: use SEAT_MAP direction + sit/work pose
        const config = currentSpot ? getSeatConfig(currentSpot.id) : { dir: 'down', animType: 'sit' };
        char.facingDir = config.dir;
        if (config.animType === 'sit') {
          const isWorking = char.agentState === 'working' || char.agentState === 'thinking' ||
                            char.agentState === 'help';
          char.currentAnim = (isWorking ? 'sit_work_' : 'sit_') + config.dir;
        } else {
          char.currentAnim = config.dir + '_idle';
        }
      }
      return;
    }

    // Move along path
    const target = char.path[char.pathIndex];
    const dx = target.x - char.x;
    const dy = target.y - char.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < OFFICE.ARRIVE_THRESHOLD) {
      char.x = target.x;
      char.y = target.y;
      char.pathIndex++;
    } else {
      const speed = OFFICE.MOVE_SPEED * speedMultiplier * deltaSec;
      char.x += (dx / dist) * speed;
      char.y += (dy / dist) * speed;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      char.facingDir = dir;
      char.currentAnim = animKeyFromDir(dir, true);
    }
  },

  _mapStatus: function (dashboardStatus) {
    const map = {
      'working': 'working',
      'thinking': 'thinking',
      'waiting': 'idle',
      'completed': 'done',
      'done': 'done',
      'help': 'help',
      'error': 'error',
      'playing': 'playing',
    };
    return map[dashboardStatus] || 'idle';
  },

  _setBubble: function (char, agentData, fallbackKind) {
    let text = null;
    let icon = null;
    let expiresAt = Infinity;
    let kind = 'state';

    const status = agentData.status || char.metadata.status;
    const pubText = agentData.publicActivityText !== undefined
      ? agentData.publicActivityText
      : char.metadata.publicActivityText;
    const tool = agentData.currentTool || char.metadata.tool;

    if (fallbackKind === 'tool') {
      // TTL expired — downgrade to tool fallback
      if (tool) {
        text = tool;
        icon = null;
        expiresAt = Infinity;
        kind = 'tool';
      } else {
        // Tool also absent, go to state fallback
        this._setBubble(char, agentData, 'state');
        return;
      }
    } else if (fallbackKind === 'state') {
      // Tool/activity absent, use state fallback
      if (status === 'thinking') {
        text = 'Thinking...';
      } else if (status === 'working') {
        text = 'Working...';
      } else if (status === 'completed' || status === 'done') {
        text = 'Done!';
      } else if (status === 'help') {
        text = 'Need help!';
      } else if (status === 'error') {
        text = 'Error!';
      } else if (status === 'playing') {
        text = 'Playing...';
      }
      // idle / waiting / unknown: clear bubble
      if (!text) {
        char.bubble = null;
        return;
      }
      icon = null;
      expiresAt = Infinity;
      kind = 'state';
    } else if (pubText && String(pubText).trim()) {
      // Priority 1: public activity text (TTL 12s)
      text = String(pubText).trim();
      icon = null;
      expiresAt = Date.now() + 12000;
      kind = 'activity';
    } else if (tool && String(tool).trim()) {
      // Priority 2: current tool (persistent while active)
      text = String(tool).trim();
      icon = null;
      expiresAt = Infinity;
      kind = 'tool';
    } else {
      // Priority 3: state fallback
      this._setBubble(char, agentData, 'state');
      return;
    }

    if (text) {
      char.bubble = { text: text, icon: icon, expiresAt: expiresAt, kind: kind };
    }
  },

  /**
   * Refresh expired bubbles — downgrade to tool or state fallback.
   * Called before rendering to ensure bubbles never go blank.
   */
  refreshBubbles: function () {
    const now = Date.now();
    this.characters.forEach(function (char) {
      if (!char.bubble) return;
      if (char.bubble.expiresAt > now) return; // still valid

      // Expired: downgrade to lower priority
      if (char.bubble.kind === 'activity') {
        // Downgrade to tool fallback
        if (char.metadata.tool) {
          char.bubble = {
            text: char.metadata.tool,
            icon: null,
            expiresAt: Infinity,
            kind: 'tool'
          };
        } else {
          // No tool, downgrade to state fallback
          const status = char.metadata.status;
          let text = null;
          if (status === 'thinking') text = 'Thinking...';
          else if (status === 'working') text = 'Working...';
          else if (status === 'completed' || status === 'done') text = 'Done!';
          else if (status === 'help') text = 'Need help!';
          else if (status === 'error') text = 'Error!';
          if (text) {
            char.bubble = { text: text, icon: null, expiresAt: Infinity, kind: 'state' };
          } else {
            char.bubble = null;
          }
        }
      }
      // tool/state kind with Infinity never expires; if they do for some reason, clear
      else {
        char.bubble = null;
      }
    });
  },

  /** D6: Find an available idle coordinate near the desk area (for overflow agents) */
  _findNearDeskIdleSpot: function (char) {
    const coords = officeCoords;
    if (!coords || !coords.idle || !coords.desk || coords.desk.length === 0) return null;

    // Calculate average coordinates of the desk area
    let avgX = 0, avgY = 0;
    for (let i = 0; i < coords.desk.length; i++) {
      avgX += coords.desk[i].x;
      avgY += coords.desk[i].y;
    }
    avgX /= coords.desk.length;
    avgY /= coords.desk.length;

    // Sort idle coords by distance from desk average coordinates
    const occupied = {};
    this.characters.forEach(function (a) {
      if (a.id === char.id) return;
      let ax = Math.floor(a.x), ay = Math.floor(a.y);
      if (a.path.length > 0) {
        const t = a.path[a.path.length - 1];
        ax = Math.floor(t.x);
        ay = Math.floor(t.y);
      }
      occupied[ax + ',' + ay] = true;
    });

    const candidates = coords.idle.filter(function (p) {
      return !occupied[Math.floor(p.x) + ',' + Math.floor(p.y)];
    }).sort(function (a, b) {
      const da = Math.abs(a.x - avgX) + Math.abs(a.y - avgY);
      const db = Math.abs(b.x - avgX) + Math.abs(b.y - avgY);
      return da - db;
    });

    // Deterministic selection (based on agent ID)
    if (candidates.length === 0) return null;
    const idHash = avatarIndexFromId(char.id);
    return candidates[idHash % Math.min(candidates.length, 5)];
  },

  getCharacterArray: function () {
    return Array.from(this.characters.values());
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { officeCharacters };
}
