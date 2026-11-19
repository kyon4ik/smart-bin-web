export const POLL_MS = 20_000;
export const STALE_MS = 120_000;
export const HISTORY_LENGTH = 30;
export const STORAGE_KEY = 'smartbin.bins.v1';

export const labels = {
  normal: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
  unknown: 'No data'
};

export const defaults = {
  name: '',
  location: '',
  latitude: undefined,
  longitude: undefined,
  channel: '',
  readKey: '',
  fillField: 1,
  weightField: 4,
  latitudeField: null,
  longitudeField: null,
  fillWarning: 65,
  fillCritical: 80,
  weightWarning: 0.75,
  weightCritical: 1,
  capacity: 5
};

const demoBin = {
  ...defaults,
  id: 'bin-01',
  name: 'Bin 01',
  location: 'Central Almaty, Kazakhstan',
  latitude: 43.23895,
  longitude: 76.88971
};

export function loadBins() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // The starter bin still works when browser storage is unavailable.
  }
  return [demoBin];
}

export function sourceKey(bin) {
  return JSON.stringify([bin.channel, bin.readKey]);
}

export function metricStatus(value, warning, critical) {
  if (value === null) return 'unknown';
  if (value >= critical) return 'critical';
  return value >= warning ? 'warning' : 'normal';
}

export function binStatus(fill, weight) {
  if (fill === 'critical' || weight === 'critical') return 'critical';
  if (fill === 'warning' || weight === 'warning') return 'warning';
  if (fill === 'unknown' || weight === 'unknown') return 'unknown';
  return 'normal';
}

const demoFill = [
  29, 29, 33, 32, 38, 35, 41, 44, 44, 50, 48, 54, 55, 58, 56,
  62, 60, 59, 61, 64, 66, 64, 67, 66, 69, 67, 71, 69, 70, 72,
  75, 78, 81, 84, 87, 16, 20, 23, 27, 29
];
const demoStart = Math.floor(Date.now() / POLL_MS) * POLL_MS;

export function demoHistory(bin, now) {
  const tick = Math.max(0, Math.floor((now - demoStart) / POLL_MS));
  const phase = bin.id === demoBin.id ? 0 : bin.id.charCodeAt(0) % demoFill.length;
  return Array.from({ length: HISTORY_LENGTH }, (_, index) => {
    const point = tick + index;
    const sample = (point + phase) % demoFill.length;
    const fill = demoFill[sample];
    // The last four readings simulate a heavy load after the bin is emptied.
    const grams = sample >= 36 ? 1250 + (sample - 36) * 75 : Math.round(fill * 7.5);
    return {
      time: demoStart + (point - HISTORY_LENGTH + 1) * POLL_MS,
      fill,
      weight: grams / 1000
    };
  });
}
