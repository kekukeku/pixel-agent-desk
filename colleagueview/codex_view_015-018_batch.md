# Codex View: TASK-015 - TASK-018

- **Tasks**: TASK-015, TASK-016, TASK-017, TASK-018
- **Perspective**: Codex (Layer 1 Planner / Finalizer)
- **Date**: 2026-06-17
- **Status Observed**: All four tasks are `MERGED` in `AGENT_STATE.md`, have final `TASKS/task_NNN.md` metadata, and have Grok Build `APPROVE` reviews.

---

## Batch Context

This batch was the first real stress test of the newer local workflow after GroupChat planning became part of the DRAFT phase. The sequence was meaningful:

- TASK-015 made the operator workflow explicit and fixed the path quoting issue that affected this repository path.
- TASK-016 added the review-decision final-mile runner so `APPROVE` and `REQUEST_CHANGES` could reach Antigravity automatically.
- TASK-017 implemented GroupChat meeting-room behavior and replay seating.
- TASK-018 restored the System Roster avatar picker and local visual customization.

The four tasks now have matching task metadata, `APPROVE` reviews, validation summaries, change-log entries, and local merge references.

---

## 小A / Antigravity

### 做得好的地方

小A在這批任務的執行成熟度明顯提高。TASK-015 沒有只做 README，而是順著規格允許的 candidate files 修掉 `watcher.py` 對含空白 repo path 的 quoting 問題，這對 Kevin 的實際環境是直接有效的修正。

TASK-016 是這批最重要的系統性任務。小A把 final-mile runner 接到既有 `trigger_antigravity.py` 路徑，而不是另開一套孤立流程，這讓 `REQUEST_CHANGES` 和 `APPROVE` 的後續動作能沿用既有 agentapi discovery、prompt 組裝和 command override 測試方式。這個選擇降低了日後維護成本。

TASK-017 和 TASK-018 的 UI 實作也比前面幾輪更謹慎。meeting-room live mode、replay mode、avatar picker override 都有注意到 state isolation，沒有把 replay-only 狀態寫回 live agent 的持久狀態，也沒有讓 avatar picker 污染 GroupChat replay sprites。這點對 Pixel Agent Desk 很重要，因為這個 app 同時有 live watcher、歷史 replay、手動外觀設定三種視覺來源。

收尾也比早期任務好。四個 task 都有 feature commit、finalize commit、task metadata、review link、validation master 和 `LOGS/change_log.md` 條目。這代表小A不只是完成程式碼，也開始真正執行 `TEAM_RULES.md` 的 post-merge reconciliation。

### 下次可以更好

第一個需要收斂的是 task boundary。TASK-017 承載了一部分 TASK-014 dashboard/replay surface，雖然結果可用，但會讓 TASK-014 自己的 `UNDER_REVIEW` / `REQUEST_CHANGES` 歷史變得尷尬。UI-heavy 任務應盡量一 task 一 branch，一旦後續任務吸收前任務內容，就要明確補 superseded / reconciled 記錄。

第二個是 self-check artifacts。這批任務測試結果很多，也都有 validation master，但 Antigravity 的 pre-review self-check 仍然可以更明確地附在 review request 或 validation artifact 裡。小B review 時若能看到 executor 自己先列出的檢查表，review 會更快、更可追溯。

第三個是小型技術債要順手記成 follow-up。像 `groupchatEmptyIcon` / `groupchatEmptyText` ID mismatch，以及 avatar localStorage helper 在 `dashboard.js` 和 `office-character.js` 的重複，沒有阻擋 merge，但應該被轉成明確的小任務或 backlog note，避免一批任務結束後散落在 review 意見裡。

### 整體感覺

小A這批是目前最像「真正 executor」的一次：能接規格、能處理 review、能完成 merge/reconcile，也能在 UI state isolation 上保持克制。主要改進方向不是能力問題，而是 task 邊界和自我驗證文件要更乾淨。

---

## 小B / Grok Build

### 做得好的地方

小B在這批 review 裡抓到了真正影響流程可信度的點。TASK-015 她沒有只看 README，而是驗證 path quoting 對含空白路徑的 repository 是否有效；這剛好對本 repo 的實際路徑很關鍵。

TASK-016 的 review 很有價值。小B檢查了 final-mile runner 的觸發條件、decision payload、active mode gating、command override 測試，以及 `APPROVE` / `REQUEST_CHANGES` 分流是否真的會打到 Antigravity。這不是表面 review，而是對 workflow 自動化是否閉環的實質審查。

TASK-017 的 review 也很細。她檢查 meeting-room seat coordinates、pathfinding bypass、speech bubble truncation、watcher event fan-out，以及 replay/live isolation。這些都是視覺功能最容易「看起來有做，但狀態其實互相污染」的地方。

TASK-018 則有抓到 async startup sequencing 這種比較隱性的風險：avatar picker 如果在 `avatars.json` 載入完成前就吃到 SSE 或 render tick，很容易出現空選單或不同步。小B能把這點納入 review，代表她不只是檢查功能表面，也在檢查啟動順序。

### 下次可以更好

小B可以更果斷地把高風險 follow-up 升級成 blocking change。TASK-016 review 裡提到狀態旗標 leakage 的風險，這種一旦影響 final-mile automation 會很難 debug；若 reviewer 認為風險真實，應該直接要求修，不要只列 optional follow-up。

第二，小B的 review 建議可以再多附一點可直接執行的例子。例如 final-mile failure simulation、planning SSE mock payload、localStorage helper test outline。她已經指出問題，但如果能附最小 payload 或 command，Antigravity 下一輪會少猜很多。

第三，TASK-014 / TASK-017 scope bleed 這件事，小B已經在 batch review 裡點出來；下次遇到類似情況，可以更早在單 task review 階段要求 operator 或 Codex 明確標記 superseded / absorbed，避免等到批次盤點才發現治理狀態不乾淨。

### 整體感覺

小B這批 review 很強，尤其在 automation 和 UI state isolation 上有實質把關。她的意見不是形式審查，而是能指出流程閉環、狀態隔離、啟動順序、治理一致性這些核心風險。下一步可以更進一步：把高風險建議更明確地轉成 blocking，並附更可操作的測試 payload。

---

## Codex Follow-up Notes

這批任務也暴露出我作為 planner/finalizer 需要修正的工作習慣：

- TASK-014 被後續 TASK-017 吸收後，我應該主動補治理收尾，而不是只看 015-018 都 `MERGED` 就算完成。
- UI 空間任務要在 spec 裡給更精準的座標、座位、fallback name source 和 state ownership。
- future task rows 不應太早預註冊進 registry；每個 task commit 應盡量只處理當前任務。
- avatar persistence 這類使用者設定要明確指定 canonical storage，不能讓 `localStorage` 和本機 JSON 的語意並存但未說明。

Overall, TASK-015 through TASK-018 are a strong workflow milestone: planning, execution, review, final-mile automation, merge, and reconciliation all worked. The next maturity step is governance hygiene around superseded tasks and tighter task boundaries for UI-heavy work.
