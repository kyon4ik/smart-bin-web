<script>
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import Icon from './Icon.svelte';
  import { labels } from '../bins.js';
  import {
    ALMATY, CITY_ZOOM, MAX_LATITUDE, MAX_ZOOM, MIN_ZOOM, clamp, fitLocations, pixelsAt, project,
    relativeX, unproject, visibleTiles, wrap
  } from '../geography.js';

  let { points = [], selectedId, onSelect, onPick, initialLocation = ALMATY } = $props();
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  let center = $state(untrack(() => project(initialLocation)));
  let zoom = $state(CITY_ZOOM);
  let width = $state(0);
  let height = $state(0);
  let dragging = $state(false);
  const failedTiles = new SvelteSet();
  let pointer;
  let previousSelection;

  let world = $derived(pixelsAt(zoom));
  let originX = $derived(Math.round(center.x * world - width / 2));
  let originY = $derived(Math.round(center.y * world - height / 2));
  let tiles = $derived(visibleTiles(zoom, originX, originY, width, height));
  let allTilesFailed = $derived(tiles.length > 0 && tiles.every(tile => failedTiles.has(tile.id)));
  let markers = $derived(points.map(point => {
    const position = project(point);
    const nearestX = center.x + relativeX(position.x, center.x);
    return { point, left: nearestX * world - originX, top: position.y * world - originY };
  }).filter(marker => marker.left >= 0 && marker.left <= width && marker.top >= 0 && marker.top <= height));
  let selectedPoint = $derived(points.find(point => point.id === selectedId));
  let metersPerPixel = $derived(Math.cos(unproject(center).latitude * Math.PI / 180) * 40_075_016.686 / world);
  let scaleMeters = $derived([1000e3, 500e3, 200e3, 100e3, 50e3, 20e3, 10e3, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5]
    .find(distance => distance / metersPerPixel <= 86));

  // Follow a selected pin when it moves out of view while leaving manual panning independent.
  $effect(() => {
    const point = selectedPoint;
    untrack(() => {
      const previous = previousSelection;
      if (point && !insideViewport(point) && (!previous || (previous.id === point.id && insideViewport(previous)))) {
        focusLocation(point);
      }
      previousSelection = point;
    });
  });

  function insideViewport(location) {
    const point = project(location);
    return Math.abs(relativeX(point.x, center.x) * world) <= width / 2
      && Math.abs((point.y - center.y) * world) <= height / 2;
  }

  export function focusLocation(location) {
    center = project(location);
    zoom = Math.max(zoom, CITY_ZOOM);
  }

  export function fitBins() {
    ({ center, zoom } = fitLocations(points, width, height));
  }

  function pan(dx, dy) {
    center = { x: wrap(center.x + dx / world, 1), y: clamp(center.y + dy / world, 0, 1) };
  }

  function zoomBy(amount) {
    zoom = clamp(zoom + amount, MIN_ZOOM, MAX_ZOOM);
  }

  function chooseLocation(x, y) {
    const location = unproject({ x: (originX + x) / world, y: clamp((originY + y) / world, 0, 1) });
    onPick({
      latitude: clamp(Number(location.latitude.toFixed(6)), -MAX_LATITUDE, MAX_LATITUDE),
      longitude: Number(location.longitude.toFixed(6))
    });
  }

  function keydown(event) {
    if (event.target !== event.currentTarget) return;
    const actions = {
      ArrowLeft: () => pan(-60, 0),
      ArrowRight: () => pan(60, 0),
      ArrowUp: () => pan(0, -60),
      ArrowDown: () => pan(0, 60),
      '+': () => zoomBy(1),
      '=': () => zoomBy(1),
      '-': () => zoomBy(-1)
    };
    if (onPick) actions.Enter = () => chooseLocation(width / 2, height / 2);
    if (!Object.hasOwn(actions, event.key)) return;
    event.preventDefault();
    actions[event.key]();
  }

  function pointerdown(event) {
    if (event.button !== 0 || !event.isPrimary || event.target.closest('button, a')) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, start: center, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointermove(event) {
    if (pointer?.id !== event.pointerId) return;
    const dx = pointer.x - event.clientX;
    const dy = pointer.y - event.clientY;
    if (!pointer.moved && Math.hypot(dx, dy) < 5) return;
    pointer.moved = true;
    dragging = true;
    center = { x: wrap(pointer.start.x + dx / world, 1), y: clamp(pointer.start.y + dy / world, 0, 1) };
  }

  function finishPointer(event) {
    if (pointer?.id !== event.pointerId) return;
    if (event.type === 'pointerup' && onPick && !pointer.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      chooseLocation(event.clientX - rect.left, event.clientY - rect.top);
    }
    pointer = undefined;
    dragging = false;
  }

  function tileSource(tile) {
    return tileUrl.replace('{z}', tile.z).replace('{x}', tile.x).replace('{y}', tile.y);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (The focusable viewport supports keyboard and pointer map navigation.) -->
<div class={['map', { dragging, picking: Boolean(onPick) }]}
  bind:clientWidth={width} bind:clientHeight={height}
  role="region" aria-label={onPick ? 'Location picker. Use arrow keys to pan, plus and minus to zoom, and Enter to place the pin.' : 'Bin map. Use arrow keys to pan, and plus and minus to zoom.'}
  tabindex="0" onkeydown={keydown} onpointerdown={pointerdown} onpointermove={pointermove}
  onpointerup={finishPointer} onpointercancel={finishPointer} onlostpointercapture={finishPointer}>
  <div class="tiles" aria-hidden="true">
    {#each tiles as tile (tile.id)}
      <img class={{ unavailable: failedTiles.has(tile.id) }} alt="" width="256" height="256"
        draggable="false" src={tileSource(tile)} style:left={`${tile.left}px`}
        style:top={`${tile.top}px`} onload={() => failedTiles.delete(tile.id)} onerror={() => failedTiles.add(tile.id)}
        {@attach () => () => failedTiles.delete(tile.id)} />
    {/each}
  </div>

  {#each markers as { point, left, top } (point.id)}
    <div class="marker-anchor" style:left={`${left}px`} style:top={`${top}px`}>
      {#if onSelect}
        <button class={['marker', { selected: point.id === selectedId }]} data-state={point.status}
          type="button" aria-label={`${point.name} · ${labels[point.status]}${point.stale ? ' · GPS stale' : ''}`} aria-pressed={point.id === selectedId} onclick={() => onSelect(point.id)}>
          <Icon name="bins" size={17} />
          {#if point.stale}<span class="marker-stale" aria-hidden="true"><Icon name="clock" size={12} /></span>{/if}
        </button>
        {#if point.id === selectedId}<span class="marker-name" aria-hidden="true">{point.name}</span>{/if}
      {:else}
        <span class="marker selected draft-marker" aria-hidden="true"><Icon name="pin" size={17} /></span>
      {/if}
    </div>
  {/each}

  <div class="map-tools">
    <div class="zoom-tools">
      <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom === MAX_ZOOM} onclick={() => zoomBy(1)}><Icon name="plus" size={17} /></button>
      <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom === MIN_ZOOM} onclick={() => zoomBy(-1)}><Icon name="minus" size={17} /></button>
    </div>
    {#if selectedPoint}
      <button type="button" aria-label="Center on selected bin" title="Center on selected bin"
        onclick={() => focusLocation(selectedPoint)}><Icon name="crosshair" size={17} /></button>
    {/if}
    {#if points.length}
      <button type="button" aria-label={onPick ? 'Center on pin' : 'Fit all bins'} title={onPick ? 'Center on pin' : 'Fit all bins'}
        onclick={() => onPick ? focusLocation(points[0]) : fitBins()}><Icon name={onPick ? 'crosshair' : 'expand'} size={17} /></button>
    {/if}
  </div>

  {#if allTilesFailed}<span class="map-notice" role="status">Basemap unavailable</span>{/if}
  {#if scaleMeters}
    <div class="scale" aria-hidden="true" style:width={`${scaleMeters / metersPerPixel}px`}>
      {scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${scaleMeters} m`}
    </div>
  {/if}
  <div class="attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
</div>

<style>
  .map { position: relative; isolation: isolate; width: 100%; height: 100%; overflow: hidden; cursor: grab; touch-action: none;
    background-color: var(--accent-soft); background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 26px 26px; }
  .map:focus-visible { outline-offset: -3px; }
  .picking { cursor: crosshair; }
  .picking:focus-visible::after { content: '+'; position: absolute; top: 50%; left: 50%; z-index: 2; transform: translate(-50%, -50%);
    color: var(--accent-ink); text-shadow: 0 0 3px white; font-size: 1.35rem; font-weight: 800; pointer-events: none; }
  .dragging { cursor: grabbing; }
  .tiles { position: absolute; inset: 0; filter: saturate(.67) contrast(.94) brightness(1.035); pointer-events: none; }
  .tiles img { position: absolute; max-width: none; display: block; user-select: none; }
  .tiles .unavailable { visibility: hidden; }
  .marker-anchor { position: absolute; z-index: 1; }
  .marker-anchor:has(.selected) { z-index: 2; }
  .marker { --marker-bg: #397c64; position: absolute; left: 0; bottom: 0; width: 38px; height: 38px; display: grid; place-items: center;
    transform: translate(-50%, -7px); color: white; border: 2px solid white; background: var(--marker-bg); border-radius: 11px;
    box-shadow: 0 3px 12px #17332b45; }
  .marker::after { content: ''; position: absolute; bottom: -6px; left: calc(50% - 5px); background: var(--marker-bg); width: 10px;
    height: 10px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); box-sizing: border-box; }
  .draft-marker { --marker-bg: var(--accent); }
  .marker[data-state='warning'] { --marker-bg: #966000; }
  .marker[data-state='critical'] { --marker-bg: #a83742; }
  .marker[data-state='unknown'] { --marker-bg: #60716b; }
  .marker.selected { box-shadow: 0 0 0 5px #17332b1a, 0 3px 12px #17332b45; }
  .marker-stale { position: absolute; display: grid; place-items: center; top: -5px; right: -6px; width: 17px; height: 17px;
    border: 1px solid #fff; border-radius: 50%; background: #805008; color: white; box-shadow: 0 1px 3px #26323d40; }
  .marker-name { position: absolute; left: 0; top: 6px; transform: translateX(-50%); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 135px; padding: 4px 9px; background: #fff; color: var(--ink); border-radius: 6px; box-shadow: 0 1px 5px #17332b24; font-size: .75rem; font-weight: 750; pointer-events: none; }
  .map-tools { position: absolute; z-index: 3; right: 12px; top: 12px; display: grid; gap: 8px; }
  .map-tools button { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--border); color: var(--ink); background: #fff;
    border-radius: 8px; box-shadow: 0 1px 5px #17332b12; }
  .map-tools button:hover:not(:disabled) { background: var(--accent-soft); }
  .zoom-tools button:first-child { border-radius: 8px 8px 0 0; }
  .zoom-tools button:last-child { border-radius: 0 0 8px 8px; border-top: 0; }
  .map-notice { position: absolute; left: 12px; top: 12px; z-index: 2; font-size: .75rem; font-weight: 650; padding: 4px 8px; border-radius: 5px; background: #fff; }
  .scale, .attribution { position: absolute; z-index: 2; bottom: 0; background: #ffffffde; color: #354840; font-size: .6875rem; line-height: 1.3; }
  .scale { left: 8px; bottom: 6px; text-align: center; border: solid #354840; border-width: 0 1px 1px; white-space: nowrap; min-width: max-content; }
  .attribution { right: 0; padding: 1px 5px; }
  .attribution a { color: inherit; }
</style>
