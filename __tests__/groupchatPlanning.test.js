const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const { formatTranscriptMarkdown, formatDraftMarkdown } = require('../agent-runner/groupchat-format');

const execSync = (cmd, options = {}) => {
  options.env = { ...process.env, ...options.env };
  return child_process.execSync(cmd, options);
};

describe('GroupChat Planning Runner and Formatter', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const tempPlanningDir = path.join(projectRoot, 'PLANNING');

  // Helper to clean up any generated files from tests
  function cleanupFiles(session) {
    const files = [
      path.join(tempPlanningDir, `groupchat_${session}.json`),
      path.join(tempPlanningDir, `groupchat_${session}.md`),
      path.join(tempPlanningDir, `draft_${session}.md`)
    ];
    files.forEach(f => {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    });
  }

  afterEach(() => {
    cleanupFiles('999');
    cleanupFiles('998');
  });

  describe('groupchat-format.js unit tests', () => {
    const mockSessionData = {
      schemaVersion: 1,
      sessionId: '999',
      taskNum: '123',
      title: 'Test Title',
      startedAt: '2026-06-16T12:00:00Z',
      finishedAt: '2026-06-16T12:05:00Z',
      participants: [
        { speakerId: 'codex', speakerName: '小C', role: 'planner' },
        { speakerId: 'grok-build', speakerName: '小B', role: 'reviewer' },
        { speakerId: 'antigravity', speakerName: '小A', role: 'executor' }
      ],
      steps: [
        { stepId: 'codex_proposal', order: 1 },
        { stepId: 'grok_advice', order: 2 },
        { stepId: 'antigravity_advice', order: 3 },
        { stepId: 'codex_response', order: 4 },
        { stepId: 'antigravity_final', order: 5 },
        { stepId: 'grok_final', order: 6 },
        { stepId: 'codex_closing', order: 7 }
      ],
      messages: [
        {
          stepId: 'codex_proposal',
          speakerId: 'codex',
          round: 1,
          content: 'Proposal content',
          at: '2026-06-16T12:00:00Z'
        },
        {
          stepId: 'codex_closing',
          speakerId: 'codex',
          round: 3,
          content: 'Final Closing content',
          at: '2026-06-16T12:03:00Z'
        }
      ]
    };

    test('formatTranscriptMarkdown outputs expected markdown structure', () => {
      const md = formatTranscriptMarkdown(mockSessionData);
      expect(md).toContain('# Test Title');
      expect(md).toContain('- **Session ID**: `999`');
      expect(md).toContain('- **Linked Task**: `TASK-123`');
      expect(md).toContain('### [小C] Step: `codex_proposal`');
      expect(md).toContain('Proposal content');
      expect(md).toContain('### [小C] Step: `codex_closing`');
      expect(md).toContain('Final Closing content');
    });

    test('formatDraftMarkdown extracts closing message content', () => {
      const md = formatDraftMarkdown(mockSessionData);
      expect(md).toContain('# Draft Plan for Session 999');
      expect(md).toContain('- **Linked Task**: `TASK-123`');
      expect(md).toContain('## Final Plan Proposal');
      expect(md).toContain('Final Closing content');
    });
  });

  describe('groupchat-planning.js CLI integration tests', () => {
    const scriptPath = 'agent-runner/groupchat-planning.js';

    test('fails if session parameter is missing', () => {
      expect(() => {
        execSync(`node ${scriptPath} --input "Some input"`, { stdio: 'pipe' });
      }).toThrow(/Error: --session <sessionId> is required/);
    });

    test('fails if session parameter is non-numeric', () => {
      expect(() => {
        execSync(`node ${scriptPath} --session "abc" --input "Some input"`, { stdio: 'pipe' });
      }).toThrow(/Error: Invalid session ID "abc"/);
    });

    test('fails if task parameter is non-numeric', () => {
      expect(() => {
        execSync(`node ${scriptPath} --session "999" --task "abc" --input "Some input"`, { stdio: 'pipe' });
      }).toThrow(/Error: Invalid task ID "abc"/);
    });

    test('fails if input content is empty', () => {
      expect(() => {
        execSync(`node ${scriptPath} --session "999"`, { stdio: 'pipe' });
      }).toThrow(/Error: Input content is empty/);
    });

    test('succeeds in deterministic mode and writes expected files', () => {
      cleanupFiles('999');
      const stdout = execSync(
        `node ${scriptPath} --session "999" --input "Hello World input text" --task "888"`,
        { encoding: 'utf8' }
      );

      expect(stdout).toContain('Success: Generated groupchat planning artifacts for session 999');

      const jsonFile = path.join(tempPlanningDir, 'groupchat_999.json');
      const mdFile = path.join(tempPlanningDir, 'groupchat_999.md');
      const draftFile = path.join(tempPlanningDir, 'draft_999.md');

      expect(fs.existsSync(jsonFile)).toBe(true);
      expect(fs.existsSync(mdFile)).toBe(true);
      expect(fs.existsSync(draftFile)).toBe(true);

      // Verify schema and replacements
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      expect(data.schemaVersion).toBe(1);
      expect(data.sessionId).toBe('999');
      expect(data.taskNum).toBe('888');
      expect(data.title).toBe('GroupChat Planning Session for Session 999');

      const firstMsg = data.messages.find(m => m.stepId === 'codex_proposal');
      expect(firstMsg.content).toContain('Hello World input text');

      // Verify MD transcript ordering
      const mdContent = fs.readFileSync(mdFile, 'utf8');
      expect(mdContent).toContain('# GroupChat Planning Session for Session 999');
      expect(mdContent).toContain('Hello World input text');
    });

    test('fails if artifacts exist and --force is not specified', () => {
      cleanupFiles('998');
      // Run once
      execSync(`node ${scriptPath} --session "998" --input "Test text"`);
      // Run again - should fail
      expect(() => {
        execSync(`node ${scriptPath} --session "998" --input "Test text"`, { stdio: 'pipe' });
      }).toThrow(/Error: Output artifacts already exist/);

      // Run again with --force - should succeed
      const stdout = execSync(`node ${scriptPath} --session "998" --input "Test text" --force`, { encoding: 'utf8' });
      expect(stdout).toContain('Success: Generated groupchat planning artifacts for session 998');
    });
  });
});
