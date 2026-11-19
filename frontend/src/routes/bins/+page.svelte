<script>
  import { resolve } from '$app/paths';
  import BinEditor from '$lib/components/BinEditor.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { getDashboard } from '$lib/dashboard.svelte.js';
  import { coordinates, osmLink } from '$lib/geography.js';

  const dashboard = getDashboard();
  let editor = $state(null);
  let binsByName = $derived(dashboard.cards.toSorted((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));

  function saveBin(bin) {
    dashboard.saveBin(bin);
    editor = null;
  }

  function removeBin(id) {
    dashboard.removeBin(id);
    editor = null;
  }
</script>

<svelte:head><title>Manage bins · SmartBin</title></svelte:head>

<main>
  <header class="page-heading">
    <div><h1>Manage bins</h1><p>Set up bin locations, ThingSpeak fields, and alert thresholds.</p></div>
    <button class="button primary add-button" type="button" disabled={!dashboard.ready} onclick={() => editor = {}}>
      <Icon name="plus" size={19} /> Add bin
    </button>
  </header>

  {#if dashboard.storageIssue}
    <p class="feedback" role="alert">This browser could not save your settings. Changes will be lost if you reload.</p>
  {/if}

  <section class="panel inventory" aria-labelledby="inventory-title">
    <header class="panel-heading">
      <span class="section-icon"><Icon name="bins" size={18} /></span>
      <h2 id="inventory-title">Configured bins</h2>
      {#if dashboard.ready}<span class="count">{binsByName.length}</span>{/if}
    </header>

    {#if !dashboard.ready}
      <p class="empty" role="status">Loading bins…</p>
    {:else if binsByName.length}
      <div class="inventory-head" aria-hidden="true"><span>Bin</span><span>Location</span><span>Telemetry</span><span>Actions</span></div>
      <ul class="inventory-list">
        {#each binsByName as bin (bin.id)}
          <li>
            <div class="bin-name"><span class="bin-tile"><Icon name="bins" size={17} /></span><strong>{bin.name}</strong></div>
            <div class="bin-location">
              {#if bin.position?.source === 'gps'}
                <strong>{bin.position.stale ? 'Last GPS fix' : 'GPS position'}</strong>
              {:else if bin.location}
                <strong>{bin.location}</strong>
              {:else if !bin.position}
                <span>{bin.gpsEnabled ? 'Awaiting GPS fix' : 'Location unavailable'}</span>
              {/if}
              {#if bin.position}
                <a href={osmLink(bin.position)} target="_blank" rel="noreferrer">{coordinates(bin.position)}</a>
              {/if}
            </div>
            <div class="bin-source">
              {#if bin.channel}
                <strong>Channel {bin.channel}</strong>
                <small>Fill: field {bin.fillField} · Weight: field {bin.weightField}</small>
                {#if bin.gpsEnabled}<small>GPS: fields {bin.latitudeField}, {bin.longitudeField}</small>{/if}
              {:else}
                <span class="demo-label">Demo mode</span>
              {/if}
            </div>
            <div class="inventory-actions">
              <a class="button" href={resolve('/')} aria-label={`View readings for ${bin.name}`} onclick={() => dashboard.selectedId = bin.id}>
                View readings
              </a>
              <button class="button" type="button" aria-label={`Edit ${bin.name}`} onclick={() => editor = { bin: dashboard.bins.find(item => item.id === bin.id) }}>
                <Icon name="edit" size={15} /> Edit
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">Add a bin to start monitoring.</p>
    {/if}
  </section>
</main>

{#if editor}
  <BinEditor bin={editor.bin} onSave={saveBin} onClose={() => editor = null} onRemove={removeBin} />
{/if}

<style>
  .inventory { --inventory-columns: minmax(100px, 1fr) minmax(135px, 1.15fr) minmax(100px, .95fr) auto; }
  .count, .demo-label { border-radius: 99px; background: var(--accent-soft); color: var(--accent-ink); font-size: .8125rem; font-weight: 660; padding: 4px 9px; }
  .inventory-head, .inventory-list li { display: grid; grid-template-columns: var(--inventory-columns); align-items: center; gap: 14px; padding: 13px 16px; border-top: 1px solid var(--border); }
  .inventory-head { background: var(--background); color: var(--muted); font-size: .8125rem; font-weight: 680; }
  .inventory-head span:last-child { text-align: right; }
  .inventory-list { padding: 0; margin: 0; list-style: none; }
  .inventory-list strong, .bin-location a { overflow-wrap: anywhere; }
  .bin-name { display: flex; align-items: center; gap: 8px; font-size: .9375rem; }
  .bin-location, .bin-source { font-size: .875rem; }
  .bin-location a, .bin-source small { display: block; color: var(--muted); margin-top: 3px; font-size: .8125rem; }
  .inventory-actions { display: flex; gap: 6px; justify-content: end; }
  @media (max-width: 1040px) {
    .inventory { --inventory-columns: minmax(100px, 1fr) minmax(120px, 1.15fr) minmax(90px, .8fr) auto; }
    .inventory-actions { flex-wrap: wrap; }
  }
  @media (max-width: 680px) {
    .inventory-head { display: none; }
    .inventory-list li { grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
    .bin-name { grid-column: 1; }
    .bin-location { grid-row: 2; grid-column: 1 / -1; }
    .bin-source { grid-row: 1; grid-column: 2; text-align: right; }
    .inventory-actions { grid-column: 1 / -1; justify-content: start; }
  }
</style>
