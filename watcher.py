#!/usr/bin/env python3
import os
import sys
import re
import time
import json
import urllib.request
import subprocess
import shlex
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
        self.dispatched_keys = set()
        self.last_processed = {}  # For debouncing: path -> last_time

    def load_config(self):
        config_path = os.environ.get("PIXEL_AGENT_DESK_WATCHER_CONFIG_PATH")
        if not config_path:
            config_path = os.path.expanduser("~/.pixel-agent-desk/watcher.json")
        defaults = {
            "execution_mode": "visual-only",
            "command_timeout_seconds": 600,
            "output_capture_bytes": 8192,
            "antigravity": {
                "command": None,
                "webhook": None
            },
            "grok": {
                "command": "node agent-runner/trigger-review.js {task_num}",
                "webhook": None
            },
            "planning": {
                "command": "npm run groupchat:plan -- --session {session_id} --input-file {input_path}",
                "webhook": None
            },
            "keep_alive_seconds": DEFAULT_KEEP_ALIVE_SECONDS
        }
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    user_config = json.load(f)
                    # Merge configurations
                    for key in ["antigravity", "grok", "planning"]:
                        if key in user_config:
                            if user_config[key] is not None:
                                defaults[key].update(user_config[key])
                    for key in ["command_timeout_seconds", "output_capture_bytes", "keep_alive_seconds"]:
                        if key in user_config:
                            try:
                                defaults[key] = int(user_config[key])
                            except ValueError:
                                defaults[key] = user_config[key]
                    if "execution_mode" in user_config:
                        defaults["execution_mode"] = user_config["execution_mode"]
                    # Configurable agents (B2)
                    if "agents" in user_config:
                        for role in ["codex", "antigravity", "grok-build"]:
                            if role in user_config["agents"]:
                                self.agents[role].update(user_config["agents"][role])
            except Exception as e:
                print(f"Warning: Failed to parse watcher.json: {e}", file=sys.stderr)

        # Allow env overrides
        env_mode = os.environ.get("PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE")
        if env_mode:
            defaults["execution_mode"] = env_mode

        env_timeout = os.environ.get("PIXEL_AGENT_DESK_WATCHER_COMMAND_TIMEOUT_SECONDS")
        if env_timeout:
            try:
                defaults["command_timeout_seconds"] = int(env_timeout)
            except ValueError:
                pass

        env_capture = os.environ.get("PIXEL_AGENT_DESK_WATCHER_OUTPUT_CAPTURE_BYTES")
        if env_capture:
            try:
                defaults["output_capture_bytes"] = int(env_capture)
            except ValueError:
                pass

        env_anti_cmd = os.environ.get("PIXEL_AGENT_DESK_ANTIGRAVITY_COMMAND")
        if env_anti_cmd:
            defaults["antigravity"]["command"] = env_anti_cmd

        env_anti_web = os.environ.get("PIXEL_AGENT_DESK_ANTIGRAVITY_WEBHOOK")
        if env_anti_web:
            defaults["antigravity"]["webhook"] = env_anti_web

        env_grok_cmd = os.environ.get("PIXEL_AGENT_DESK_GROK_COMMAND")
        if env_grok_cmd:
            defaults["grok"]["command"] = env_grok_cmd

        env_grok_web = os.environ.get("PIXEL_AGENT_DESK_GROK_WEBHOOK")
        if env_grok_web:
            defaults["grok"]["webhook"] = env_grok_web

        env_plan_cmd = os.environ.get("PIXEL_AGENT_DESK_PLANNING_COMMAND")
        if env_plan_cmd:
            defaults["planning"]["command"] = env_plan_cmd

        env_plan_web = os.environ.get("PIXEL_AGENT_DESK_PLANNING_WEBHOOK")
        if env_plan_web:
            defaults["planning"]["webhook"] = env_plan_web

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

def extract_session_id_from_request(file_path):
    # Matches groupchat_request_NNN.json
    match = re.search(r'groupchat_request_(\d+)\.json$', file_path)
    if match:
        return match.group(1)
    return None


# ── Dispatch Engine ────────────────────────────────────────────────────────────

def make_dispatch_key(task_num, target, trigger, state_or_decision):
    """Build an idempotency key. Format: {task_num}:{target}:{trigger}:{state_or_decision}"""
    return f"{task_num}:{target}:{trigger}:{state_or_decision}"

def _build_node_env():
    """Return os.environ copy with ~/.local/node/bin prepended when missing."""
    env = os.environ.copy()
    node_bin = os.path.expanduser("~/.local/node/bin")
    if node_bin not in env.get("PATH", ""):
        env["PATH"] = node_bin + os.pathsep + env.get("PATH", "")
    return env

def _write_dispatch_result(project_root, result):
    """Write target-specific dispatch result file. Errors are printed to stderr."""
    task_num = result["task_num"]
    target = result["target"]
    if target == "planning":
        path = os.path.join(project_root, "PLANNING", f"dispatch_result_{task_num}_{target}.json")
    else:
        path = os.path.join(project_root, "REVIEWS", f"dispatch_result_{task_num}_{target}.json")
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not write dispatch result to {path}: {e}", file=sys.stderr)

def _run_command_worker(formatted_cmd, timeout, capture_bytes, project_root, result_template):
    """Background thread: run command, collect result, write dispatch_result file."""
    env = _build_node_env()
    result = dict(result_template)
    result["transport"] = "command"
    result["started_at"] = time.time()
    timed_out = False
    try:
        proc = subprocess.Popen(
            formatted_cmd,
            shell=True,
            cwd=project_root,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        try:
            stdout_b, stderr_b = proc.communicate(timeout=timeout)
            returncode = proc.returncode
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout_b, stderr_b = proc.communicate()
            returncode = -1
            timed_out = True

        result["success"] = (returncode == 0) and not timed_out
        result["returncode"] = returncode
        result["timed_out"] = timed_out
        result["stdout_excerpt"] = stdout_b[:capture_bytes].decode("utf-8", errors="replace")
        result["stderr_excerpt"] = stderr_b[:capture_bytes].decode("utf-8", errors="replace")
        result["error"] = "Command timed out" if timed_out else None
    except Exception as e:
        result["success"] = False
        result["returncode"] = -1
        result["timed_out"] = False
        result["stdout_excerpt"] = ""
        result["stderr_excerpt"] = ""
        result["error"] = str(e)
    result["finished_at"] = time.time()
    if not result["success"]:
        print(
            f"Error: Active dispatch for TASK-{result['task_num']} ({result['target']}) failed."
            f" exit={result['returncode']} timed_out={result['timed_out']} err={result['error']}",
            file=sys.stderr
        )
    _write_dispatch_result(project_root, result)

def _run_webhook_worker(url, payload, capture_bytes, project_root, result_template):
    """Background thread: POST webhook, collect result, write dispatch_result file."""
    result = dict(result_template)
    result["transport"] = "webhook"
    result["started_at"] = time.time()
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read(capture_bytes)
            result["success"] = True
            result["http_status"] = resp.status
            result["stdout_excerpt"] = body.decode("utf-8", errors="replace")
            result["stderr_excerpt"] = ""
            result["error"] = None
    except Exception as e:
        result["success"] = False
        result["http_status"] = getattr(e, "code", None)
        result["stdout_excerpt"] = ""
        result["stderr_excerpt"] = ""
        result["error"] = str(e)
        print(
            f"Error: Active webhook dispatch for TASK-{result['task_num']} ({result['target']}) failed: {e}",
            file=sys.stderr
        )
    result["finished_at"] = time.time()
    _write_dispatch_result(project_root, result)

def _format_command_template(cmd, replacements):
    """Replace command placeholders with shell-quoted values."""
    formatted = cmd
    for key, value in replacements.items():
        formatted = formatted.replace("{" + key + "}", shlex.quote(str(value)))
    return formatted

def dispatch_handoff(state, target, task_num, trigger, state_or_decision, payload):
    """
    Central dispatcher. Writes fallback payload, enforces idempotency,
    and in active mode fires an async command or webhook worker.

    target: 'antigravity' | 'grok' | 'planning'
    trigger: 'task_status' | 'registry_state' | 'review_decision'
    state_or_decision: e.g. 'IN_PROGRESS', 'UNDER_REVIEW', 'APPROVE', 'DRAFT'
    payload: dict to send as handoff body
    """
    dispatch_key = make_dispatch_key(task_num, target, trigger, state_or_decision)

    # Write fallback payload file — but ONLY for the task-execution, registry and planning pipelines.
    # review_decision dispatches must NOT write task_handoff_NNN.json: that file is exclusively
    # owned by the task-status pipeline. The review router writes handoff_payload_NNN.json via
    # route-review-decision.js; the dispatch_result_* file (written by the worker) is the audit
    # artifact for the router path.
    if trigger != "review_decision":
        if target == "antigravity":
            fallback_path = os.path.join(state.project_root, "REVIEWS", f"task_handoff_{task_num}.json")
        elif target == "planning":
            fallback_path = os.path.join(state.project_root, "PLANNING", f"groupchat_request_{task_num}.json")
        else:
            fallback_path = os.path.join(state.project_root, "REVIEWS", f"grok_handoff_{task_num}.json")
        try:
            os.makedirs(os.path.dirname(fallback_path), exist_ok=True)
            with open(fallback_path, "w", encoding="utf-8") as hf:
                json.dump(payload, hf, indent=2)
        except Exception:
            pass
    else:
        # For review_decision: derive fallback_path only for the warning message below
        fallback_path = os.path.join(state.project_root, "REVIEWS", f"dispatch_result_{task_num}_{target}.json")

    # Idempotency: skip if already dispatched in this session
    if dispatch_key in state.dispatched_keys:
        return
    state.dispatched_keys.add(dispatch_key)

    execution_mode = state.config.get("execution_mode", "visual-only")
    target_cfg = state.config.get(target, {})
    cmd = target_cfg.get("command")
    webhook = target_cfg.get("webhook")
    timeout = state.config.get("command_timeout_seconds", 600)
    capture = state.config.get("output_capture_bytes", 8192)

    if execution_mode != "active":
        # visual-only: warn and exit
        print(
            f"Warning: visual-only mode — handoff payload written to "
            f"{os.path.relpath(fallback_path, state.project_root)}, no command/webhook fired.",
            file=sys.stderr
        )
        return

    # active mode: consumer must be configured
    if not cmd and not webhook:
        # Emit configuration error and write a failed dispatch result
        err_msg = (
            f"Error: execution_mode=active but no command/webhook configured for "
            f"'{target}'. Handoff payload is in {os.path.relpath(fallback_path, state.project_root)}"
        )
        print(err_msg, file=sys.stderr)
        result = {
            "task_num": task_num,
            "target": target,
            "trigger": trigger,
            "state": state_or_decision,
            "dispatch_key": dispatch_key,
            "transport": None,
            "success": False,
            "returncode": None,
            "http_status": None,
            "timed_out": False,
            "stdout_excerpt": "",
            "stderr_excerpt": "",
            "error": err_msg,
            "started_at": time.time(),
            "finished_at": time.time(),
        }
        _write_dispatch_result(state.project_root, result)
        return

    # Build result template (worker will fill in runtime fields)
    result_template = {
        "task_num": task_num,
        "target": target,
        "trigger": trigger,
        "state": state_or_decision,
        "dispatch_key": dispatch_key,
        "transport": None,
        "success": False,
        "returncode": None,
        "http_status": None,
        "timed_out": False,
        "stdout_excerpt": "",
        "stderr_excerpt": "",
        "error": None,
        "started_at": None,
        "finished_at": None,
    }

    if cmd:
        if target == "planning":
            input_path = os.path.join(state.project_root, "TASKS", f"task_{task_num}.md")
            formatted_cmd = _format_command_template(cmd, {
                "session_id": task_num,
                "input_path": input_path,
            })
        else:
            formatted_cmd = _format_command_template(cmd, {"task_num": task_num})
        t = Thread(
            target=_run_command_worker,
            args=(formatted_cmd, timeout, capture, state.project_root, result_template),
            daemon=True
        )
        t.start()
    else:
        t = Thread(
            target=_run_webhook_worker,
            args=(webhook, payload, capture, state.project_root, result_template),
            daemon=True
        )
        t.start()

# ── Simulation (--simulate-handoff) ────────────────────────────────────────────

def perform_simulate_handoff(project_root, execution_mode="visual-only", config=None):
    """
    Pure, side-effect-free function: parse repository state and return the list
    of dispatches that *would* be fired, including their idempotency keys,
    transport (command/webhook/none), and payload shape.
    """
    if config is None:
        config = {}
    anti_cmd = (config.get("antigravity") or {}).get("command")
    anti_web = (config.get("antigravity") or {}).get("webhook")
    grok_cmd = (config.get("grok") or {}).get("command", "node agent-runner/trigger-review.js {task_num}")
    grok_web = (config.get("grok") or {}).get("webhook")
    plan_cmd = (config.get("planning") or {}).get("command")
    plan_web = (config.get("planning") or {}).get("webhook")

    scan = perform_scan(project_root)
    dispatches = []

    for task_num, info in scan["tasks"].items():
        status = info.get("status")
        if status == "IN_PROGRESS":
            key = make_dispatch_key(task_num, "antigravity", "task_status", status)
            transport = "command" if anti_cmd else ("webhook" if anti_web else "none")
            dispatches.append({
                "dispatch_key": key,
                "task_num": task_num,
                "target": "antigravity",
                "trigger": "task_status",
                "state": status,
                "transport": transport,
                "would_error_active": execution_mode == "active" and transport == "none",
                "payload_shape": {
                    "task_num": task_num,
                    "branch": info.get("branch"),
                    "project_root": project_root,
                    "status": status,
                    "timestamp": "<float>"
                }
            })
        elif status == "DRAFT":
            request_file = os.path.join(project_root, "PLANNING", f"groupchat_request_{task_num}.json")
            output_file = os.path.join(project_root, "PLANNING", f"groupchat_{task_num}.json")
            if not os.path.exists(request_file) and not os.path.exists(output_file):
                key = make_dispatch_key(task_num, "planning", "task_status", "DRAFT")
                transport = "command" if plan_cmd else ("webhook" if plan_web else "none")
                dispatches.append({
                    "dispatch_key": key,
                    "task_num": task_num,
                    "target": "planning",
                    "trigger": "task_status",
                    "state": "DRAFT",
                    "transport": transport,
                    "would_error_active": execution_mode == "active" and transport == "none",
                    "payload_shape": {
                        "session_id": task_num,
                        "task_num": task_num,
                        "project_root": project_root,
                        "status": "DRAFT",
                        "timestamp": "<float>"
                    }
                })

    for task_num, reg_state in scan["registry"].items():
        if reg_state == "UNDER_REVIEW":
            key = make_dispatch_key(task_num, "grok", "registry_state", "UNDER_REVIEW")
            transport = "command" if grok_cmd else ("webhook" if grok_web else "none")
            dispatches.append({
                "dispatch_key": key,
                "task_num": task_num,
                "target": "grok",
                "trigger": "registry_state",
                "state": "UNDER_REVIEW",
                "transport": transport,
                "would_error_active": False,
                "payload_shape": {
                    "task_num": task_num,
                    "project_root": project_root,
                    "status": "UNDER_REVIEW",
                    "timestamp": "<float>"
                }
            })
        elif reg_state == "DRAFT":
            request_file = os.path.join(project_root, "PLANNING", f"groupchat_request_{task_num}.json")
            output_file = os.path.join(project_root, "PLANNING", f"groupchat_{task_num}.json")
            if not os.path.exists(request_file) and not os.path.exists(output_file):
                key = make_dispatch_key(task_num, "planning", "registry_state", "DRAFT")
                transport = "command" if plan_cmd else ("webhook" if plan_web else "none")
                dispatches.append({
                    "dispatch_key": key,
                    "task_num": task_num,
                    "target": "planning",
                    "trigger": "registry_state",
                    "state": "DRAFT",
                    "transport": transport,
                    "would_error_active": execution_mode == "active" and transport == "none",
                    "payload_shape": {
                        "session_id": task_num,
                        "task_num": task_num,
                        "project_root": project_root,
                        "status": "DRAFT",
                        "timestamp": "<float>"
                    }
                })

    return dispatches

def perform_dispatch_one(project_root, target, task_num, trigger, state_or_decision,
                         payload, timeout_wait=15):
    """
    CI test helper: create a minimal WatcherState from project_root config,
    call dispatch_handoff() once, then block until the background worker
    thread completes (up to timeout_wait seconds).

    Returns the parsed dispatch_result_NNN_target.json dict, or raises
    RuntimeError if the result file does not appear within timeout_wait seconds.

    This function is called by --dispatch-test CLI flag and must not be used
    from within the watchdog event loop.
    """
    state = WatcherState(project_root)
    dispatch_handoff(state, target, task_num, trigger, state_or_decision, payload)
    if target == "planning":
        result_path = os.path.join(
            project_root, "PLANNING", f"dispatch_result_{task_num}_{target}.json"
        )
    else:
        result_path = os.path.join(
            project_root, "REVIEWS", f"dispatch_result_{task_num}_{target}.json"
        )
    deadline = time.time() + timeout_wait
    while time.time() < deadline:
        if os.path.exists(result_path):
            try:
                with open(result_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        time.sleep(0.1)
    raise RuntimeError(
        f"dispatch_result not written within {timeout_wait}s: {result_path}"
    )


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
            (rel_path.startswith("PLANNING/") and os.path.basename(rel_path).startswith("groupchat_request_") and rel_path.endswith(".json")) or
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
    simulate_handoff = False
    dispatch_test_args = None  # Set if --dispatch-test JSON arg is present

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
        elif arg == "--simulate-handoff":
            simulate_handoff = True
            i += 1
        elif arg == "--dispatch-test" and i + 1 < len(args):
            # Format: --dispatch-test '<json_string>'
            # JSON keys: target, task_num, trigger, state, payload (optional)
            try:
                dispatch_test_args = json.loads(args[i+1])
            except Exception as e:
                print(f"Error: --dispatch-test argument must be valid JSON: {e}", file=sys.stderr)
                sys.exit(1)
            i += 2
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

    if simulate_handoff:
        # --simulate-handoff: side-effect-free; show what would dispatch given current repo state
        tmp_state = WatcherState.__new__(WatcherState)
        tmp_state.project_root = project_root
        tmp_state.agents = {
            "codex": {"id": "codex", "name": "Codex", "type": "planner"},
            "antigravity": {"id": "antigravity", "name": "Antigravity", "type": "executor"},
            "grok-build": {"id": "grok-build", "name": "Grok Build", "type": "reviewer"}
        }
        tmp_state.config = tmp_state.load_config()
        mode = tmp_state.config.get("execution_mode", "visual-only")
        simulated = perform_simulate_handoff(project_root, execution_mode=mode, config=tmp_state.config)
        print(json.dumps(simulated, indent=2))
        sys.exit(0)

    if dispatch_test_args is not None:
        # --dispatch-test: CI integration test hook.
        # Runs a single dispatch_handoff() call and waits for the result file.
        # Exits 0 and prints dispatch_result JSON on success; exits 1 on failure.
        required = {"target", "task_num", "trigger", "state"}
        missing = required - dispatch_test_args.keys()
        if missing:
            print(f"Error: --dispatch-test JSON missing required keys: {missing}", file=sys.stderr)
            sys.exit(1)
        payload = dispatch_test_args.get("payload") or {
            "task_num": dispatch_test_args["task_num"],
            "project_root": project_root,
            "status": dispatch_test_args["state"],
            "timestamp": time.time()
        }
        timeout_wait = dispatch_test_args.get("timeout_wait", 15)
        try:
            result = perform_dispatch_one(
                project_root,
                dispatch_test_args["target"],
                dispatch_test_args["task_num"],
                dispatch_test_args["trigger"],
                dispatch_test_args["state"],
                payload,
                timeout_wait=timeout_wait
            )
            print(json.dumps(result, indent=2))
            sys.exit(0 if result.get("success") else 1)
        except RuntimeError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

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

    planning_dir = os.path.join(project_root, "PLANNING")
    if os.path.exists(planning_dir):
        for fname in os.listdir(planning_dir):
            if fname.startswith("groupchat_request_") and fname.endswith(".json"):
                p = os.path.join(planning_dir, fname)
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

            if status == "IN_PROGRESS":
                post_agent_event(
                    "agent.working",
                    antigravity_info["id"],
                    antigravity_info["name"],
                    antigravity_info["type"],
                    tool=f"Implementing TASK-{task_num} on {branch}",
                    project_root=state.project_root
                )
                handoff_data = {
                    "task_num": task_num,
                    "branch": branch,
                    "project_root": state.project_root,
                    "status": status,
                    "timestamp": time.time()
                }
                dispatch_handoff(
                    state, "antigravity", task_num,
                    "task_status", status, handoff_data
                )
            elif status == "DRAFT":
                request_file = os.path.join(state.project_root, "PLANNING", f"groupchat_request_{task_num}.json")
                output_file = os.path.join(state.project_root, "PLANNING", f"groupchat_{task_num}.json")
                if not os.path.exists(request_file) and not os.path.exists(output_file):
                    codex_info = state.agents["codex"]
                    post_agent_event(
                        "agent.working",
                        codex_info["id"],
                        codex_info["name"],
                        codex_info["type"],
                        tool=f"Planning session {task_num}",
                        project_root=state.project_root
                    )
                    handoff_data = {
                        "session_id": task_num,
                        "task_num": task_num,
                        "project_root": state.project_root,
                        "status": status,
                        "timestamp": time.time()
                    }
                    dispatch_handoff(
                        state, "planning", task_num,
                        "task_status", status, handoff_data
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
                        # Grok Build handoff: gated strictly on UNDER_REVIEW
                        grok_handoff = {
                            "task_num": tnum,
                            "project_root": state.project_root,
                            "status": "UNDER_REVIEW",
                            "timestamp": time.time()
                        }
                        dispatch_handoff(
                            state, "grok", tnum,
                            "registry_state", "UNDER_REVIEW", grok_handoff
                        )
                    elif new_state == "DRAFT":
                        request_file = os.path.join(state.project_root, "PLANNING", f"groupchat_request_{tnum}.json")
                        output_file = os.path.join(state.project_root, "PLANNING", f"groupchat_{tnum}.json")
                        if not os.path.exists(request_file) and not os.path.exists(output_file):
                            codex_info = state.agents["codex"]
                            post_agent_event(
                                "agent.working",
                                codex_info["id"],
                                codex_info["name"],
                                codex_info["type"],
                                tool=f"Planning session {tnum}",
                                project_root=state.project_root
                            )
                            handoff_data = {
                                "session_id": tnum,
                                "task_num": tnum,
                                "project_root": state.project_root,
                                "status": "DRAFT",
                                "timestamp": time.time()
                            }
                            dispatch_handoff(
                                state, "planning", tnum,
                                "registry_state", "DRAFT", handoff_data
                            )

        elif rel_path.startswith("PLANNING/"):
            session_id = extract_session_id_from_request(path)
            if session_id:
                output_file = os.path.join(state.project_root, "PLANNING", f"groupchat_{session_id}.json")
                if not os.path.exists(output_file):
                    task_num = session_id
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            task_num = data.get("task_num", session_id)
                    except Exception:
                        pass
                    
                    key = make_dispatch_key(session_id, "planning", "request_file", "DRAFT")
                    if key not in state.dispatched_keys:
                        codex_info = state.agents["codex"]
                        post_agent_event(
                            "agent.working",
                            codex_info["id"],
                            codex_info["name"],
                            codex_info["type"],
                            tool=f"Planning session {session_id}",
                            project_root=state.project_root
                        )
                        handoff_data = {
                            "session_id": session_id,
                            "task_num": task_num,
                            "project_root": state.project_root,
                            "status": "DRAFT",
                            "timestamp": time.time()
                        }
                        dispatch_handoff(
                            state, "planning", session_id,
                            "request_file", "DRAFT", handoff_data
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
                    # Run route-review-decision asynchronously via dispatch engine
                    router_payload = {
                        "task_num": task_num,
                        "project_root": state.project_root,
                        "decision": decision,
                        "timestamp": time.time()
                    }
                    router_cmd = f"node agent-runner/route-review-decision.js {{task_num}}"
                    # Temporarily override config for router command (internal, no consumer cfg needed)
                    router_cfg_override = dict(state.config)
                    router_cfg_override["antigravity"] = {"command": router_cmd, "webhook": None}
                    router_cfg_override["execution_mode"] = "active"
                    router_state = type('_RS', (), {
                        'config': router_cfg_override,
                        'project_root': state.project_root,
                        'dispatched_keys': state.dispatched_keys
                    })()
                    dispatch_handoff(
                        router_state, "antigravity", task_num,
                        "review_decision", decision, router_payload
                    )

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
