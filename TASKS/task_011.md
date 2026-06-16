# TASK-011: Set default agent display names in user name map

- **Status**: `MERGED`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `LOW`
- **Branch**: `task/task_011_default_agent_names`
- **PR URL**: `N/A (local merge @ 094b9ff)`
- **Linked Review**: [review_011.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_011.md)
- **Dependencies**: [TASK-010](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_010.md)

---

## 1. Objective

Write the local user name map so the three default watcher agents appear with the intended Chinese names instead of falling back to the project folder name `pixel-agent-desk`.

The target file is:

```text
~/.pixel-agent-desk/name-map.json
```

Its final JSON content must be exactly:

```json
{
  "antigravity": "小A沐瑤",
  "grok-build": "小B盼兮",
  "codex": "小C婉清"
}
```

This is a local user configuration task only. Do not modify app source code, watcher dispatch logic, reviewer adapter behavior, or historical task/review/log records.

---

## 2. Files Affected

- `[MODIFY]` [name-map.json](file:///Users/kevinkuo/.pixel-agent-desk/name-map.json)

---

## 3. Acceptance Criteria

- `~/.pixel-agent-desk/name-map.json` exists after the task.
- The file contains valid formatted JSON.
- The final mapping is exactly:

```json
{
  "antigravity": "小A沐瑤",
  "grok-build": "小B盼兮",
  "codex": "小C婉清"
}
```

- Existing stale mappings that set these IDs to `pixel-agent-desk` are removed.
- Do not modify repository source files for this task.
- Verify the file by running:

```bash
python3 -m json.tool ~/.pixel-agent-desk/name-map.json
cat ~/.pixel-agent-desk/name-map.json
```

---

## 4. Implementation Notes

- Create `~/.pixel-agent-desk/` if it does not exist.
- It is acceptable to overwrite the existing `name-map.json` because the operator explicitly requested the exact mapping above.
- Restarting the app or watcher may be needed before already-rendered agents pick up the new names.

---

## 5. Verification Plan

1. Write `~/.pixel-agent-desk/name-map.json`.
2. Run JSON validation:

```bash
python3 -m json.tool ~/.pixel-agent-desk/name-map.json
```

3. Inspect the file content.
4. Restart Pixel Agent Desk or refresh agent events if the UI still shows stale names.

---

## 6. Rollback Notes

If the names need to be changed later, edit `~/.pixel-agent-desk/name-map.json` again or use the dashboard name editor from TASK-009.

---

小A，請依照 `pixel-agent-desk/TASKS/task_011.md` 寫入本機 `~/.pixel-agent-desk/name-map.json` 的三個預設小人名稱；完成後不要標 `COMPLETED`，請將 `TASKS/task_011.md` 與 `AGENT_STATE.md` 推進到 `UNDER_REVIEW`。
