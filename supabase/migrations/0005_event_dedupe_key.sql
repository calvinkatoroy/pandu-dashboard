-- seq dari Vest hanya 16-bit (0-65535) dan mulai acak saat cold boot, jadi nilainya BERULANG (heartbeat 30 s: sekitar tiap 22 jam).
-- Kunci unik (gateway_id, vest_id, seq) akan membuang event baru yang kebetulan memakai seq lama.
-- Kunci baru menambah received_at: retry Gateway (event sama, waktu sama) tetap duplikat; seq yang berulang di waktu lain diterima.
-- Paket ulang radio (SOS 3x, seq sama, waktu beda) dibuang oleh Gateway sebelum diunggah (jendela 60 s).
alter table events drop constraint if exists events_gateway_id_vest_id_seq_key;
alter table events add constraint events_dedupe_key unique (gateway_id, vest_id, seq, received_at);
