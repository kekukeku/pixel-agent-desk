# Pixel Agent Desk

[![CI](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> AI 코딩 에이전트를 위한 실시간 픽셀 오피스.
>
> [Mgpixelart/pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk)의 포크로, 독립적으로 유지보수되며 확장된 통합 기능과 대시보드 기능을 갖추고 있습니다.

## 기계 속 수호자에 관하여

예부터 장인의 손길이 양피지에 주문을 새길 때, 그 곁엔 늘 보이지 않는 수호자가 깃들어 있었다. 세월이 흘러 양피지는 유리 화면이 되었고, 그들 또한 이진법(binary)의 옷을 입은 AI 에이전트로 환생했다.
‘Pixel Agent Desk’는 이 기특한 밤의 파수꾼들을 위해 마련한 작은 2D 정원(오피스)이다.
이제 서랍을 열어 보이지 않던 동반자들에게 제자리를 찾아주자. 그들이 분주히 생각하고, 때론 꾸벅꾸벅 조는 사랑스러운 몸짓 속에, 버그를 쫓는 옛 마법이 고스란히 살아 숨 쉬고 있으니.

*[전주곡 전문 읽기](docs/readme-prelude.md) — 『기계 속 수호자에 관하여』*

Pixel Agent Desk는 에이전트 라이프사이클 이벤트를 감시하고 활성 AI 세션을 2D 오피스의 애니메이션 픽셀 캐릭터로 렌더링하는 독립형 Electron 앱입니다. 즉시 사용 가능한 다섯 가지 주요 에이전트 워크스페이스를 지원합니다:

- **Claude Cowork**
- **Codex**
- **Grok Build**
- **Antigravity**
- **OpenWork**

본 앱은 관찰자이자 시각화 계층에 불과합니다. 작업을 배분하거나, 작업을 할당하거나, 에이전트를 제어하지 않습니다.

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## 주요 특징

- **독립형 관찰자** — PAD는 GUI 및 TUI 에이전트 워크스페이스의 관찰자로 독립적으로 실행됩니다.
- **픽셀 오피스** — 라이프사이클 이벤트에 의해 구동되는 애니메이션 픽셀 캐릭터로 활성 에이전트가 나타나는 2D 가상 오피스.
- **시스템 로스터** — 에이전트 상태, 활성 도구, 소스, 토큰 사용량, 측정 비용(가능한 경우)을 표시하는 실시간 대시보드 카드.
- **5가지 선택형 통합** — Claude Cowork, Codex, Grok Build, Antigravity, OpenWork. OpenWork 코어를 통해 OpenCode와의 호환성 제공.
- **토큰 및 비용 분석** — 지원되는 에이전트(Antigravity 제외)의 토큰 가시성을 표시하며, 신뢰할 수 있는 가격 데이터가 있을 때만 비용을 추정합니다.
- **활동 메시 및 그룹챗 리뷰** — 과거 세션 재생과 시각적 히트맵 활동 매트릭스에 접근할 수 있습니다.
- **범용 이벤트 API** — 사용자 지정 외부 도구가 `POST /events/agent`를 통해 정규화된 이벤트를 게시할 수 있습니다.
- **자동 복구** — 검증된 PID 또는 허용 구성을 사용하여 앱 재시작 시 활성 에이전트 세션을 안전하게 복원합니다.

## 요구 사항

**Pixel Agent Desk를 실행하려면:**
- **macOS(권장):** 별도의 Node 설치가 필요 없습니다 —— [`Install.command`](Install.command)를 처음 실행하면 휴대용 Node.js 22를 `~/.local/node`에 다운로드합니다.
- **Windows / Linux / 수동 macOS:** **Node.js** 20 이상 및 **npm** 필요
- **macOS, Windows 또는 Linux**

*참고: 에이전트 워크스페이스는 실행에 **필수가 아닙니다**. Pixel Agent Desk는 독립적인 관찰자로 작동합니다. 누락된 플랫폼은 진단에 보고되지만 대시보드를 중단시키거나 충돌시키지 않습니다.*

## 빠른 시작

### macOS — 데스크톱 시작(권장)

1. **첫 설정**: 저장소 루트에서 [`Install.command`](Install.command)를 더블클릭합니다.
   - Node 20+가 설치되어 있지 않으면 공식 Node.js 바이너리를 `~/.local/node`에 다운로드합니다.
   - Pixel Agent Desk 의존성을 위해 `npm install`을 실행합니다.
   - 첫 실행 시 네트워크 접근이 필요합니다.
2. **대시보드 실행**: [`Start.command`](Start.command)를 더블클릭합니다.
   - 동일한 Node.js(`~/.local/node` 또는 기존 시스템 Node 20+)를 사용합니다.
   - `npm start`를 통해 대시보드 창을 엽니다.
   - *Gatekeeper 참고: macOS가 실행을 차단하면 `.command` 파일을 우클릭하여 **열기**를 선택하거나, 터미널에서 `chmod +x Install.command Start.command`를 실행하세요.*

### 모든 플랫폼 — 소스 시작

수동으로 복제하고 소스에서 실행하려면:

```bash
git clone https://github.com/kekukeku/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

실행 시:
- Pixel Agent Desk 대시보드 창이 열립니다(OS 계정 프로필에 맞춰 `{username}의 Office`로 동적 표시).
- 로컬 이벤트 게이트웨이 서버가 `127.0.0.1:47821`에서 수신을 시작합니다.
- 구성된 관찰자 및 포워더 통합이 등록되고 에이전트 이벤트 수신을 준비합니다.

### 진단

구성 후크를 작성하거나 관찰자를 시작하지 않고도 로컬 에이전트 통합의 감지 상태를 검사하려면:

```bash
npm run diagnose:integrations
```

## 대시보드 보기

사이드바 탐색에서는 에이전트 세션을 모니터링하고 탐색하기 위한 4가지 기본 보기 모드를 제공합니다:

| 보기 | 목적 | 세부 정보 |
|---|---|---|
| **Overview** | 메인 2D 오피스 캔버스 및 실시간 로스터 | 애니메이션 픽셀 스프라이트가 움직이고 작업하는 모습을 실시간 에이전트 상태 카드와 함께 보기. PiP(화면 속 화면) 창 지원. |
| **Activity Mesh** | 인터랙티브 히트맵 매트릭스 | 일별/시간별 이벤트 빈도와 피크를 표시합니다. |
| **GroupChat Review** | 로컬 세션 재생 | 녹화된 다중 에이전트 토론(`groupchat_*.json`)을 2D 시각 오피스 캔버스에서 직접 재생합니다. |
| **Metered API Usage** | 토큰 및 청구 사용량 대시보드 | 지원되는 에이전트의 토큰 수, 가격이 신뢰할 수 있을 때 추정 비용, Grok Build의 피크 컨텍스트 윈도우 사용량(CTX%)을 표시합니다. |

## 통합

| 에이전트 | 메커니즘 | 구성/데이터 경로 | 구성을 씁니까? | 참고 |
|---|---|---|---|---|
| Claude Cowork | 이벤트 포워더 | `~/.claude/settings.json` | 예 | PAD 소유 후크를 자동 등록; 기존 HTTP 후크가 있으면 마이그레이션 |
| Codex | 읽기 전용 JSONL 관찰자 | `~/.codex/` | 아니요 | 약 2초마다 세션 파일 스캔 |
| Grok Build | 이벤트 포워더 + 관찰자 | `~/.grok/hooks/pixel-agent-desk.json` + `~/.grok/sessions/**/signals.json` | 예 | 후크가 라이프사이클을 관리; 관찰자가 토큰과 CTX% 추적 |
| Antigravity | 이벤트 포워더 | `~/.gemini/config/hooks.json` | 예 | 포워더 실행 파일을 직접 통합 |
| OpenWork / OpenCode | OpenCode 호환 플러그인 | `~/.config/opencode/plugins/pad-adapter.js` | 예 | OpenWork는 OpenCode 호환 코어를 통해 지원됩니다 |

패키지 빌드에서는 헬퍼 파일이 `~/.pixel-agent-desk/runtime/` 아래에 구체화되어 `ELECTRON_RUN_AS_NODE=1`을 사용하여 Electron 바이너리를 통해 포워더를 실행합니다. 소스 개발 모드에서는 포워더가 저장소 소스 폴더에서 직접 실행됩니다.

포괄적인 통합 테스트 가이드는 [docs/integration-smoke-test.md](docs/integration-smoke-test.md)를 참조하세요.

*중요 참고: 활성 에이전트가 없으면 **빈 가상 오피스**가 정상이며 PAD에 오류가 있는 것을 의미하지 않습니다. 애니메이션 캐릭터는 해당 에이전트가 하나 이상의 이벤트(예: 지원되는 워크스페이스 열기 또는 프롬프트 보내기)를 보낸 후에만 표시됩니다.*

Pixel Agent Desk 통합을 해제하려면 PAD 소유 후크/플러그인 구성 또는 키만 제거하세요:

| 에이전트 | 제거할 항목 |
|---|---|
| Claude Cowork | `~/.claude/settings.json`에서 PAD 소유 후크 항목 제거 |
| Grok Build | `~/.grok/hooks/pixel-agent-desk.json` 삭제 |
| Antigravity | `~/.gemini/config/hooks.json`에서 `"pixel-agent-desk"` 키 제거 |
| OpenWork / OpenCode | `~/.config/opencode/plugins/pad-adapter.js` 삭제 |
| Codex | 구성이 작성되지 않음 — PAD를 종료하면 해제됩니다 |

선택적 캐시(안전하게 삭제 가능; PAD는 다음 실행 시 재생성):

```text
~/.pixel-agent-desk/runtime/
```

수정 후 영향을 받는 에이전트 워크스페이스를 재시작하여 구성을 다시 로드하세요.

## 구성

Pixel Agent Desk는 다음 경로에서 선택적 사용자 구성을 읽습니다:

```text
~/.pixel-agent-desk/config.json
```

예:

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

현재 구성 게이트:

- `integrations.claude.enabled: false`는 Claude Cowork 후크 등록 및 대본 스캔을 건너뜁니다.
- `integrations.opencode.enabled: false`는 OpenCode 플러그인 등록을 건너뜁니다.

기타 통합은 기능 감지되며, 플랫폼이 설치되지 않은 경우 안전하게 개방됩니다.

## 정규화된 에이전트 이벤트 API

사용자 지정 도구는 정규화된 이벤트를 다음 주소로 보내 활동을 보고할 수 있습니다:

```text
POST http://127.0.0.1:47821/events/agent
Content-Type: application/json
```

예:

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

### 지원되는 이벤트

- `agent.started` — 에이전트 세션을 등록하거나 새로 고칩니다.
- `agent.thinking` — 생각 상태를 표시하고 토큰 사용량을 누적할 수 있습니다.
- `agent.working` — 작업 상태 및 활성 도구를 표시합니다.
- `agent.idle` — 휴식/유휴 상태를 표시합니다.
- `agent.done` — 완료된 작업을 표시합니다.
- `agent.error` — 오류 상태를 표시합니다.
- `agent.help` — 권한/도움 상태를 표시합니다.
- `agent.removed` — 캐릭터를 오피스에서 제거합니다.

## 세션 복구 및 표시 이름

Pixel Agent Desk는 활성 세션을 지속화하고 소스를 안전하게 확인할 수 있을 때 재시작 시 복구를 시도합니다.

선택적 로컬 매핑 파일:

- `~/.pixel-agent-desk/name-map.json`은 안정적인 세션 ID를 표시 이름에 매핑합니다.
- `~/.pixel-agent-desk/watcher-allowlist.json`은 사용자 지정/수동 세션의 복구 허용 목록으로 사용되는 레거시 파일 이름입니다. 제거된 Python 감시자와는 관련이 없습니다.

`name-map.json` 예:

```json
{
  "codex-main": "Codex",
  "antigravity-ui": "Antigravity"
}
```

## 아바타 사용자 지정

아바타 선택은 브라우저 로컬 스토리지에 저장됩니다:

```text
localStorage 키: pixel-agent-desk.avatarOverrides.v1
```

값은 안정적인 에이전트 ID를 아바타 인덱스에 매핑합니다. "기본값으로 재설정"을 선택하면 재정의가 제거됩니다.

## 토큰 및 비용 표시

Pixel Agent Desk는 에이전트가 제공하는 데이터에 따라 리소스 사용량을 표시합니다:

- **토큰 가시성 에이전트**: Claude Cowork, Codex, Grok Build, OpenWork/OpenCode는 로컬 이벤트 또는 세션 데이터가 노출될 때 토큰 사용량을 표시할 수 있습니다.
- **비용 인식 에이전트**: 토큰 사용량이 [src/pricing.js](src/pricing.js)의 신뢰할 수 있는 가격과 일치하면 Pixel Agent Desk가 비용을 추정합니다. 그렇지 않으면 과장된 청구 번호 없이 사용량만 표시합니다.
- **컨텍스트 인식 에이전트(예: Grok Build)**: 피크 컨텍스트 윈도우 백분율(`CTX: N tok` 또는 백분율 압력)을 표시합니다. 컨텍스트 스냅샷 값은 누적되지 않습니다. 일일 히트맵은 일일 피크 컨텍스트 토큰을 기록합니다.
- **Antigravity**: 라이프사이클 가시성은 지원되지만 토큰 감지는 현재 사용할 수 없습니다.

Grok CTX 확인은 [docs/integration-smoke-test.md](docs/integration-smoke-test.md) §5.3을 참조하세요.

*참고: 패키지 후크를 검증할 때 `npm start`가 종료되었는지 확인하세요. 로컬 이벤트 서버 포트(`47821`)에 바인딩할 수 있는 PAD 인스턴스는 하나뿐입니다.*

## 고급: 패키지 빌드

소스에서 실행하는 것이 권장되지만, 로컬에서 독립형 패키지 앱을 빌드할 수도 있습니다:

```bash
npm run dist:mac
```

그런 다음 실행:

```text
release/mac/Pixel Agent Desk.app
```

## 디버그 로그

Pixel Agent Desk는 런타임 로그를 `debug.log`에 작성합니다:

- **소스에서(`npm start`)**: 복제한 리포지토리 내 `src/debug.log`
- **패키지 앱(macOS)**: `~/Library/Application Support/pixel-agent-desk/debug.log`
- **패키지 앱(Windows)**: `%APPDATA%/pixel-agent-desk/debug.log`
- **패키지 앱(Linux)**: `~/.config/pixel-agent-desk/debug.log`

에이전트 이벤트가 오피스에 도달하는지 확인할 때 `[Processor]` 및 `[Event]` 줄을 찾으세요.

## 문제 해결

| 증상 | 가능한 원인 | 해결 방법 |
|---|---|---|
| 캐릭터가 나타나지 않음 | 아직 에이전트 이벤트가 PAD에 도달하지 않음 | 에이전트 세션을 한 번 시작한 다음 위의 `debug.log`에서 `[Processor]` 줄을 확인하세요 |
| 오피스가 비어 있음(캐릭터 없음) | 시작 시 또는 비활성 세션의 정상 상태 | 애니메이션 캐릭터는 에이전트가 하나 이상의 이벤트를 보낸 후에만 표시됩니다(예: 지원되는 워크스페이스 열기 또는 프롬프트 보내기). `debug.log`에 `[Processor]` 이벤트가 있는지 확인하세요. |
| 진단에서 Codex `active=false` 표시 | 진단은 읽기 전용이며 관찰자를 시작하지 않음 | `npm start`를 사용하세요; Codex가 설치되어 있으면 활성화되어야 합니다 |
| 패키지 앱에서 Grok 또는 Antigravity가 표시되지 않음 | 후크 명령이 오래된 소스 경로를 가리킴 | 패키지 앱을 다시 시작하여 후크를 새로 고치세요; `~/.pixel-agent-desk/runtime/forwarders/`의 후크 구성을 확인하세요 |
| 패키지 검증에서 후크 명령이 `node` 사용 | 후크 구성이 개발 앱 또는 이전 버전에서 생성됨 | 개발 PAD를 닫고 패키지 `.app`을 연 다음 후크 구성을 다시 확인하세요 |
| OpenCode가 표시되지 않음 | 플러그인이 설치되지 않았거나 OpenCode가 로드하지 않음 | `~/.config/opencode/plugins/pad-adapter.js`를 확인한 다음 OpenCode/OpenWork를 다시 시작하세요 |
| Claude Cowork가 표시되지 않음 | Claude Cowork 후크가 누락되었거나 비활성화됨 | `npm run diagnose:integrations`를 실행하고 `~/.claude/settings.json`을 확인하세요 |
| 오래된 캐릭터가 남아 있음 | 지속된 세션 복구에 여전히 일치하는 ID가 있음 | `name-map.json` 또는 `watcher-allowlist.json`에서 오래된 항목을 제거한 다음 다시 시작하세요 |

## 개발 명령

```bash
npm start                  # 소스에서 Electron 앱 실행
npm test                   # 테스트 스위트 실행
npm run diagnose:integrations
npm run dist:mac           # macOS 패키지 빌드
```

## 기여

예상되는 PR 요약, 테스트 노트 및 범위 확인은 [PR_TEMPLATE.md](PR_TEMPLATE.md)를 참조하세요.

## 라이선스

- **소스 코드:** [MIT 라이선스](LICENSE)
- **아트 에셋**(`public/characters/`, `public/office/`): [사용자 지정 제한적 라이선스](LICENSE-ASSETS) — 재배포 또는 수정 금지.
