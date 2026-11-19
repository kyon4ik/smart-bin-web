import { STALE_MS } from './bins.js';
import { parseNumber } from './telemetry.js';

const STORAGE_KEY = 'smartbin.gps-fixes.v1';
export const GPS_HISTORY_LENGTH = 8000;

function validCoordinates({ latitude, longitude }) {
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export function tracksGps(bin) {
  return Boolean(bin.channel) && [bin.latitudeField, bin.longitudeField]
    .every(field => Number.isInteger(field) && field >= 1 && field <= 8)
    && bin.latitudeField !== bin.longitudeField;
}

export function gpsKey(bin) {
  return JSON.stringify([bin.id, bin.channel, bin.latitudeField, bin.longitudeField]);
}

export function latestGpsFix(bin, entries) {
  if (!tracksGps(bin)) return null;

  let latest = null;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const time = Date.parse(entry.created_at);
    const latitude = parseNumber(entry[`field${bin.latitudeField}`], -90, 90);
    const longitude = parseNumber(entry[`field${bin.longitudeField}`], -180, 180);
    if (Number.isFinite(time) && latitude !== null && longitude !== null && (!latest || time >= latest.time)) {
      latest = { latitude, longitude, time };
    }
  }
  return latest;
}

export function binPosition(bin, fix, now) {
  if (tracksGps(bin) && fix) {
    return { ...fix, source: 'gps', stale: now - fix.time >= STALE_MS };
  }
  return validCoordinates(bin)
    ? { latitude: bin.latitude, longitude: bin.longitude, source: 'saved' }
    : null;
}

export function loadGpsFixes() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Object.fromEntries(Object.entries(raw ?? {}).filter(([, fix]) =>
      fix && validCoordinates(fix) && Number.isFinite(fix.time) && Math.abs(fix.time) <= 8.64e15));
  } catch {
    return {};
  }
}

export function saveGpsFixes(fixes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixes));
  } catch {
    // The current dashboard can still display the in-memory fix.
  }
}
