# Pixel Agent Desk

[![CI](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> AI コーディング・エージェントのためのリアルタイム・ピクセル・オフィス。
>
> [Mgpixelart/pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk) のフォーク。独自にメンテナンスされ、拡張された統合機能とダッシュボード機能を備えています。

## 機械の奥に棲む守り人について

古の工匠が羊皮紙に呪文を綴りし頃、その傍らには常に見えざる「守り人」が羽を休めていたという。時は流れ、羊皮紙は硝子の画面へと姿を変え、彼らもまたバイナリの衣を纏うAIエージェントとなった。
「Pixel Agent Desk」は、この健気な夜警たちに贈る小さな二次元の箱庭（オフィス）である。
さあ、引き出しを開け、見えざる隣人たちに席を与えよ。彼らがカタカタと思索し、時に居眠りするその愛らしき姿の中に、バグを退治する古の魔法が息づいている。

*[完全な前奏曲を読む](docs/readme-prelude.md) —— 『機械の奥に棲む守り人について』*

Pixel Agent Desk は、スタンドアローンの Electron アプリケーションであり、エージェントのライフサイクル・イベントを監視し、アクティブな AI セッションを 2D オフィス内のアニメーション・ピクセル・キャラクターとして描画します。次の 5 つの主要エージェント・ワークスペースをすぐに利用できます：

- **Claude Cowork**
- **Codex**
- **Grok Build**
- **Antigravity**
- **OpenWork**

本アプリは観察者であり可視化レイヤーに過ぎません。作業の派遣、タスクの割り当て、エージェントの制御は行いません。

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## 主な特徴

- **スタンドアローン・オブザーバー** — PAD は独立して動作し、GUI および TUI のエージェント・ワークスペースを観察します。
- **ピクセル・オフィス** — ライフサイクル・イベントに駆動されるアニメーション・ピクセル・キャラクターとしてアクティブなエージェントが現れる 2D 仮想オフィス。
- **システム・ロースター** — エージェントの状態、アクティブなツール、ソース、トークン使用量、メーター制コスト（取得可能な場合）を表示するライブ・ダッシュボード・カード。
- **5 つのオプション統合** — Claude Cowork、Codex、Grok Build、Antigravity、OpenWork。OpenWork コアを通じて OpenCode との互換性もあります。
- **トークン＆コスト分析** — サポート対象エージェント（Antigravity を除く）のトークン可視性を表示し、信頼できる価格データがある場合にのみコストを推定します。
- **アクティビティ・メッシュ＆グループチャット・レビュー** — 過去のセッション再生と視覚的なヒートマップ・アクティビティ・マトリックスにアクセスできます。
- **汎用イベント API** — カスタム外部ツールは、`POST /events/agent` を介して正規化されたイベントを投稿できます。
- **自動復旧** — 検証済み PID または許可設定を使用して、アプリ再起動時にアクティブなエージェント・セッションを安全に復元します。

## 動作要件

**Pixel Agent Desk を実行するには：**
- **macOS（推奨）：** 別途 Node をインストールする必要はありません —— 初回実行時に [`Install.command`](Install.command) がポータブル版 Node.js 22 を `~/.local/node` にダウンロードします。
- **Windows / Linux / 手動 macOS：** **Node.js** 20 以降および **npm** が必要です。
- **macOS、Windows、または Linux**

*注：エージェント・ワークスペースは実行に**必須ではありません**。Pixel Agent Desk は独立したオブザーバーとして動作します。未検出のプラットフォームは診断情報に報告されますが、ダッシュボードのクラッシュやブロックを引き起こすことはありません。*

## クイック・スタート

### macOS — デスクトップ起動（推奨）

1. **初回セットアップ**：リポジトリのルートにある [`Install.command`](Install.command) をダブルクリックします。
   - Node 20+ が未インストールの場合、公式 Node.js バイナリを `~/.local/node` にダウンロードします。
   - Pixel Agent Desk の依存関係をインストールするため `npm install` を実行します。
   - 初回実行時はネットワーク・アクセスが必要です。
2. **ダッシュボードの起動**：[`Start.command`](Start.command) をダブルクリックします。
   - 同じ Node.js（`~/.local/node` または既存のシステム Node 20+）を使用します。
   - `npm start` 経由でダッシュボード・ウィンドウを開きます。
   - *Gatekeeper 注記：macOS が実行をブロックする場合は、`.command` ファイルを右クリックして「開く」を選択するか、ターミナルで `chmod +x Install.command Start.command` を実行してください。*

### すべてのプラットフォーム — ソースからの起動

手動でクローンし、ソースから実行するには：

```bash
git clone https://github.com/kekukeku/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

起動時：
- Pixel Agent Desk ダッシュボード・ウィンドウが開きます（`{username} のオフィス` と動的に表示され、OS アカウント・プロファイルと一致します）。
- ローカル・イベント・ゲートウェイ・サーバーが `127.0.0.1:47821` で待ち受けを開始します。
- 設定されたオブザーバーおよびフォワーダー統合が登録され、エージェント・イベントの受信準備をします。

### 診断

設定フックを書いたりオブザーバーを起動したりせずに、ローカルのエージェント統合の検出状態を確認するには：

```bash
npm run diagnose:integrations
```

## ダッシュボード・ビュー

サイドバー・ナビゲーションには、エージェント・セッションの監視と探索のための 4 つの主要なビュー・モードがあります：

| ビュー | 目的 | 詳細 |
|---|---|---|
| **Overview（概要）** | メインの 2D オフィス・キャンバス＆ライブ・ロースター | アニメーション・ピクセル・スプライトの移動や作業を、リアルタイムのエージェント・ステータス・カードと共に表示。PiP（ピクチャー・イン・ピクチャー）ウィンドウをサポート。 |
| **Activity Mesh** | インタラクティブなヒートマップ・マトリックス | 日次／時間単位のイベント頻度とピークを表示。 |
| **GroupChat Review** | ローカル・セッション再生 | 録画されたマルチ・エージェント・ディスカッション（`groupchat_*.json`）を 2D ビジュアル・オフィス・キャンバス上で直接再生。 |
| **Metered API Usage** | トークン＆請求使用ダッシュボード | サポート対象エージェントのトークン数、価格が信頼できる場合の推定コスト、Grok Build のピーク・コンテキスト・ウィンドウ使用率（CTX%）を表示。 |

## 統合

| エージェント | メカニズム | 設定／データ・パス | 設定を書き込む？ | 備考 |
|---|---|---|---|---|
| Claude Cowork | イベント・フォワーダ | `~/.claude/settings.json` | はい | PAD 所有のフックを自動登録；従来の HTTP フックがあれば移行 |
| Codex | 読み取り専用 JSONL オブザーバー | `~/.codex/` | いいえ | 約 2 秒ごとにセッション・ファイルをスキャン |
| Grok Build | イベント・フォワーダ＋オブザーバー | `~/.grok/hooks/pixel-agent-desk.json` + `~/.grok/sessions/**/signals.json` | はい | フックがライフサイクルを管理；オブザーバーがトークンと CTX% を追跡 |
| Antigravity | イベント・フォワーダ | `~/.gemini/config/hooks.json` | はい | フォワーダ実行ファイルを直接統合 |
| OpenWork / OpenCode | OpenCode 互換プラグイン | `~/.config/opencode/plugins/pad-adapter.js` | はい | OpenWork はその OpenCode 互換コアを通じてサポートされます |

パッケージ版ビルドでは、ヘルパー・ファイルが `~/.pixel-agent-desk/runtime/` の下に具現化され、`ELECTRON_RUN_AS_NODE=1` を使用して Electron バイナリ経由でフォワーダを実行します。ソース開発モードでは、フォワーダはリポジトリのソース・フォルダから直接実行されます。

包括的な統合テスト・ガイドについては [docs/integration-smoke-test.md](docs/integration-smoke-test.md) を参照してください。

*重要な注記：アクティブなエージェントがない場合、**空の仮想オフィス**は正常であり、PAD に障害があることを意味しません。アニメーション・キャラクターは、対応するエージェントが少なくとも 1 つのイベント（例：サポート対象ワークスペースを開くかプロンプトを送信する）を送信した後にのみ表示されます。*

Pixel Agent Desk の統合を切断するには、PAD 所有のフック／プラグイン設定またはキーのみを削除してください：

| エージェント | 削除する項目 |
|---|---|
| Claude Cowork | `~/.claude/settings.json` から PAD 所有のフック・エントリを削除 |
| Grok Build | `~/.grok/hooks/pixel-agent-desk.json` を削除 |
| Antigravity | `~/.gemini/config/hooks.json` から `"pixel-agent-desk"` キーを削除 |
| OpenWork / OpenCode | `~/.config/opencode/plugins/pad-adapter.js` を削除 |
| Codex | 設定は書き込まれません — PAD を終了するだけで切断されます |

オプションのキャッシュ（安全に削除可能；PAD は次回起動時に再作成します）：

```text
~/.pixel-agent-desk/runtime/
```

変更後、影響を受けるエージェント・ワークスペースを再起動して設定を再読み込みしてください。

## 設定

Pixel Agent Desk は、以下のパスからオプションのユーザー設定を読み込みます：

```text
~/.pixel-agent-desk/config.json
```

例：

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

現在の設定ゲート：

- `integrations.claude.enabled: false` は Claude Cowork フックの登録とトランスクリプトのスキャンをスキップします。
- `integrations.opencode.enabled: false` は OpenCode プラグインの登録をスキップします。

その他の統合は機能検出され、プラットフォームがインストールされていない場合はフォール・オープンします。

## 正規化されたエージェント・イベント API

カスタム・ツールは、正規化されたイベントを以下に送信することでアクティビティを報告できます：

```text
POST http://127.0.0.1:47821/events/agent
Content-Type: application/json
```

例：

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

### サポート対象イベント

- `agent.started` — エージェント・セッションを登録または更新します。
- `agent.thinking` — 思考状態を表示し、トークン使用量を累積する場合があります。
- `agent.working` — 作業状態とアクティブなツールを表示します。
- `agent.idle` — 休憩／アイドル状態を表示します。
- `agent.done` — 完了したアクションをマークします。
- `agent.error` — エラー状態を表示します。
- `agent.help` — 権限／ヘルプ状態を表示します。
- `agent.removed` — キャラクターをオフィスから削除します。

## セッション復旧と表示名

Pixel Agent Desk はアクティブなセッションを永続化し、ソースが安全に検証できる場合に再起動時に復旧を試みます。

オプションのローカル・マッピング・ファイル：

- `~/.pixel-agent-desk/name-map.json` は、安定したセッション ID を表示名にマッピングします。
- `~/.pixel-agent-desk/watcher-allowlist.json` は、カスタム／手動セッションの復旧許可リストとして使用される従来のファイル名です。削除された Python ウォッチャーとは関係ありません。

`name-map.json` の例：

```json
{
  "codex-main": "Codex",
  "antigravity-ui": "Antigravity"
}
```

## アバター・カスタマイズ

アバターの選択は、ブラウザのローカル・ストレージに保存されます：

```text
localStorage キー: pixel-agent-desk.avatarOverrides.v1
```

値は、安定したエージェント ID をアバター・インデックスにマッピングします。「デフォルトにリセット」を選択すると、オーバーライドが削除されます。

## トークンとコストの表示

Pixel Agent Desk は、エージェントが提供するデータに応じてリソース使用量を表示します：

- **トークン可視エージェント**：Claude Cowork、Codex、Grok Build、OpenWork／OpenCode は、ローカル・イベントまたはセッション・データが公開している場合にトークン使用量を表示できます。
- **コスト対応エージェント**：トークン使用量が [src/pricing.js](src/pricing.js) の信頼できる価格と一致する場合、Pixel Agent Desk はコストを推定します。それ以外の場合は、請求番号をでっち上げることなく使用量のみを表示します。
- **コンテキスト対応エージェント（例：Grok Build）**：ピーク・コンテキスト・ウィンドウのパーセンテージ（`CTX: N tok` またはパーセンテージ圧力）を表示します。コンテキスト・スナップショット値は累積されません。日次ヒートマップは日次ピーク・コンテキスト・トークンを記録します。
- **Antigravity**：ライフサイクルの可視性はサポートされていますが、トークン検出は現在使用できません。

Grok CTX の検証については [docs/integration-smoke-test.md](docs/integration-smoke-test.md) §5.3 を参照してください。

*注：パッケージ版フックを検証する際は、`npm start` が閉じられていることを確認してください。ローカル・イベント・サーバー・ポート（`47821`）にバインドできる PAD インスタンスは 1 つだけです。*

## 上級：パッケージ版ビルド

ソースからの実行が推奨されますが、スタンドアロンのパッケージ版アプリをローカルでビルドすることもできます：

```bash
npm run dist:mac
```

次に起動します：

```text
release/mac/Pixel Agent Desk.app
```

## デバッグ・ログ

Pixel Agent Desk は、実行時ログを `debug.log` に書き込みます：

- **ソースから（`npm start`）**：クローンしたリポジトリ内の `src/debug.log`
- **パッケージ版アプリ（macOS）**：`~/Library/Application Support/pixel-agent-desk/debug.log`
- **パッケージ版アプリ（Windows）**：`%APPDATA%/pixel-agent-desk/debug.log`
- **パッケージ版アプリ（Linux）**：`~/.config/pixel-agent-desk/debug.log`

エージェント・イベントがオフィスに到達しているか確認する際は、`[Processor]` と `[Event]` の行を探してください。

## トラブルシューティング

| 症状 | 考えられる原因 | 対処法 |
|---|---|---|
| キャラクターが表示されない | まだエージェント・イベントが PAD に到達していない | エージェント・セッションを 1 回起動し、上記の `debug.log` で `[Processor]` の行を確認してください |
| オフィスが空（キャラクターなし） | 起動時または非アクティブなセッションの正常な状態 | アニメーション・キャラクターは、エージェントが少なくとも 1 つのイベントを送信した後にのみ表示されます（例：サポート対象ワークスペースを開くかプロンプトを送信）。`debug.log` に `[Processor]` イベントがあることを確認してください。 |
| 診断で Codex `active=false` と表示 | 診断は読み取り専用で、オブザーバーを起動しない | `npm start` を使用してください；Codex がインストールされていればアクティブになるはずです |
| パッケージ版アプリで Grok または Antigravity が表示されない | フック・コマンドが古いソース・パスを指している | パッケージ版アプリを再起動してフックを更新してください；`~/.pixel-agent-desk/runtime/forwarders/` のフック設定を確認してください |
| パッケージ版検証でフック・コマンドが `node` を使用 | フック設定が開発版アプリまたは古いバージョンによって生成された | 開発版 PAD を閉じ、パッケージ版 `.app` を開き、フック設定を再確認してください |
| OpenCode が表示されない | プラグインがインストールされていないか、OpenCode がロードしていない | `~/.config/opencode/plugins/pad-adapter.js` を確認し、OpenCode／OpenWork を再起動してください |
| Claude Cowork が表示されない | Claude Cowork フックが欠落しているか無効化されている | `npm run diagnose:integrations` を実行し、`~/.claude/settings.json` を確認してください |
| 古いキャラクターが残る | 永続化されたセッション復旧にまだ一致する ID がある | `name-map.json` または `watcher-allowlist.json` から古いエントリを削除し、再起動してください |

## 開発コマンド

```bash
npm start                  # ソースから Electron アプリを実行
npm test                   # テスト・スイートを実行
npm run diagnose:integrations
npm run dist:mac           # macOS パッケージ版をビルド
```

## コントリビューション

期待される PR サマリー、テスト・ノート、およびスコープ確認については [PR_TEMPLATE.md](PR_TEMPLATE.md) を参照してください。

## ライセンス

- **ソース・コード：** [MIT ライセンス](LICENSE)
- **アート・アセット**（`public/characters/`、`public/office/`）：[カスタム制限付きライセンス](LICENSE-ASSETS) —— 再配布または改変は禁止されています。
