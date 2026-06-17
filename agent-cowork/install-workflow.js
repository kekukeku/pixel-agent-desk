#!/usr/bin/env node
/**
 * install-workflow.js
 * Installer script for the agent-cowork workflow kit.
 * Usage: node install-workflow.js --target <path> [--dry-run] [--force]
 */

const fs = require('fs');
const path = require('path');

function printUsage() {
  console.log(`
Usage:
  node install-workflow.js --target <path> [options]

Options:
  --target <path>, -t <path>  Target directory where the workflow should be installed (required)
  --dry-run, -d              Show what would be installed without writing any files
  --force, -f                Overwrite existing files in the target directory (default: skip)
`);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const params = {
    target: null,
    dryRun: false,
    force: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === '--target' || arg === '-t') && argv[i + 1]) {
      params.target = path.resolve(argv[i + 1]);
      i++;
    } else if (arg === '--dry-run' || arg === '-d') {
      params.dryRun = true;
    } else if (arg === '--force' || arg === '-f') {
      params.force = true;
    } else {
      console.error(`Unknown or invalid option: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  if (!params.target) {
    console.error('Error: --target <path> is required.');
    printUsage();
    process.exit(1);
  }

  return params;
}

const config = parseArgs();

console.log('--- Agent Cowork Workflow Installer ---');
console.log(`Target:  ${config.target}`);
console.log(`Dry Run: ${config.dryRun ? 'YES' : 'NO'}`);
console.log(`Force:   ${config.force ? 'YES (Overwrite)' : 'NO (Conservative - skip existing)'}`);
console.log('---------------------------------------\n');

// Core files and directories to copy
// For files, we copy source path -> target path
// For templates, we copy template path -> target path
const packageRoot = path.resolve(__dirname);

const copyTasks = [
  // Standalone watcher
  { src: path.join(packageRoot, 'watcher.py'), dest: 'watcher.py' },
  // Runner scripts
  { src: path.join(packageRoot, 'agent-runner'), dest: 'agent-runner' },
  // Handoff & startup scripts
  { src: path.join(packageRoot, 'scripts', 'trigger_antigravity.py'), dest: 'scripts/trigger_antigravity.py' },
  { src: path.join(packageRoot, 'scripts', 'start_agent_cowork.sh'), dest: 'scripts/start_agent_cowork.sh' },
  // Templates
  { src: path.join(packageRoot, 'templates', 'TEAM_RULES.md'), dest: 'TEAM_RULES.md' },
  { src: path.join(packageRoot, 'templates', 'AGENT_STATE.md'), dest: 'AGENT_STATE.md' },
  { src: path.join(packageRoot, 'templates', 'TASKS', 'README.md'), dest: 'TASKS/README.md' },
  { src: path.join(packageRoot, 'templates', 'REVIEWS', 'README.md'), dest: 'REVIEWS/README.md' },
  { src: path.join(packageRoot, 'templates', 'PLANNING', 'README.md'), dest: 'PLANNING/README.md' },
  { src: path.join(packageRoot, 'templates', 'LOGS', 'change_log.md'), dest: 'LOGS/change_log.md' },
  { src: path.join(packageRoot, 'templates', 'colleagueview', 'README.md'), dest: 'colleagueview/README.md' }
];

let filesCopied = 0;
let filesSkipped = 0;

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!config.dryRun) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    // If it's a file
    const targetDir = path.dirname(dest);
    const fileExists = fs.existsSync(dest);

    if (fileExists && !config.force) {
      console.log(`[SKIP] File already exists: ${path.relative(config.target, dest)}`);
      filesSkipped++;
      return;
    }

    if (config.dryRun) {
      console.log(`[DRY-RUN] Would copy file: ${path.relative(packageRoot, src)} -> ${path.relative(config.target, dest)}`);
    } else {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(src, dest);
      console.log(`[COPY] ${path.relative(packageRoot, src)} -> ${path.relative(config.target, dest)}`);
    }
    filesCopied++;
  }
}

// 1. Copy files and folders
for (const task of copyTasks) {
  const targetDest = path.join(config.target, task.dest);
  if (!fs.existsSync(task.src)) {
    console.warn(`[WARN] Source not found, skipping task: ${task.src}`);
    continue;
  }
  copyRecursiveSync(task.src, targetDest);
}

// 2. Manage target package.json
const targetPackageJsonPath = path.join(config.target, 'package.json');
let packageJsonContent = {};

const workflowScripts = {
  'reviewer-adapter': 'node agent-runner/reviewer-adapter-server.js',
  'workflow': 'bash scripts/start_agent_cowork.sh',
  'generate-review-diff': 'node agent-runner/generate-review-diff.js',
  'groupchat:plan': 'node agent-runner/groupchat-planning.js'
};

if (fs.existsSync(targetPackageJsonPath)) {
  try {
    const raw = fs.readFileSync(targetPackageJsonPath, 'utf8');
    packageJsonContent = JSON.parse(raw);
    console.log('[INFO] Existing package.json found. Merging workflow scripts...');
  } catch (error) {
    console.warn(`[WARN] Failed to parse target package.json: ${error.message}. Will create clean package.json.`);
    packageJsonContent = {};
  }
} else {
  console.log('[INFO] No package.json found. Creating a new one...');
  packageJsonContent = {
    name: path.basename(config.target) || 'agent-cowork-project',
    version: '1.0.0',
    private: true
  };
}

// Inject scripts
if (!packageJsonContent.scripts) {
  packageJsonContent.scripts = {};
}

let scriptsUpdated = false;
for (const [key, cmd] of Object.entries(workflowScripts)) {
  if (packageJsonContent.scripts[key] && packageJsonContent.scripts[key] !== cmd) {
    if (config.force) {
      packageJsonContent.scripts[key] = cmd;
      scriptsUpdated = true;
      console.log(`[FORCE-UPDATE] Script '${key}' replaced with: ${cmd}`);
    } else {
      console.log(`[SKIP] Script '${key}' already exists: ${packageJsonContent.scripts[key]}`);
    }
  } else if (!packageJsonContent.scripts[key]) {
    packageJsonContent.scripts[key] = cmd;
    scriptsUpdated = true;
    console.log(`[ADD] Script '${key}': ${cmd}`);
  }
}

if (scriptsUpdated) {
  if (config.dryRun) {
    console.log(`[DRY-RUN] Would write updated package.json to: ${targetPackageJsonPath}`);
  } else {
    fs.writeFileSync(targetPackageJsonPath, JSON.stringify(packageJsonContent, null, 2) + '\n', 'utf8');
    console.log('[WRITE] package.json updated successfully.');
  }
} else {
  console.log('[INFO] No scripts needed updating in package.json.');
}

console.log('\n---------------------------------------');
console.log(`Summary: Copied/Would-copy ${filesCopied} files, Skipped ${filesSkipped} files.`);
console.log('Workflow installation complete.');
console.log('---------------------------------------');
