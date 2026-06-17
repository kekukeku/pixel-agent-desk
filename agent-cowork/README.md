# Agent Cowork Workflow Kit

The **Agent Cowork** workflow kit is a lightweight, portable, and zero-dependency package containing a multi-agent governance and automation framework. It allows you to run Layer 1 (Codex / Planner), Layer 2 (Grok Build / Reviewer), and Layer 3 (Antigravity / Executor) automation locally on your machine or inside a CI/CD environment (like GitHub Actions).

This kit has been separated from the graphical user interface components of the parent desktop application to keep target codebases clean and minimal.

---

## 1. What the Kit Does

The kit sets up a local automation loop that:
1. **Tracks changes** in your repository's task state (`AGENT_STATE.md` and `TASKS/`).
2. **Dispatches review requests** to Layer 2 (Grok Build) when tasks move to `UNDER_REVIEW`.
3. **Validates code changes** and runs automated reviews locally using the Grok Build TUI or via the X.AI API.
4. **Routes review outcomes** (`APPROVE`, `REQUEST_CHANGES`, `REJECT`) to automate label tagging, PR commenting, and handoffs back to the executor (Antigravity) or human operator.
5. **Facilitates multi-agent group planning sessions** via a 7-step consultative protocol.

---

## 2. Installation Instructions

The kit contains an installation utility (`install-workflow.js`) that automates copying files and configuring scripts.

### Option A: Install into an Existing Project

Run the installer pointing to your target project folder:

```bash
node agent-cowork/install-workflow.js --target /path/to/existing-project
```

- **Default Behavior (Safe)**: The installer will copy watcher scripts, runner scripts, and template directories without overwriting existing files in the target.
- **Overwriting**: If you want to overwrite existing files, add the `--force` flag:
  ```bash
  node agent-cowork/install-workflow.js --target /path/to/existing-project --force
  ```
- **Dry Run**: To check what would be copied without writing anything, run:
  ```bash
  node agent-cowork/install-workflow.js --target /path/to/existing-project --dry-run
  ```

### Option B: Install into a New Project

To spin up a new project with the agent cowork workflow enabled:
1. Create a clean project folder:
   ```bash
   mkdir my-new-project && cd my-new-project
   ```
2. Initialize npm (optional, the installer will create a default package.json if it is missing):
   ```bash
   npm init -y
   ```
3. Run the installer from the `pixel-agent-desk` repository root:
   ```bash
   node /path/to/pixel-agent-desk/agent-cowork/install-workflow.js --target .
   ```
4. Install any global dependencies (e.g. `python3`).

---

## 3. Required Startup Order & Execution

To start the local autonomous loop in the target project, follow this startup order:

### Step 1: Start the Grok Reviewer Adapter
The adapter server translates review requests into local execution jobs. By default, it listens on `127.0.0.1:47822`.
You can start it manually using:
```bash
npm run reviewer-adapter
```
*(Alternatively, starting the workflow script in Step 2 will spin this up automatically if the port is free.)*

### Step 2: Run the Watcher
Start the file watcher which monitors task statuses (`TASKS/` and `AGENT_STATE.md`):
```bash
npm run workflow
```
This runs `bash scripts/start_agent_cowork.sh`, which loads environment overrides, starts the reviewer adapter if not running, and launches `python3 watcher.py`.

### Step 3: Configure the Reviewer Engine
The review engine runs reviews. By default:
- **`REVIEWER_ENGINE=tui`**: Runs reviews locally using the Grok Build Terminal User Interface (`~/.grok/bin/grok`).
- To configure or change the reviewer engine:
  - Create a file at `~/.agent-cowork/reviewer.env` (or `~/.pixel-agent-desk/reviewer.env` as fallback).
  - Add your environment variables:
    ```bash
    # Use Grok Build TUI (default)
    export REVIEWER_ENGINE="tui"
    export GROK_BIN="$HOME/.grok/bin/grok"

    # Or use X.AI API review engine
    # export REVIEWER_ENGINE="xai"
    # export XAI_API_KEY="your-api-key"
    ```

---

## 4. How to Split into a Standalone GitHub Repository

In a future task (e.g., Task-022), you can extract this subdirectory to make it a standalone repository named `agent-cowork` on GitHub:

1. **Clone/Copy `agent-cowork/` out**:
   Create a separate folder containing only the contents of `agent-cowork/`.
2. **Initialize Git**:
   ```bash
   cd agent-cowork
   git init
   git checkout -b main
   ```
3. **Commit the files**:
   ```bash
   git add .
   git commit -m "initial commit: port agent-cowork workflow kit"
   ```
4. **Push to GitHub**:
   Create a new blank repository named `agent-cowork` on GitHub under your account, then push:
   ```bash
   git remote add origin https://github.com/your-username/agent-cowork.git
   git push -u origin main
   ```
5. **Usage as a dependency**:
   Target projects can install it by copying it or referencing it directly.
