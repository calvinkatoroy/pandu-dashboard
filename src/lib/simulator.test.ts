import { describe, it, expect } from 'vitest';
import { buildSimulatedPayload, buildVestState } from './simulator';

describe('Simulator payload and states (DATA_CONTRACT §1, §2, §3)', () => {
  it('builds SOS payload with correct event type', () => {
    const payload = buildSimulatedPayload('sos', 1);
    expect(payload.gateway_id).toBe('GW1');
    expect(payload.events.length).toBe(1);
    expect(payload.events[0].type).toBe('SOS');
    expect(payload.events[0].vest_id).toBe(1);
  });

  it('builds NOFIX payload with null coordinates', () => {
    const payload = buildSimulatedPayload('nofix', 2);
    expect(payload.events.length).toBe(1);
    expect(payload.events[0].lat).toBeNull();
    expect(payload.events[0].lon).toBeNull();
  });

  it('builds simulated state for danger events', () => {
    const sosState = buildVestState('sos', 1);
    expect(sosState.stage).toBe('danger');
    expect(sosState.status_text).toBe('SOS aktif');

    const mobState = buildVestState('fall_mob', 2);
    expect(mobState.stage).toBe('danger');
    expect(mobState.status_text).toBe('Man Overboard');
  });

  it('builds simulated state for warning events', () => {
    const helmState = buildVestState('helm_off', 3);
    expect(helmState.stage).toBe('warning');
    expect(helmState.helm).toBe(2);

    const lowBatState = buildVestState('lowbat', 4);
    expect(lowBatState.stage).toBe('warning');
    expect(lowBatState.bat_mv).toBe(3400);
  });
});
