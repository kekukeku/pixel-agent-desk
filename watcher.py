#!/usr/bin/env python3
import os
import sys
import re
import time
import json
import urllib.request
import subprocess
from threading import Thread

# Watchdog imports
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    HAS_WATCHDOG = True
except ImportError:
    FileSystemEventHandler = object
    Observer = object
    HAS_WATCHDOG = False

# Default Configurations
DEFAULT_KEEP_ALIVE_SECONDS = 60
DEFAULT_PORT = 47821
EVENT_ENDPOINT = f"http://localhost:{DEFAULT_PORT}/events/agent"

class WatcherState:
    def __init__(self, project_root):
        self.project_root = project_root
        self.agents = {
            "codex": {"id": "codex", "name": "Codex", "type": "planner"},
            "antigravity": {"id": "antigravity", "name": "Antigravity", "type": "executor"},
            "grok-build": {"id": "grok-build", "name": "Grok Build", "type": "reviewer"}
        }
        self.config = self.load_config()
        self.mtimes = {}
        self.registry_state = {}
        self.last_processed = {}  # For debouncing: path -> last_time

    def load_config(self):
        config_path = os.path.expanduser("~/.pixel-agent-desk/watcher.json")
        defaults = {
            "antigravity": {
                "command": None,
                "webhook": None
            },
            "grok": {
                "command": "node agent-runner/trigger-review.js {task_num}",
                "webhook": None
            },
            "keep_alive_seconds": DEFAULT_KEEP_ALIVE_SECONDS
        }
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    user_config = json.load(f)
                    # Merge configurations
                    for key in ["antigravity", "grok"]:
                        if key in user_config:
                            defaults[key].update(user_config[key])
                    if "keep_alive_seconds" in user_config:
                        defaults["keep_alive_seconds"] = user_config["keep_alive_seconds"]
                    # Configurable agents (B2)
                    if "agents" in user_config:
                        for role in ["codex", "antigravity", "grok-build"]:
                            if role in user_config["agents"]:
                                self.agents[role].update(user_config["agents"][role])
            except Exception as e:
                print(f"Warning: Failed to parse watcher.json: {e}", file=sys.stderr)

        # Allow env override for keep-alive
        env_keep_alive = os.environ.get("PIXEL_AGENT_DESK_WATCHER_KEEP_ALIVE")
        if env_keep_alive:
            try:
                defaults["keep_alive_seconds"] = int(env_keep_alive)
            except ValueError:
                pass

        # Allow env overrides for agent attributes (B2)
        for role in ["codex", "antigravity", "grok-build"]:
            env_key = role.replace("-", "_").upper()
            id_env = os.environ.get(f"PIXEL_AGENT_DESK_AGENT_{env_key}_ID")
            name_env = os.environ.get(f"PIXEL_AGENT_DESK_AGENT_{env_key}_NAME")
            type_env = os.environ.get(f"PIXEL_AGENT_DESK_AGENT_{env_key}_TYPE")
            if id_env:
                self.agents[role]["id"] = id_env
            if name_env:
                self.agents[role]["name"] = name_env
            if type_env:
                self.agents[role]["type"] = type_env

        return defaults

def post_agent_event(event_type, agent_id, name, agent_type, tool="", project_root=""):
    payload = {
        "event": event_type,
        "agent_id": agent_id,
        "source": "pixel-agent-desk-watcher",
        "name": name,
        "agent_type": agent_type,
        "tool": tool,
        "project_path": project_root
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        EVENT_ENDPOINT,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=2) as response:
            response.read()
    except Exception:
        # Silently log/warn so the watcher does not crash when server is offline
        pass

def post_webhook(url, payload):
    if not url:
        return
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            response.read()
    except Exception as e:
        print(f"Error dispatching webhook to {url}: {e}", file=sys.stderr)

def parse_task_file(file_path):
    status = None
    branch = None
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Parse Status
            status_match = re.search(r'-\s*\*\*Status\*\*:\s*`([^`]+)`', content)
            if status_match:
                status = status_match.group(1)
            # Parse Branch
            branch_match = re.search(r'-\s*\*\*Branch\*\*:\s*`([^`]+)`', content)
            if branch_match:
                branch = branch_match.group(1)
    except Exception:
        pass
    return {"status": status, "branch": branch}

def parse_registry(file_path):
    registry = {}
    if not os.path.exists(file_path):
        return registry
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                # Matches: | **TASK-006** | `IN_PROGRESS` |
                match = re.search(r'\|\s*\*\*TASK-(\d+)\*\*\s*\|\s*`([^`]+)`', line)
                if match:
                    task_num = match.group(1)
                    state = match.group(2)
                    registry[task_num] = state
    except Exception:
        pass
    return registry

def parse_review_file(file_path):
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            match = re.search(r'-\s*\*\*Decision\*\*:\s*`?([A-Z_]+)`?', content)
            if match:
                return match.group(1)
    except Exception:
        pass
    return None

def extract_task_num(file_path):
    # Matches task_NNN or review_NNN or review_request_NNN
    match = re.search(r'(?:task|review|review_request)_(\d+)\.md$', file_path)
    if match:
        return match.group(1)
    return None

def run_command_in_shell(command, task_num, project_root):
    if not command:
        return
    formatted_cmd = command.replace("{task_num}", task_num)
    # Ensure env path contains node
    env = os.environ.copy()
    if "~/.local/node/bin" not in env.get("PATH", ""):
        env["PATH"] = os.path.expanduser("~/.local/node/bin") + os.pathsep + env.get("PATH", "")

    try:
        subprocess.Popen(
            formatted_cmd,
            shell=True,
            cwd=project_root,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception as e:
        print(f"Error executing command '{formatted_cmd}': {e}", file=sys.stderr)

# Global Keep Alive Thread Target
def keep_alive_loop(state):
    while True:
        interval = state.config.get("keep_alive_seconds", DEFAULT_KEEP_ALIVE_SECONDS)
        time.sleep(interval)
        for role, info in state.agents.items():
            post_agent_event("agent.idle", info["id"], info["name"], info["type"], project_root=state.project_root)

class RepoEventHandler(FileSystemEventHandler):
    def __init__(self, state, on_change_callback):
        self.state = state
        self.on_change_callback = on_change_callback

    def handle_event(self, event):
        if event.is_directory:
            return

        path = os.path.abspath(event.src_path)
        rel_path = os.path.relpath(path, self.state.project_root)

        # Filter files we care about
        is_relevant = (
            rel_path.startswith("TASKS/") and rel_path.endswith(".md") or
            rel_path.startswith("REVIEWS/") and rel_path.endswith(".md") or
            rel_path == "AGENT_STATE.md"
        )
        if not is_relevant:
            return

        # Debouncing: skip if processed within 500ms
        now = time.time()
        last_time = self.state.last_processed.get(path, 0)
        if now - last_time < 0.5:
            return
        self.state.last_processed[path] = now

        # Debounce sleep to let file write finish
        time.sleep(0.05)

        # Check mtime change
        try:
            current_mtime = os.path.getmtime(path)
        except OSError:
            return

        prev_mtime = self.state.mtimes.get(path, 0)
        if current_mtime > prev_mtime:
            self.state.mtimes[path] = current_mtime
            self.on_change_callback(path)

    def on_modified(self, event):
        self.handle_event(event)

    def on_created(self, event):
        # B4: New file creation triggers the handler
        self.handle_event(event)

def perform_scan(project_root):
    # Pure parse-only function without side-effects
    parsed_tasks = {}
    tasks_dir = os.path.join(project_root, "TASKS")
    if os.path.exists(tasks_dir):
        for fname in os.listdir(tasks_dir):
            if fname.startswith("task_") and fname.endswith(".md"):
                tnum = extract_task_num(fname)
                if tnum:
                    info = parse_task_file(os.path.join(tasks_dir, fname))
                    if info:
                        parsed_tasks[tnum] = info

    parsed_decisions = {}
    reviews_dir = os.path.join(project_root, "REVIEWS")
    if os.path.exists(reviews_dir):
        for fname in os.listdir(reviews_dir):
            if fname.startswith("review_") and not fname.startswith("review_request_") and fname.endswith(".md"):
                tnum = extract_task_num(fname)
                if tnum:
                    decision = parse_review_file(os.path.join(reviews_dir, fname))
                    if decision:
                        parsed_decisions[tnum] = decision

    registry_file = os.path.join(project_root, "AGENT_STATE.md")
    registry = parse_registry(registry_file)

    return {
        "tasks": parsed_tasks,
        "registry": registry,
        "decisions": parsed_decisions
    }

def main():
    # Parse CLI Arguments
    project_root = None
    parse_only = False

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--project-root" and i + 1 < len(args):
            project_root = os.path.abspath(args[i+1])
            i += 2
        elif arg == "--parse-only":
            parse_only = True
            i += 1
        else:
            i += 1

    # B1: Resolve project root. Priority: CLI > Env > Script's directory
    if not project_root:
        project_root = os.environ.get("PIXEL_AGENT_DESK_PROJECT_ROOT")
    if not project_root:
        project_root = os.path.dirname(os.path.abspath(__file__))

    if parse_only:
        # B7: --parse-only must be completely side-effect free
        result = perform_scan(project_root)
        print(json.dumps(result, indent=2))
        sys.exit(0)

    if not HAS_WATCHDOG:
        print("Error: The 'watchdog' package is required to run the watcher in daemon/monitoring mode.", file=sys.stderr)
        print("Please install dependencies using:", file=sys.stderr)
        print("    python3 -m pip install -r requirements.txt", file=sys.stderr)
        sys.exit(1)

    print(f"Starting Pixel Agent Desk Watcher on: {project_root}")
    state = WatcherState(project_root)

    # 1. Establish initial baseline mtimes
    # B1: Startup initial scan only builds baseline, does not dispatch
    tasks_dir = os.path.join(project_root, "TASKS")
    if os.path.exists(tasks_dir):
        for fname in os.listdir(tasks_dir):
            p = os.path.join(tasks_dir, fname)
            if os.path.isfile(p):
                state.mtimes[os.path.abspath(p)] = os.path.getmtime(p)

    reviews_dir = os.path.join(project_root, "REVIEWS")
    if os.path.exists(reviews_dir):
        for fname in os.listdir(reviews_dir):
            p = os.path.join(reviews_dir, fname)
            if os.path.isfile(p):
                state.mtimes[os.path.abspath(p)] = os.path.getmtime(p)

    state_file = os.path.join(project_root, "AGENT_STATE.md")
    if os.path.exists(state_file):
        state.mtimes[os.path.abspath(state_file)] = os.path.getmtime(state_file)
        # Establish initial registry state baseline
        state.registry_state = parse_registry(state_file)

    # 2. Startup Agent Registration
    for role, info in state.agents.items():
        post_agent_event("agent.started", info["id"], info["name"], info["type"], project_root=project_root)
        post_agent_event("agent.idle", info["id"], info["name"], info["type"], project_root=project_root)

    # 3. Start Keep-Alive Loop in Background
    keep_alive_thread = Thread(target=keep_alive_loop, args=(state,), daemon=True)
    keep_alive_thread.start()

    # Callback when a monitored file changes post-baseline
    def handle_file_change(path):
        rel_path = os.path.relpath(path, state.project_root)
        task_num = extract_task_num(path)

        if rel_path.startswith("TASKS/"):
            if not task_num:
                return
            info = parse_task_file(path)
            if not info:
                return

            status = info["status"]
            branch = info["branch"] or f"task/task_{task_num}"
            antigravity_info = state.agents["antigravity"]

            if status in ["DRAFT", "IN_PROGRESS"]:
                post_agent_event(
                    "agent.working",
                    antigravity_info["id"],
                    antigravity_info["name"],
                    antigravity_info["type"],
                    tool=f"Implementing TASK-{task_num} on {branch}",
                    project_root=state.project_root
                )
                # Antigravity handoff execution
                cmd = state.config["antigravity"]["command"]
                webhook = state.config["antigravity"]["webhook"]
                handoff_data = {
                    "task_num": task_num,
                    "branch": branch,
                    "project_root": state.project_root,
                    "status": status,
                    "timestamp": time.time()
                }

                # B3/B5: Webhook and command routing
                if cmd or webhook:
                    if cmd:
                        run_command_in_shell(cmd, task_num, state.project_root)
                    else:
                        post_webhook(webhook, handoff_data)
                else:
                    # Fallback visual-only mode: B4: write to task_handoff_NNN.json
                    handoff_path = os.path.join(state.project_root, "REVIEWS", f"task_handoff_{task_num}.json")
                    try:
                        os.makedirs(os.path.dirname(handoff_path), exist_ok=True)
                        with open(handoff_path, "w", encoding="utf-8") as hf:
                            json.dump(handoff_data, hf, indent=2)
                    except Exception:
                        pass
                    print(
                        f"Warning: Visual status updated for Antigravity, but execution handoff is pending configuration. "
                        f"Handoff payload written to REVIEWS/task_handoff_{task_num}.json",
                        file=sys.stderr
                    )
            elif status == "MERGED":
                post_agent_event(
                    "agent.idle",
                    antigravity_info["id"],
                    antigravity_info["name"],
                    antigravity_info["type"],
                    project_root=state.project_root
                )

        elif rel_path == "AGENT_STATE.md":
            new_registry = parse_registry(path)
            for tnum, new_state in new_registry.items():
                old_state = state.registry_state.get(tnum)
                if new_state != old_state:
                    state.registry_state[tnum] = new_state
                    # If transitioned to UNDER_REVIEW
                    if new_state == "UNDER_REVIEW":
                        grok_info = state.agents["grok-build"]
                        post_agent_event(
                            "agent.working",
                            grok_info["id"],
                            grok_info["name"],
                            grok_info["type"],
                            tool=f"Reviewing TASK-{tnum}",
                            project_root=state.project_root
                        )
                        # Grok Build handoff execution: B6: Gated strictly on UNDER_REVIEW
                        grok_cmd = state.config["grok"]["command"]
                        grok_webhook = state.config["grok"].get("webhook")
                        grok_handoff = {
                            "task_num": tnum,
                            "project_root": state.project_root,
                            "status": "UNDER_REVIEW",
                            "timestamp": time.time()
                        }
                        if grok_cmd or grok_webhook:
                            if grok_cmd:
                                run_command_in_shell(grok_cmd, tnum, state.project_root)
                            else:
                                post_webhook(grok_webhook, grok_handoff)
                        else:
                            # B5: Grok missing-command/webhook handoff fallback
                            handoff_path = os.path.join(state.project_root, "REVIEWS", f"grok_handoff_{tnum}.json")
                            try:
                                os.makedirs(os.path.dirname(handoff_path), exist_ok=True)
                                with open(handoff_path, "w", encoding="utf-8") as hf:
                                    json.dump(grok_handoff, hf, indent=2)
                            except Exception:
                                pass
                            print(
                                f"Warning: Visual status updated for Grok Build, but execution handoff is pending configuration. "
                                f"Handoff payload written to REVIEWS/grok_handoff_{tnum}.json",
                                file=sys.stderr
                            )

        elif rel_path.startswith("REVIEWS/"):
            if not task_num:
                return

            grok_info = state.agents["grok-build"]
            # Review Request
            if rel_path.startswith("REVIEWS/review_request_"):
                post_agent_event(
                    "agent.working",
                    grok_info["id"],
                    grok_info["name"],
                    grok_info["type"],
                    tool=f"Reviewing TASK-{task_num}",
                    project_root=state.project_root
                )
            # Review Output
            elif rel_path.startswith("REVIEWS/review_"):
                decision = parse_review_file(path)
                if decision:
                    # Run route-review-decision
                    router_cmd = f"node agent-runner/route-review-decision.js {task_num}"
                    run_command_in_shell(router_cmd, task_num, state.project_root)

                    antigravity_info = state.agents["antigravity"]
                    codex_info = state.agents["codex"]
                    # Map visual states based on decision
                    if decision == "APPROVE":
                        post_agent_event(
                            "agent.idle",
                            grok_info["id"],
                            grok_info["name"],
                            grok_info["type"],
                            project_root=state.project_root
                        )
                        post_agent_event(
                            "agent.working",
                            antigravity_info["id"],
                            antigravity_info["name"],
                            antigravity_info["type"],
                            tool=f"Merging TASK-{task_num}",
                            project_root=state.project_root
                        )
                    elif decision == "REQUEST_CHANGES":
                        post_agent_event(
                            "agent.idle",
                            grok_info["id"],
                            grok_info["name"],
                            grok_info["type"],
                            project_root=state.project_root
                        )
                        post_agent_event(
                            "agent.working",
                            antigravity_info["id"],
                            antigravity_info["name"],
                            antigravity_info["type"],
                            tool=f"Fixing TASK-{task_num}",
                            project_root=state.project_root
                        )
                    elif decision == "REJECT":
                        post_agent_event(
                            "agent.idle",
                            grok_info["id"],
                            grok_info["name"],
                            grok_info["type"],
                            project_root=state.project_root
                        )
                        post_agent_event(
                            "agent.working",
                            codex_info["id"],
                            codex_info["name"],
                            codex_info["type"],
                            tool=f"Operator review required for TASK-{task_num}",
                            project_root=state.project_root
                        )

    # Setup watchdog observer
    observer = Observer()
    event_handler = RepoEventHandler(state, handle_file_change)
    observer.schedule(event_handler, path=project_root, recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    main()
