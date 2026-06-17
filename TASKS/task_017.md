# TASK-017: Add GroupChat meeting-room live mode and replay seating

- **Status**: `MERGED`
- **Created**: 2026-06-17
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_017_groupchat_meeting_room_mode`
- **PR URL**: `N/A (local merge @ 66f78cb)`
- **Linked Advice**: [groupchat_017.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_017.md)
- **Linked Review**: [review_017.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_017.md)
- **Dependencies**: [TASK-013](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_013.md), [TASK-014](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_014.md)

---

## 1. Objective

Make GroupChat visually behave like a meeting instead of ordinary live agent wandering.

Kevin observed that during GroupChat planning, 小C shows a planning bubble while 小A and 小B remain in unrelated live positions. This does not match the intended meeting-room experience. When a GroupChat planning session is active, 小C, 小A, and 小B should move to the right-middle meeting room, occupy separated fixed seats, stay still, and show the relevant planning/advisory/replay speech bubbles there.

This task should cover both:

- **Live planning mode**: while watcher dispatches a `DRAFT` GroupChat planning session.
- **Replay mode**: when the dashboard replays an existing `PLANNING/groupchat_NNN.json` session.

---

## 2. Files Affected

- `[MODIFY]` [watcher.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/watcher.py)
- `[MODIFY]` [public/dashboard.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.js)
- `[MODIFY]` [src/office/office-character.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/office/office-character.js)
- `[MODIFY]` [src/office/office-config.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/office/office-config.js)
- `[MODIFY]` [src/office/office-ui.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/office/office-ui.js)
- `[MODIFY]` [__tests__/watcher.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/watcher.test.js)
- `[MODIFY]` [__tests__/groupchatDashboard.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/groupchatDashboard.test.js)

### Candidate Files

- [dashboard.html](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/dashboard.html) only if replay controls need a small state indicator.
- [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md) if user-facing documentation needs a brief clarification.

---

## 3. Acceptance Criteria

- Define a single meeting-room seat map for `codex`, `antigravity`, and `grok-build` in `office-config.js`. The seats must be in the right-middle meeting room and separated enough that sprites and bubbles do not overlap incoherently.
- Live GroupChat planning starts a meeting-room override for all three core agents, not only 小C.
- During live planning, 小C, 小A, and 小B stay at their meeting-room seats and do not pathfind away until the planning session ends or the override times out.
- Replay mode reuses the same meeting-room seats and does not mutate persisted live agent positions, avatar choices, names, or desk assignments.
- When live planning or replay ends, replay/meeting-only positioning and bubbles clear, and normal live movement may resume.
- If a matching live agent does not currently exist, the office may create a temporary visual participant for the meeting and remove it afterward.
- Speech bubbles during meeting/replay remain readable and safely truncated for long messages.
- Watcher must emit enough structured event data for the dashboard to identify GroupChat live meeting start/end and participants.
- Add tests for the pure meeting/replay state helpers and watcher event payload shape where practical.
- Run focused verification:

```bash
npm test -- --runTestsByPath __tests__/watcher.test.js __tests__/groupchatDashboard.test.js
```

---

## 4. Implementation Notes

- Treat this as a visual override layer, not as live agent state mutation.
- Prefer a small explicit API on `officeCharacters`, such as `startGroupChatMeeting(sessionId, participants)` and `endGroupChatMeeting(sessionId)`.
- Store each affected character's prior transient position/path/bubble in memory only, then restore or release on exit.
- Live planning and replay can share the same seat map but should have separate active flags so replay does not accidentally clear a live planning session.
- The screenshot that triggered this task showed 小C in the upper room and 小B elsewhere while session 016 was planning; this task is specifically to prevent that.

### GroupChat Reconciliation

- The GroupChat session completed and produced [PLANNING/groupchat_017.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_017.md), [PLANNING/groupchat_017.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_017.json), and [PLANNING/draft_017.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/draft_017.md).
- 小C does not adopt the generic fixture recommendations about implementing the GroupChat runner, schema, or DRAFT watcher hooks; those were already delivered by TASK-013.
- 小C final decision: proceed with the objective and acceptance criteria above, focused on live GroupChat meeting-room mode and replay seating.

---

## 5. Verification Plan

1. Start `npm run workflow`.
2. Create or update a DRAFT task to trigger GroupChat planning.
3. Confirm 小C, 小A, and 小B move to the right-middle meeting room and stay in separated seats during planning.
4. Open the GroupChat dashboard/replay surface and replay a session.
5. Confirm replay uses the same meeting-room seats and does not affect live movement after stopping.
6. Run focused tests.

---

## 6. Rollback Notes

If the meeting override destabilizes office rendering, revert the meeting override and watcher meeting event changes while leaving GroupChat transcript artifacts intact.

---

小C finalized this task after GroupChat advisory. 小A may start implementation.
