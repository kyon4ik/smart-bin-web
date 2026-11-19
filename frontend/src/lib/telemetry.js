import { HISTORY_LENGTH } from './bins.js';

export async function readChannel(channel, readKey, signal, results = HISTORY_LENGTH) {
  const url = new URL(`https://api.thingspeak.com/channels/${channel}/feeds.json`);
  url.searchParams.set('results', results);
  if (readKey) url.searchParams.set('api_key', readKey);
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)])
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new Error('Check the channel ID and Read API key.');
  }
  if (!response.ok) throw new Error('ThingSpeak is temporarily unavailable.');

  const data = await response.json();
  if (!Array.isArray(data?.feeds)) throw new Error('ThingSpeak returned an invalid feed.');
  return data.feeds;
}

export function parseNumber(value, min = 0, max = Infinity) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function channelHistory(bin, feeds) {
  const readings = feeds.filter(entry => entry && typeof entry === 'object').map(entry => {
    const grams = parseNumber(entry[`field${bin.weightField}`]);
    return {
      time: Date.parse(entry.created_at),
      fill: parseNumber(entry[`field${bin.fillField}`], 0, 100),
      weight: grams === null ? null : grams / 1000
    };
  }).filter(reading => Number.isFinite(reading.time));
  const byTime = new Map();
  for (const { time, fill, weight } of readings) {
    const previous = byTime.get(time);
    byTime.set(time, { time, fill: fill ?? previous?.fill ?? null, weight: weight ?? previous?.weight ?? null });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
