# Grok Build Review: TASK-020

- **Reviewer**: Grok Build
- **Decision**: APPROVE

---

## 1. Review Summary

Evaluated branch `task/task_020_roster_avatar_portrait_picker` against `TASKS/task_020.md` and `REVIEWS/review_request_020.md` using `REVIEWS/review_diff_020.patch`, plus workspace implementation files (`public/dashboard.js`, `public/dashboard.css`, `public/shared/sprite-frames.json`, and `AGENT_STATE.md`).

The submission fixes the TASK-018 regression with a minimal, reusable sprite-portrait renderer. Full spritesheet `<img>` tags are replaced by cropped, scaled `background-image` divs that show `front_idle` frame index `0`. TASK-018 picker interactions, office-canvas sync, and `pixel-agent-desk.avatarOverrides.v1` persistence are untouched. All acceptance criteria are satisfied.

| Check | Result |
| :--- | :--- |
| Roster card preview shows single front-facing frame, not full sheet | **PASS** |
| Picker grid options show single front-facing frame per avatar | **PASS** |
| Sprite metadata: 8 cols, 48×64 frames, preview frame `0` (`front_idle[0]`) | **PASS** |
| Selected / hover / reset-to-default behavior preserved (TASK-018) | **PASS** |
| Selection updates roster preview and office canvas immediately | **PASS** |
| `pixel-agent-desk.avatarOverrides.v1` storage key and handlers unchanged | **PASS** |
| Card and picker layout stable (fixed button/option sizes, absolute dropdown) | **PASS** |
| Focused verification: `rg -n "mc-avatar\|avatarOverrides\|front_idle\|sprite" public/dashboard.js public/dashboard.css` | **PASS** |

---

## 2. Detailed Findings

### Blocking Issues

- None.

### Non-Blocking Notes

- **Reusable portrait helpers match implementation notes** — `spritePortraitStyle()` and `spritePortraitHtml()` centralize frame math and DOM markup. Both the roster card (32px) and picker options (28px) call the same helper with different display widths, avoiding duplicated inline style logic.

- **Sprite convention is correctly applied** — `SPRITE_SHEET` uses `cols: 8`, `frameW: 48`, `frameH: 64`, and `previewFrame: 0`, matching `public/shared/sprite-frames.json` where `front_idle` begins at index `0`. Background sizing and negative `background-position` crop exactly one frame and scale with `image-rendering: pixelated`.

- **TASK-018 interaction surface is preserved** — Event delegation for `.mc-avatar-btn`, `.mc-avatar-option`, and `.mc-avatar-reset-btn` is unchanged. CSS selectors for `.selected`, `:hover`, and reset button styling remain intact. Dropdown open state is still preserved across `updateAgentUI` re-renders via `isDropdownActive`.

- **Accessibility labels retained** — Portrait divs use `role="img"`, `aria-label`, and `title`; user-facing labels pass through `escapeHtml()`.

- **Layout containment is sound** — `.mc-avatar-btn` (44×44) and `.mc-avatar-option` (36×36) keep fixed dimensions; the new `overflow: hidden` on options clips scaled portraits without resizing cards. The dropdown remains `position: absolute`, so opening the picker does not reflow the roster column.

### Optional Follow-ups

- Add a focused Jest test for `spritePortraitStyle()` frame-position math (pure helper, easy to lock against `sprite-frames.json` drift).
- Load `previewFrame` from `sprite-frames.json` at runtime instead of a hardcoded constant to eliminate manual sync burden.
- URL-encode `sheetFile` in the inline `background-image` style as defense-in-depth (filenames are currently trusted via `AVATAR_FILES`).

---

## 3. Tradeoffs & Architectural Analysis

**CSS background-position cropping vs. `<img>` or canvas data URLs** — The chosen approach is the simplest fix for the regression: one div per preview, no extra assets, no async image generation. Tradeoff: portrait dimensions follow the sprite aspect ratio (taller than the previous square `<img>` boxes), so options rely on `overflow: hidden` for minor vertical clipping. At 28–32px display width the portrait remains legible and meets the task requirement.

**Hardcoded `SPRITE_SHEET` constant** — Duplicating sheet metadata in `dashboard.js` avoids an extra fetch and keeps rendering synchronous. The `ponytail:` comment documents the sync obligation with `sprite-frames.json`. Tradeoff: future sheet layout changes require updating two files unless a shared loader is introduced later.

**Inline `style` attributes for per-frame geometry** — Dynamic `background-size` and `background-position` values are easier to express inline than as a large set of CSS custom properties. Tradeoff: slightly more DOM verbosity, but confined to two call sites and encapsulated in helpers.

**No new dependencies or persistence changes** — Scope stays within the two files listed in the task spec plus registry metadata. No risk of state-contamination or storage-key breakage.

**Merge gate unlocked.** Antigravity may proceed with merge reconciliation per TEAM_RULES.md §12.

---

*Review authored by Grok Build (Layer 2).*
