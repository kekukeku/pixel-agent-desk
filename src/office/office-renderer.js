/**
 * Office Renderer — Canvas render loop, layer compositing, effects
 * Ported from pixel_office renderer.ts (rendering parts)
 */

/* eslint-disable no-unused-vars */

var officeRenderer = {
  canvas: null,
  ctx: null,
  rafId: 0,
  lastTime: 0,
  effects: [],
  laptopImages: { down: null, up: null, left: null, right: null },
  laptopOpenImages: { down: null, up: null, left: null, right: null },

  async init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 1. Load layers (bg/fg)
    await buildOfficeLayers();
    canvas.width = officeLayers.width;
    canvas.height = officeLayers.height;

    // 2. Build pathfinder
    await officePathfinder.init(officeLayers.width, officeLayers.height);

    // 3. Parse coordinates
    await parseMapCoordinates(officeLayers.width, officeLayers.height);

    // 4. Load all skins + laptop images in parallel
    const resMap = { down: 'front', up: 'back', left: 'left', right: 'right' };
    const directions = ['down', 'up', 'left', 'right'];
    const self = this;
    const ts = Date.now();

    const promises = [loadAllOfficeSkins()];
    directions.forEach(function (d) {
      promises.push(new Promise(function (resolve) {
        const img = new Image();
        img.src = '/public/office/ojects/office_laptop_' + resMap[d] + '_close.webp?v=' + ts;
        img.onload = function () { self.laptopImages[d] = img; resolve(); };
        img.onerror = function () { resolve(); };
      }));
      promises.push(new Promise(function (resolve) {
        const img = new Image();
        img.src = '/public/office/ojects/office_laptop_' + resMap[d] + '_open.webp?v=' + ts;
        img.onload = function () { self.laptopOpenImages[d] = img; resolve(); };
        img.onerror = function () { resolve(); };
      }));
    });

    await Promise.all(promises);

    // 5. Parse laptop object coords
    await parseObjectCoordinates(officeLayers.width, officeLayers.height);

    this.lastTime = performance.now();
    this.loop(this.lastTime);
  },

  stop: function () {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  },

  resume: function () {
    if (this.rafId) return; // already running
    if (!this.canvas) return;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  },

  loop: function (now) {
    const self = this;
    self.rafId = requestAnimationFrame(function (t) { self.loop(t); });
    const deltaMs = Math.min(now - self.lastTime, 100);
    self.lastTime = now;
    self.update(deltaMs);
    self.render();
  },

  update: function (deltaMs) {
    const deltaSec = deltaMs / 1000;
    officeCharacters.updateAll(deltaSec, deltaMs);
    this.updateEffects(deltaMs);
  },

  render: function () {
    if (!this.ctx || !officeLayers.bgImage) return;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Background
    ctx.drawImage(officeLayers.bgImage, 0, 0);

    // 2. Ambient map animation
    this.renderAmbientOverlay(ctx);

    // 3. Laptops
    const laptopSpots = officeCoords.laptopSpots || [];
    const chars = officeCharacters.getCharacterArray();
    for (let i = 0; i < laptopSpots.length; i++) {
      const spot = laptopSpots[i];
      const seatId = LAPTOP_ID_MAP[i] !== undefined ? LAPTOP_ID_MAP[i] : i;

      const isAtDesk = chars.some(function (a) {
        return a.deskIndex === seatId &&
          (a.agentState === 'working' || a.agentState === 'thinking' ||
           a.agentState === 'error' || a.agentState === 'help');
      });

      const img = isAtDesk ? this.laptopOpenImages[spot.dir] : this.laptopImages[spot.dir];
      if (img) ctx.drawImage(img, spot.x, spot.y);
    }

    // 4. Characters (Y-sorted)
    const sorted = chars.slice().sort(function (a, b) { return a.y - b.y; });

    for (let j = 0; j < sorted.length; j++) {
      const agent = sorted[j];

      if (agent.agentState === 'error') {
        if (Math.random() < 0.1) this.spawnEffect('warning', agent.x, agent.y - 65);
      }

      const isSubType = agent.metadata && agent.metadata.type === 'sub';
      const baseScale = isSubType ? 0.85 : 1.0;

      ctx.save();
      ctx.translate(agent.x, agent.y);
      ctx.scale(baseScale, baseScale);
      ctx.translate(-agent.x, -agent.y);
      drawOfficeSprite(ctx, agent);
      ctx.restore();

      drawOfficeNameTag(ctx, agent);
      drawOfficeBubble(ctx, agent);
    }

    // 5. Foreground
    if (officeLayers.fgImage && officeLayers.fgImage.complete && officeLayers.fgImage.naturalWidth > 0) {
      ctx.drawImage(officeLayers.fgImage, 0, 0);
    }

    // 6. Effects
    this.renderEffects(ctx);
  },

  isAnimatedMap: function () {
    return ['map1', 'map2', 'map3', 'map4', 'map5'].includes(officeLayers.mapFolder);
  },

  renderAmbientOverlay: function (ctx) {
    if (!this.isAnimatedMap()) return;
    const t = performance.now() / 1000;
    const mapFolder = officeLayers.mapFolder;

    if (mapFolder === 'map1' || mapFolder === 'map2') {
      this.drawForestSnake(ctx, t, mapFolder);
      this.drawForestCat(ctx, t, mapFolder);
      this.drawChalkboardCode(ctx, t, mapFolder);
      if (mapFolder === 'map1') this.drawWhiteboardTrends(ctx, t, mapFolder);
      if (mapFolder === 'map2') this.drawHearthFire(ctx, t);
    } else if (mapFolder === 'map3') {
      this.drawSwayingBamboo(ctx, t);
      this.drawCalligraphyScroll(ctx, t);
      this.drawRedPanda(ctx, t);
      this.drawIndoorSnake(ctx, t, { x: 684, y: 196, ampX: 12, ampY: 3, body: '#5fae57', head: '#8bd46a' });
    } else if (mapFolder === 'map4') {
      this.drawBlinkingPortraits(ctx, t);
      this.drawPottedPlantSway(ctx, t);
      this.drawEurohound(ctx, t);
      this.drawIndoorSnake(ctx, t, { x: 688, y: 196, ampX: 12, ampY: 3, body: '#6a7d3f', head: '#a6b76a' });
    } else if (mapFolder === 'map5') {
      this.drawStarTwinkles(ctx, t);
      this.drawInstrumentLights(ctx, t);
      this.drawLedWaveform(ctx, t);
      this.drawGreyAlien(ctx, t);
      this.drawIndoorSnake(ctx, t, { x: 686, y: 195, ampX: 13, ampY: 3, body: '#49b86a', head: '#8ee68e' });
    }
  },

  drawForestSnake: function (ctx, t, mapFolder) {
    const base = mapFolder === 'map2'
      ? { x: 682, y: 190, ampX: 14, ampY: 4 }
      : { x: 684, y: 176, ampX: 16, ampY: 4 };
    const x = base.x + Math.sin(t * 0.75) * base.ampX;
    const y = base.y + Math.cos(t * 0.95) * base.ampY;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#182f1d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const px = i * 7;
      const py = Math.sin(t * 3 + i * 0.9) * 3;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = '#6bbf59';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#8de26f';
    ctx.fillRect(38, -3, 7, 6);
    ctx.fillStyle = '#111';
    ctx.fillRect(43, -1, 1, 1);
    ctx.restore();
  },

  drawForestCat: function (ctx, t, mapFolder) {
    const base = mapFolder === 'map2'
      ? { x: 326, y: 430, ampX: 12, ampY: 4 }
      : { x: 330, y: 430, ampX: 13, ampY: 4 };
    const x = base.x + Math.sin(t * 0.55) * base.ampX;
    const y = base.y + Math.sin(t * 1.2) * base.ampY;
    const step = Math.floor(t * 3) % 2;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.fillStyle = '#2d211a';
    ctx.fillRect(3, 14, 20, 8);
    ctx.fillRect(7, 6, 12, 10);
    ctx.fillStyle = '#4a3428';
    ctx.fillRect(5, 13, 18, 8);
    ctx.fillStyle = '#2d211a';
    ctx.fillRect(7, 3, 4, 5);
    ctx.fillRect(15, 3, 4, 5);
    ctx.fillRect(23, 16 + step, 7, 3);
    ctx.fillStyle = '#f2d6a2';
    ctx.fillRect(9, 10, 2, 2);
    ctx.fillRect(16, 10, 2, 2);
    ctx.fillStyle = '#15110e';
    ctx.fillRect(12, 13, 3, 1);
    ctx.fillRect(7, 22, 4, 3 + step);
    ctx.fillRect(17, 22, 4, 3 + (1 - step));
    ctx.restore();
  },

  drawChalkboardCode: function (ctx, t, mapFolder) {
    const boards = mapFolder === 'map2'
      ? [{ x: 648, y: 317, w: 120, h: 57 }]
      : [{ x: 652, y: 315, w: 130, h: 58 }];
    const snippets = [
      ['for agent in desk:', '  path.find()', '  sit.work()'],
      ['if state == done:', '  go(idle)', '  dance()'],
      ['route = astar()', 'while moving:', '  step++'],
      ['forest.map()', 'snake.tick()', 'cat.patrol()'],
    ];
    const lines = snippets[Math.floor(t / 3) % snippets.length];

    ctx.save();
    ctx.font = '8px "Courier New", monospace';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 1;
    boards.forEach(function (board, idx) {
      const flicker = 0.72 + Math.sin(t * 2.3 + idx) * 0.08;
      ctx.save();
      ctx.beginPath();
      ctx.rect(board.x + 5, board.y + 5, board.w - 10, board.h - 10);
      ctx.clip();
      ctx.fillStyle = `rgba(218, 241, 193, ${flicker})`;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[(i + idx) % lines.length];
        ctx.fillText(line.slice(0, Math.max(7, Math.floor((board.w - 16) / 7))), board.x + 8, board.y + 8 + i * 11);
      }
      ctx.strokeStyle = 'rgba(218, 241, 193, 0.2)';
      ctx.beginPath();
      ctx.moveTo(board.x + 7, board.y + board.h - 8);
      ctx.lineTo(board.x + board.w - 7, board.y + board.h - 8);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  },

  drawWhiteboardTrends: function (ctx, t, mapFolder) {
    const board = mapFolder === 'map2'
      ? { x: 548, y: 362, w: 90, h: 48 }
      : { x: 538, y: 346, w: 70, h: 57 };
    const phase = t * 1.1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(board.x + 5, board.y + 5, board.w - 10, board.h - 10);
    ctx.clip();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const px = board.x + 8 + i * ((board.w - 16) / 6);
      const py = board.y + board.h - 9 - i * 3 + Math.sin(phase + i) * 3;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.beginPath();
    for (let j = 0; j < 7; j++) {
      const px2 = board.x + 8 + j * ((board.w - 16) / 6);
      const py2 = board.y + 11 + j * 2 + Math.cos(phase + j * 0.8) * 3;
      if (j === 0) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
    ctx.fillRect(board.x + board.w - 13, board.y + 6, 5, 5);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.fillRect(board.x + board.w - 13, board.y + 14, 5, 5);
    ctx.restore();
  },

  drawHearthFire: function (ctx, t) {
    const x = 406;
    const y = 106;
    const flicker = Math.sin(t * 8) * 2 + Math.sin(t * 13) * 1.5;

    ctx.save();
    ctx.globalAlpha = 0.82 + Math.sin(t * 10) * 0.12;
    ctx.fillStyle = 'rgba(255, 172, 42, 0.25)';
    ctx.fillRect(x - 10, y - 8, 20, 14);

    ctx.fillStyle = '#b7351f';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 5);
    ctx.lineTo(x - 4, y - 6 - flicker);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x + 4, y - 7 + flicker);
    ctx.lineTo(x + 8, y + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff8f1f';
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 5);
    ctx.lineTo(x - 1, y - 8 + flicker);
    ctx.lineTo(x + 2, y + 1);
    ctx.lineTo(x + 5, y - 5 - flicker);
    ctx.lineTo(x + 6, y + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffe36e';
    ctx.fillRect(x - 2, y - 2 - Math.round(flicker), 4, 7);
    ctx.restore();
  },

  drawIndoorSnake: function (ctx, t, config) {
    const x = config.x + Math.sin(t * 0.72) * config.ampX;
    const y = config.y + Math.cos(t * 1.05) * config.ampY;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(17, 26, 16, 0.75)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const px = i * 7;
      const py = Math.sin(t * 3.2 + i * 0.85) * 3;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = config.body;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = config.head;
    ctx.fillRect(43, -3, 7, 6);
    ctx.fillStyle = '#111';
    ctx.fillRect(48, -1, 1, 1);
    ctx.restore();
  },

  drawSwayingBamboo: function (ctx, t) {
    const clusters = [
      { x: 30, y: 8, h: 116 },
      { x: 805, y: 586, h: 108 },
      { x: 760, y: 600, h: 84 },
    ];

    ctx.save();
    ctx.lineCap = 'round';
    clusters.forEach(function (cluster, clusterIdx) {
      for (let i = 0; i < 7; i++) {
        const baseX = cluster.x + i * 7;
        const sway = Math.sin(t * 1.2 + i * 0.6 + clusterIdx) * 3;
        ctx.strokeStyle = i % 2 ? 'rgba(84, 132, 57, 0.5)' : 'rgba(122, 169, 77, 0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(baseX, cluster.y + cluster.h);
        ctx.quadraticCurveTo(baseX + sway, cluster.y + cluster.h * 0.5, baseX + sway * 1.4, cluster.y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(132, 178, 88, 0.55)';
        ctx.fillRect(baseX + sway - 2, cluster.y + 28 + (i % 4) * 14, 9, 2);
      }
    });
    ctx.restore();
  },

  drawCalligraphyScroll: function (ctx, t) {
    const panels = [
      { x: 642, y: 286, w: 112, h: 54 },
      { x: 644, y: 76, w: 126, h: 28 },
    ];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    panels.forEach(function (panel, idx) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(panel.x + 7, panel.y + 5, panel.w - 14, panel.h - 10);
      ctx.clip();
      const pulse = 0.45 + Math.sin(t * 1.7 + idx) * 0.18;
      ctx.strokeStyle = `rgba(235, 222, 174, ${pulse})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const sx = panel.x + 13 + i * ((panel.w - 26) / 4);
        const sy = panel.y + 10 + Math.sin(t * 2 + i + idx) * 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx + 7, sy + 8, sx - 5, sy + 17, sx + 9, sy + 25);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(245, 224, 151, ${pulse})`;
      ctx.fillRect(panel.x + panel.w - 18, panel.y + panel.h - 12, 9, 2);
      ctx.restore();
    });
    ctx.restore();
  },

  drawRedPanda: function (ctx, t) {
    const x = 326 + Math.sin(t * 0.62) * 13;
    const y = 416 + Math.sin(t * 1.18) * 4;
    const step = Math.floor(t * 3.2) % 2;
    const tailLift = Math.round(Math.sin(t * 2.1) * 2);

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = 'rgba(31, 23, 18, 0.25)';
    ctx.fillRect(3, 34, 48, 5);

    // Curled, striped tail from the selected rounder red panda design.
    ctx.fillStyle = '#3a211d';
    ctx.fillRect(38, 9 + tailLift, 10, 6);
    ctx.fillRect(45, 5 + tailLift, 10, 8);
    ctx.fillRect(51, 8 + tailLift, 8, 12);
    ctx.fillRect(47, 17 + tailLift, 9, 7);
    ctx.fillStyle = '#d85d2d';
    ctx.fillRect(40, 10 + tailLift, 8, 4);
    ctx.fillRect(47, 7 + tailLift, 7, 5);
    ctx.fillRect(53, 10 + tailLift, 4, 7);
    ctx.fillRect(49, 18 + tailLift, 6, 4);
    ctx.fillStyle = '#f18a3c';
    ctx.fillRect(47, 7 + tailLift, 5, 3);
    ctx.fillRect(53, 13 + tailLift, 4, 3);

    ctx.fillStyle = '#3b2521';
    ctx.fillRect(18, 20, 29, 14);
    ctx.fillRect(21, 31, 7, 6 + step);
    ctx.fillRect(39, 31, 7, 6 + (1 - step));
    ctx.fillStyle = '#e35f2b';
    ctx.fillRect(17, 15, 29, 15);
    ctx.fillRect(21, 12, 18, 7);
    ctx.fillStyle = '#f07832';
    ctx.fillRect(21, 14, 20, 7);
    ctx.fillRect(30, 19, 15, 8);
    ctx.fillStyle = '#a63d24';
    ctx.fillRect(35, 16, 8, 5);
    ctx.fillRect(40, 24, 6, 6);

    // Large readable face, ears, cream mask, and dark eye patches.
    ctx.fillStyle = '#3a211d';
    ctx.fillRect(4, 7, 9, 10);
    ctx.fillRect(21, 6, 9, 10);
    ctx.fillStyle = '#d95a2b';
    ctx.fillRect(7, 5, 7, 10);
    ctx.fillRect(21, 5, 7, 10);
    ctx.fillRect(5, 11, 25, 16);
    ctx.fillStyle = '#ffcf99';
    ctx.fillRect(8, 12, 6, 8);
    ctx.fillRect(21, 12, 6, 8);
    ctx.fillRect(12, 18, 12, 8);
    ctx.fillStyle = '#4a2822';
    ctx.fillRect(9, 13, 5, 5);
    ctx.fillRect(21, 13, 5, 5);
    ctx.fillStyle = '#171313';
    ctx.fillRect(11, 14, 2, 2);
    ctx.fillRect(22, 14, 2, 2);
    ctx.fillRect(16, 21, 4, 3);
    ctx.fillStyle = '#fff0ce';
    ctx.fillRect(13, 18, 10, 4);
    ctx.fillStyle = '#2d1b18';
    ctx.fillRect(14, 25, 8, 2);
    ctx.restore();
  },

  drawBlinkingPortraits: function (ctx, t) {
    const portraits = [
      { x: 72, y: 238 },
      { x: 492, y: 64 },
      { x: 764, y: 436 },
    ];
    const blink = (Math.floor(t * 2.2) % 9) === 0;

    ctx.save();
    portraits.forEach(function (portrait, idx) {
      const bob = Math.sin(t * 0.9 + idx) * 1;
      ctx.fillStyle = 'rgba(22, 16, 12, 0.45)';
      if (blink) {
        ctx.fillRect(portrait.x + 8, portrait.y + 15 + bob, 5, 1);
        ctx.fillRect(portrait.x + 17, portrait.y + 15 - bob, 5, 1);
      } else {
        ctx.fillRect(portrait.x + 9, portrait.y + 14 + bob, 3, 2);
        ctx.fillRect(portrait.x + 18, portrait.y + 14 - bob, 3, 2);
      }
    });
    ctx.restore();
  },

  drawPottedPlantSway: function (ctx, t) {
    const plants = [
      { x: 816, y: 240, scale: 1 },
      { x: 508, y: 246, scale: 0.7 },
      { x: 92, y: 402, scale: 0.8 },
    ];

    ctx.save();
    plants.forEach(function (plant, idx) {
      const sway = Math.sin(t * 1.3 + idx * 0.8) * 3;
      ctx.save();
      ctx.translate(plant.x, plant.y);
      ctx.scale(plant.scale, plant.scale);
      ctx.strokeStyle = 'rgba(64, 111, 61, 0.6)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 22);
        ctx.quadraticCurveTo(-8 + i * 4 + sway, 10, -14 + i * 7 + sway * 1.3, 0 + i);
        ctx.stroke();
      }
      ctx.restore();
    });
    ctx.restore();
  },

  drawEurohound: function (ctx, t) {
    const x = 326 + Math.sin(t * 0.56) * 12;
    const y = 416 + Math.sin(t * 1.1) * 3;
    const step = Math.floor(t * 3.5) % 2;
    const tailLift = Math.round(Math.sin(t * 2.4) * 2);

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = 'rgba(30, 24, 20, 0.22)';
    ctx.fillRect(2, 34, 52, 5);

    ctx.fillStyle = '#4b2e22';
    ctx.fillRect(43, 15 + tailLift, 10, 5);
    ctx.fillRect(50, 10 + tailLift, 7, 7);
    ctx.fillStyle = '#a95328';
    ctx.fillRect(45, 14 + tailLift, 8, 4);
    ctx.fillRect(51, 10 + tailLift, 5, 5);
    ctx.fillStyle = '#fff1d2';
    ctx.fillRect(54, 8 + tailLift, 4, 5);

    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(18, 17, 30, 15);
    ctx.fillRect(21, 29, 7, 7 + step);
    ctx.fillRect(40, 29, 7, 7 + (1 - step));
    ctx.fillStyle = '#fff7df';
    ctx.fillRect(21, 15, 23, 8);
    ctx.fillRect(25, 22, 22, 8);

    // Chestnut patches from the selected white-and-brown hound.
    ctx.fillStyle = '#b45d2b';
    ctx.fillRect(33, 15, 11, 8);
    ctx.fillRect(39, 21, 9, 8);
    ctx.fillRect(23, 25, 7, 6);
    ctx.fillStyle = '#d47a3d';
    ctx.fillRect(35, 16, 7, 4);
    ctx.fillRect(41, 23, 6, 4);

    // Long muzzle, floppy ears, blaze, and alert eye.
    ctx.fillStyle = '#a95328';
    ctx.fillRect(5, 8, 9, 17);
    ctx.fillRect(20, 7, 8, 17);
    ctx.fillStyle = '#f4ead4';
    ctx.fillRect(8, 7, 17, 18);
    ctx.fillRect(3, 18, 16, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, 7, 5, 13);
    ctx.fillRect(7, 19, 12, 5);
    ctx.fillStyle = '#bb612e';
    ctx.fillRect(7, 9, 6, 10);
    ctx.fillRect(21, 9, 5, 12);
    ctx.fillStyle = '#231915';
    ctx.fillRect(16, 13, 3, 3);
    ctx.fillRect(2, 21, 5, 4);
    ctx.fillStyle = '#fff5df';
    ctx.fillRect(7, 23, 9, 3);
    ctx.fillStyle = '#5b3424';
    ctx.fillRect(10, 27, 7, 2);
    ctx.restore();
  },

  drawStarTwinkles: function (ctx, t) {
    const stars = [
      { x: 20, y: 28, p: 0 },
      { x: 68, y: 106, p: 1.7 },
      { x: 146, y: 770, p: 0.8 },
      { x: 256, y: 760, p: 2.2 },
      { x: 802, y: 26, p: 1.1 },
      { x: 820, y: 704, p: 2.9 },
      { x: 742, y: 748, p: 1.5 },
    ];

    ctx.save();
    stars.forEach(function (star) {
      const alpha = 0.25 + Math.max(0, Math.sin(t * 2.1 + star.p)) * 0.65;
      ctx.strokeStyle = `rgba(176, 225, 255, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(star.x - 3, star.y);
      ctx.lineTo(star.x + 3, star.y);
      ctx.moveTo(star.x, star.y - 3);
      ctx.lineTo(star.x, star.y + 3);
      ctx.stroke();
    });
    ctx.restore();
  },

  drawInstrumentLights: function (ctx, t) {
    const lights = [
      { x: 298, y: 344, c: '#4fe7ff', p: 0 },
      { x: 328, y: 344, c: '#8cff89', p: 0.8 },
      { x: 358, y: 344, c: '#ff6bd5', p: 1.6 },
      { x: 812, y: 416, c: '#4fe7ff', p: 2.2 },
      { x: 830, y: 416, c: '#8cff89', p: 2.9 },
      { x: 624, y: 563, c: '#4fe7ff', p: 3.3 },
    ];

    ctx.save();
    lights.forEach(function (light) {
      const on = Math.sin(t * 4 + light.p) > -0.25;
      ctx.fillStyle = on ? light.c : 'rgba(28, 45, 55, 0.6)';
      ctx.fillRect(light.x, light.y, 5, 3);
    });
    ctx.restore();
  },

  drawLedWaveform: function (ctx, t) {
    const screens = [
      { x: 624, y: 330, w: 124, h: 42 },
      { x: 162, y: 514, w: 86, h: 36 },
      { x: 418, y: 514, w: 86, h: 36 },
    ];

    ctx.save();
    screens.forEach(function (screen, idx) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(screen.x + 4, screen.y + 4, screen.w - 8, screen.h - 8);
      ctx.clip();
      ctx.strokeStyle = 'rgba(76, 225, 255, 0.82)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= screen.w; i += 5) {
        const px = screen.x + i;
        const py = screen.y + screen.h / 2 + Math.sin((i + t * 58 + idx * 40) / 12) * (screen.h * 0.22);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(76, 225, 255, 0.18)';
      const scanX = screen.x + 5 + ((t * 26 + idx * 20) % Math.max(1, screen.w - 12));
      ctx.fillRect(scanX, screen.y + 5, 3, screen.h - 10);
      ctx.restore();
    });
    ctx.restore();
  },

  drawGreyAlien: function (ctx, t) {
    const x = 332 + Math.sin(t * 0.62) * 12;
    const y = 423 + Math.sin(t * 1.24) * 4;
    const step = Math.floor(t * 3.1) % 2;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.fillStyle = 'rgba(10, 20, 30, 0.25)';
    ctx.fillRect(3, 25, 28, 4);
    ctx.fillStyle = '#a8b7b6';
    ctx.fillRect(10, 16, 12, 10);
    ctx.fillStyle = '#bfcfcb';
    ctx.beginPath();
    ctx.ellipse(16, 10, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b2a32';
    ctx.beginPath();
    ctx.ellipse(11, 9, 4, 5, -0.35, 0, Math.PI * 2);
    ctx.ellipse(21, 9, 4, 5, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7edcff';
    ctx.fillRect(15, 14, 2, 1);
    ctx.fillStyle = '#879c9a';
    ctx.fillRect(8, 24, 4, 4 + step);
    ctx.fillRect(20, 24, 4, 4 + (1 - step));
    ctx.restore();
  },

  spawnEffect: function (type, x, y) {
    const id = Math.random().toString(36).substr(2, 9);
    const now = performance.now();

    if (type === 'confetti') {
      const colors = ['#ff4d4d', '#ffeb3b', '#4caf50', '#2196f3', '#e91e63', '#9c27b0'];
      for (let i = 0; i < 20; i++) {
        this.effects.push({
          id: id + i, type: type,
          x: x + (Math.random() - 0.5) * 10, y: y - 5,
          vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 8 - 2,
          rotation: Math.random() * Math.PI * 2,
          vRotation: (Math.random() - 0.5) * 0.4,
          startTime: now, duration: 1500 + Math.random() * 1000,
          alpha: 1, scale: 0.6 + Math.random() * 0.8,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    } else if (type === 'warning') {
      this.effects.push({
        id: id, type: type, x: x, y: y,
        vx: 0, vy: -0.2, rotation: 0, vRotation: 0,
        startTime: now, duration: 1200, alpha: 1, scale: 1,
      });
    } else if (type === 'focus') {
      this.effects.push({
        id: id, type: type,
        x: x + (Math.random() - 0.5) * 15, y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.3, vy: -0.4 - Math.random() * 0.4,
        rotation: (Math.random() - 0.5) * 0.2,
        vRotation: (Math.random() - 0.5) * 0.05,
        startTime: now, duration: 1000 + Math.random() * 500,
        alpha: 1, scale: 0.8 + Math.random() * 0.4,
        color: Math.random() > 0.5 ? '#00f2ff' : '#00ffaa',
      });
    } else if (type === 'stateChange') {
      this.effects.push({
        id: id, type: type, x: x, y: y,
        vx: 0, vy: 0, rotation: 0, vRotation: 0,
        startTime: now, duration: 600, alpha: 1, scale: 0.3,
        color: arguments[3] || '#f97316', // 4th argument = color
      });
    }
  },

  updateEffects: function (deltaMs) {
    const now = performance.now();
    this.effects = this.effects.filter(function (fx) {
      const elapsed = now - fx.startTime;
      if (elapsed > fx.duration) return false;
      fx.alpha = 1 - (elapsed / fx.duration);
      fx.x += fx.vx * (deltaMs / 16);
      fx.y += fx.vy * (deltaMs / 16);
      fx.rotation += fx.vRotation * (deltaMs / 16);
      if (fx.type === 'confetti') {
        fx.vy += 0.15;
        fx.vx *= 0.98;
      } else if (fx.type === 'focus') {
        fx.vy -= 0.02;
      }
      return true;
    });
  },

  renderEffects: function (ctx) {
    for (let i = 0; i < this.effects.length; i++) {
      const fx = this.effects[i];
      ctx.save();
      ctx.translate(fx.x, fx.y);
      ctx.rotate(fx.rotation);
      ctx.scale(fx.scale, fx.scale);
      ctx.globalAlpha = fx.alpha;

      if (fx.type === 'confetti') {
        ctx.fillStyle = fx.color || '#fff';
        ctx.fillRect(-2, -3, 4, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(-2, -3, 2, 2);
      } else if (fx.type === 'warning') {
        const size = 24;
        const wobble = Math.sin(performance.now() * 0.02) * 3;
        ctx.translate(wobble, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this._drawTri(ctx, 2, 2, size);
        ctx.fillStyle = '#ffcc00';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        this._drawTri(ctx, 0, 0, size);
        ctx.fill();
        ctx.stroke();
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, 7);
      } else if (fx.type === 'focus') {
        ctx.fillStyle = fx.color || '#fff';
        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.textAlign = 'center';
        const chars = ['0', '1', '{', '}', ';', '>', '_'];
        const charIdx = parseInt(fx.id.slice(-1), 36) % chars.length;
        ctx.fillText(chars[charIdx], 0, 0);
        ctx.shadowBlur = 4;
        ctx.shadowColor = fx.color || '#fff';
        ctx.fillText(chars[charIdx], 0, 0);
      } else if (fx.type === 'stateChange') {
        // Expanding circular ring effect
        const elapsed = performance.now() - fx.startTime;
        const t = elapsed / fx.duration;
        const radius = 8 + t * 20;
        ctx.strokeStyle = fx.color || '#f97316';
        ctx.lineWidth = 2 * (1 - t);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  },

  _drawTri: function (ctx, x, y, size) {
    const h = size * (Math.sqrt(3) / 2);
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2 - 2);
    ctx.lineTo(x + size / 2 + 2, y + h / 2);
    ctx.lineTo(x - size / 2 - 2, y + h / 2);
    ctx.closePath();
  },

  async reloadMap() {
    this.stop();

    // 1. Load layers (bg/fg)
    await buildOfficeLayers();
    if (this.canvas) {
      this.canvas.width = officeLayers.width;
      this.canvas.height = officeLayers.height;
    }

    // 2. Build pathfinder
    await officePathfinder.init(officeLayers.width, officeLayers.height);

    // 3. Parse coordinates
    await parseMapCoordinates(officeLayers.width, officeLayers.height);

    // 4. Parse laptop object coords
    await parseObjectCoordinates(officeLayers.width, officeLayers.height);

    // 5. Resume loop
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  },
};

window.addEventListener('storage', function (e) {
  if (e.key === 'officeMapFolder') {
    if (typeof officeRenderer !== 'undefined' && officeRenderer.reloadMap && officeRenderer.canvas) {
      officeRenderer.reloadMap();
    }
  }
});
