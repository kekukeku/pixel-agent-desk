# Pixel Agent Desk

[![CI](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> Văn phòng pixel thời gian thực dành cho các tác nhân mã hóa AI của bạn.
>
> Fork từ [Mgpixelart/pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk), được duy trì độc lập với các tích hợp mở rộng và tính năng bảng điều khiển.

## Về những Người Hộ Vệ trong Máy Móc

Thuở xưa, không một bậc kỳ tài nào độc hành trên con đường kiến tạo mà thiếu đi những hộ vệ vô hình thầm lặng dẫn lối. Nay, khi giấy da đã hóa thành màn gương, những linh hồn hộ mệnh ấy cũng khoác lên mình tấm áo pixel và mã nhị phân.
*Pixel Agent Desk* mở ra một gian phòng hai chiều nho nhỏ cho những hộ vệ trung thành này: một góc văn phòng nơi các tác nhân AI suy tư, làm việc và cả những lúc gật gù say ngủ.
Hãy mở ngăn bàn, biến những điều vô hình thành hiện hữu, và đón xem phép màu gỡ lỗi hiển hiện ngay trước mắt.

*[Đọc phần mở đầu đầy đủ](docs/readme-prelude.md) — Về những Người Hộ Vệ trong Máy Móc*

Pixel Agent Desk là ứng dụng Electron độc lập, theo dõi các sự kiện vòng đời tác nhân và kết xuất các phiên AI đang hoạt động thành các nhân vật pixel động trong văn phòng 2D. Hỗ trợ sẵn năm không gian làm việc tác nhân chính:

- **Claude Cowork**
- **Codex**
- **Grok Build**
- **Antigravity**
- **OpenWork**

Ứng dụng này là một lớp quan sát và trực quan hóa. Nó không điều phối công việc, gán nhiệm vụ hoặc kiểm soát các tác nhân của bạn.

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## Điểm nổi bật

- **Trình quan sát độc lập** — PAD chạy độc lập như một trình quan sát cho các không gian làm việc tác nhân GUI và TUI.
- **Văn phòng Pixel** — Một văn phòng ảo 2D nơi các tác nhân đang hoạt động xuất hiện dưới dạng nhân vật pixel động được điều khiển bởi các sự kiện vòng đời.
- **Danh sách hệ thống** — Thẻ bảng điều khiển trực tiếp hiển thị trạng thái tác nhân, công cụ đang hoạt động, nguồn, mức sử dụng token và chi phí đo lường khi có sẵn.
- **Năm tích hợp tùy chọn** — Claude Cowork, Codex, Grok Build, Antigravity và OpenWork, với khả năng tương thích OpenCode thông qua lõi OpenWork.
- **Phân tích Token & Chi phí** — Hiển thị khả năng hiển thị token cho các tác nhân được hỗ trợ trừ Antigravity, và ước tính chi phí chỉ khi có dữ liệu định giá đáng tin cậy.
- **Lưới hoạt động & Đánh giá GroupChat** — Truy cập phát lại phiên lịch sử và ma trận hoạt động bản đồ nhiệt trực quan.
- **API Sự kiện chung** — Các công cụ bên ngoài tùy chỉnh có thể đăng các sự kiện chuẩn hóa qua `POST /events/agent`.
- **Tự động phục hồi** — Khôi phục an toàn các phiên tác nhân đang hoạt động khi khởi động lại ứng dụng bằng PID đã xác minh hoặc cấu hình cho phép.

## Yêu cầu

**Để chạy Pixel Agent Desk:**
- **macOS (khuyến nghị):** không cần cài đặt Node riêng — [`Install.command`](Install.command) tải Node.js 22 di động về `~/.local/node` khi chạy lần đầu.
- **Windows / Linux / macOS thủ công:** cần **Node.js** 20 trở lên và **npm**
- **macOS, Windows hoặc Linux**

*Lưu ý: Các không gian làm việc tác nhân **không** phải là yêu cầu để chạy ứng dụng. Pixel Agent Desk hoạt động như một trình quan sát độc lập. Các nền tảng thiếu sẽ được báo cáo trong chẩn đoán nhưng sẽ không bao giờ gây sập hoặc chặn bảng điều khiển.*

## Khởi động nhanh

### macOS — Khởi động Desktop (Khuyến nghị)

1. **Thiết lập lần đầu**: Nhấp đúp vào [`Install.command`](Install.command) ở thư mục gốc kho lưu trữ.
   - Tải tệp nhị phân Node.js chính thức về `~/.local/node` nếu bạn chưa có Node 20+.
   - Chạy `npm install` cho các phụ thuộc của Pixel Agent Desk.
   - Cần truy cập mạng khi chạy lần đầu.
2. **Khởi chạy Bảng điều khiển**: Nhấp đúp vào [`Start.command`](Start.command).
   - Sử dụng cùng Node.js (`~/.local/node` hoặc Node 20+ hệ thống hiện có).
   - Mở cửa sổ bảng điều khiển qua `npm start`.
   - *Lưu ý quyền: Nếu macOS báo không thể mở `Install.command` hoặc `Start.command`, hãy chạy `chmod +x Install.command Start.command` trong thư mục này bằng Terminal.*
   - *Lưu ý Gatekeeper: Nếu macOS chặn thực thi, nhấp chuột phải vào tệp `.command` và chọn **Mở**.*

### Tất cả nền tảng — Khởi động từ mã nguồn

Để sao chép và chạy thủ công từ mã nguồn:

```bash
git clone https://github.com/kekukeku/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

Khi khởi chạy:
- Cửa sổ bảng điều khiển Pixel Agent Desk mở ra (hiển thị `Văn phòng của {username}` khớp động với hồ sơ tài khoản OS của bạn).
- Máy chủ cổng sự kiện cục bộ bắt đầu lắng nghe trên `127.0.0.1:47821`.
- Các tích hợp trình quan sát và bộ chuyển tiếp được cấu hình đăng ký và chuẩn bị nhận sự kiện tác nhân.

### Chẩn đoán

Để kiểm tra trạng thái phát hiện của các tích hợp tác nhân cục bộ mà không cần viết bất kỳ móc cấu hình nào hoặc khởi động trình quan sát:

```bash
npm run diagnose:integrations
```

## Các chế độ xem Bảng điều khiển

Thanh điều hướng bên cung cấp bốn chế độ xem chính để giám sát và khám phá các phiên tác nhân của bạn:

| Chế độ xem | Mục đích | Chi tiết |
|---|---|---|
| **Overview** | Khung vẽ văn phòng 2D chính & Danh sách trực tiếp | Xem các sprite pixel động di chuyển và làm việc, cùng với thẻ trạng thái tác nhân thời gian thực. Hỗ trợ cửa sổ PiP (Hình trong hình). |
| **Activity Mesh** | Ma trận bản đồ nhiệt tương tác | Hiển thị tần suất và đỉnh sự kiện theo ngày/giờ. |
| **GroupChat Review** | Phát lại phiên cục bộ | Phát lại các cuộc thảo luận đa tác nhân đã ghi (`groupchat_*.json`) trực tiếp trên khung vẽ văn phòng 2D trực quan. |
| **Metered API Usage** | Bảng điều khiển sử dụng token & thanh toán | Hiển thị số lượng token cho các tác nhân được hỗ trợ, chi phí ước tính khi định giá đáng tin cậy, và mức sử dụng cửa sổ ngữ cảnh đỉnh (CTX%) cho Grok Build. |

## Tích hợp

| Tác nhân | Cơ chế | Đường dẫn Cấu hình / Dữ liệu | Ghi cấu hình? | Ghi chú |
|---|---|---|---|---|
| Claude Cowork | Bộ chuyển tiếp sự kiện | `~/.claude/settings.json` | Có | Tự động đăng ký móc thuộc sở hữu PAD; di chuyển móc HTTP cũ nếu có |
| Codex | Trình quan sát JSONL chỉ đọc | `~/.codex/` | Không | Quét tệp phiên khoảng 2 giây một lần |
| Grok Build | Bộ chuyển tiếp sự kiện + trình quan sát | `~/.grok/hooks/pixel-agent-desk.json` + `~/.grok/sessions/**/signals.json` | Có | Móc quản lý vòng đời; trình quan sát theo dõi token và CTX% |
| Antigravity | Bộ chuyển tiếp sự kiện | `~/.gemini/config/hooks.json` | Có | Tích hợp trực tiếp tệp thực thi chuyển tiếp |
| OpenWork / OpenCode | Plugin tương thích OpenCode | `~/.config/opencode/plugins/pad-adapter.js` | Có | OpenWork được hỗ trợ thông qua lõi tương thích OpenCode của nó |

Trong các bản dựng đóng gói, các tệp trợ giúp được tạo ra trong `~/.pixel-agent-desk/runtime/` để thực thi các bộ chuyển tiếp qua tệp nhị phân Electron bằng `ELECTRON_RUN_AS_NODE=1`. Ở chế độ phát triển mã nguồn, các bộ chuyển tiếp chạy trực tiếp từ thư mục mã nguồn kho lưu trữ.

Xem [docs/integration-smoke-test.md](docs/integration-smoke-test.md) để có hướng dẫn kiểm thử tích hợp toàn diện.

*Lưu ý quan trọng: Nếu không có tác nhân nào đang hoạt động, **văn phòng ảo trống** là bình thường và không có nghĩa PAD đang bị lỗi. Các nhân vật động chỉ xuất hiện sau khi tác nhân tương ứng của chúng gửi ít nhất một sự kiện (ví dụ: mở không gian làm việc được hỗ trợ hoặc gửi lời nhắc).*

Để ngắt kết nối các tích hợp Pixel Agent Desk, chỉ xóa cấu hình móc/plugin hoặc khóa thuộc sở hữu PAD:

| Tác nhân | Nội dung cần xóa |
|---|---|
| Claude Cowork | Xóa các mục móc thuộc sở hữu PAD khỏi `~/.claude/settings.json` |
| Grok Build | Xóa `~/.grok/hooks/pixel-agent-desk.json` |
| Antigravity | Xóa khóa `"pixel-agent-desk"` khỏi `~/.gemini/config/hooks.json` |
| OpenWork / OpenCode | Xóa `~/.config/opencode/plugins/pad-adapter.js` |
| Codex | Không ghi cấu hình — chỉ cần thoát PAD để ngắt kết nối |

Bộ đệm tùy chọn (có thể xóa an toàn; PAD sẽ tạo lại khi khởi chạy tiếp theo):

```text
~/.pixel-agent-desk/runtime/
```

Khởi động lại không gian làm việc tác nhân bị ảnh hưởng sau khi sửa đổi để tải lại cấu hình.

## Cấu hình

Pixel Agent Desk đọc cấu hình người dùng tùy chọn từ:

```text
~/.pixel-agent-desk/config.json
```

Ví dụ:

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

Các cổng cấu hình hiện tại:

- `integrations.claude.enabled: false` bỏ qua đăng ký móc Claude Cowork và quét bản ghi.
- `integrations.opencode.enabled: false` bỏ qua đăng ký plugin OpenCode.

Các tích hợp khác được phát hiện theo khả năng và mở cửa an toàn nếu nền tảng của chúng chưa được cài đặt.

## API Sự kiện Tác nhân Chuẩn hóa

Các công cụ tùy chỉnh có thể báo cáo hoạt động bằng cách gửi các sự kiện chuẩn hóa đến:

```text
POST http://127.0.0.1:47821/events/agent
Content-Type: application/json
```

Ví dụ:

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

### Các sự kiện được hỗ trợ

- `agent.started` — Đăng ký hoặc làm mới phiên tác nhân.
- `agent.thinking` — Hiển thị trạng thái suy nghĩ và có thể tích lũy mức sử dụng token.
- `agent.working` — Hiển thị trạng thái làm việc và công cụ đang hoạt động.
- `agent.idle` — Hiển thị trạng thái nghỉ ngơi/chờ.
- `agent.done` — Đánh dấu một hành động đã hoàn thành.
- `agent.error` — Hiển thị trạng thái lỗi.
- `agent.help` — Hiển thị trạng thái quyền hạn/trợ giúp.
- `agent.removed` — Xóa nhân vật khỏi văn phòng.

## Phục hồi Phiên và Tên Hiển thị

Pixel Agent Desk lưu trữ các phiên đang hoạt động và cố gắng phục hồi khi khởi động lại khi nguồn có thể được xác minh an toàn.

Các tệp ánh xạ cục bộ tùy chọn:

- `~/.pixel-agent-desk/name-map.json` ánh xạ ID phiên ổn định đến tên hiển thị.
- `~/.pixel-agent-desk/watcher-allowlist.json` là tên tệp cũ được dùng làm danh sách cho phép phục hồi cho các phiên tùy chỉnh/thủ công. Nó không liên kết với trình giám sát Python đã bị xóa.

Ví dụ `name-map.json`:

```json
{
  "codex-main": "Codex",
  "antigravity-ui": "Antigravity"
}
```

## Tùy chỉnh Hình đại diện

Các lựa chọn hình đại diện được lưu trữ cục bộ trong bộ nhớ trình duyệt:

```text
Khóa localStorage: pixel-agent-desk.avatarOverrides.v1
```

Giá trị ánh xạ ID tác nhân ổn định đến chỉ số hình đại diện. Chọn "Đặt lại về Mặc định" sẽ xóa ghi đè.

## Hiển thị Token và Chi phí

Pixel Agent Desk hiển thị mức sử dụng tài nguyên tùy thuộc vào dữ liệu do tác nhân cung cấp:

- **Tác nhân hiển thị token**: Claude Cowork, Codex, Grok Build và OpenWork/OpenCode có thể hiển thị mức sử dụng token khi dữ liệu sự kiện hoặc phiên cục bộ của chúng tiết lộ điều đó.
- **Tác nhân nhận thức chi phí**: Khi mức sử dụng token có thể được khớp với định giá đáng tin cậy trong [src/pricing.js](src/pricing.js), Pixel Agent Desk ước tính chi phí. Nếu không, nó chỉ hiển thị mức sử dụng mà không bịa ra con số thanh toán.
- **Tác nhân nhận thức ngữ cảnh (ví dụ: Grok Build)**: Hiển thị phần trăm cửa sổ ngữ cảnh đỉnh (`CTX: N tok` hoặc áp lực phần trăm). Các giá trị ảnh chụp ngữ cảnh không được tích lũy. Bản đồ nhiệt hàng ngày ghi lại số token ngữ cảnh đỉnh hàng ngày.
- **Antigravity**: Khả năng hiển thị vòng đời được hỗ trợ, nhưng phát hiện token hiện không khả dụng.

Xem [docs/integration-smoke-test.md](docs/integration-smoke-test.md) §5.3 để xác minh Grok CTX.

*Lưu ý: Đảm bảo `npm start` đã đóng khi xác thực móc đóng gói, vì chỉ một phiên bản PAD có thể liên kết với cổng máy chủ sự kiện cục bộ (`47821`).*

## Nâng cao: Bản dựng Đóng gói

Mặc dù chạy từ mã nguồn được khuyến nghị, bạn vẫn có thể xây dựng ứng dụng độc lập đóng gói cục bộ:

```bash
npm run dist:mac
```

Sau đó khởi chạy:

```text
release/mac/Pixel Agent Desk.app
```

## Nhật ký Gỡ lỗi

Pixel Agent Desk ghi nhật ký thời gian chạy vào `debug.log`:

- **Từ mã nguồn (`npm start`)**: `src/debug.log` bên trong kho lưu trữ đã sao chép
- **Ứng dụng đóng gói (macOS)**: `~/Library/Application Support/pixel-agent-desk/debug.log`
- **Ứng dụng đóng gói (Windows)**: `%APPDATA%/pixel-agent-desk/debug.log`
- **Ứng dụng đóng gói (Linux)**: `~/.config/pixel-agent-desk/debug.log`

Tìm các dòng `[Processor]` và `[Event]` khi xác minh rằng sự kiện tác nhân đang đến văn phòng.

## Khắc phục sự cố

| Triệu chứng | Nguyên nhân có thể | Khắc phục |
|---|---|---|
| Không có nhân vật xuất hiện | Chưa có sự kiện tác nhân nào đến PAD | Khởi động phiên tác nhân một lần, sau đó kiểm tra `debug.log` (xem Nhật ký Gỡ lỗi ở trên) cho các dòng `[Processor]` |
| Văn phòng trống (không có nhân vật) | Trạng thái bình thường khi khởi động hoặc phiên không hoạt động | Các nhân vật động chỉ xuất hiện sau khi tác nhân của chúng gửi ít nhất một sự kiện (ví dụ: mở không gian làm việc được hỗ trợ hoặc gửi lời nhắc). Xác nhận `debug.log` có các sự kiện `[Processor]`. |
| Chẩn đoán cho biết Codex `active=false` | Chẩn đoán chỉ đọc và không khởi động trình quan sát | Sử dụng `npm start`; Codex sẽ trở nên hoạt động nếu được cài đặt |
| Grok hoặc Antigravity không xuất hiện trong ứng dụng đóng gói | Lệnh móc vẫn trỏ đến đường dẫn mã nguồn cũ | Khởi động lại ứng dụng đóng gói để làm mới móc; kiểm tra cấu hình móc cho `~/.pixel-agent-desk/runtime/forwarders/` |
| Lệnh móc sử dụng `node` trong xác thực đóng gói | Cấu hình móc được tạo bởi ứng dụng dev hoặc phiên bản cũ | Đóng dev PAD, mở gói `.app`, sau đó kiểm tra lại cấu hình móc |
| OpenCode không xuất hiện | Plugin chưa được cài đặt hoặc OpenCode chưa tải nó | Kiểm tra `~/.config/opencode/plugins/pad-adapter.js`, sau đó khởi động lại OpenCode/OpenWork |
| Claude Cowork không xuất hiện | Thiếu hoặc vô hiệu hóa móc Claude Cowork | Chạy `npm run diagnose:integrations` và kiểm tra `~/.claude/settings.json` |
| Một nhân vật cũ vẫn còn | Phục hồi phiên được lưu trữ vẫn có ID khớp | Xóa các mục cũ khỏi `name-map.json` hoặc `watcher-allowlist.json`, sau đó khởi động lại |

## Lệnh phát triển

```bash
npm start                  # Chạy ứng dụng Electron từ mã nguồn
npm test                   # Chạy bộ kiểm thử
npm run diagnose:integrations
npm run dist:mac           # Xây dựng gói macOS
```

## Đóng góp

Xem [PR_TEMPLATE.md](PR_TEMPLATE.md) để biết tóm tắt PR mong đợi, ghi chú kiểm thử và xác minh phạm vi.

## Giấy phép

- **Mã nguồn:** [Giấy phép MIT](LICENSE)
- **Tài sản nghệ thuật** (`public/characters/`, `public/office/`): [Giấy phép hạn chế tùy chỉnh](LICENSE-ASSETS) — không được phân phối lại hoặc sửa đổi.
