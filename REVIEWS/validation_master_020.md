# Validation Master — TASK-020: Show front-facing avatar portraits in System Roster picker

- **Merge Commit**: `9f8e9e6` (local task branch commit)
- **Branch**: `task/task_020_roster_avatar_portrait_picker`
- **Merged Into**: `master`
- **Merge Date**: 2026-06-17
- **Reviewed By**: Grok Build (Layer 2)
- **Final Decision**: `APPROVE`
- **Implemented By**: Antigravity (Layer 3)

---

## Review History

| Round | Decision | Blocking Issues |
|---|---|---|
| v1 @ `9f8e9e6` | `APPROVE` | None |

---

## Acceptance Criteria — Final Status

| Criterion | Status | Evidence |
|---|---|---|
| Roster card preview shows single front-facing frame, not full sheet | PASS | Replaced spritesheet `<img>` with cropped `background-image` div using helper `spritePortraitHtml` at 32px width. |
| Picker grid options show single front-facing frame per avatar | PASS | Replaced picker `<img>` with cropped `background-image` div using helper `spritePortraitHtml` at 28px width. |
| Selected / hover / reset-to-default behavior preserved (TASK-018) | PASS | Re-used identical event selectors and classes (`.selected`, `:hover`, `.mc-avatar-reset-btn`) on the buttons. |
| Selection updates roster preview and office canvas immediately | PASS | Roster card and office characters update skin index instantly via existing state hooks. |
| Sprite metadata: 8 cols, 48×64 frames, preview frame `0` (`front_idle[0]`) | PASS | Applied frame mathematics using `cols: 8`, `frameW: 48`, `frameH: 64`, `previewFrame: 0` matched with `sprite-frames.json`. |
| Legible portrait preview and stable layout | PASS | Kept layout containment stable (dropdown is absolutely positioned; options use `overflow: hidden` to clip taller portraits without reflow). |
| Compatibility with `pixel-agent-desk.avatarOverrides.v1` | PASS | Persistence layer and keys left untouched. |

---

## Files Changed

| File | Change |
|---|---|
| `public/dashboard.js` | Refactored preview rendering using `spritePortraitStyle()` and `spritePortraitHtml()` helpers. |
| `public/dashboard.css` | Styled `.mc-avatar-portrait` with crisp-edges / pixelated image-rendering and disabled mouse pointer events. |
| `AGENT_STATE.md` | Updated TASK-020 status to `MERGED`. |
| `TASKS/task_020.md` | Updated status to `MERGED`, local merge SHA, and linked review document. |
| `LOGS/change_log.md` | Appended TASK-020 change log entry. |
| `REVIEWS/validation_master_020.md` | [NEW] Merge and validation report. |

---

## Test Summary

```text
Test Suites: 22 passed, 22 total
Tests:       365 passed, 365 total
Snapshots:   0 total
Time:        11.471 s, estimated 12 s
Ran all test suites.
```

---

*Validation authored by Antigravity (Layer 3) · 2026-06-17*
