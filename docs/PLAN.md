# Rencana Dashboard PANDU (desktop, tablet, mobile)

Status: rencana awal untuk dibahas dengan Rafif (pembuat dashboard). Dasar: definisi proyek yang sudah disepakati, `docs/AUDIT_V2.md`, firmware Gateway/Vest saat ini, dan Laporan Pekan 7.
Tanda: **[P0]** wajib untuk demo/MVP, **[P1]** penting, **[P2]** nanti. **[KONFIRMASI]** = butuh keputusan tim.

---

## 1. Tujuan, pengguna, dan batas

**Tujuan:** operator di dermaga memantau sampai **8 Vest** secara real-time, melihat stage (aman, warning, danger), posisi di peta, dan menangani alarm (mute, dismiss), dengan riwayat insiden.

**Pengguna**

| Peran | Kebutuhan | Perangkat utama |
|---|---|---|
| Operator/Overseer (pengguna utama) | Pantau semua Vest, tangani alarm | Desktop di dermaga; tablet; mobile saat bergerak |
| Admin | Kelola Vest, pairing helm, ambang, pengguna | Desktop |
| Viewer (supervisor/dosen) | Lihat saja, tanpa kontrol | Semua |

Pandu (pemakai Vest) **bukan** pengguna aplikasi. SOS hanya dari tombol di Vest.

**Di luar scope (v1):** SOP-AI (RAG/LLM), aplikasi native, tombol "I'm safe"/SOS di aplikasi, komunikasi dua arah ke Vest, pelaporan K3 resmi.

**Scope prototipe (diputuskan 12 Okt): 1 Helmet, 1 Vest, 1 Gateway.** Dampaknya:
- Desain dan model data tetap mendukung banyak Vest (definisi proyek sampai 8), tapi **MVP dan demo fokus pada satu Vest**: layar utama menampilkan satu kartu besar + peta, bukan grid 8 kartu. Daftar banyak Vest dibuat setelah MVP berjalan, dan tetap diuji lewat simulator (8 Vest palsu).
- Tidak ada tabrakan paket antar-Vest dan tidak ada pairing helm banyak-ke-banyak; `vest_id` cukup diisi tetap (1) di firmware, `seq` tetap dipakai untuk membuang duplikat (paket SOS dikirim 3×).
- Satu Gateway saja: tabel `gateways` dan `vest_state` tetap, tapi layar kelola Gateway tidak perlu.
- **HTTPS POST tetap pilihan terbaik** (MQTT dan broker berlebihan untuk satu perangkat); MQTT hanya dipertimbangkan jika kelak perlu perintah dari dashboard ke Gateway.
- Halaman yang bisa ditunda ke setelah UTS: kelola pengguna, kelola banyak Vest, laporan PDF, replay jejak.

**Hanya tampilkan data yang benar-benar dikirim hardware:** jenis kejadian, posisi dan usianya, tegangan baterai Vest, status helm, RSSI/SNR, waktu. Jangan tampilkan baterai helm, jumlah satelit, arah, kecepatan (belum ada di hardware).

---

## 2. Sumber data dan kontrak (hardware ke dashboard)

### 2.1 Paket Vest ke Gateway (LoRa), saat ini
`PANDU,V1,<tipe>,<lat>,<lon>,<mV>,<helm>,<usia_posisi_s>`

| Field | Nilai | Arti |
|---|---|---|
| tipe | `HB` `SOS` `FALL` `MOB` (`OFF` direncanakan) | Heartbeat (30 s), SOS manual, jatuh, jatuh+basah |
| lat, lon | desimal atau `NOFIX` | Posisi terakhir yang diketahui |
| mV | integer | Tegangan baterai (ADC, ada noise) |
| helm | 1 / 0 / 2 | Dipakai-dekat / terdengar-jauh / tidak terdengar |
| usia | detik | Usia posisi (0 bila `NOFIX`) |

**Wajib ditambah di paket v2 (Firmware, B2 audit):** `vest_id` (1-8), `seq` (nomor urut, untuk membuang duplikat), `ts` bila ada.

### 2.2 Keluaran Gateway ke serial/cloud (satu baris JSON per paket)
```json
{"type":"MOB","lat":"-6.1021","lon":"106.8823","bat_mv":3890,"helm":1,"pos_age_s":4,"rssi":-97,"snr":6.5}
```
Peristiwa lain: `{"warning":"vest_lost"}`, `{"siren":"muted|timeout"}`, `{"boot":true,"lora":1,"sd":1}`, `{"ignored":"bad_packet","rssi":..}`.
Catatan: `lat`/`lon` berupa string dan bisa `"NOFIX"`; Gateway belum punya `vest_id`, `seq`, cap waktu NTP, WiFi, atau upload (pekerjaan firmware Gateway).

### 2.3 Kontrak ingest yang diusulkan (Gateway ke cloud, HTTPS POST)
```
POST /functions/v1/ingest      Header: x-device-key: <kunci gateway>
{
  "gateway_id": "GW1",
  "sent_at": "2026-10-17T03:21:05Z",      // NTP, UTC
  "events": [
    {"vest_id":3,"seq":412,"type":"HB","lat":-6.1021,"lon":106.8823,"pos_age_s":4,
     "bat_mv":3890,"helm":1,"rssi":-97,"snr":6.5,"received_at":"2026-10-17T03:21:04Z"}
  ]
}
→ 200 {"accepted":1,"duplicates":0}
```
Aturan: **idempoten** (unik `gateway_id+vest_id+seq`), mendukung batch (isi antrean microSD saat internet kembali), `received_at` dari Gateway (bukan waktu server). Zona waktu tampil WIB (UTC+7), simpan UTC.

---

## 3. Logika stage (satu sumber kebenaran, dijalankan di server)

| Stage | Aturan | Warna/ikon |
|---|---|---|
| **3 Danger** | Ada kejadian `SOS`, `FALL`, atau `MOB` yang belum selesai | Merah, ikon segitiga, alarm bunyi |
| **2 Warning** | (a) helm `0` atau `2` lebih dari ambang waktu, atau (b) tidak ada heartbeat > timeout (**"tidak terjangkau/inaktif"**), atau (c) baterai rendah | Kuning/oranye |
| **1 Aman** | Heartbeat terbaru normal, helm `1`, tidak ada alarm | Hijau |
| Nonaktif | Paket `OFF` diterima (Vest dimatikan sengaja) | Abu-abu, bukan warning |

Prioritas: Danger > Warning > Aman. Stage Vest ditampilkan sebagai warna + ikon + teks (jangan hanya warna, untuk aksesibilitas).

**Parameter default (bisa diubah di Pengaturan) [KONFIRMASI]:**
- Timeout heartbeat: 120 s (≈4× interval 30 s, memberi ruang untuk jitter dan satu paket hilang).
- Ambang helm tidak terdengar: 30 s (sama dengan firmware).
- Baterai rendah: < 3500 mV (kalibrasi dengan divider; angka ADC berisik, pakai rata-rata bergerak).
- **Alarm padam otomatis** saat kondisi kembali normal (definisi proyek): Danger selesai bila 2 heartbeat berturut-turut tanpa flag alarm; operator tetap bisa **mute** (diam suara) atau **dismiss** (tandai ditangani) kapan saja.
- SOS/FALL/MOB selalu membuat **insiden** yang tercatat (tidak hilang meski padam otomatis).

---

## 4. Tech stack yang diusulkan

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | **React + Vite + TypeScript**, Tailwind CSS, komponen shadcn/ui (Radix) | Cepat, responsif, aksesibel, mudah dibagi tugas |
| Peta | **Leaflet + OpenStreetMap**, overlay **OpenSeaMap** (tanda laut) | Gratis, tanpa kunci; Mapbox opsional bila perlu gaya lebih bagus |
| State/data | TanStack Query + langganan Supabase Realtime | Real-time dan cache sederhana |
| Backend | **Supabase** (Postgres, Auth, Row Level Security, Realtime, Edge Functions) | Cocok dengan laporan Pekan 7, cepat dibangun, real-time bawaan |
| Ingest | Edge Function `ingest` (HTTPS POST dari Gateway) | Gateway ESP32 cukup HTTPS; tanpa broker MQTT yang harus dikelola |
| Notifikasi | Web Audio (bunyi alarm), Web Notifications/Push (PWA), getUserMedia tidak perlu | Alarm di tab terbuka dan di perangkat mobile |
| PWA | Service worker, manifest, installable | Mobile/tablet terasa seperti aplikasi, cache offline tampilan |
| Grafik | Recharts (baterai, RSSI) | Ringan |
| Hosting | Vercel / Netlify / Cloudflare Pages (frontend), Supabase cloud (backend) | Gratis untuk skala ini |
| Uji | Vitest, Playwright (responsif 3 viewport), skrip **simulator** | Hardware belum siap, simulator wajib |
| Repo | `pandu-dashboard` (monorepo: `apps/web`, `supabase/`, `tools/simulator`, `docs/`) | Satu tempat, CI sederhana |

**Alternatif dan alasan tidak dipilih:** Firebase (Firestore real-time bagus, tapi query relasional/riwayat lebih rumit dan biaya sulit diprediksi); backend sendiri (FastAPI + Mosquitto + InfluxDB, sesuai proposal) — fleksibel tapi butuh server, TLS, dan perawatan; terlalu berat untuk 8 Vest dan waktu yang tersisa. **[KONFIRMASI]** Rafif: Supabase atau Firebase; dek proposal perlu diselaraskan.

**Target performa:** pembaruan di UI ≤ 2 detik dari POST Gateway; tampilan awal ≤ 3 detik di 4G; 8 Vest dan 1 gateway (skala kecil, tidak perlu optimasi berat).

---

## 5. Model data (Postgres)

| Tabel | Kolom penting | Fungsi |
|---|---|---|
| `gateways` | id, name, lat, lon, last_seen_at, status, sd_ok, wifi_ok | Status Gateway di dermaga |
| `vests` | id (1-8), name, assigned_to, helmet_label, active, mac | Daftar Vest dan pairing helm |
| `events` | id, gateway_id, vest_id, seq, type, lat, lon, pos_age_s, bat_mv, helm, rssi, snr, received_at, created_at; unik (gateway_id, vest_id, seq) | Semua paket (log mentah) |
| `vest_state` | vest_id, last_event_id, stage, status_text, lat, lon, pos_fix_at, bat_mv, helm, rssi, snr, last_seen_at, offline | Keadaan terbaru (cepat dibaca peta/daftar) |
| `incidents` | id, vest_id, kind (SOS/FALL/MOB), stage, opened_at, last_event_at, muted_at, acknowledged_by, acknowledged_at, resolved_at, resolved_by, resolution (auto/dismissed), notes | Siklus hidup alarm |
| `commands` | id, gateway_id, kind (mute_siren, ack_sos), payload, status, created_by, created_at | Perintah ke Gateway **[P2, perlu downlink]** |
| `profiles` | user_id, name, role (admin/operator/viewer) | Peran pengguna |
| `settings` | key, value | Ambang (timeout, baterai, helm) |
| `audit_log` | id, user_id, action, target, at | Siapa melakukan apa (mute/dismiss/ubah ambang) |
| `push_subscriptions` | user_id, endpoint, keys | Notifikasi push |

Keamanan: Row Level Security (viewer hanya baca; operator boleh ack/mute/dismiss; admin semua). Gateway memakai kunci perangkat terpisah (bukan kunci pengguna). Simpan koordinat pekerja secara terbatas (privasi, K3): retensi 90 hari **[KONFIRMASI]**.

---

## 6. Fitur lengkap

### 6.1 Pemantauan live
- **[P0] Ringkasan atas:** jumlah Vest per stage (Aman / Warning / Danger / Nonaktif), status Gateway (online, uplink terakhir), jam WIB.
- **[P0] Daftar/kartu Vest** (sampai 8): nama, warna+ikon stage, jenis kejadian aktif, "terakhir terdengar x detik lalu", baterai, status helm, RSSI/SNR, usia posisi.
- **[P0] Peta live:** penanda per Vest berwarna stage; penanda Gateway; klik penanda memunculkan kartu; tombol "fit semua"; garis jejak terbaru; lingkaran usia posisi (makin lama makin pudar); tidak ada posisi (`NOFIX`) ditandai jelas.
- **[P0] Alarm (Danger):** banner merah tetap + bunyi berulang hingga mute; kartu Vest naik ke atas; peta memfokus ke Vest itu.
- **[P1] Tidak terjangkau/inaktif:** penghitung waktu sejak terakhir terdengar; tampil sebagai Warning, bukan alarm suara.
- **[P1] Detail Vest (panel/laci):** linimasa kejadian, posisi terakhir (lat/lon, salin), grafik baterai dan RSSI 24 jam, paket mentah terakhir.

### 6.2 Penanganan alarm
- **[P0] Mute** (hentikan bunyi, insiden tetap terbuka), **Dismiss/Selesai** (tandai ditangani, wajib catatan singkat opsional).
- **[P0] Padam otomatis** saat normal, tetap tersimpan sebagai insiden.
- **[P1] Acknowledge** (operator "saya tangani") agar operator lain tahu.
- **[P1] Eskalasi visual:** alarm belum di-ack > 60 s menjadi lebih mencolok **[KONFIRMASI]**.
- **[P2] Perintah ke Gateway:** mute sirine fisik dan konfirmasi SOS diterima (perlu downlink/polling di firmware).

### 6.3 Riwayat dan laporan
- **[P0] Log kejadian:** tabel (waktu, Vest, jenis, stage, posisi, baterai, RSSI), filter (Vest, jenis, tanggal), pencarian, paginasi.
- **[P1] Ekspor CSV** log dan insiden.
- **[P1] Halaman insiden:** daftar insiden, durasi, siapa yang menangani.
- **[P2] Pemutaran ulang jejak** per Vest (slider waktu di peta); **[P2] laporan PDF** per insiden.

### 6.4 Administrasi
- **[P1] Kelola Vest:** tambah/ubah (nama pandu, nomor Vest, label helm), aktifkan/nonaktifkan.
- **[P1] Pengaturan:** timeout heartbeat, ambang helm/baterai, bunyi alarm, notifikasi, tema.
- **[P0] Login** (email) dan peran; **[P1] audit log**; **[P2] kelola pengguna**.
- **[P1] Kesehatan sistem:** Gateway online, SD ok, kualitas link LoRa, jumlah paket diabaikan (bad packet), uplink terakhir.

### 6.5 Umum
- **[P0] Responsif** (3 layout, bagian 7), mode gelap/terang, bahasa Indonesia (siap i18n).
- **[P1] PWA** terpasang di mobile/tablet, **Web Push** untuk Danger/Warning saat aplikasi tertutup.
- **[P1] Aksesibilitas:** kontras WCAG AA, tidak mengandalkan warna saja, target sentuh ≥ 44 px, navigasi keyboard.
- **[P1] Mode simulator/demo** (data palsu) agar bisa didemokan tanpa hardware.

---

## 7. Layout responsif

| Viewport | Layout |
|---|---|
| **Desktop ≥ 1280 px** | 3 panel: daftar Vest (kiri) · peta (tengah) · detail/insiden (kanan); bilah status global di atas; log ringkas bisa dibuka di bawah |
| **Tablet 768-1279 px** | 2 panel: peta penuh + panel samping yang bisa dilipat (daftar atau detail); alarm sebagai banner atas; sentuh-friendly |
| **Mobile < 768 px** | Satu kolom, **bottom navigation** (Peta · Daftar · Alarm · Log · Lainnya); peta layar penuh dengan **bottom sheet** untuk kartu Vest; Danger = layar penuh yang mengambil alih |

```
DESKTOP                                         MOBILE
+--------------------------------------------+  +----------------+
| PANDU  3 Aman 1 Warn 1 Danger  GW online   |  | PANDU  GW ●    |
+--------+----------------------+------------+  | [!] DANGER V3  |
| Vest 1 |                      | Detail V3  |  +----------------+
| Vest 2 |        PETA          | MOB 03:21  |  |                |
| Vest 3!|    (penanda stage)   | Baterai .. |  |     PETA       |
| ...    |                      | [Mute][OK] |  |                |
+--------+----------------------+------------+  +----------------+
| Log kejadian (ringkas)                     |  | ▔▔ kartu Vest ▔|
+--------------------------------------------+  | Peta Daftar !  |
                                                +----------------+
```

**Inventaris layar**

| Layar | Isi | P |
|---|---|---|
| Beranda/Pemantauan | Ringkasan + peta + daftar Vest | P0 |
| Detail Vest | Linimasa, posisi, grafik, paket mentah | P1 |
| Alarm aktif (modal/banner) | Vest, jenis, waktu, Mute/Dismiss | P0 |
| Log kejadian | Tabel dan filter | P0 |
| Insiden | Daftar dan detail penanganan | P1 |
| Kesehatan sistem | Gateway, link, SD | P1 |
| Kelola Vest | CRUD Vest | P1 |
| Pengaturan | Ambang, notifikasi, tema | P1 |
| Login | Autentikasi | P0 |

---

## 8. Input dan output

| Input | Dari | Diproses menjadi |
|---|---|---|
| Paket tipe HB/SOS/FALL/MOB/OFF (JSON batch) | Gateway lewat POST `/ingest` | Baris `events`, pembaruan `vest_state`, pembukaan/penutupan `incidents`, siaran real-time |
| Heartbeat berhenti | Server (cron tiap 15-30 s) | Vest ditandai "tidak terjangkau" (Warning) |
| Aksi pengguna: mute, dismiss, ack | UI | Perubahan `incidents`, `audit_log`, (P2) `commands` ke Gateway |
| Form: tambah/ubah Vest, pengaturan | UI (admin) | `vests`, `settings` |
| Filter/pencarian log | UI | Query `events`/`incidents` |

| Output | Ke | Bentuk |
|---|---|---|
| Kartu Vest + peta + banner | Layar | Warna + ikon + teks, real-time |
| Bunyi alarm, getar, push | Perangkat operator | Audio loop sampai mute, Web Push |
| Log/insiden | Pengguna | Tabel, CSV (P1), PDF (P2) |
| Perintah mute sirine, konfirmasi SOS | Gateway (P2) | Baris `commands` yang dibaca Gateway |
| Respons ingest | Gateway | `{"accepted":n,"duplicates":m}` (Gateway menghapus dari antrean SD) |

---

## 9. UX alarm (cegah alarm fatigue)

- Satu insiden per kejadian; paket SOS berulang (3×) digabung (sama `vest_id`+`seq`).
- Bunyi hanya untuk **Danger**; Warning cukup visual (+ push opsional).
- Danger memakai warna, ikon, dan teks "BAHAYA: MOB, Vest 3, 03:21 WIB" (jangan hanya merah).
- Bunyi berulang tiap 5 s sampai mute; mute tidak menutup insiden.
- Aturan peramban: audio hanya bisa diputar setelah interaksi pengguna, jadi tampilkan tombol "Aktifkan suara" saat membuka dashboard.

---

## 10. Non-fungsional

- **Latensi:** ≤ 2 s dari ingest ke UI; indikator koneksi (online/terputus) dan penanda "data usang" bila realtime putus.
- **Keandalan:** Gateway menyimpan antrean di microSD dan mengirim ulang; ingest idempoten.
- **Keamanan:** HTTPS, RLS, kunci perangkat per Gateway (bisa dirotasi), tidak ada rahasia di frontend, validasi skema di Edge Function, pembatasan laju.
- **Privasi:** posisi pekerja = data sensitif; akses berdasar peran; retensi terbatas; audit log.
- **Kompatibilitas:** Chrome/Edge/Safari/Firefox terbaru; iOS Safari (PWA push terbatas, uji).
- **Aksesibilitas dan bahasa:** WCAG AA; bahasa Indonesia, label campur Inggris dirapikan.

---

## 11. Pengujian dan simulator (wajib)

`tools/simulator` mengirim paket sesuai kontrak (bagian 2.3):
- Skenario: 8 Vest normal; satu helm lepas (Warning); satu Vest berhenti kirim (tidak terjangkau); SOS; FALL lalu MOB; Vest `OFF`; batch dari antrean SD; paket duplikat; `NOFIX`.
- Uji otomatis: logika stage (unit), aturan RLS, ingest idempoten, tampilan di 3 viewport (Playwright), alarm berbunyi dan bisa di-mute.
- Data uji harus sesuai format firmware nyata (lihat bagian 2.2).

---

## 12. Rencana pengerjaan

| Fase | Isi | Keluaran | Pemilik |
|---|---|---|---|
| 0 Kontrak | Sepakati skema paket v2, ingest, aturan stage, ambang | Dokumen kontrak + simulator awal | Calvin (firmware), Rafif |
| 1 MVP | Login, tampilan **satu Vest** (kartu besar + peta live), stage, alarm Danger + mute/dismiss, log; responsif 3 layout; data dari simulator (juga 8 Vest palsu untuk uji tampilan) | Demo UTS (17 Okt) | Rafif |
| 2 Lengkapi | Detail Vest, insiden, kesehatan sistem, kelola Vest, pengaturan, ekspor CSV, audit log | Dashboard fungsional | Rafif |
| 3 Integrasi | Hubungkan Gateway nyata (ingest), uji LoRa end-to-end, PWA + push, polesan UI | Uji lapangan | Calvin + Rafif |
| 4 Lanjutan | Replay jejak, laporan PDF, downlink (mute sirine, ack SOS), SOP-AI | Setelah UTS | Tim |

**Pembagian kerja firmware yang dibutuhkan dashboard (Calvin):** paket v2 (`vest_id`, `seq`), WiFi + NTP, ingest POST + antrean SD + batch, paket `OFF`, jitter heartbeat, (P2) polling `commands`.

---

## 13. Keputusan terbuka [KONFIRMASI]

1. Backend: Supabase (rekomendasi) atau Firebase.
2. Aturan padam otomatis Danger (2 heartbeat bersih? waktu tetap?) dan eskalasi alarm tak di-ack.
3. Timeout heartbeat (120 s) dan ambang baterai rendah.
4. Perlu downlink dari dashboard ke Gateway (mute sirine, konfirmasi SOS) di v1 atau nanti?
5. Peta: OpenStreetMap + OpenSeaMap atau Mapbox; area kerja (koordinat dermaga/Gateway).
6. Retensi data posisi, siapa yang boleh melihat.
7. Perlu notifikasi lewat kanal lain (Telegram/WhatsApp/email) selain push?
8. Satu Gateway atau lebih (model data sudah mendukung banyak).

---

## 14. Peta hardware ke UI (ringkas)

| Data hardware | Kolom DB | Tampil di UI |
|---|---|---|
| `type` HB/SOS/FALL/MOB/OFF | events.type, incidents.kind | Stage, banner, jenis kejadian |
| `lat`,`lon`,`pos_age_s` | events, vest_state | Penanda peta, usia posisi |
| `bat_mv` | events.bat_mv | Ikon baterai + angka (rata-rata bergerak) |
| `helm` 1/0/2 | events.helm | Chip "Helm: dipakai / jauh / tidak terdengar" |
| `rssi`,`snr` | events | Kualitas link, grafik RSSI |
| `vest_id`,`seq` (v2) | events | Nama Vest, dedup |
| Heartbeat berhenti | vest_state.offline | "Tidak terjangkau/inaktif" (Warning) |
