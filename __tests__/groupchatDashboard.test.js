const path = require('path');
const fs = require('fs');

// Set up globals required by office-character.js and office-ui.js
global.STATE_ZONE_MAP = {
  working: 'desk',
  thinking: 'desk',
  idle: 'idle',
  waiting: 'idle',
  done: 'idle',
  error: 'idle',
  help: 'idle'
};
global.STATE_COLORS = {
  working: '#58a6ff',
  thinking: '#8b949e',
  idle: '#8b949e'
};
global.AVATAR_FILES = ['avatar_0.webp', 'avatar_1.webp', 'avatar_2.webp'];
global.avatarIndexFromId = (id) => {
  if (id === 'codex') return 0;
  if (id === 'grok-build') return 1;
  return 2;
};
global.officeLayers = { width: 800, height: 800 };
global.officeCoords = {
  desk: [{ x: 100, y: 100 }],
  idle: [{ x: 200, y: 200 }]
};
global.GROUPCHAT_REPLAY_SEATS = {
  codex: { x: 624, y: 480 },
  'grok-build': { x: 656, y: 448 },
  antigravity: { x: 688, y: 480 }
};
global.tickOfficeAnimation = jest.fn();
global.officeRenderer = {
  spawnEffect: jest.fn()
};
global.officePathfinder = {
  findPath: (x1, y1, x2, y2) => []
};

const { officeCharacters } = require('../src/office/office-character');
const { wrapText } = require('../src/office/office-ui');

describe('GroupChat Dashboard Canvas and State Tests', () => {
  beforeEach(() => {
    officeCharacters.characters.clear();
    officeCharacters._meetingActive = false;
    officeCharacters._meetingSessionId = null;
    officeCharacters._meetingParticipants = null;
    officeCharacters._priorStates = null;
    jest.clearAllMocks();
  });

  describe('officeCharacters startGroupChatMeeting & endGroupChatMeeting', () => {
    test('startGroupChatMeeting places core characters at meeting seats and preserves state', () => {
      // 1. Setup pre-existing live characters
      const codexAgent = { id: 'codex', name: 'Codex', status: 'idle', type: 'main' };
      const antigravityAgent = { id: 'antigravity', name: 'Antigravity', status: 'idle', type: 'main' };
      officeCharacters.addCharacter(codexAgent);
      officeCharacters.addCharacter(antigravityAgent);

      const codexChar = officeCharacters.characters.get('codex');
      codexChar.x = 100;
      codexChar.y = 100;
      codexChar.path = [{ x: 100, y: 100 }];
      codexChar.pathIndex = 1;

      // 2. Start meeting
      officeCharacters.startGroupChatMeeting('017');

      expect(officeCharacters._meetingActive).toBe(true);
      expect(officeCharacters._meetingSessionId).toBe('017');

      // Verify seats are applied
      const seats = global.GROUPCHAT_REPLAY_SEATS;
      expect(codexChar.x).toBe(seats.codex.x);
      expect(codexChar.y).toBe(seats.codex.y);
      expect(codexChar.facingDir).toBe('right');

      // Verify grok-build is created as temporary because it didn't exist prior to the meeting
      const grokChar = officeCharacters.characters.get('grok-build');
      expect(grokChar).toBeDefined();
      expect(grokChar._isTemporary).toBe(true);
      expect(grokChar.x).toBe(seats['grok-build'].x);
      expect(grokChar.y).toBe(seats['grok-build'].y);

      // 3. End meeting
      officeCharacters.endGroupChatMeeting('017');

      expect(officeCharacters._meetingActive).toBe(false);

      // Verify codex restored to original position
      expect(codexChar.x).toBe(100);
      expect(codexChar.y).toBe(100);

      // Verify temporary grok-build is removed
      expect(officeCharacters.characters.has('grok-build')).toBe(false);
    });

    test('updateCharacter automatic meeting triggers and ends correctly', () => {
      const codexAgent = { id: 'codex', name: 'Codex', status: 'idle', type: 'main' };
      const antigravityAgent = { id: 'antigravity', name: 'Antigravity', status: 'idle', type: 'main' };
      officeCharacters.addCharacter(codexAgent);
      officeCharacters.addCharacter(antigravityAgent);

      // Trigger planning for codex
      officeCharacters.updateCharacter({
        id: 'codex',
        status: 'working',
        currentTool: 'Planning session 017',
        name: 'Codex',
        type: 'main'
      });

      expect(officeCharacters._meetingActive).toBe(true);
      expect(officeCharacters._meetingSessionId).toBe('017');

      // Trigger planning for antigravity
      officeCharacters.updateCharacter({
        id: 'antigravity',
        status: 'working',
        currentTool: 'Planning session 017',
        name: 'Antigravity',
        type: 'main'
      });

      expect(officeCharacters._meetingActive).toBe(true);

      // Finish planning for codex
      officeCharacters.updateCharacter({
        id: 'codex',
        status: 'waiting',
        currentTool: null,
        name: 'Codex',
        type: 'main'
      });

      // Meeting should still be active because antigravity is still planning
      expect(officeCharacters._meetingActive).toBe(true);

      // Finish planning for antigravity
      officeCharacters.updateCharacter({
        id: 'antigravity',
        status: 'waiting',
        currentTool: null,
        name: 'Antigravity',
        type: 'main'
      });

      // Now meeting should be ended!
      expect(officeCharacters._meetingActive).toBe(false);
    });

    test('updateAll bypasses pathfinding during active meeting', () => {
      const codexAgent = { id: 'codex', name: 'Codex', status: 'idle', type: 'main' };
      officeCharacters.addCharacter(codexAgent);

      const codexChar = officeCharacters.characters.get('codex');
      codexChar.x = 100;
      codexChar.y = 100;

      // Start meeting
      officeCharacters.startGroupChatMeeting('017');
      const seatX = global.GROUPCHAT_REPLAY_SEATS.codex.x;
      const seatY = global.GROUPCHAT_REPLAY_SEATS.codex.y;

      expect(codexChar.x).toBe(seatX);
      expect(codexChar.y).toBe(seatY);

      // Spy or call updateAll, verify coordinates do not change even with large delta
      officeCharacters.updateAll(10.0, 10000);

      expect(codexChar.x).toBe(seatX);
      expect(codexChar.y).toBe(seatY);
    });
  });

  describe('wrapText Canvas bubble safety & truncation', () => {
    const mockCtx = {
      measureText: (text) => {
        // Mock simple character width = 6px
        return { width: text.length * 6 };
      }
    };

    test('wrapText truncates extremely long strings (>150 chars) and appends ellipsis', () => {
      const longText = 'a'.repeat(200);
      const lines = wrapText(mockCtx, longText, 180);
      
      const totalLength = lines.reduce((acc, line) => acc + line.replace('...', '').length, 0);
      expect(totalLength).toBeLessThanOrEqual(150);
      expect(lines[lines.length - 1]).toContain('...');
    });

    test('wrapText forces line split for single very long words that exceed maxWidth', () => {
      const longWord = 'w'.repeat(100); // 600px width, max is 180px
      const lines = wrapText(mockCtx, longWord, 180);

      expect(lines.length).toBeGreaterThan(1);
      lines.forEach(line => {
        expect(line.length * 6).toBeLessThanOrEqual(180);
      });
    });

    test('wrapText caps lines to at most 4 lines with ellipsis on the last line', () => {
      const linesText = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15';
      // maxWidth = 40 (only a couple words per line)
      const lines = wrapText(mockCtx, linesText, 40);

      expect(lines.length).toBeLessThanOrEqual(4);
      if (lines.length === 4) {
        expect(lines[3]).toContain('...');
      }
    });
  });
});
