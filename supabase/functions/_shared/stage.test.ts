import { describe, it, expect } from 'vitest';
import { validateEvent } from './stage.ts';

const ok = {
  vest_id: 1, seq: 1, type: 'HB', lat: -6.1, lon: 106.8, pos_age_s: 4,
  bat_mv: 3800, helm: 1, rssi: -90, snr: 6, received_at: '2026-10-17T03:21:04Z',
};

describe('validateEvent', () => {
  it('accepts a valid event and NOFIX position', () => {
    expect(validateEvent(ok)).toBeNull();
    expect(validateEvent({ ...ok, lat: null, lon: null })).toBeNull();
  });
  it('rejects non-objects and wrong types', () => {
    expect(validateEvent(null)).not.toBeNull();
    expect(validateEvent({ ...ok, vest_id: '1' })).not.toBeNull();
    expect(validateEvent({ ...ok, seq: 70000 })).not.toBeNull();
    expect(validateEvent({ ...ok, type: 'XX' })).not.toBeNull();
    expect(validateEvent({ ...ok, received_at: 'bukan tanggal' })).not.toBeNull();
    expect(validateEvent({ ...ok, bat_mv: 100 })).not.toBeNull();
    expect(validateEvent({ ...ok, rssi: 5 })).not.toBeNull();
  });
});
