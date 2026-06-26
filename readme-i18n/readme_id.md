# Pixel Agent Desk

[![CI](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> Sebuah kantor pixel real-time untuk agen pengodean AI Anda.
>
> Fork dari [Mgpixelart/pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk), dikelola secara mandiri dengan integrasi yang diperluas dan fitur dasbor.

## Tentang Para Penjaga di dalam Mesin

Alkisah, tak ada perajin yang menorehkan tinta tanpa penjaga tak kasatmata di sisinya. Kini, meski perkamen telah bersalin rupa menjadi layar kaca, dan roh-roh penjaga itu telah mengenakan jubah piksel serta kode biner, tugas mereka tidak pernah usai.
*Pixel Agent Desk* mempersembahkan sebuah ruang dwimatra bagi para penjaga setia ini: kantor kecil tempat agen AI Anda berpikir, bekerja, dan sesekali terkantuk-kantuk tenang.
Bukalah laci meja, wujudkan yang tak kasatmata, dan biarkan keajaiban pengurasan kutu (debugging) bekerja di depan mata Anda.

*[Baca preludium lengkap](docs/readme-prelude.md) — Tentang Para Penjaga di dalam Mesin*

Pixel Agent Desk adalah aplikasi Electron mandiri yang memantau peristiwa siklus hidup agen dan merender sesi AI aktif sebagai karakter pixel animasi di kantor 2D. Ia mendukung lima ruang kerja agen utama secara langsung:

- **Claude Cowork**
- **Codex**
- **Grok Build**
- **Antigravity**
- **OpenWork**

Aplikasi ini merupakan lapisan pengamat dan visualisasi. Ia tidak mengirimkan pekerjaan, menugaskan tugas, atau mengendalikan agen Anda.

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## Sorotan

- **Pengamat Mandiri** — PAD berjalan secara independen sebagai pengamat untuk ruang kerja agen GUI dan TUI.
- **Kantor Pixel** — Sebuah kantor virtual 2D di mana agen aktif muncul sebagai karakter pixel animasi yang digerakkan oleh peristiwa siklus hidup.
- **Daftar Sistem** — Kartu dasbor langsung yang menampilkan status agen, alat aktif, sumber, penggunaan token, dan biaya terukur jika tersedia.
- **Lima Integrasi Opsional** — Claude Cowork, Codex, Grok Build, Antigravity, dan OpenWork, dengan kompatibilitas OpenCode melalui inti OpenWork.
- **Analitik Token & Biaya** — Menampilkan visibilitas token untuk agen yang didukung kecuali Antigravity, dan mengestimasi biaya hanya jika data harga yang andal tersedia.
- **Jaring Aktivitas & Tinjauan GroupChat** — Akses pemutaran ulang sesi historis dan matriks aktivitas peta panas visual.
- **API Peristiwa Generik** — Alat eksternal kustom dapat memposting peristiwa yang dinormalisasi melalui `POST /events/agent`.
- **Pemulihan Otomatis** — Memulihkan sesi agen aktif dengan aman saat aplikasi di-restart menggunakan PID yang terverifikasi atau konfigurasi toleransi.

## Persyaratan

**Untuk menjalankan Pixel Agent Desk:**
- **macOS (disarankan):** tidak memerlukan instalasi Node terpisah — [`Install.command`](Install.command) mengunduh Node.js 22 portabel ke `~/.local/node` pada pertama kali dijalankan.
- **Windows / Linux / macOS manual:** **Node.js** 20 atau lebih baru dan **npm**
- **macOS, Windows, atau Linux**

*Catatan: Ruang kerja agen **bukan** persyaratan untuk menjalankan aplikasi. Pixel Agent Desk berfungsi sebagai pengamat independen. Platform yang tidak terdeteksi akan dilaporkan dalam diagnostik tetapi tidak akan pernah membuat dasbor mogok atau terblokir.*

## Mulai Cepat

### macOS — Startup Desktop (Disarankan)

1. **Pengaturan Pertama Kali**: Klik dua kali [`Install.command`](Install.command) di root repositori.
   - Mengunduh biner Node.js resmi ke `~/.local/node` jika Anda belum memiliki Node 20+.
   - Menjalankan `npm install` untuk dependensi Pixel Agent Desk.
   - Memerlukan akses jaringan saat pertama kali dijalankan.
2. **Luncurkan Dasbor**: Klik dua kali [`Start.command`](Start.command).
   - Menggunakan Node.js yang sama (`~/.local/node` atau Node 20+ sistem yang ada).
   - Membuka jendela dasbor melalui `npm start`.
   - *Catatan Gatekeeper: Jika macOS memblokir eksekusi, klik kanan berkas `.command` dan pilih **Buka**, atau jalankan `chmod +x Install.command Start.command` di Terminal.*

### Semua Platform — Startup dari Sumber

Untuk mengkloning dan menjalankan dari sumber secara manual:

```bash
git clone https://github.com/kekukeku/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

Saat peluncuran:
- Jendela dasbor Pixel Agent Desk terbuka (menampilkan `Kantor {username}` secara dinamis sesuai profil akun OS Anda).
- Server gerbang peristiwa lokal mulai mendengarkan di `127.0.0.1:47821`.
- Integrasi pengamat dan penerusan yang dikonfigurasi mendaftar dan bersiap menerima peristiwa agen.

### Diagnostik

Untuk memeriksa status deteksi integrasi agen lokal Anda tanpa menulis kait konfigurasi apa pun atau memulai pengamat:

```bash
npm run diagnose:integrations
```

## Tampilan Dasbor

Navigasi bilah sisi menyediakan empat mode tampilan utama untuk memantau dan menjelajahi sesi agen Anda:

| Tampilan | Tujuan | Detail |
|---|---|---|
| **Overview** | Kanvas kantor 2D utama & Daftar Langsung | Lihat sprite pixel animasi bergerak dan bekerja, bersama kartu status agen real-time. Mendukung jendela PiP (Picture-in-Picture). |
| **Activity Mesh** | Matriks peta panas interaktif | Menampilkan frekuensi dan puncak peristiwa harian/jam. |
| **GroupChat Review** | Pemutaran ulang sesi lokal | Memutar ulang diskusi multi-agen yang direkam (`groupchat_*.json`) langsung di kanvas kantor visual 2D. |
| **Metered API Usage** | Dasbor penggunaan token & penagihan | Menampilkan jumlah token untuk agen yang didukung, estimasi biaya saat harga andal, dan penggunaan jendela konteks puncak (CTX%) untuk Grok Build. |

## Integrasi

| Agen | Mekanisme | Jalur Konfigurasi / Data | Menulis Konfigurasi? | Catatan |
|---|---|---|---|---|
| Claude Cowork | Penerus peristiwa | `~/.claude/settings.json` | Ya | Mendaftarkan kait milik PAD secara otomatis; memigrasikan kait HTTP lama jika ada |
| Codex | Pengamat JSONL hanya-baca | `~/.codex/` | Tidak | Memindai berkas sesi setiap ~2 detik |
| Grok Build | Penerus peristiwa + pengamat | `~/.grok/hooks/pixel-agent-desk.json` + `~/.grok/sessions/**/signals.json` | Ya | Kait mengelola siklus hidup; pengamat melacak token dan CTX% |
| Antigravity | Penerus peristiwa | `~/.gemini/config/hooks.json` | Ya | Mengintegrasikan berkas eksekusi penerus secara langsung |
| OpenWork / OpenCode | Plugin yang kompatibel dengan OpenCode | `~/.config/opencode/plugins/pad-adapter.js` | Ya | OpenWork didukung melalui inti yang kompatibel dengan OpenCode |

Dalam build terpaket, berkas pembantu diwujudkan di bawah `~/.pixel-agent-desk/runtime/` untuk menjalankan penerus melalui biner Electron menggunakan `ELECTRON_RUN_AS_NODE=1`. Dalam mode pengembangan sumber, penerus berjalan langsung dari folder sumber repositori.

Lihat [docs/integration-smoke-test.md](docs/integration-smoke-test.md) untuk panduan pengujian integrasi yang komprehensif.

*Catatan Penting: Jika tidak ada agen yang aktif, **kantor virtual kosong** adalah normal dan tidak berarti PAD gagal. Karakter animasi hanya muncul setelah agen masing-masing mengirimkan setidaknya satu peristiwa (misalnya, membuka ruang kerja yang didukung atau mengirimkan prompt).*

Untuk memutuskan integrasi Pixel Agent Desk, hapus hanya konfigurasi kait/plugin atau kunci milik PAD:

| Agen | Yang perlu dihapus |
|---|---|
| Claude Cowork | Hapus entri kait milik PAD dari `~/.claude/settings.json` |
| Grok Build | Hapus `~/.grok/hooks/pixel-agent-desk.json` |
| Antigravity | Hapus kunci `"pixel-agent-desk"` dari `~/.gemini/config/hooks.json` |
| OpenWork / OpenCode | Hapus `~/.config/opencode/plugins/pad-adapter.js` |
| Codex | Tidak ada konfigurasi yang ditulis — cukup keluar dari PAD untuk memutuskan |

Tembolok opsional (aman untuk dihapus; PAD akan membuat ulang saat peluncuran berikutnya):

```text
~/.pixel-agent-desk/runtime/
```

Mulai ulang ruang kerja agen yang terpengaruh setelah modifikasi untuk memuat ulang konfigurasi.

## Konfigurasi

Pixel Agent Desk membaca konfigurasi pengguna opsional dari:

```text
~/.pixel-agent-desk/config.json
```

Contoh:

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

Gerbang konfigurasi saat ini:

- `integrations.claude.enabled: false` melewati pendaftaran kait Claude Cowork dan pemindaian transkrip.
- `integrations.opencode.enabled: false` melewati pendaftaran plugin OpenCode.

Integrasi lain dideteksi berdasarkan kemampuan dan gagal terbuka jika platformnya tidak terpasang.

## API Peristiwa Agen Normalisasi

Alat kustom dapat melaporkan aktivitas dengan mengirimkan peristiwa yang dinormalisasi ke:

```text
POST http://127.0.0.1:47821/events/agent
Content-Type: application/json
```

Contoh:

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

### Peristiwa yang Didukung

- `agent.started` — Mendaftarkan atau menyegarkan sesi agen.
- `agent.thinking` — Menampilkan status berpikir dan dapat mengakumulasi penggunaan token.
- `agent.working` — Menampilkan status bekerja dan alat aktif.
- `agent.idle` — Menampilkan status istirahat/diam.
- `agent.done` — Menandai tindakan yang selesai.
- `agent.error` — Menampilkan status kesalahan.
- `agent.help` — Menampilkan status izin/bantuan.
- `agent.removed` — Menghapus karakter dari kantor.

## Pemulihan Sesi dan Nama Tampilan

Pixel Agent Desk mempertahankan sesi aktif dan mencoba pemulihan saat restart ketika sumber dapat diverifikasi dengan aman.

Berkas pemetaan lokal opsional:

- `~/.pixel-agent-desk/name-map.json` memetakan ID sesi stabil ke nama tampilan.
- `~/.pixel-agent-desk/watcher-allowlist.json` adalah nama berkas warisan yang digunakan sebagai daftar izin pemulihan untuk sesi kustom/manual. Tidak terkait dengan pengamat Python yang telah dihapus.

Contoh `name-map.json`:

```json
{
  "codex-main": "Codex",
  "antigravity-ui": "Antigravity"
}
```

## Penyesuaian Avatar

Pilihan avatar disimpan secara lokal di penyimpanan peramban:

```text
Kunci localStorage: pixel-agent-desk.avatarOverrides.v1
```

Nilainya memetakan ID agen stabil ke indeks avatar. Memilih "Atur Ulang ke Default" menghapus penimpaan.

## Tampilan Token dan Biaya

Pixel Agent Desk menampilkan penggunaan sumber daya tergantung pada data yang disediakan oleh agen:

- **Agen dengan visibilitas token**: Claude Cowork, Codex, Grok Build, dan OpenWork/OpenCode dapat menampilkan penggunaan token ketika data peristiwa atau sesi lokal mereka mengeksposnya.
- **Agen yang sadar biaya**: Ketika penggunaan token dapat dipadankan dengan harga yang andal di [src/pricing.js](src/pricing.js), Pixel Agent Desk mengestimasi biaya. Jika tidak, ia menampilkan penggunaan tanpa membuat-buat angka penagihan.
- **Agen yang sadar konteks (misalnya Grok Build)**: Menampilkan persentase jendela konteks puncak (`CTX: N tok` atau tekanan persentase). Nilai snapshot konteks tidak diakumulasikan. Peta panas harian mencatat token konteks puncak harian.
- **Antigravity**: Visibilitas siklus hidup didukung, tetapi deteksi token saat ini tidak tersedia.

Lihat [docs/integration-smoke-test.md](docs/integration-smoke-test.md) §5.3 untuk verifikasi Grok CTX.

*Catatan: Pastikan `npm start` ditutup saat memvalidasi kait terpaket, karena hanya satu instance PAD yang dapat mengikat ke port server peristiwa lokal (`47821`).*

## Lanjutan: Build Terpaket

Meskipun menjalankan dari sumber disarankan, Anda dapat membangun aplikasi terpaket mandiri secara lokal:

```bash
npm run dist:mac
```

Kemudian luncurkan:

```text
release/mac/Pixel Agent Desk.app
```

## Log Debug

Pixel Agent Desk menulis log runtime ke `debug.log`:

- **Dari sumber (`npm start`)**: `src/debug.log` di dalam repo yang dikloning
- **Aplikasi terpaket (macOS)**: `~/Library/Application Support/pixel-agent-desk/debug.log`
- **Aplikasi terpaket (Windows)**: `%APPDATA%/pixel-agent-desk/debug.log`
- **Aplikasi terpaket (Linux)**: `~/.config/pixel-agent-desk/debug.log`

Cari baris `[Processor]` dan `[Event]` saat memverifikasi bahwa peristiwa agen telah mencapai kantor.

## Pemecahan Masalah

| Gejala | Kemungkinan Penyebab | Perbaikan |
|---|---|---|
| Tidak ada karakter yang muncul | Belum ada peristiwa agen yang mencapai PAD | Mulai sesi agen sekali, lalu periksa `debug.log` (lihat Log Debug di atas) untuk baris `[Processor]` |
| Kantor kosong (tidak ada karakter) | Status normal saat startup atau sesi tidak aktif | Karakter animasi hanya muncul setelah agen mereka mengirimkan setidaknya satu peristiwa (misalnya, buka ruang kerja yang didukung atau kirim prompt). Konfirmasi `debug.log` memiliki peristiwa `[Processor]`. |
| Diagnostik menyatakan Codex `active=false` | Diagnostik bersifat hanya-baca dan tidak memulai pengamat | Gunakan `npm start`; Codex harus aktif jika terpasang |
| Grok atau Antigravity tidak muncul di aplikasi terpaket | Perintah kait masih menunjuk ke jalur sumber lama | Mulai ulang aplikasi terpaket sehingga kait disegarkan; periksa konfigurasi kait untuk `~/.pixel-agent-desk/runtime/forwarders/` |
| Perintah kait menggunakan `node` dalam validasi terpaket | Konfigurasi kait dibuat oleh aplikasi dev atau versi lama | Tutup dev PAD, buka `.app` terpaket, lalu periksa ulang konfigurasi kait |
| OpenCode tidak muncul | Plugin belum terpasang atau OpenCode belum memuatnya | Periksa `~/.config/opencode/plugins/pad-adapter.js`, lalu mulai ulang OpenCode/OpenWork |
| Claude Cowork tidak muncul | Kait Claude Cowork hilang atau dinonaktifkan | Jalankan `npm run diagnose:integrations` dan periksa `~/.claude/settings.json` |
| Karakter usang masih ada | Pemulihan sesi yang dipertahankan masih memiliki ID yang cocok | Hapus entri usang dari `name-map.json` atau `watcher-allowlist.json`, lalu mulai ulang |

## Perintah Pengembangan

```bash
npm start                  # Jalankan aplikasi Electron dari sumber
npm test                   # Jalankan rangkaian pengujian
npm run diagnose:integrations
npm run dist:mac           # Bangun paket macOS
```

## Berkontribusi

Lihat [PR_TEMPLATE.md](PR_TEMPLATE.md) untuk ringkasan PR yang diharapkan, catatan pengujian, dan verifikasi cakupan.

## Lisensi

- **Kode sumber:** [Lisensi MIT](LICENSE)
- **Aset seni** (`public/characters/`, `public/office/`): [Lisensi pembatasan kustom](LICENSE-ASSETS) — tidak untuk didistribusikan ulang atau dimodifikasi.
