import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STALE_MS } from '../src/lib/bins.js';
import { binPosition, gpsKey, latestGpsFix, loadGpsFixes, saveGpsFixes } from '../src/lib/positions.js';

const bin = {
  id: 'bin-01', channel: '1234', latitudeField: 3, longitudeField: 4,
  latitude: 43.23895, longitude: 76.88971
};

test('selects the newest valid GPS pair from one numbered-field entry', () => {
  const feeds = [
    { created_at: '2026-11-19T10:03:00Z', field3: '91', field4: '45' },
    { created_at: '2026-11-19T10:02:00Z', field3: '-34.0', field4: null },
    { created_at: '2026-11-19T10:01:00Z', field3: ' ', field4: '-70.1' },
    { created_at: '2026-11-19T09:00:00Z', field3: '0', field4: '0' },
    { created_at: '2026-11-19T10:00:00Z', field3: '-33.861', field4: '-71.209' },
    { created_at: 'invalid', field3: '1', field4: '2' }
  ];
  assert.deepEqual(latestGpsFix(bin, feeds), {
    latitude: -33.861, longitude: -71.209, time: Date.parse('2026-11-19T10:00:00Z')
  });
  assert.equal(latestGpsFix(bin, feeds.slice(0, 3)), null);
  assert.deepEqual(latestGpsFix(bin, [feeds[3]]), {
    latitude: 0, longitude: 0, time: Date.parse(feeds[3].created_at)
  });
});

test('a stale GPS fix takes precedence over saved coordinates and missing fixes use the saved position', () => {
  const fix = { latitude: -33.86, longitude: -71.209, time: 100 };
  assert.deepEqual(binPosition(bin, fix, fix.time + STALE_MS), { ...fix, source: 'gps', stale: true });
  assert.equal(binPosition(bin, fix, fix.time + STALE_MS - 1).stale, false);
  assert.deepEqual(binPosition(bin, null, 0), { latitude: 43.23895, longitude: 76.88971, source: 'saved' });
  assert.equal(binPosition({ ...bin, latitude: undefined, longitude: undefined }, null, 0), null);
  assert.equal(binPosition({ ...bin, latitudeField: null }, fix, 0).source, 'saved');
});

test('stores the last fix by bin, channel, and field mapping', (t) => {
  const storage = new Map();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });

  const valid = { latitude: -33.86, longitude: -71.21, time: 100 };
  saveGpsFixes({ [gpsKey(bin)]: valid, malformed: { ...valid, longitude: 181 } });
  const cached = loadGpsFixes();
  assert.deepEqual(cached, { [gpsKey(bin)]: valid });
  assert.equal(cached[gpsKey({ ...bin, channel: '3210' })], undefined);
  assert.equal(cached[gpsKey({ ...bin, longitudeField: 5 })], undefined);
});
