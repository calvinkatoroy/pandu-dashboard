import { describe, it, expect } from 'vitest';
import {
  computeStage,
  batPercent,
  batColor,
  helmLabel,
  rssiBars,
  rssiLabel,
} from './stage';

const DEFAULT_SETTINGS = {
  heartbeat_timeout_s: 120,
  helmet_threshold_s: 30,
  battery_low_mv: 3500,
};

describe('Stage Logic (DATA_CONTRACT §4 & PLAN §3)', () => {
  it('prioritizes danger over warning and safe', () => {
    const stage = computeStage({
      type: 'SOS',
      helm: 1,
      bat_mv: 3800,
      lastSeenSecondsAgo: 10,
      hasOpenDanger: true,
      settings: DEFAULT_SETTINGS,
    });
    expect(stage).toBe('danger');
  });

  it('marks inactive when packet type is OFF', () => {
    const stage = computeStage({
      type: 'OFF',
      helm: 1,
      bat_mv: 3800,
      lastSeenSecondsAgo: 10,
      hasOpenDanger: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(stage).toBe('inactive');
  });

  it('marks warning when heartbeat exceeds timeout (tidak terjangkau)', () => {
    const stage = computeStage({
      type: 'HB',
      helm: 1,
      bat_mv: 3800,
      lastSeenSecondsAgo: 130, // > 120s
      hasOpenDanger: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(stage).toBe('warning');
  });

  it('helmet off is only a warning after helmet_threshold_s', () => {
    const base = { type: 'HB', helm: 2, bat_mv: 3800, lastSeenSecondsAgo: 20, hasOpenDanger: false, settings: DEFAULT_SETTINGS };
    expect(computeStage({ ...base, helmOffSeconds: 10 })).toBe('safe');
    expect(computeStage({ ...base, helmOffSeconds: 30 })).toBe('warning');
  });

  it('marks warning when helmet is off (helm = 2)', () => {
    const stage = computeStage({
      type: 'HB',
      helm: 2,
      helmOffSeconds: 31,
      bat_mv: 3800,
      lastSeenSecondsAgo: 20,
      hasOpenDanger: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(stage).toBe('warning');
  });

  it('marks warning when battery is below threshold', () => {
    const stage = computeStage({
      type: 'HB',
      helm: 1,
      bat_mv: 3400, // < 3500 mV
      lastSeenSecondsAgo: 20,
      hasOpenDanger: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(stage).toBe('warning');
  });

  it('marks safe when conditions are normal', () => {
    const stage = computeStage({
      type: 'HB',
      helm: 1,
      bat_mv: 3850,
      lastSeenSecondsAgo: 15,
      hasOpenDanger: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(stage).toBe('safe');
  });
});

describe('Telemetry helpers', () => {
  it('converts battery mV to percentage (3000-4300mV)', () => {
    expect(batPercent(3000)).toBe(0);
    expect(batPercent(4300)).toBe(100);
    expect(batPercent(3650)).toBe(50);
    expect(batPercent(2800)).toBe(0); // clamped min
    expect(batPercent(4500)).toBe(100); // clamped max
    expect(batPercent(null)).toBe(0);
  });

  it('determines battery color according to threshold', () => {
    expect(batColor(3400, 3500)).toBe('#e8542b'); // alert red
    expect(batColor(3600, 3500)).toBe('#e0a83e'); // caution yellow
    expect(batColor(3800, 3500)).toBe('#1fa37a'); // safe green
    expect(batColor(null, 3500)).toBe('#6b7c8d'); // unknown
  });

  it('maps helmet state labels', () => {
    expect(helmLabel(1)).toBe('Dipakai');
    expect(helmLabel(0)).toBe('Jauh');
    expect(helmLabel(2)).toBe('Tidak terdengar');
    expect(helmLabel(null)).toBe('—');
  });

  it('calculates LoRa signal strength bars and labels', () => {
    expect(rssiBars(-65)).toBe(5);
    expect(rssiBars(-75)).toBe(4);
    expect(rssiBars(-85)).toBe(3);
    expect(rssiBars(-95)).toBe(2);
    expect(rssiBars(-105)).toBe(1);
    expect(rssiBars(-115)).toBe(0);
    expect(rssiBars(null)).toBe(0);

    expect(rssiLabel(-80)).toBe('-80 dBm');
    expect(rssiLabel(null)).toBe('no link');
  });
});
