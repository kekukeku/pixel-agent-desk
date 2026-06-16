# Review Request: Add consultative GroupChat planning artifacts with 小C final authority (TASK-013)

- **Request ID**: RR-013
- **Linked Task**: [TASK-013](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_013.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_013_groupchat_planning_artifacts`
- **Date**: 2026-06-16

---

## 1. Request Details

Add a consultative multi-agent planning workflow that lets 小C, 小B, and 小A share one visible planning conversation before a task enters the normal `TASKS/task_NNN.md` workflow.

This is not a new merge gate. 小C is the final planner and has sole discretion to accept, reject, or adapt 小A/小B advice. 小A and 小B are advisory participants only; they do not need to approve the plan before 小C finalizes it.

The workflow must preserve a complete, human-readable conversation artifact so Kevin can inspect how the plan evolved. The final output should be a clean task draft that Codex can convert into the existing `TASKS/task_NNN.md` format and registry update.

GroupChat replaces the old `REVIEWS/task_advice_NNN.md` DRAFT advisory step. Do not run the old single-agent `task_advice_NNN.md` path in parallel by default. `TEAM_RULES.md` should be updated so Trigger A means "run consultative GroupChat advisory and produce `PLANNING/groupchat_<sessionId>.*` artifacts." The legacy `task_advice_NNN.md` format may remain documented only as a compatibility fallback for repositories that have not adopted GroupChat.

This task should also close the current implementation gap between `TEAM_RULES.md` and `watcher.py`: DRAFT must remain planning-only, but it should trigger the consultative GroupChat planning/advisory path without starting executor work.

Required speaker order:

1. 小C proposes the initial plan.
2. 小B gives advice.
3. 小A gives advice.
4. 小C responds to both sets of advice and states what will be adopted or rejected.
5. 小A gives a final opinion or full recognition.
6. 小B gives a final opinion or full recognition.
7. 小C thanks both participants and writes the final plan.

All participants must see the same shared conversation history. 小A must be able to see 小B's advice, and 小B must be able to see 小A's advice before their final opinion.

---

## 2. Changes Summary

- **PLANNING/README.md**: Action: NEW
- **groupchat_001.json**: Action: NEW
- **groupchat-planning.js**: Action: NEW
- **groupchat-format.js**: Action: NEW
- **groupchat_mock_template.json**: Action: NEW
- **groupchatPlanning.test.js**: Action: NEW
- **watcher.py**: Action: MODIFY
- **watcher.test.js**: Action: MODIFY
- **.gitignore**: Action: MODIFY
- **package.json**: Action: MODIFY
- **README.md**: Action: MODIFY
- **TEAM_RULES.md**: Action: MODIFY

---

**Please evaluate these changes and record the decision in `REVIEWS/review_013.md`**.
