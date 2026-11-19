import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALMATY, directionsLink, fitLocations, pixelsAt, project, relativeX, unproject, visibleTiles } from '../src/lib/geography.js';

test('Almaty projects into its XYZ tile and round-trips at sub-meter precision', () => {
  const projected = project(ALMATY);
  assert.equal(Math.floor(projected.x * 2 ** 14), 11691);
  assert.equal(Math.floor(projected.y * 2 ** 14), 6005);
  const restored = unproject(projected);
  assert.ok(Math.abs(restored.latitude - ALMATY.latitude) < 1e-8);
  assert.ok(Math.abs(restored.longitude - ALMATY.longitude) < 1e-8);
});

test('fit keeps locations on opposite sides of the antimeridian near each other', () => {
  const points = [{latitude: -18, longitude: 179.9}, {latitude: -18, longitude: -179.9}];
  const { center, zoom } = fitLocations(points, 600, 300);
  assert.ok(zoom > 8);
  assert.ok(Math.abs(unproject(center).longitude) > 179);
  for (const point of points) assert.ok(Math.abs(relativeX(project(point).x, center.x) * pixelsAt(zoom)) < 250);
});

test('XYZ URLs wrap horizontally and avoid invalid polar rows', () => {
  const tiles = visibleTiles(2, -100, -60, 360, 300);
  assert.deepEqual(tiles.map(({x, y}) => [x, y]), [[3, 0], [0, 0], [1, 0]]);
  assert.equal(new URL(directionsLink(ALMATY)).searchParams.get('destination'), '43.23895,76.88971');
});
