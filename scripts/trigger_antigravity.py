#!/usr/bin/env python3
"""Trigger a Google Antigravity handoff through the local agentapi CLI.

This wrapper exits 0 only when the local agentapi CLI successfully dispatches
the task to Antigravity and returns a valid conversationId.
"""

import argparse
import json
import os
import subprocess
import sys
import re
from urllib.parse import unquote, urlparse


def run_command(args):
    return subprocess.run(args, capture_output=True, text=True, check=False)


def find_antigravity_language_servers():
    result = run_command(["ps", "ax", "-ww", "-o", "pid=", "-o", "command="])
    if result.returncode != 0:
        return []

    servers = []
    for line in result.stdout.splitlines():
        match = re.match(r"\s*(\d+)\s+(.+)$", line)
        if not match:
            continue
        pid, command = match.groups()
        lower_command = command.lower()
        if "antigravity" in lower_command and "language_server" in lower_command:
            token_match = re.search(r"--csrf_token(?:=|\s+)(\S+)", command)
            servers.append({
                "pid": int(pid),
                "csrf_token": token_match.group(1) if token_match else None,
            })
    return servers


def listening_ports(pid):
    result = run_command(["lsof", "-nP", "-a", "-p", str(pid), "-iTCP", "-sTCP:LISTEN"])
    if result.returncode != 0 and not result.stdout.strip():
        return []

    ports = []
    for line in result.stdout.splitlines()[1:]:
        match = re.search(r"(?:127\.0\.0\.1|\[::1\]|\*):(\d+)\s+\(LISTEN\)", line)
        if match:
            ports.append(int(match.group(1)))
    return sorted(set(ports), reverse=True)


def discover_ls_connection():
    for server in find_antigravity_language_servers():
        for port in listening_ports(server["pid"]):
            probe = run_command([
                "python3",
                "-c",
                (
                    "import urllib.request;"
                    f"urllib.request.urlopen('http://127.0.0.1:{port}/', timeout=1).read(1)"
                )
            ])
            if probe.returncode == 0:
                return {
                    "address": f"http://127.0.0.1:{port}",
                    "csrf_token": server.get("csrf_token"),
                }
    return {"address": None, "csrf_token": None}


def find_antigravity_project_id(repo_abs_path):
    config_dir = os.path.expanduser("~/.gemini/config/projects")
    if not os.path.isdir(config_dir):
        return None

    repo_abs_path = os.path.realpath(repo_abs_path)
    for filename in os.listdir(config_dir):
        if not filename.endswith(".json"):
            continue
        config_path = os.path.join(config_dir, filename)
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
        except Exception:
            continue
        resources = config.get("projectResources", {}).get("resources", [])
        for resource in resources:
            folder_uri = resource.get("gitFolder", {}).get("folderUri")
            if not folder_uri:
                continue
            parsed = urlparse(folder_uri)
            if parsed.scheme != "file":
                continue
            folder_path = os.path.realpath(unquote(parsed.path))
            if folder_path == repo_abs_path:
                return config.get("id")
    return None


def run_agentapi_handoff(task_num, repo_path, review_decision=False):
    repo_abs_path = os.path.abspath(repo_path)
    
    if review_decision:
        handoff_payload_path = os.path.join(repo_abs_path, "REVIEWS", f"handoff_payload_{task_num}.json")
        decision = "UNKNOWN"
        handoff_target = "UNKNOWN"
        review_file_path = f"REVIEWS/review_{task_num}.md"
        summary = "N/A"
        
        if os.path.exists(handoff_payload_path):
            try:
                with open(handoff_payload_path, "r", encoding="utf-8") as f:
                    payload = json.load(f)
                    decision = payload.get("decision", decision)
                    handoff_target = payload.get("handoffTarget", handoff_target)
                    review_file_path = payload.get("reviewPath", review_file_path)
                    summary = payload.get("summary", summary)
            except Exception as e:
                print(f"Warning: Could not read {handoff_payload_path}: {e}")
        
        if decision == "REQUEST_CHANGES":
            instruction = "Please fix the blocking review findings and resubmit to UNDER_REVIEW."
        elif decision == "APPROVE":
            instruction = "Please perform the approved-task merge/reconciliation workflow."
        else:
            instruction = f"Please handle the review decision: {decision}."
            
        prompt = (
            f"{instruction}\n"
            f"Context:\n"
            f"- Task Number: {task_num}\n"
            f"- Target Directory: {repo_abs_path}\n"
            f"- Review File Path: {review_file_path}\n"
            f"- Handoff Payload Path: {handoff_payload_path}\n"
            f"- Decision: {decision}\n"
            f"- Handoff Target: {handoff_target}\n"
            f"- Review Summary: {summary}"
        )
    else:
        handoff_json_path = os.path.join(repo_abs_path, "REVIEWS", f"task_handoff_{task_num}.json")
        
        # Read handoff payload details written by the watcher to get the branch
        branch = f"task/task_{task_num}"
        if os.path.exists(handoff_json_path):
            try:
                with open(handoff_json_path, "r", encoding="utf-8") as f:
                    handoff_data = json.load(f)
                    branch = handoff_data.get("branch", branch)
            except Exception as e:
                print(f"Warning: Could not read {handoff_json_path}: {e}")

        # Build prompt instructing Antigravity to solve the designated task
        prompt = (
            f"Please implement the requirements in TASKS/task_{task_num}.md.\n"
            f"Context:\n"
            f"- Task Number: {task_num}\n"
            f"- Workspace Branch: {branch}\n"
            f"- Target Directory: {repo_abs_path}"
        )

    # Locate agentapi binary
    agentapi_path = os.path.expanduser("~/.gemini/antigravity/bin/agentapi")
    if not os.path.exists(agentapi_path):
        # Check fallback path in Application Support
        agentapi_path = os.path.expanduser("~/Library/Application Support/Antigravity/bin/agentapi")
        if not os.path.exists(agentapi_path):
            print(f"Error: agentapi CLI not found in ~/.gemini/antigravity/bin or Application Support.", file=sys.stderr)
            sys.exit(1)

    cmd = [agentapi_path, "new-conversation", "--model=flash", prompt]
    env = os.environ.copy()
    if not env.get("ANTIGRAVITY_LS_ADDRESS"):
        connection = discover_ls_connection()
        if connection["address"]:
            env["ANTIGRAVITY_LS_ADDRESS"] = connection["address"]
        else:
            print("Error: ANTIGRAVITY_LS_ADDRESS is not set and no Antigravity language server address was discovered.", file=sys.stderr)
            sys.exit(1)
        if connection["csrf_token"] and not env.get("ANTIGRAVITY_CSRF_TOKEN"):
            env["ANTIGRAVITY_CSRF_TOKEN"] = connection["csrf_token"]
    if not env.get("ANTIGRAVITY_CSRF_TOKEN"):
        connection = discover_ls_connection()
        if connection["csrf_token"]:
            env["ANTIGRAVITY_CSRF_TOKEN"] = connection["csrf_token"]
        else:
            print("Error: ANTIGRAVITY_CSRF_TOKEN is not set and no Antigravity CSRF token was discovered.", file=sys.stderr)
            sys.exit(1)
    if not env.get("ANTIGRAVITY_PROJECT_ID"):
        project_id = find_antigravity_project_id(repo_abs_path)
        if project_id:
            env["ANTIGRAVITY_PROJECT_ID"] = project_id
        else:
            print("Error: ANTIGRAVITY_PROJECT_ID is not set and no matching Antigravity project config was found.", file=sys.stderr)
            sys.exit(1)
    
    print(f"Spawning Antigravity task session for TASK-{task_num} using agentapi...")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True, env=env)
        res = json.loads(proc.stdout)
        
        if "error" in res and res["error"]:
            print(f"Error returned by agentapi: {res['error']}", file=sys.stderr)
            sys.exit(1)
            
        convo_id = res.get("response", {}).get("newConversation", {}).get("conversationId")
        if convo_id:
            print(json.dumps({
                "ok": True,
                "conversationId": convo_id,
                "lsAddress": env.get("ANTIGRAVITY_LS_ADDRESS"),
                "projectId": env.get("ANTIGRAVITY_PROJECT_ID"),
                "prompt": prompt
            }, indent=2))
            sys.exit(0)
        else:
            print(f"Error: Response did not contain a conversationId: {proc.stdout}", file=sys.stderr)
            sys.exit(1)
    except subprocess.CalledProcessError as err:
        print(f"Error launching agentapi: {err.stderr}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Dispatch a Pixel Agent Desk task to Google Antigravity.")
    parser.add_argument("--task", required=True, help="Task number, for example 008.")
    parser.add_argument("--repo-path", default=".", help="Repository path for the task.")
    parser.add_argument("--path", default=None, help="Deprecated path parameter.")
    parser.add_argument("--timeout", type=float, default=None, help="Deprecated timeout parameter.")
    parser.add_argument("--dry-run", action="store_true", help="Only check for agentapi CLI availability.")
    parser.add_argument("--review-decision", action="store_true", help="Trigger a review decision follow-up session.")
    args = parser.parse_args()

    if args.dry_run:
        agentapi_path = os.path.expanduser("~/.gemini/antigravity/bin/agentapi")
        exists = os.path.exists(agentapi_path) or os.path.exists(os.path.expanduser("~/Library/Application Support/Antigravity/bin/agentapi"))
        connection = discover_ls_connection()
        ls_address = os.environ.get("ANTIGRAVITY_LS_ADDRESS") or connection["address"]
        project_id = os.environ.get("ANTIGRAVITY_PROJECT_ID") or find_antigravity_project_id(os.path.abspath(args.repo_path))
        print(json.dumps({
            "ok": True,
            "agentapi_available": exists,
            "ls_address": ls_address,
            "csrf_token_available": bool(os.environ.get("ANTIGRAVITY_CSRF_TOKEN") or connection["csrf_token"]),
            "project_id": project_id
        }, indent=2))
        return 0

    run_agentapi_handoff(args.task, args.repo_path, review_decision=args.review_decision)


if __name__ == "__main__":
    main()
