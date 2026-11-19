import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binStatus, metricStatus } from '../src/lib/bins.js';
import { channelHistory, readChannel } from '../src/lib/telemetry.js';

test('maps the configured fields and converts grams without treating missing readings as zero', () => {
  const result = channelHistory({fillField: 2, weightField: 5}, [
    {created_at: '2026-11-19T10:00:20Z', field2: '0', field5: '1650'},
    {created_at: '2026-11-19T10:00:00Z', field2: ' ', field5: '-1'},
    {created_at: '2026-11-19T10:00:20Z', field3: '-33.1', field4: '42.1'},
    {created_at: 'invalid', field2: '30', field5: '200'},
    null
  ]);
  assert.deepEqual(result.map(({fill, weight}) => [fill, weight]), [[null, null], [0, 1.65]]);
});

test('a critical weight alone triggers pickup and thresholds are inclusive', () => {
  assert.equal(metricStatus(65, 65, 80), 'warning');
  assert.equal(metricStatus(80, 65, 80), 'critical');
  assert.equal(binStatus(metricStatus(15, 65, 80), metricStatus(1, 0.75, 1)), 'critical');
  assert.equal(binStatus('normal', 'unknown'), 'unknown');
});

test('fetches up to 30 samples and attaches a private read key only when provided', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({ok: true, json: async () => ({feeds: []})}));
  for (const token of ['', 'example-token']) {
    assert.deepEqual(await readChannel('1234', token, new AbortController().signal), []);
  }
  await readChannel('1234', '', new AbortController().signal, 8000);
  const [publicUrl, privateUrl, historicalUrl] = fetch.mock.calls.map(call => call.arguments[0]);
  assert.equal(publicUrl.pathname, '/channels/1234/feeds.json');
  assert.equal(publicUrl.searchParams.get('results'), '30');
  assert.equal(publicUrl.searchParams.has('api_key'), false);
  assert.equal(privateUrl.searchParams.get('api_key'), 'example-token');
  assert.equal(historicalUrl.searchParams.get('results'), '8000');
});
