# Kontrak data PANDU (hardware ke dashboard)

Satu sumber kebenaran untuk format data antara Vest, Gateway, dan dashboard. Firmware (repo `pandu-capstone`), simulator, dan backend dashboard harus mengikuti dokumen ini. Setiap perubahan format dicatat di bagian "Riwayat versi".

Status per 12 Okt 2026: **v1 = format yang dikeluarkan firmware sekarang. v2 = usulan, belum diimplementasikan di firmware.** Scope prototipe: 1 Helmet, 1 Vest, 1 Gateway (kontrak tetap mendukung sampai 8 Vest).

---

## 1. Paket Vest ke Gateway (LoRa)

### 1.1 v1 (firmware sekarang)
Teks, dipisah koma, satu paket per pesan LoRa:

```
PANDU,V1,<tipe>,<lat>,<lon>,<mV>,<helm>,<usia_s>
PANDU,V1,HB,-6.1021,106.8823,3890,1,4
PANDU,V1,SOS,NOFIX,NOFIX,3890,2,0
```

| Field | Tipe | Nilai | Arti |
|---|---|---|---|
| `PANDU` | konstanta | - | Penanda paket |
| `V1` | konstanta | - | Versi format |
| `tipe` | enum | `HB`, `SOS`, `FALL`, `MOB` | Heartbeat (30 s), SOS manual (tahan 2 detik, dikirim 3× tiap 5 s), jatuh, jatuh lalu basah dalam 60 s |
| `lat`, `lon` | desimal atau `NOFIX` | derajat | Posisi terakhir yang diketahui; `NOFIX` bila belum pernah fix |
| `mV` | integer | ±3000-4300 | Tegangan baterai dari ADC (berisik; pakai rata-rata bergerak) |
| `helm` | integer | `1` dekat/dipakai, `0` terdengar tapi jauh, `2` tidak terdengar | Status helm dari RSSI BLE (batas 30 s) |
| `usia_s` | integer | detik | Usia posisi; `0` bila `NOFIX` |

Keterbatasan v1: tidak ada ID Vest, tidak ada nomor urut (`seq`), tidak bisa membuang duplikat SOS, tidak ada tipe `OFF`.

### 1.2 v2 (usulan, wajib sebelum uji end-to-end)
```
PANDU,V2,<vest_id>,<seq>,<tipe>,<lat>,<lon>,<mV>,<helm>,<usia_s>
PANDU,V2,1,412,HB,-6.1021,106.8823,3890,1,4
```

| Tambahan | Nilai | Fungsi |
|---|---|---|
| `vest_id` | 1-8 (prototipe: selalu 1) | Pembeda Vest |
| `seq` | 0-65535, naik 1 tiap kejadian baru; **paket ulang SOS memakai `seq` yang sama** | Membuang duplikat |
| `tipe` ditambah `OFF` | - | Vest dimatikan sengaja (bukan "tidak terjangkau") |

Direncanakan: heartbeat dengan jitter acak (mis. 30 s ± 5 s), format biner ringkas (bila waktu udara LoRa perlu dipangkas).

---

## 2. Keluaran Gateway (serial dan upload)

### 2.1 Serial JSON (firmware sekarang), satu baris per kejadian
```json
{"type":"MOB","lat":"-6.1021","lon":"106.8823","bat_mv":3890,"helm":1,"pos_age_s":4,"rssi":-97,"snr":6.5}
```

| Field | Tipe | Catatan |
|---|---|---|
| `type` | string | `HB`/`SOS`/`FALL`/`MOB` |
| `lat`, `lon` | **string** | Bisa `"NOFIX"` (bukan angka) |
| `bat_mv` | int | mV |
| `helm` | int | 1/0/2 |
| `pos_age_s` | int | Detik |
| `rssi` | int | dBm (RSSI paket LoRa di Gateway) |
| `snr` | float | dB |

Kejadian lain di serial: `{"warning":"vest_lost"}`, `{"siren":"muted"}`, `{"siren":"timeout"}`, `{"boot":true,"lora":1,"sd":1}`, `{"ignored":"bad_packet","rssi":-110}`.
Log SD (`/pandu.csv`): `ms,type,lat,lon,bat_mv,helm,pos_age_s,rssi,snr` (waktu masih `millis()`, perlu cap waktu NTP).

### 2.2 Yang harus ditambah di firmware Gateway
`vest_id` dan `seq` (dari paket v2), cap waktu NTP (UTC), WiFi, upload ke ingest, antrean microSD (store-and-forward), paket `OFF`.

---

## 3. API ingest (Gateway ke backend)

Pilihan: **HTTPS POST** ke Edge Function Supabase (tanpa broker MQTT). MQTT hanya bila kelak butuh perintah dari dashboard ke Gateway.

```
POST /functions/v1/ingest
Header: Content-Type: application/json
        x-device-key: <kunci per Gateway>
```

Body:
```json
{
  "gateway_id": "GW1",
  "sent_at": "2026-10-17T03:21:05Z",
  "events": [
    {
      "vest_id": 1, "seq": 412, "type": "HB",
      "lat": -6.1021, "lon": 106.8823, "pos_age_s": 4,
      "bat_mv": 3890, "helm": 1, "rssi": -97, "snr": 6.5,
      "received_at": "2026-10-17T03:21:04Z"
    }
  ]
}
```

Aturan:
- `lat`/`lon` dikirim sebagai angka, atau `null` bila `NOFIX` (Gateway mengubah string `"NOFIX"` menjadi `null`).
- `received_at` diisi Gateway (UTC, NTP), bukan waktu server. Simpan UTC; tampilkan WIB (UTC+7).
- **Idempoten:** unik pada (`gateway_id`, `vest_id`, `seq`); paket ulang diabaikan (dihitung `duplicates`).
- Mendukung **batch** (isi antrean microSD saat internet kembali), urut dari terlama.
- Batas: ≤ 100 event per request.

Respons:
```json
{"accepted": 1, "duplicates": 0, "rejected": []}
```
Kode: `200` sukses (Gateway menghapus event dari antrean SD), `401` kunci salah, `422` validasi gagal atau `gateway_id` tidak terdaftar (`rejected` berisi indeks dan alasan per event), `429` terlalu sering (maks 30 request/menit per gateway), `5xx` coba lagi (backoff).

Validasi: `type` ∈ {HB,SOS,FALL,MOB,OFF}; `vest_id` 1-8; `helm` ∈ {0,1,2}; `bat_mv` 2500-4500; `lat` -90..90, `lon` -180..180; `rssi` -140..0.

---

## 4. Aturan stage (dijalankan di server)

| Stage | Aturan | Catatan |
|---|---|---|
| 3 Danger | Ada insiden `SOS`/`FALL`/`MOB` terbuka | Alarm suara |
| 2 Warning | helm ≠ 1 terus-menerus ≥ `helmet_threshold_s` (30 s; dihitung dari `vest_state.helm_off_since`), atau tidak ada heartbeat > **120 s** (tidak terjangkau/inaktif), atau `bat_mv` < 3500 | Visual saja |
| 1 Aman | Heartbeat normal, helm = 1, tidak ada insiden | - |
| Nonaktif | Paket `OFF` | Bukan warning |

Prioritas Danger > Warning > Aman. Danger padam otomatis bila 2 heartbeat berturut-turut tanpa flag alarm; operator dapat **mute** (diam suara) atau **dismiss** (tandai ditangani). Semua parameter (120 s, 30 s, 3500 mV, 2 heartbeat) default dan dapat diubah di Pengaturan. [BELUM DISEPAKATI TIM]

---

## 5. Contoh uji (untuk simulator dan unit test)

| Skenario | Event | Hasil yang diharapkan |
|---|---|---|
| Normal | HB tiap 30 s, helm 1 | Stage 1 |
| Helm lepas | HB dengan helm 2 selama >30 s | Stage 2 |
| Tidak terjangkau | Tidak ada paket 120 s | Stage 2, "tidak terjangkau" |
| SOS | 3 paket SOS `seq` sama | **1 insiden**, Stage 3 |
| FALL lalu MOB | FALL (`seq`=n), lalu MOB (`seq`=n+1) dalam 60 s | Insiden naik dari FALL ke MOB, Stage 3 |
| Tanpa posisi | SOS dengan `lat:null` | Stage 3, peta tanpa penanda + tulisan "posisi belum tersedia" |
| Padam otomatis | Danger lalu 2 HB bersih | Insiden selesai (auto), tetap tersimpan |
| Duplikat | Event sama dikirim dua kali | `duplicates: 1` |
| Batch lama | 20 event dari SD, urut terlama | Semua diterima, urutan terjaga |
| Dimatikan | `OFF` | Nonaktif, bukan warning |

---

## 6. Riwayat versi

| Tanggal | Versi | Perubahan |
|---|---|---|
| 12 Okt 2026 | Draf | Dokumen dibuat dari firmware v1 dan usulan v2 |
| 13 Okt 2026 | Draf | Ingest: validasi per event, event lama tidak menimpa state, aturan helm 30 s di server (migrasi 0004), 429, gateway tak dikenal 422. Logika stage di `supabase/functions/_shared/stage.ts` (dipakai server dan client). |
