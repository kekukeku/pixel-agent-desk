const fs = require('fs');
const path = require('path');
const { formatTranscriptMarkdown, formatDraftMarkdown } = require('./groupchat-format');

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    session: null,
    input: null,
    inputFile: null,
    task: null,
    force: false,
    deterministic: true // Default to deterministic local mode
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--session') {
      params.session = args[++i];
    } else if (arg === '--input') {
      params.input = args[++i];
    } else if (arg === '--input-file') {
      params.inputFile = args[++i];
    } else if (arg === '--task') {
      params.task = args[++i];
    } else if (arg === '--force') {
      params.force = true;
    } else if (arg === '--live') {
      params.deterministic = false;
    }
  }

  return params;
}

function main() {
  const params = parseArgs();

  // 1. Session ID validation
  if (!params.session) {
    console.error('Error: --session <sessionId> is required.');
    process.exit(1);
  }
  if (!/^\d+$/.test(params.session)) {
    console.error(`Error: Invalid session ID "${params.session}". Must be a numeric string.`);
    process.exit(1);
  }

  // 2. Task ID validation
  if (params.task && !/^\d+$/.test(params.task)) {
    console.error(`Error: Invalid task ID "${params.task}". Must be a numeric string.`);
    process.exit(1);
  }

  // 3. Resolve input content
  let inputContent = '';
  if (params.input) {
    inputContent = params.input.trim();
  } else if (params.inputFile) {
    const resolvedPath = path.resolve(params.inputFile);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: Input file does not exist at "${resolvedPath}".`);
      process.exit(1);
    }
    inputContent = fs.readFileSync(resolvedPath, 'utf8').trim();
  }

  if (!inputContent) {
    console.error('Error: Input content is empty. Provide non-empty --input or --input-file.');
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const planningDir = path.join(projectRoot, 'PLANNING');
  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true });
  }

  // Define output paths
  const jsonPath = path.join(planningDir, `groupchat_${params.session}.json`);
  const mdPath = path.join(planningDir, `groupchat_${params.session}.md`);
  const draftPath = path.join(planningDir, `draft_${params.session}.md`);

  // 4. Check for existing artifacts unless --force is specified
  if (!params.force) {
    const existing = [jsonPath, mdPath, draftPath].filter(p => fs.existsSync(p));
    if (existing.length > 0) {
      console.error(`Error: Output artifacts already exist: ${existing.map(p => path.basename(p)).join(', ')}.`);
      console.error('Use --force to overwrite.');
      process.exit(1);
    }
  }

  // 5. Generate planning data (Deterministic Local Mode by default)
  if (params.deterministic) {
    const templatePath = path.join(__dirname, 'fixtures', 'groupchat_mock_template.json');
    if (!fs.existsSync(templatePath)) {
      console.error(`Error: Mock template fixture not found at "${templatePath}".`);
      process.exit(1);
    }

    let template;
    try {
      template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    } catch (e) {
      console.error(`Error: Failed to parse mock template JSON: ${e.message}`);
      process.exit(1);
    }

    const startedAt = new Date().toISOString();
    const finishedAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // mock 5 min session

    const replacePlaceholders = (text) => {
      return text.replace(/{session_id}/g, params.session).replace(/{input}/g, inputContent);
    };

    const sessionData = {
      schemaVersion: 1,
      sessionId: params.session,
      taskNum: params.task || null,
      title: replacePlaceholders(template.title),
      startedAt: startedAt,
      finishedAt: finishedAt,
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
      messages: template.steps.map((step, idx) => {
        let round = 1;
        if (['codex_response', 'antigravity_final', 'grok_final'].includes(step.stepId)) {
          round = 2;
        } else if (step.stepId === 'codex_closing') {
          round = 3;
        }
        return {
          stepId: step.stepId,
          speakerId: step.speakerId,
          round: round,
          content: replacePlaceholders(step.content),
          at: new Date(Date.parse(startedAt) + idx * 30 * 1000).toISOString()
        };
      })
    };

    // 6. Format and Write files
    fs.writeFileSync(jsonPath, JSON.stringify(sessionData, null, 2), 'utf8');
    fs.writeFileSync(mdPath, formatTranscriptMarkdown(sessionData), 'utf8');
    fs.writeFileSync(draftPath, formatDraftMarkdown(sessionData), 'utf8');

    console.log(`Success: Generated groupchat planning artifacts for session ${params.session}.`);
    console.log(`- ${path.relative(projectRoot, jsonPath)}`);
    console.log(`- ${path.relative(projectRoot, mdPath)}`);
    console.log(`- ${path.relative(projectRoot, draftPath)}`);
  } else {
    // Live mode placeholder / implementation when API keys are present (out of scope for deterministic local)
    console.error('Error: Live mode is currently not implemented. Please use the default deterministic mode.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
