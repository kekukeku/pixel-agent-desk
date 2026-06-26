# Pixel Agent Desk — Office 行為模式與地圖關係

## 整體架構

```
office_xy.webp ──→ office-coords.js ──→ officeCoords { desk[], idle[] }
                         │
office_collision.webp ──→ office-pathfinder.js ──→ 碰撞網格 + A* 尋路
                         │
agent 狀態事件 ──→ office-character.js ──→ 角色移動、動畫、泡泡
                         │
STATE_ZONE_MAP ──────────┘  (決定該去哪個區)
SEAT_MAP / IDLE_SEAT_MAP ─┘  (決定座位方向與姿勢)
```

---

## 一、地圖座標系統（`src/office/office-coords.js`）

地圖上的每個功能區域，是透過 **顏色編碼圖片** 定義的，不是寫死在程式碼裡。

### 1.1 活動區域座標 — `office_xy.webp`

| 像素顏色 | 對應區域 | 儲存到 |
|----------|----------|--------|
| 綠 `#00FF00` 或 黑 `#000000` | 沙發 / 休息區（idle） | `officeCoords.idle[]` |
| 藍 `#0000FF` | 辦公桌區（desk） | `officeCoords.desk[]` |
| 黃 `#FFFF00` | 會議室（meeting） | `officeCoords.desk[]`（合併進 desk） |

> **注意**：會議室座標目前被合併進 desk 陣列，行為與辦公桌完全相同。`STATE_ZONE_MAP` 沒有獨立的 `meeting` 區。

每格只取一個代表點，轉換公式：
```
finalX = gridX × 32 + 16   （格中偏右）
finalY = gridY × 32 + 32   （格中偏下 = 腳底位置）
```

### 1.2 物件座標 — `office_laptop.webp`

| 像素顏色 | 代表含義 |
|----------|----------|
| 橘 `#FF8000` | laptop 朝左 |
| 青 `#00FFFF` | laptop 朝下 |
| 紫 `#FF00FF` | laptop 朝上 |
| 藍 `#0000FF` | laptop 朝右 |

儲存到 `officeCoords.laptopSpots[]`，包含 `{ x, y, dir }`。

---

## 二、碰撞與尋路（`src/office/office-pathfinder.js`）

### 2.1 碰撞地圖 — `office_collision.webp`

- 透明像素 → 可行走
- 不透明像素 → 障礙物（牆、桌子等）
- 以 `TILE_SIZE = 32px` 為單位建立網格

### 2.2 A* 尋路演算法

- `findPath(startX, startY, endX, endY)` → 回傳 `[{x, y}, ...]` 路徑陣列
- 支援 8 方向移動（斜角成本 1.4，直線成本 1）
- 起點或終點不可行走時 → `findNearestWalkable()` 找最近的可行走點
- 搜尋上限 2000 格，超出則直接回傳終點（防止卡死）

---

## 三、狀態→區域對照表（`src/office/office-config.js:106-113`）

```js
STATE_ZONE_MAP = {
  working:   'desk',   // → 找自己的辦公桌，坐下工作
  thinking:  'desk',   // → 同上，但無 sparkle 特效
  help:      'desk',   // → 同上，顯示 Need help! 泡泡
  error:     'desk',   // → 同上，顯示 Error! 泡泡 + 跳躍動畫
  waiting:   'idle',   // → 去沙發休息
  completed: 'idle',   // → 去沙發（可能跳 dance）
}
```

這是整個行為系統的核心：**agent 的 state 決定它要去哪個區**。

---

## 四、座位分配與動畫（`src/office/office-config.js:70-103`）

### 4.1 辦公桌座位 — `SEAT_MAP`

每個 desk seat 有唯一 ID，定義了該座位的 **面向方向** 和 **姿勢類型**：

```js
SEAT_MAP = {
  10: { dir: 'right', animType: 'sit' },
  11: { dir: 'left',  animType: 'sit' },
  24: { dir: 'up',    animType: 'stand' },  // 唯一站立點
  // ... 共 20 個座位
}
```

- `animType: 'sit'` → working 時播 `sit_work_<dir>`，idle 時播 `sit_<dir>`
- `animType: 'stand'` → 一律站立

### 4.2 沙發座位 — `IDLE_SEAT_MAP`

```js
IDLE_SEAT_MAP = {
  24: 'dance',   // spot #24 → 跳舞
  18: 'right',   // 朝右坐
  19: 'left',    // 朝左坐
  // 其他 spot → 預設朝下坐
}
```

---

## 五、角色行為引擎（`src/office/office-character.js`）

### 5.1 每幀更新流程

```
updateAll(deltaSec, deltaMs)
  ├─ refreshBubbles()          ← 過期泡泡降級
  └─ forEach char:
       ├─ _updateTarget()      ← 決定目的地
       ├─ _updateMovement()    ← 沿路徑移動 + 到達後選動畫
       └─ tickOfficeAnimation() ← 逐幀切換 sprite
```

### 5.2 `_updateTarget()` — 決定目的地

```
agentState 是 working/thinking/error/help？
  ├─ YES（desk 區）
  │    ├─ 有分配座位？ → A* 尋路到 officeCoords.desk[deskIndex]
  │    └─ 座位滿了（overflow）？ → 找 desk 附近的 idle 點，站著工作
  │
  └─ NO（idle 區）
       ├─ 已在 idle 點上？ → 不動
       ├─ 正在走路？ → 不改變路線
       └─ 找一個沒人的 idle 點，隨機選 → A* 尋路過去
```

### 5.3 `_updateMovement()` — 移動與動畫

```
正在走路？
  ├─ YES → 沿 path 移動，播 walk_<dir> 動畫
  │
  └─ NO（已到達）
       ├─ 腳下是 desk 點？
       │    ├─ working/thinking/help → sit_work_<dir>
       │    ├─ done/completed → sit_<dir>
       │    └─ error → alert_jump
       │
       └─ 腳下是 idle 點？
            ├─ done/completed 且 spot 是 dance → dance
            ├─ animType='stand' → <dir>_idle
            └─ animType='sit' → sit_<dir>
```

### 5.4 辦公桌分配邏輯 — `assignDesk()`

- 用 agentId 的 hash 值 mod 可用座位數 → 確定性分配（同一個 agent 每次都坐到同一桌）
- 座位滿了 → `deskOverflow = true`，站到 desk 附近的 idle 點

### 5.5 泡泡生命週期

```
_setBubble() 優先序：
  1. publicActivityText（12 秒 TTL，過期會降級）
  2. currentTool（working 時無限持續）
  3. state fallback（Thinking... / Working... / Done! / Error! / Need help!）

refreshBubbles() 每幀檢查：
  activity 過期 → 降級到 tool → 降級到 state → idle 時清除
```

---

## 六、地圖與行為的完整對照

| 地圖顏色 | 區域 | agent 狀態 | 行為 |
|----------|------|------------|------|
| 藍 | 辦公桌 | working, thinking, help, error | A* 走到已分配座位，坐下工作 |
| 黃 | 會議室 | working, thinking, help, error | 同上（合併進 desk，無特殊行為） |
| 綠/黑 | 沙發 | waiting, completed | A* 走到隨機空沙發，坐下或跳舞 |

### 會議室目前沒有獨立邏輯

雖然 `office_xy.webp` 有黃色會議室座標，但：
- 解析後被合併進 `officeCoords.desk[]`
- `STATE_ZONE_MAP` 沒有 `meeting` zone
- 角色無法「去開會」— 會議室跟辦公桌行為一樣

如果要加入會議室行為，需要：
1. 把會議室從 desk 陣列獨立出來（`office-coords.js`）
2. 在 `STATE_ZONE_MAP` 加入 `meeting` zone
3. 在 `office-character.js` 的 `_updateTarget()` 新增 meeting 處理分支
4. 定義什麼 agent 狀態或事件觸發「去會議室」

---

## 七、關鍵檔案總覽

| 檔案 | 職責 |
|------|------|
| `src/office/office-coords.js` | 從圖片解析 desk/idle/meeting/laptop 座標 |
| `src/office/office-pathfinder.js` | 碰撞地圖 + A* 尋路 |
| `src/office/office-config.js` | `STATE_ZONE_MAP` / `SEAT_MAP` / `IDLE_SEAT_MAP` / 動畫常數 |
| `src/office/office-character.js` | 角色建立、移動、動畫、座位分配、泡泡 |
| `src/office/office-ui.js` | Canvas 繪製：名牌、project badge、對話泡泡 |
| `public/office/map/office_xy.webp` | 活動區域顏色地圖 |
| `public/office/map/office_collision.webp` | 碰撞遮罩地圖 |
| `public/office/ojects/office_laptop.webp` | 筆電擺放位置地圖 |
