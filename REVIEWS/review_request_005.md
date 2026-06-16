# Review Request: Personalize office floorplan title with local username (TASK-005)

- **Request ID**: RR-005
- **Linked Task**: [TASK-005](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_005.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_005_username_office_title`
- **Head**: `11e89a5`
- **Reviewer**: Grok Build (Layer 2)
- **Date**: 2026-06-16

---

## 1. Request Details

Replace the dashboard office panel title currently shown as `Operational Floorplan` with a personalized title using the local operating-system username:

```text
<username>'s Office
```

The title must be resolved dynamically on the machine running Pixel Agent Desk. Do not hardcode the current developer's username.

---

## 2. Changes Summary

- **dashboard.html**: Wrap the title text inside `<span id="officePanelTitle">` to allow dynamic update.
- **public/dashboard.js**: Retrieve the username from `/api/profile` and update the title safely.
- **src/dashboard-server.js**: Create the local-only `GET /api/profile` endpoint returning `{ username }` using `os.userInfo().username` with environment variable fallbacks.
- **__tests__/dashboard-server.test.js**: Add full test coverage for the `/api/profile` endpoint, verifying both success and all error fallback paths.

---

## 3. Test Results

```text
Test Suites: 19 passed, 19 total
Tests:       324 passed, 324 total
Time:        10.738 s
```

---

**Please evaluate these changes and record the decision in `REVIEWS/review_005.md`**.
