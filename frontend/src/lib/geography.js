export const MAX_LATITUDE = 85.05112878;
export const TILE_SIZE = 256;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 19;
export const CITY_ZOOM = 14;
export const ALMATY = { latitude: 43.23895, longitude: 76.88971 };

export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function wrap(value, period) {
  return ((value % period) + period) % period;
}

export function project({ latitude, longitude }) {
  const radians = clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI / 180;
  return { x: wrap((longitude + 180) / 360, 1), y: clamp((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2, 0, 1) };
}

export function unproject({ x, y }) {
  return {
    latitude: clamp(Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI, -MAX_LATITUDE, MAX_LATITUDE),
    longitude: wrap(x, 1) * 360 - 180
  };
}

export function pixelsAt(zoom) {
  return TILE_SIZE * 2 ** zoom;
}

export function relativeX(x, center) {
  return wrap(x - center + 0.5, 1) - 0.5;
}

export function fitLocations(locations, width, height) {
  if (locations.length < 2) return { center: project(locations[0] ?? ALMATY), zoom: CITY_ZOOM };

  const points = locations.map(project);
  const xs = points.map(p => p.x).sort((a, b) => a - b);
  // Cut the world at the largest empty longitude gap so bins spanning 180° stay together.
  let gapIndex = xs.length - 1;
  let largestGap = xs[0] + 1 - xs.at(-1);
  for (let i = 0; i < xs.length - 1; i += 1) {
    const gap = xs[i + 1] - xs[i];
    if (gap > largestGap) {
      largestGap = gap;
      gapIndex = i;
    }
  }
  const west = xs[(gapIndex + 1) % xs.length];
  const north = Math.min(...points.map(p => p.y));
  const south = Math.max(...points.map(p => p.y));
  const spanX = 1 - largestGap;
  const scaleX = Math.max(1, width - 100) / spanX;
  const scaleY = Math.max(1, height - 100) / (south - north);
  const zoom = clamp(Math.floor(Math.log2(Math.min(scaleX, scaleY) / TILE_SIZE)), MIN_ZOOM, CITY_ZOOM);
  return { center: { x: wrap(west + spanX / 2, 1), y: (north + south) / 2 }, zoom };
}

export function visibleTiles(zoom, originX, originY, width, height) {
  if (!width || !height) return [];
  const count = 2 ** zoom;
  const firstX = Math.floor(originX / TILE_SIZE);
  const firstY = Math.max(0, Math.floor(originY / TILE_SIZE));
  const lastX = Math.ceil((originX + width) / TILE_SIZE);
  const lastY = Math.min(count, Math.ceil((originY + height) / TILE_SIZE));
  const tiles = [];
  for (let y = firstY; y < lastY; y += 1) {
    for (let x = firstX; x < lastX; x += 1) {
      tiles.push({ id: `${zoom}/${x}/${y}`, z: zoom, x: wrap(x, count), y, left: x * TILE_SIZE - originX, top: y * TILE_SIZE - originY });
    }
  }
  return tiles;
}

export function osmLink({ latitude, longitude }) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
}

export function directionsLink({ latitude, longitude }) {
  const destination = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

export function coordinates({ latitude, longitude }) {
  const lat = Math.abs(latitude).toFixed(6);
  const lon = Math.abs(longitude).toFixed(6);
  return `${lat}° ${latitude < 0 ? 'S' : 'N'}, ${lon}° ${longitude < 0 ? 'W' : 'E'}`;
}
