# TASK-005: Personalize office floorplan title with local username

- **Status**: `MERGED`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `LOW`
- **Branch**: `task/task_005_username_office_title`
- **PR URL**: `TBD`
- **Linked Review**: `TBD`
- **Dependencies**: [TASK-004](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_004.md)

---

## 1. Objective

Replace the dashboard office panel title currently shown as `Operational Floorplan` with a personalized title using the local operating-system username:

```text
<username>'s Office
```

Examples:

- macOS login user `kevinkuo` -> `kevinkuo's Office`
- Windows user `Alice` -> `Alice's Office`

The title must be resolved dynamically on the machine running Pixel Agent Desk. Do not hardcode the current developer's username.

---

## 2. Files Affected

- `[MODIFY]` [dashboard.html](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/dashboard.html)
- `[MODIFY]` [dashboard.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.js)
- `[MODIFY]` [dashboard-server.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/dashboard-server.js)
- `[MODIFY]` [dashboard-server.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/dashboard-server.test.js)

---

## 3. Acceptance Criteria

- The office panel header no longer displays `Operational Floorplan`.
- The header displays `<local username>'s Office`, using the account name of the user running the app.
- Username resolution works cross-platform:
  - Prefer `os.userInfo().username` in Node.
  - Fall back to `process.env.USER`, `process.env.USERNAME`, or `User` if OS lookup fails.
- The browser UI receives the username through a safe app/dashboard API or server-provided data path, not by hardcoding in `dashboard.html`.
- The UI writes the personalized title with `textContent` or equivalent safe text rendering, not raw HTML interpolation.
- The existing `LIVE` badge and PiP button remain visually and functionally unchanged.
- The title has a stable fallback before the async username load completes, with no broken or empty header.
- Add/update Jest coverage for the new dashboard API or server behavior.
- Run `npm test -- --runTestsByPath __tests__/dashboard-server.test.js`.

---

## 4. Implementation Notes

- A small endpoint such as `GET /api/profile` or `GET /api/system` is acceptable if it returns a minimal payload like `{ "username": "kevinkuo" }`.
- Keep the endpoint local-only through the existing dashboard server; do not add network dependencies.
- Preserve existing API routes and dashboard behavior.
- If adding a DOM id for the title text, keep the `LIVE` badge and PiP button outside that title element so the layout remains unchanged.
- Do not change agent event, watcher, or review-routing behavior in this task.

---

## 5. Verification Plan

- Run:

```bash
npm test -- --runTestsByPath __tests__/dashboard-server.test.js
```

- Manually inspect the dashboard after restart and confirm the header reads `<username>'s Office`.

---

## 6. Rollback Notes

If the personalized title causes dashboard regressions, revert the changes to `dashboard.html`, `public/dashboard.js`, `src/dashboard-server.js`, and `__tests__/dashboard-server.test.js`.

---

小 A，請依照 `pixel-agent-desk/TASKS/task_005.md` 開始執行，將狀態從 `DRAFT` 推進到 `IN_PROGRESS`，並按既有流程開分支實作本機 username 的 office title。
