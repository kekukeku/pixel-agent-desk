# TASK-006 後續建議書

- **Author**: Grok Build (Layer 2)
- **Related Task**: [TASK-006](../TASKS/task_006.md) — Pixel Agent Desk watcher（已 `MERGED`）
- **Related Review**: [review_006.md](./review_006.md)（`APPROVE`）
- **Written At**: 2026-06-16
- **Status**: 建議追蹤清單 — **尚未開立正式任務**（是否成為 TASK-007 或由 operator 安排其他優先序，待決）

---

## 1. 目的

TASK-006 已 merge 並通過 `validation_master_006.md`。本文件整理審查階段標記為 **Optional Follow-ups** 與團隊回饋中的改善項，供 operator / 小C 日後排程參考。

**本文件不構成 merge 阻擋、不修改驗收結論。** 現行 `watcher.py` 已滿足 TASK-006 全部 acceptance criteria。

---

## 2. 建議總覽

| ID | 項目 | 優先級 | 粗估工作量 | 主要受益 |
| :--- | :--- | :---: | :---: | :--- |
| F1 | `requirements.txt` + README 安裝說明 | **高** | S | 新環境 onboarding |
| F2 | README 補充 `grok_handoff_NNN.json` | **中** | XS | visual-only 操作者 |
| F3 | 擴充 watcher 自動化測試 | **中** | M | 回歸防護 |
| F4 | `run_command_in_shell` 改 argument-array | **中** | S～M | 安全與可維護 |
| F5 | Review 完成後改用 `agent.done` 語意 | **低** | S | 視覺清晰度 |
| F6 | `on_deleted` 治理檔處理 | **低** | S | 邊界情境完整性 |

優先級說明：**高** = 新用戶/新機器很可能當場卡住；**中** = 不擋 MVP 但值得在 watcher 成為長期入口前補上；**低** = 體驗或邊界優化，可與其他 UI/治理任務一併考慮。

---

## 3. 各項說明

### F1 — Python 依賴明文化（`requirements.txt`）

**現況：** `watcher.py` 依賴 `watchdog`，repo 內無 `requirements.txt`；README 僅寫 `python3 watcher.py`，未說明 pip 安裝步驟。

**風險：** 乾淨環境執行會直接 `ImportError`，operator 需自行摸索。

**建議內容：**
- 新增 `requirements.txt`（至少 `watchdog`，建議 pin 相容版本）
- README「How to Run」前加一節：`pip install -r requirements.txt`（或 `pip install watchdog`）
- 可選：在 `watcher.py` 啟動時對缺依賴給出明確錯誤訊息

**建議負責層：** 小A 實作；小C 若開任務可列為單一驗收項。

---

### F2 — README 對稱文件（Grok handoff fallback）

**現況：** Visual-only 模式 README 已描述 Antigravity 的 `REVIEWS/task_handoff_NNN.json`；Grok 路徑實際寫入 `REVIEWS/grok_handoff_NNN.json` + stderr warning，但 README 未提及。

**風險：** 操作者以為 Grok handoff 失敗或 watcher 有 bug，其實是預期 fallback。

**建議內容：**
- 在「Visual-Only Mode」段落並列兩種 fallback 路徑與觸發條件（`UNDER_REVIEW` transition、無 grok cmd/webhook）
- 可附範例 JSON 欄位（`task_num`, `project_root`, `status`, `timestamp`）

**建議負責層：** 小A；純文件，可與 F1 同批處理。

---

### F3 — 擴充 `__tests__/watcher.test.js`

**現況：** 3 個 `--parse-only` 整合測試覆蓋 parsing；handoff 建構、decision → visual mapping、debounce 邏輯未自動驗證。

**風險：** 日後改 `handle_file_change` 或 handoff 格式時，回歸只能靠手動 smoke test。

**建議內容（可分期）：**

| 子項 | 做法 | 難度 |
| :--- | :--- | :---: |
| F3a | 抽出 handoff builder 純函式，`--parse-only` 或新 CLI flag 輸出 payload shape | 低 |
| F3b | decision → agent event 對照表單元測試（APPROVE / REQUEST_CHANGES / REJECT） | 中 |
| F3c | debounce keying（同 path 500ms 內不重複）— 需 mock 或 subprocess 時間控制 | 中高 |

**建議負責層：** 小A 實作 + 小B 審查測試策略；延續 TASK-006 的 `--parse-only` 可測性設計。

---

### F4 — 命令執行改 argument-array

**現況：** `run_command_in_shell` 使用 `shell=True` + 字串模板 `{task_num}`；TASK-006 審查列為 non-blocking（config 由 operator 控制）。

**風險：** 若 `watcher.json` 被誤改或模板來源不可信，存在 shell injection 面。

**建議內容：**
- 支援 `command` 為字串陣列（如 `["node", "agent-runner/trigger-review.js", "{task_num}"]`）
- 字串形式保留但文件標註「僅限受信任環境」
- 長期可 deprecate `shell=True` 單一字串路徑

**建議負責層：** 小C 規格化 config schema → 小A 實作；需 README / `watcher.json` 範例同步更新。

---

### F5 — `agent.done` vs `agent.idle` 語意

**現況：** Review 完成後 Grok 視覺狀態回到 `agent.idle`（與 keep-alive 相同事件類型）。

**改善：** 若 Pixel Agent Desk runtime 已支援或將支援 `agent.done`，review 結束時發送 `agent.done` 可與「待命 keep-alive」區分，動畫語意更清楚。

**前置：** 需確認 `src/` 事件處理是否已支援 `agent.done`；若未支援，應先走 TASK-002 相關擴充或併入 UI 任務。

**建議負責層：** 小C 釐清 runtime contract → 再決定是否納入 watcher-only 變更。

---

### F6 — `on_deleted` 處理

**現況：** `RepoEventHandler` 處理 `on_modified` 與 `on_created`；刪除 `TASKS/task_NNN.md` 或相關 review 檔時無動作。

**改善：** 若任務檔被移除，可選擇將對應 agent 視覺狀態重置為 `agent.idle` 或從辦公室場景移除（需產品決策）。

**建議：** 先由 operator 確認是否為真實工作流（任務很少被刪，多為 archive）；若非高頻，優先級維持低。

---

## 4. 打包建議（僅供排程參考）

以下為**候選組合**，非定案；operator 可改做 TASK-005 或其他治理項。

| 方案 | 包含 | 適合時機 |
| :--- | :--- | :--- |
| **A — 運維就緒包** | F1 + F2 | 打算對外分享 repo 或換機部署 watcher |
| **B — 品質加固包** | F3 + F4 | watcher 將成為每日必開工具 |
| **C — 體驗拋光包** | F5 + F6 | 配合 TASK-005 UI 或 runtime 事件擴充 |

若日後開立正式任務，建議標題範例：`TASK-007: watcher hardening (deps, docs, tests)`，並在 `TASKS/` 明列驗收項與 non-goals（不重寫 watcher 架構、不改 `src/` 除非 F5 需要）。

---

## 5. 明確不建議納入後續項

- **重做 TASK-006 核心架構**（watchdog、debounce、baseline scan）— 已驗證穩定
- **auto-merge 或修改 review router 語意** — 屬 TASK-004 範疇，應獨立任務
- **TASK-005 office title UI** — 與 watcher 無直接依賴，維持獨立排程

---

## 6. 結論

TASK-006 閉環已完成；本清單記錄「讓 watcher 從能跑變好跑、好維護、好交接」的六項候選。**無需立即行動。** Operator 決定下一個任務時，可從 §4 方案中擇一打包，或將單項併入其他任務。

---

*Authored by Grok Build (Layer 2). 團隊回饋已納入：optional follow-ups 應可追蹤、避免只留在 review 備註。*