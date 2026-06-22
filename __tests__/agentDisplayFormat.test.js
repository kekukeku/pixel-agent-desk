/**
 * agentDisplayFormat.test.js
 * Tests for shared agent display formatting utilities
 */

'use strict';

const {
  formatAgentSource,
  formatAgentStatus,
  formatAgentActivity,
  resolveAgentDisplayName,
  sourceCssClass,
  safeStr,
} = require('../src/agentDisplayFormat');

describe('formatAgentSource', () => {
  test('maps claude-code → Claude Code', () => {
    expect(formatAgentSource('claude-code')).toBe('Claude Code');
  });

  test('maps codex → Codex', () => {
    expect(formatAgentSource('codex')).toBe('Codex');
  });

  test('maps grok-build → Grok Build', () => {
    expect(formatAgentSource('grok-build')).toBe('Grok Build');
  });

  test('maps antigravity → Antigravity', () => {
    expect(formatAgentSource('antigravity')).toBe('Antigravity');
  });

  test('maps opencode → OpenWork / OpenCode', () => {
    expect(formatAgentSource('opencode')).toBe('OpenWork / OpenCode');
  });

  test('returns Unknown Agent for null', () => {
    expect(formatAgentSource(null)).toBe('Unknown Agent');
  });

  test('returns Unknown Agent for undefined', () => {
    expect(formatAgentSource(undefined)).toBe('Unknown Agent');
  });

  test('returns Unknown Agent for unmapped value', () => {
    expect(formatAgentSource('custom-watcher')).toBe('Unknown Agent');
  });
});

describe('formatAgentStatus', () => {
  test('working → WORKING', () => {
    expect(formatAgentStatus('working')).toBe('WORKING');
  });

  test('Working → WORKING', () => {
    expect(formatAgentStatus('Working')).toBe('WORKING');
  });

  test('thinking → THINKING', () => {
    expect(formatAgentStatus('thinking')).toBe('THINKING');
  });

  test('Thinking → THINKING', () => {
    expect(formatAgentStatus('Thinking')).toBe('THINKING');
  });

  test('waiting → RESTING', () => {
    expect(formatAgentStatus('waiting')).toBe('RESTING');
  });

  test('Waiting → RESTING', () => {
    expect(formatAgentStatus('Waiting')).toBe('RESTING');
  });

  test('idle → RESTING', () => {
    expect(formatAgentStatus('idle')).toBe('RESTING');
  });

  test('done → DONE', () => {
    expect(formatAgentStatus('done')).toBe('DONE');
  });

  test('completed → DONE', () => {
    expect(formatAgentStatus('completed')).toBe('DONE');
  });

  test('error → ERROR', () => {
    expect(formatAgentStatus('error')).toBe('ERROR');
  });

  test('help → HELP', () => {
    expect(formatAgentStatus('help')).toBe('HELP');
  });

  test('null returns IDLE', () => {
    expect(formatAgentStatus(null)).toBe('IDLE');
  });

  test('unmapped value uppercases raw', () => {
    expect(formatAgentStatus('CustomState')).toBe('CUSTOMSTATE');
  });
});

describe('formatAgentActivity', () => {
  test('tool present returns CMD> tool', () => {
    expect(formatAgentActivity('working', 'Bash')).toBe('CMD> Bash');
  });

  test('null tool and working state returns CMD> Working...', () => {
    expect(formatAgentActivity('working', null)).toBe('CMD> Working...');
  });

  test('null tool and thinking state returns CMD> Thinking...', () => {
    expect(formatAgentActivity('thinking', null)).toBe('CMD> Thinking...');
  });

  test('null tool and waiting state returns CMD> Idling...', () => {
    expect(formatAgentActivity('waiting', null)).toBe('CMD> Idling...');
  });

  test('null tool and error state returns CMD> Error', () => {
    expect(formatAgentActivity('error', null)).toBe('CMD> Error');
  });

  test('null tool and help state returns CMD> Help', () => {
    expect(formatAgentActivity('help', null)).toBe('CMD> Help');
  });

  test('null tool and null state returns Waiting for activity...', () => {
    expect(formatAgentActivity(null, null)).toBe('Waiting for activity...');
  });

  test('idle with empty tool returns CMD> Idling...', () => {
    expect(formatAgentActivity('idle', '')).toBe('CMD> Idling...');
  });
});

describe('resolveAgentDisplayName', () => {
  test('prefers displayName over source', () => {
    const name = resolveAgentDisplayName({ displayName: 'My Agent', source: 'codex' });
    expect(name).toBe('My Agent');
  });

  test('falls back to source label when no displayName', () => {
    const name = resolveAgentDisplayName({ source: 'codex' });
    expect(name).toBe('Codex');
  });

  test('falls back to Agent for empty agent', () => {
    expect(resolveAgentDisplayName(null)).toBe('Agent');
    expect(resolveAgentDisplayName({})).toBe('Agent');
  });

    test('does not return pixel-agent-desk as display name', () => {
      const name = resolveAgentDisplayName({ source: 'claude-code' });
      expect(name).toBe('Claude Code');
      expect(name).not.toBe('pixel-agent-desk');
    });

    test('pixel-agent-desk displayName with source falls back to source label', () => {
      const name = resolveAgentDisplayName({ displayName: 'pixel-agent-desk', source: 'codex' });
      // The displayName literally IS 'pixel-agent-desk' but we skip it because
      // it matches the fallback default — resolveAgentDisplayName treats it as
      // a placeholder and falls through to the source label.
      expect(name).toBe('Codex');
    });
  });

describe('sourceCssClass', () => {
  test('returns correct CSS class for each source', () => {
    expect(sourceCssClass('claude-code')).toBe('src-claude');
    expect(sourceCssClass('codex')).toBe('src-codex');
    expect(sourceCssClass('grok-build')).toBe('src-grok');
    expect(sourceCssClass('antigravity')).toBe('src-antigravity');
    expect(sourceCssClass('opencode')).toBe('src-opencode');
  });

  test('returns src-unknown for unmapped', () => {
    expect(sourceCssClass('unknown')).toBe('src-unknown');
  });
});

describe('safeStr', () => {
  test('returns string as-is', () => {
    expect(safeStr('hello')).toBe('hello');
  });

  test('returns empty string for null', () => {
    expect(safeStr(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(safeStr(undefined)).toBe('');
  });

  test('converts numbers to string', () => {
    expect(safeStr(42)).toBe('42');
  });
});
