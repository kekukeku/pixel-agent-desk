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
  resolveAgentName,
  resolveProjectLabel,
  resolveBubbleActivity,
  formatCommandText,
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

  test('maps opencode → OpenWork', () => {
    expect(formatAgentSource('opencode')).toBe('OpenWork');
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

  test('playing → PLAYING', () => {
    expect(formatAgentStatus('playing')).toBe('PLAYING');
  });

  test('Playing → PLAYING', () => {
    expect(formatAgentStatus('Playing')).toBe('PLAYING');
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

  test('null tool and playing state returns CMD> Playing...', () => {
    expect(formatAgentActivity('playing', null)).toBe('CMD> Playing...');
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

  test('codex source falls back to Codex before projectPath basename', () => {
    const name = resolveAgentDisplayName({ source: 'codex', projectPath: '/projects/MAW' });
    expect(name).toBe('Codex');
  });

  test('grok-build source falls back to Grok Build before projectPath basename', () => {
    const name = resolveAgentDisplayName({ source: 'grok-build', projectPath: '/projects/MAW' });
    expect(name).toBe('Grok Build');
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

describe('resolveAgentName', () => {
  test('returns Spirit for null/undefined', () => {
    expect(resolveAgentName(null)).toBe('Spirit');
    expect(resolveAgentName({})).toBe('Spirit');
  });

  test('known source returns source label', () => {
    expect(resolveAgentName({ source: 'codex' })).toBe('Codex');
    expect(resolveAgentName({ source: 'claude-code' })).toBe('Claude Code');
    expect(resolveAgentName({ source: 'grok-build' })).toBe('Grok Build');
    expect(resolveAgentName({ source: 'antigravity' })).toBe('Antigravity');
    expect(resolveAgentName({ source: 'opencode' })).toBe('OpenWork');
  });

  test('unknown source returns Spirit', () => {
    expect(resolveAgentName({ source: 'unknown-source' })).toBe('Spirit');
    expect(resolveAgentName({ source: null })).toBe('Spirit');
  });

  test('agentName field wins over source', () => {
    expect(resolveAgentName({ agentName: 'My Agent', source: 'codex' })).toBe('My Agent');
  });

  test('displayName (pre-resolved) wins over source', () => {
    expect(resolveAgentName({ displayName: 'Custom', agentName: 'Agent', source: 'codex' })).toBe('Custom');
  });

  test('source label beats legacy name field', () => {
    expect(resolveAgentName({ name: 'Legacy Name', source: 'codex' })).toBe('Codex');
  });

  test('does NOT use projectPath basename', () => {
    expect(resolveAgentName({ source: null, projectPath: '/projects/my-app' })).toBe('Spirit');
  });

  test('does NOT use slug or sessionTitle', () => {
    expect(resolveAgentName({ sessionTitle: 'My Session', slug: 'my-slug' })).toBe('Spirit');
  });

  test('nameMap parameter overrides source label', () => {
    const nameMap = { 'agent-1': 'Manual Name' };
    expect(resolveAgentName({ id: 'agent-1', source: 'codex' }, nameMap)).toBe('Manual Name');
  });

  test('nameMap parameter only matches by agent id', () => {
    const nameMap = { 'agent-1': 'Manual Name' };
    expect(resolveAgentName({ id: 'agent-2', source: 'codex' }, nameMap)).toBe('Codex');
  });

  test('empty nameMap does not interfere', () => {
    expect(resolveAgentName({ id: 'agent-1', source: 'codex' }, {})).toBe('Codex');
  });
});

describe('resolveProjectLabel', () => {
  test('returns empty for null/undefined', () => {
    expect(resolveProjectLabel(null)).toBe('');
    expect(resolveProjectLabel({})).toBe('');
  });

  test('extracts basename from projectPath', () => {
    expect(resolveProjectLabel({ projectPath: '/home/user/my-app' })).toBe('my-app');
  });

  test('handles Windows paths', () => {
    expect(resolveProjectLabel({ projectPath: 'C:\\Users\\dev\\my-app' })).toBe('my-app');
  });

  test('strips trailing slashes', () => {
    expect(resolveProjectLabel({ projectPath: '/path/to/project/' })).toBe('project');
  });

  test('filters Default sentinel', () => {
    expect(resolveProjectLabel({ projectPath: '/path/to/Default' })).toBe('');
  });

  test('does NOT filter pixel-agent-desk', () => {
    expect(resolveProjectLabel({ projectPath: '/path/to/pixel-agent-desk' })).toBe('pixel-agent-desk');
  });

  test('reads projectPath from metadata as fallback', () => {
    expect(resolveProjectLabel({ metadata: { projectPath: '/path/to/from-meta' } })).toBe('from-meta');
  });
});

describe('resolveBubbleActivity', () => {
  test('returns Thinking... for null/empty', () => {
    expect(resolveBubbleActivity(null)).toBe('Thinking...');
    expect(resolveBubbleActivity({})).toBe('Thinking...');
  });

  test('prefers publicActivityText', () => {
    expect(resolveBubbleActivity({
      publicActivityText: 'Checking files...',
      currentTool: 'Read',
      state: 'working'
    })).toBe('Checking files...');
  });

  test('falls back to currentTool when no publicActivityText', () => {
    expect(resolveBubbleActivity({
      currentTool: 'Bash',
      state: 'working'
    })).toBe('Bash');
  });

  test('falls back to state text when no tool', () => {
    expect(resolveBubbleActivity({ state: 'thinking' })).toBe('Thinking...');
    expect(resolveBubbleActivity({ state: 'working' })).toBe('Working...');
    expect(resolveBubbleActivity({ state: 'waiting' })).toBe('Idling...');
    expect(resolveBubbleActivity({ state: 'idle' })).toBe('Idling...');
    expect(resolveBubbleActivity({ state: 'error' })).toBe('Error!');
    expect(resolveBubbleActivity({ state: 'help' })).toBe('Need help!');
    expect(resolveBubbleActivity({ state: 'done' })).toBe('Done!');
    expect(resolveBubbleActivity({ state: 'completed' })).toBe('Done!');
    expect(resolveBubbleActivity({ state: 'playing' })).toBe('Playing...');
  });

  test('uses metadata.publicActivityText as fallback', () => {
    expect(resolveBubbleActivity({
      metadata: { publicActivityText: 'Meta text' },
      state: 'working'
    })).toBe('Meta text');
  });

  test('uses metadata.tool as fallback', () => {
    expect(resolveBubbleActivity({
      metadata: { tool: 'Grep' },
      state: 'working'
    })).toBe('Grep');
  });

  test('does NOT add CMD> prefix', () => {
    const result = resolveBubbleActivity({ currentTool: 'Bash', state: 'working' });
    expect(result).not.toContain('CMD>');
    expect(result).toBe('Bash');
  });
});

describe('formatCommandText', () => {
  test('returns tool with CMD> prefix', () => {
    expect(formatCommandText({ currentTool: 'Bash', state: 'working' })).toBe('CMD> Bash');
  });

  test('returns state fallback with CMD>', () => {
    expect(formatCommandText({ state: 'thinking' })).toBe('CMD> Thinking...');
    expect(formatCommandText({ state: 'working' })).toBe('CMD> Working...');
    expect(formatCommandText({ state: 'idle' })).toBe('CMD> Idling...');
    expect(formatCommandText({ state: 'error' })).toBe('CMD> Error');
    expect(formatCommandText({ state: 'help' })).toBe('CMD> Help');
    expect(formatCommandText({ state: 'done' })).toBe('CMD> Done');
    expect(formatCommandText({ state: 'playing' })).toBe('CMD> Playing...');
  });

  test('returns fallback for null/empty', () => {
    expect(formatCommandText(null)).toBe('Waiting for activity...');
    expect(formatCommandText({})).toBe('Waiting for activity...');
  });

  test('prefers tool over toolName', () => {
    expect(formatCommandText({ currentTool: 'Read', tool: 'Bash' })).toBe('CMD> Read');
  });
});
