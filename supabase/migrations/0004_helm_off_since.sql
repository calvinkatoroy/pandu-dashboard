-- Waktu helm terakhir terlihat tidak dipakai (helm <> 1); null bila sedang dipakai.
-- Dipakai ingest untuk aturan "helm tidak dipakai > helmet_threshold_s" (DATA_CONTRACT §4).
alter table vest_state add column if not exists helm_off_since timestamptz;
