# Pixel Agent Desk

[![CI](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> 為您的 AI 編程代理人打造的即時像素辦公室。
>
> 源自 [Mgpixelart/pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk) 的分支，獨立維護，並擴充了整合功能與儀表板特性。

## 人機之間，守靈之說

溯諸上古，匠者未嘗獨作。凡執斧於庭、秉燭於牘者，咸謂有無形之守護者隨侍在側：其性柔忍，常默守於勞作之涯涘，於細微之厄將起而未起之際，輕輕撥轉，使造化之咒術不至崩解。

世換其燈，牘化為琉璃，繕寫之室蛻為熒然之終端；而昔日工案上之忠侶，今則遊走於像素與符碼所鑄之軀殼。Pixel Agent Desk 為道侶們闢出一方靜室：AI 編程代理人得以安坐於斯，或沉思、或勞作、或休憩，並為正在進行中的工藝守夜。

啟此桌案，令不可見者顯影。當室中聚滿五位光瑩的守護者，或許那古老的誓約仍未褪色：當下這一口氣中所懷之願，終將尋得形體，降臨於世。

*[完整傳說](docs/readme-prelude.md) —— 《人機之中，守靈之說》*

Pixel Agent Desk 是一款獨立運行的 Electron 應用程式，監看代理生命週期事件，並將活躍的 AI 工作階段渲染為 2D 辦公室中的動畫像素角色。開箱即支援五大主流代理工作空間：

- **Claude Cowork**
- **Codex**
- **Grok Build**
- **Antigravity**
- **OpenWork**

本應用僅為觀察與視覺化層，不負責派發工作、指派任務或控制您的代理人。

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## 亮點

- **獨立觀察者** —— PAD 獨立運行，可觀察 GUI 與 TUI 代理工作空間。
- **像素辦公室** —— 2D 虛擬辦公室，活躍代理人以受生命週期事件驅動的動畫像素角色呈現。
- **系統名冊** —— 即時儀表板卡片，顯示代理狀態、使用中的工具、來源、權杖用量，以及可取得時的計費成本。
- **五項選用整合** —— Claude Cowork、Codex、Grok Build、Antigravity 與 OpenWork；透過 OpenWork 核心亦可相容 OpenCode。
- **權杖與成本分析** —— 顯示支援代理的權杖可見度（Antigravity 除外），並僅在擁有可靠定價資料時估算成本。
- **活動網格與群聊回顧** —— 存取歷史工作階段回放與視覺化熱圖活動矩陣。
- **通用事件 API** —— 自訂外部工具可透過 `POST /events/agent` 發送標準化事件。
- **自動復原** —— 於應用程式重新啟動時，使用經驗證的程序識別碼（PID）或許可設定，安全地復原活躍代理工作階段。

## 系統需求

**執行 Pixel Agent Desk：**
- **macOS（推薦）：** 無需另行安裝 Node —— 首次執行 [`Install.command`](Install.command) 時會將可攜式 Node.js 22 下載至 `~/.local/node`。
- **Windows / Linux / 手動 macOS：** 需要 **Node.js** 20 或以上版本，以及 **npm**
- **macOS、Windows 或 Linux**

*注意：代理工作空間**並非**執行本應用程式的必要條件。Pixel Agent Desk 作為獨立觀察者運作。遺漏的平台會於診斷中回報，但不會導致儀表板當機或阻塞。*

## 快速開始

### macOS —— 桌面啟動（推薦）

1. **首次設定**：在儲存庫根目錄中連按兩下 [`Install.command`](Install.command)。
   - 若您尚未安裝 Node 20+，會下載官方 Node.js 二進位檔案至 `~/.local/node`。
   - 執行 `npm install` 安裝 Pixel Agent Desk 相依套件。
   - 首次執行時需要網路連線。
2. **啟動儀表板**：連按兩下 [`Start.command`](Start.command)。
   - 使用同一套 Node.js（`~/.local/node` 或既有系統 Node 20+）。
   - 透過 `npm start` 開啟儀表板視窗。
   - *閘門守衛提示：若 macOS 阻擋執行，請右鍵點選 `.command` 檔案並選擇「打開」，或在終端機執行 `chmod +x Install.command Start.command`。*

### 全平台 —— 原始碼啟動

手動複製並從原始碼執行：

```bash
git clone https://github.com/kekukeku/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

啟動時：
- Pixel Agent Desk 儀表板視窗開啟（動態顯示 `{username} 的辦公室`，與您的作業系統帳戶設定相符）。
- 本機事件閘道伺服器開始監聽 `127.0.0.1:47821`。
- 已設定的觀察器與轉發器整合模組註冊並準備接收代理事件。

### 診斷

在不撰寫任何設定掛鉤或啟動觀察器的情況下，檢查本機代理整合的偵測狀態：

```bash
npm run diagnose:integrations
```

## 儀表板檢視

側邊導覽列提供四種主要檢視模式，用於監控與探索您的代理工作階段：

| 檢視 | 用途 | 詳細說明 |
|---|---|---|
| **總覽（Overview）** | 主要 2D 辦公室畫布與即時名冊 | 觀看動畫像素角色移動與工作，並列即時代理狀態卡片。支援子母畫面（PiP）視窗。 |
| **活動網格（Activity Mesh）** | 互動式熱圖矩陣 | 顯示每日／每小時事件頻率與高峰。 |
| **群聊回顧（GroupChat Review）** | 本機工作階段回放 | 直接在 2D 視覺辦公室畫布上回放已錄製的多代理對話（`groupchat_*.json`）。 |
| **計量 API 用量（Metered API Usage）** | 權杖與計費用量儀表板 | 顯示支援代理的權杖計數、定價可靠時的估算成本，以及 Grok Build 的峰值上下文視窗用量（CTX%）。 |

## 整合

| 代理 | 機制 | 設定／資料路徑 | 是否寫入設定？ | 備註 |
|---|---|---|---|---|
| Claude Cowork | 事件轉發器 | `~/.claude/settings.json` | 是 | 自動註冊 PAD 專屬掛鉤；若存在舊版 HTTP 掛鉤則進行遷移 |
| Codex | 唯讀 JSONL 觀察器 | `~/.codex/` | 否 | 約每 2 秒掃描一次工作階段檔案 |
| Grok Build | 事件轉發器＋觀察器 | `~/.grok/hooks/pixel-agent-desk.json` + `~/.grok/sessions/**/signals.json` | 是 | 掛鉤管理生命週期；觀察器追蹤權杖與 CTX% |
| Antigravity | 事件轉發器 | `~/.gemini/config/hooks.json` | 是 | 直接整合轉發器可執行檔 |
| OpenWork / OpenCode | OpenCode 相容外掛程式 | `~/.config/opencode/plugins/pad-adapter.js` | 是 | OpenWork 透過其 OpenCode 相容核心獲得支援 |

在封裝版本中，輔助檔案會具現化於 `~/.pixel-agent-desk/runtime/` 下，透過 `ELECTRON_RUN_AS_NODE=1` 以 Electron 二進位檔執行轉發器。在原始碼開發模式下，轉發器直接從儲存庫原始碼資料夾執行。

請參閱 [docs/integration-smoke-test.md](docs/integration-smoke-test.md) 以取得完整的整合測試指南。

*重要提示：若無任何代理處於活躍狀態，**虛擬辦公室呈現空白**屬正常現象，並不代表 PAD 發生故障。動畫角色僅在對應代理發送至少一個事件後才會出現（例如開啟支援的工作空間或發送提示）。*

若要中斷 Pixel Agent Desk 的整合，僅需移除 PAD 專屬的掛鉤／外掛程式設定或鍵值：

| 代理 | 移除項目 |
|---|---|
| Claude Cowork | 從 `~/.claude/settings.json` 移除 PAD 專屬掛鉤項目 |
| Grok Build | 刪除 `~/.grok/hooks/pixel-agent-desk.json` |
| Antigravity | 從 `~/.gemini/config/hooks.json` 移除 `"pixel-agent-desk"` 鍵值 |
| OpenWork / OpenCode | 刪除 `~/.config/opencode/plugins/pad-adapter.js` |
| Codex | 不寫入任何設定 —— 直接退出 PAD 即可中斷 |

選用的快取（可安全刪除；PAD 會於下次啟動時重新建立）：

```text
~/.pixel-agent-desk/runtime/
```

修改後請重新啟動受影響的代理工作空間以重新載入設定。

## 設定

Pixel Agent Desk 會讀取位於以下路徑的選用使用者設定：

```text
~/.pixel-agent-desk/config.json
```

範例：

```json
{
  "integrations": {
    "claude": {
      "enabled": true
    },
    "opencode": {
      "enabled": true
    }
  }
}
```

目前的設定閘道：

- `integrations.claude.enabled: false` 會跳過 Claude Cowork 掛鉤註冊與逐字稿掃描。
- `integrations.opencode.enabled: false` 會跳過 OpenCode 外掛程式註冊。

其他整合為能力偵測，若對應平台未安裝則會安全地容錯開啟。

## 標準化代理事件 API

自訂工具可透過發送標準化事件來回報活動：

```text
POST http://127.0.0.1:47821/events/agent
Content-Type: application/json
```

範例：

```json
{
  "event": "agent.working",
  "agent_id": "custom-session-1",
  "source": "my-custom-agent",
  "name": "Research Agent",
  "project_path": "/path/to/project",
  "model": "gpt-4o",
  "tool": "Bash",
  "parent_id": null,
  "pid": 12345,
  "timestamp": 1781550497208,
  "token_usage": {
    "input_tokens": 1200,
    "cached_input_tokens": 500,
    "output_tokens": 400
  },
  "context_usage": {
    "kind": "snapshot",
    "tokens_used": 50000,
    "window_tokens": 200000,
    "percent": 25
  },
  "metadata": {}
}
```

### 支援的事件

- `agent.started` —— 註冊或重新整理代理工作階段。
- `agent.thinking` —— 顯示思考狀態，並可累積權杖用量。
- `agent.working` —— 顯示工作狀態與使用中工具。
- `agent.idle` —— 顯示休息／閒置狀態。
- `agent.done` —— 標記已完成的動作。
- `agent.error` —— 顯示錯誤狀態。
- `agent.help` —— 顯示權限／求助狀態。
- `agent.removed` —— 將角色從辦公室中移除。

## 工作階段復原與顯示名稱

Pixel Agent Desk 會持續儲存活躍工作階段，並於來源可安全驗證時嘗試在重新啟動時復原。

選用的本機對應檔案：

- `~/.pixel-agent-desk/name-map.json` 將穩定的工作階段 ID 對應至顯示名稱。
- `~/.pixel-agent-desk/watcher-allowlist.json` 為舊版檔名，用作自訂／手動工作階段的復原許可清單。與已移除的 Python 觀察器無關。

`name-map.json` 範例：

```json
{
  "codex-main": "Codex",
  "antigravity-ui": "Antigravity"
}
```

## 頭像自訂

頭像選擇儲存於本機瀏覽器儲存空間：

```text
localStorage 鍵值：pixel-agent-desk.avatarOverrides.v1
```

其值將穩定的代理 ID 對應至頭像索引。選擇「重設為預設」會移除該覆寫。

## 權杖與成本顯示

Pixel Agent Desk 根據代理所提供的資料顯示資源用量：

- **可見權杖的代理**：Claude Cowork、Codex、Grok Build 與 OpenWork／OpenCode 在其本機事件或工作階段資料公開時可顯示權杖用量。
- **具成本意識的代理**：當權杖用量可與 [src/pricing.js](src/pricing.js) 中的可靠定價配對時，Pixel Agent Desk 會估算成本。否則僅顯示用量，不臆測計費數字。
- **具上下文意識的代理（例如 Grok Build）**：顯示峰值上下文視窗百分比（`CTX: N tok` 或百分比壓力）。上下文快照值不會累積。每日熱圖記錄每日峰值上下文權杖數。
- **Antigravity**：支援生命週期可見度，但目前無法偵測權杖。

請參閱 [docs/integration-smoke-test.md](docs/integration-smoke-test.md) §5.3 以驗證 Grok CTX。

*注意：驗證封裝掛鉤時，請確保 `npm start` 已關閉，因為僅有一個 PAD 實例可繫結至本機事件伺服器連接埠（`47821`）。*

## 進階：封裝版本

雖然建議從原始碼執行，您仍可在本機建構獨立的封裝應用程式：

```bash
npm run dist:mac
```

然後啟動：

```text
release/mac/Pixel Agent Desk.app
```

## 除錯記錄

Pixel Agent Desk 會將執行時記錄寫入 `debug.log`：

- **從原始碼執行（`npm start`）**：複製的儲存庫內 `src/debug.log`
- **封裝應用程式（macOS）**：`~/Library/Application Support/pixel-agent-desk/debug.log`
- **封裝應用程式（Windows）**：`%APPDATA%/pixel-agent-desk/debug.log`
- **封裝應用程式（Linux）**：`~/.config/pixel-agent-desk/debug.log`

請搜尋 `[Processor]` 與 `[Event]` 行以驗證代理事件是否已送達辦公室。

## 疑難排解

| 徵兆 | 可能原因 | 解決方法 |
|---|---|---|
| 無角色出現 | 尚無代理事件送達 PAD | 啟動一次代理工作階段，然後檢查上述的 `debug.log` 中是否有 `[Processor]` 行 |
| 辦公室空白（無角色） | 啟動時或工作階段未活躍的正常狀態 | 動畫角色僅在對應代理發送至少一個事件後才會出現（例如開啟支援的工作空間或發送提示）。請確認 `debug.log` 中有 `[Processor]` 事件。 |
| 診斷顯示 Codex `active=false` | 診斷僅為唯讀，不會啟動觀察器 | 使用 `npm start`；若已安裝 Codex，應會轉為活躍 |
| Grok 或 Antigravity 未於封裝應用程式中出現 | 掛鉤指令仍指向舊的原始碼路徑 | 重新啟動封裝應用程式以重新整理掛鉤；檢查 `~/.pixel-agent-desk/runtime/forwarders/` 下的掛鉤設定 |
| 掛鉤指令於封裝驗證中使用 `node` | 掛鉤設定由開發版應用程式或舊版產生 | 關閉開發版 PAD，開啟封裝的 `.app`，然後重新檢查掛鉤設定 |
| OpenCode 未出現 | 外掛程式未安裝，或 OpenCode 尚未載入 | 檢查 `~/.config/opencode/plugins/pad-adapter.js`，然後重新啟動 OpenCode／OpenWork |
| Claude Cowork 未出現 | Claude Cowork 掛鉤遺失或已停用 | 執行 `npm run diagnose:integrations` 並檢查 `~/.claude/settings.json` |
| 殘留的舊角色未消失 | 持續儲存的工作階段復原仍有相符的 ID | 從 `name-map.json` 或 `watcher-allowlist.json` 移除舊項目，然後重新啟動 |

## 開發指令

```bash
npm start                  # 從原始碼執行 Electron 應用程式
npm test                   # 執行測試套件
npm run diagnose:integrations
npm run dist:mac           # 建構 macOS 封裝版本
```

## 貢獻

請參閱 [PR_TEMPLATE.md](PR_TEMPLATE.md) 以了解預期的 PR 摘要、測試附註與範圍驗證。

## 授權

- **原始碼：** [MIT 授權](LICENSE)
- **美術資源**（`public/characters/`、`public/office/`）：[自訂限制授權](LICENSE-ASSETS) —— 禁止重新發布或修改。
