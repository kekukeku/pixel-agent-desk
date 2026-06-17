# TASK-020: Show front-facing avatar portraits in System Roster picker

- **Status**: `MERGED`
- **Created**: 2026-06-17
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_020_roster_avatar_portrait_picker`
- **PR URL**: `N/A (local merge @ 9f8e9e6ae50c0bccd10f2287a63d63eedb37bd12)`
- **Linked Advice**: [groupchat_020.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_020.md)
- **Linked Review**: [review_020.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_020.md)
- **Dependencies**: [TASK-018](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_018.md)

---

## 1. Objective

Fix the System Roster avatar appearance picker so users select recognizable front-facing character portraits, not compressed full spritesheets.

Current regression: the right-side roster picker renders each `avatar_X.webp` spritesheet as a tiny `<img>`, so the user sees a sheet of dots instead of the character. The roster card preview and picker options must show the agent's front-facing character appearance clearly.

---

## 2. Files Affected

- `[MODIFY]` [public/dashboard.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.js)
- `[MODIFY]` [public/dashboard.css](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.css)

### Candidate Files

- [public/shared/sprite-frames.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/shared/sprite-frames.json) for reference only; do not modify unless the existing metadata is insufficient.
- [__tests__/dashboard-server.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/dashboard-server.test.js) or a new focused dashboard helper test if pure helper logic is introduced.

---

## 3. Acceptance Criteria

- The System Roster card avatar button shows a recognizable front-facing character portrait or bust, not the whole spritesheet.
- The avatar picker grid options show recognizable front-facing character portraits or busts for every available avatar.
- The selected option state, hover state, and reset-to-default behavior from TASK-018 continue to work.
- Selecting an avatar still updates both the roster card preview and office canvas character immediately.
- The fix must use the sprite metadata convention from [public/shared/sprite-frames.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/shared/sprite-frames.json):
  - sheet columns: `8`
  - frame size: `48 x 64`
  - preferred preview frame: the first `front_idle` frame, frame index `0`
- Do not display the entire spritesheet in any roster preview or picker option.
- The portrait preview must remain legible at the current roster size and dropdown option size.
- The UI must not shift or resize cards while the picker is opened.
- Existing avatar persistence key `pixel-agent-desk.avatarOverrides.v1` must remain compatible.
- Run focused verification:

```bash
rg -n "mc-avatar|avatarOverrides|front_idle|sprite" public/dashboard.js public/dashboard.css
```

If tests are updated or helper tests are added, run the relevant Jest test as well.

---

## 4. Implementation Notes

- Prefer a small reusable preview renderer/class rather than duplicating inline style math in multiple places.
- A CSS background-position preview is acceptable:
  - use the full spritesheet as `background-image`
  - crop to one `48 x 64` frame
  - scale up with pixelated rendering
  - position at frame index `0` (`front_idle[0]`)
- A canvas-generated data URL is also acceptable if it keeps the DOM cleaner, but avoid unnecessary complexity.
- The current broken pattern is in `public/dashboard.js`, where `.mc-avatar-img` and `.mc-avatar-option-img` use `<img src="/public/characters/${file}">` and therefore shrink the full sheet.
- Preserve accessibility labels/titles so users can still identify options.

### GroupChat Reconciliation

- The GroupChat session completed and produced [PLANNING/groupchat_020.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_020.md), [PLANNING/groupchat_020.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_020.json), and [PLANNING/draft_020.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/draft_020.md).
- 小C does not adopt generic fixture recommendations about implementing the GroupChat runner, schema, or DRAFT watcher hooks; those were already delivered by TASK-013.
- 小C final decision: proceed with the current high-priority UI regression fix. The implementation must focus on rendering recognizable front-facing sprite portraits in the System Roster picker.

---

## 5. Manual Verification

1. Open the dashboard and inspect the right-side System Roster.
2. Confirm 小C, 小A, and 小B cards show a clear front-facing character preview.
3. Open the avatar picker and confirm each option shows a character portrait, not a dot-like spritesheet.
4. Select a different avatar and confirm the roster preview updates immediately.
5. Confirm the office canvas character changes to the selected avatar.
6. Reload the dashboard and confirm the selected avatar persists.

---

小A請直接修正這個 TASK-018 UI regression。完成後請把 `TASKS/task_020.md` 與 `AGENT_STATE.md` 移到 `UNDER_REVIEW`，不要標成 `COMPLETED`。
