/**
 * Office UI — Name tags, speech bubbles, camera controls
 * Ported from pixel_office nameTagRenderer.ts
 */

/* eslint-disable no-unused-vars */

var OFFICE_UI_BASE_Y = -66;

function drawOfficeNameTag(ctx, agent) {
  const baseX = Math.round(agent.x);
  const footY = Math.round(agent.y);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const statusColor = STATE_COLORS[agent.agentState] || STATE_COLORS[agent.metadata.status] || '#94a3b8';

  // Role label
  ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
  let roleStr = agent.role || agent.metadata.name || 'Agent';
  if (roleStr.length > 20) roleStr = roleStr.slice(0, 19) + '...';

  const tw = ctx.measureText(roleStr).width;
  const roleBoxW = tw + 16;
  const roleBoxH = 16;
  const roleBoxX = baseX - roleBoxW / 2;
  const roleBoxY = footY + OFFICE_UI_BASE_Y - roleBoxH;

  // Role background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.strokeStyle = statusColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(roleBoxX, roleBoxY, roleBoxW, roleBoxH, 4);
  ctx.fill();
  ctx.stroke();

  // Role text
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(roleStr, baseX, footY + OFFICE_UI_BASE_Y - 3);

  // Status badge
  const state = agent.agentState || 'idle';
  const displayState = state === 'done' ? 'DONE' : state === 'idle' ? 'RESTING' : state.toUpperCase();

  ctx.font = 'bold 9.5px sans-serif';
  const stateTw = ctx.measureText(displayState).width;

  ctx.globalAlpha = 0.75;
  ctx.fillStyle = statusColor;
  const paddingX = 10;
  const sBoxW = stateTw + paddingX * 2;
  const sBoxH = 15;
  const sBoxX = baseX - sBoxW / 2;
  const sBoxY = roleBoxY - sBoxH - 5;

  ctx.beginPath();
  ctx.roundRect(sBoxX, sBoxY, sBoxW, sBoxH, sBoxH / 2);
  ctx.fill();

  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(displayState, baseX, sBoxY + sBoxH - 3);

  ctx.restore();
}

function drawOfficeBubble(ctx, agent) {
  const now = Date.now();
  const baseX = Math.round(agent.x);
  const bubbleY = Math.round(agent.y) + OFFICE_UI_BASE_Y - 45;

  ctx.save();

  if (agent.bubble && agent.bubble.expiresAt > now) {
    const icon = agent.bubble.icon ? agent.bubble.icon + ' ' : '';
    const rawText = icon + agent.bubble.text;

    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
    
    // Wrap text if too long
    const maxTextWidth = 180;
    const lines = rawText.length > 25 ? wrapText(ctx, rawText, maxTextWidth) : [rawText];
    
    // Find the max line width
    let maxW = 0;
    for (let i = 0; i < lines.length; i++) {
      const w = ctx.measureText(lines[i]).width;
      if (w > maxW) maxW = w;
    }
    
    const paddingH = 12;
    const paddingV = 8;
    const lineHeight = 14;
    const boxW = maxW + paddingH * 2;
    const boxH = lines.length * lineHeight + paddingV * 2;
    const boxX = baseX - boxW / 2;
    const boxY = bubbleY - boxH;

    const isReplay = (typeof window !== 'undefined' && window.__groupchatReplayActive);
    const borderColor = isReplay ? '#000000' : 'rgba(203, 213, 225, 0.5)';
    const bgColor = isReplay ? '#ffffff' : 'rgba(255, 255, 255, 0.95)';
    const textColor = '#000000';

    // Bubble background
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();

    // Border
    ctx.lineWidth = 2;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Tail (6px half-width, 7px height)
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(baseX - 6, boxY + boxH);
    ctx.lineTo(baseX + 6, boxY + boxH);
    ctx.lineTo(baseX, boxY + boxH + 7);
    ctx.closePath();
    ctx.fill();
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    
    for (let i = 0; i < lines.length; i++) {
      const lineY = boxY + paddingV + (i * lineHeight) + (lineHeight / 2);
      ctx.fillText(lines[i], baseX, lineY);
    }
  }

  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  if (text.length > 150) {
    text = text.substring(0, 147) + '...';
  }
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const width = ctx.measureText(testLine).width;
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If the word itself is wider than maxWidth, force-split it
      const wordWidth = ctx.measureText(word).width;
      if (wordWidth > maxWidth) {
        let subWord = '';
        for (let j = 0; j < word.length; j++) {
          const char = word[j];
          if (ctx.measureText(subWord + char).width <= maxWidth) {
            subWord += char;
          } else {
            lines.push(subWord);
            subWord = char;
          }
        }
        currentLine = subWord;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  // Cap at 4 lines to prevent vertical overflow of the canvas
  if (lines.length > 4) {
    const capped = lines.slice(0, 3);
    let lastLine = lines[3];
    if (lastLine.length > 3) {
      lastLine = lastLine.substring(0, lastLine.length - 3) + '...';
    } else {
      lastLine += '...';
    }
    capped.push(lastLine);
    return capped;
  }
  return lines;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { wrapText };
}
