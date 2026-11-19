<script>
  import { resolve } from '$app/paths';
  import { getDashboard } from '$lib/dashboard.svelte.js';
  import BinMap from '$lib/components/BinMap.svelte';
  import Gauge from '$lib/components/Gauge.svelte';
  import History from '$lib/components/History.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { labels } from '$lib/bins.js';
  import { ALMATY, coordinates, directionsLink, osmLink } from '$lib/geography.js';

  const dashboard = getDashboard();
  const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
  const priority = { critical: 0, warning: 1, normal: 2, unknown: 3 };
  let map = $state();
  let selected = $derived(dashboard.selected);
  let mapPoints = $derived(dashboard.cards.filter(bin => bin.position).map(bin => ({
    id: bin.id, name: bin.name, status: bin.status, ...bin.position
  })));
  let position = $derived(selected?.position);
  let counts = $derived({
    warning: dashboard.cards.filter(bin => bin.status === 'warning').length,
    critical: dashboard.cards.filter(bin => bin.status === 'critical').length
  });
  let ordered = $derived(dashboard.cards.toSorted((a, b) => priority[a.status] - priority[b.status] || a.name.localeCompare(b.name)));

  function selectBin(id, focus = false) {
    dashboard.selectedId = id;
    if (focus) {
      const bin = dashboard.cards.find(item => item.id === id);
      if (bin?.position) map?.focusLocation(bin.position);
      document.getElementById('readings-title')?.scrollIntoView({ block: 'nearest' });
    }
  }

  function alertReason(bin) {
    const states = [bin.fillStatus, bin.weightStatus];
    const names = ['Fill level', 'Weight'];
    return names.filter((_, index) => states[index] === bin.status).join(' and ');
  }
</script>

<svelte:head><title>Overview · SmartBin</title></svelte:head>

{#snippet fillIcon()}<Icon name="gauge" size={18} />{/snippet}
{#snippet weightIcon()}<Icon name="weight" size={18} />{/snippet}

<main>
  <header class="page-heading">
    <div><h1>Bin monitoring</h1><p>Track fill levels, weight, and bin locations.</p></div>
    {#if dashboard.hasConfiguredChannels}
      <button class="button refresh-button" type="button" disabled={dashboard.refreshing} onclick={() => dashboard.refresh()}>
        <Icon name="refresh" size={17} /> {dashboard.refreshing ? 'Refreshing…' : 'Refresh readings'}
      </button>
    {/if}
  </header>

  {#if dashboard.ready}
    <section class="summary" aria-label="Fleet summary">
      <div class="summary-card"><span class="summary-icon total"><Icon name="bins" size={20} /></span><div><span>Total bins</span><strong>{dashboard.bins.length}</strong></div></div>
      <div class="summary-card"><span class="summary-icon warning"><Icon name="alert" size={20} /></span><div><span>Warnings</span><strong>{counts.warning}</strong></div></div>
      <div class="summary-card"><span class="summary-icon critical"><Icon name="truck" size={20} /></span><div><span>Pickup needed</span><strong>{counts.critical}</strong></div></div>
    </section>

    {#if selected}
      <div class="dashboard-grid">
        <section class="panel map-panel" aria-labelledby="map-title">
          <header class="panel-heading">
            <span class="section-icon"><Icon name="pin" size={18} /></span>
            <div><h2 id="map-title">Bin locations</h2><p>{mapPoints.length} {mapPoints.length === 1 ? 'bin' : 'bins'} on the map</p></div>
            {#if position}
              <a class="button map-link" href={directionsLink(position)} target="_blank" rel="noreferrer"><Icon name="external" size={16} /><span>Directions</span></a>
            {/if}
          </header>
          <div class="map-frame">
            <BinMap points={mapPoints} selectedId={selected.id} onSelect={selectBin} initialLocation={position ?? mapPoints[0] ?? ALMATY} bind:this={map} />
          </div>
          <footer class="map-footer">
            <div>
              <strong>{position?.source === 'gps' ? selected.name : selected.location || selected.name}</strong>
              {#if position}
                <a class="coordinates" href={osmLink(position)} target="_blank" rel="noreferrer">{coordinates(position)}</a>
              {/if}
              <p class="coordinates">
                {#if position?.source === 'gps'}
                  {position.stale ? 'Last GPS fix' : 'GPS fix'} · <time datetime={new Date(position.time).toISOString()}>{dateFormat.format(position.time)}</time>
                {:else if selected.gpsEnabled}
                  {position ? 'Awaiting GPS fix · showing saved location' : 'Awaiting first GPS fix'}
                {:else if position}
                  Saved location
                {:else}
                  Location unavailable
                {/if}
              </p>
            </div>
            <div class="map-statuses">
              {#if position?.source === 'gps' && position.stale}
                <span class="badge" data-state="warning"><i></i>GPS stale</span>
              {/if}
              <span class="badge" data-state={selected.status}><i></i>{labels[selected.status]}</span>
            </div>
          </footer>
        </section>

        <section class="readings" aria-labelledby="readings-title">
          <header class="readings-heading">
            <div>
              <h2 id="readings-title">{selected.name}</h2>
              <p><Icon name={selected.channel ? 'clock' : 'radio'} size={14} />
                {#if !selected.channel}Demo readings
                {:else if selected.latest}
                  <time datetime={new Date(selected.latest.time).toISOString()}>{selected.stale ? 'Stale · ' : ''}{dateFormat.format(selected.latest.time)}</time>
                {:else if dashboard.refreshing}Loading readings…
                {:else}Waiting for readings{/if}
              </p>
            </div>
          </header>
          {#if selected.error}<p class="feedback" role="status">{selected.error}</p>{/if}
          <Gauge label="Fill level" icon={fillIcon} value={selected.fill} unit="%" max={100}
            warning={selected.fillWarning} critical={selected.fillCritical} state={selected.fillStatus} stale={selected.fillStale}
            detail={selected.fillStale ? 'Last reading' : 'of total volume'} />
          <Gauge label="Bin weight" icon={weightIcon} value={selected.weight} unit="kg" max={selected.capacity}
            warning={selected.weightWarning} critical={selected.weightCritical} state={selected.weightStatus} stale={selected.weightStale}
            detail={selected.weightStale ? 'Last reading' : `of ${numberFormat.format(selected.capacity)} kg capacity`} />
        </section>
      </div>
    {/if}

    <div class={['bottom-grid', { single: !selected }]}>
      <section class="panel roster" aria-labelledby="fleet-title">
        <header class="panel-heading"><span class="section-icon"><Icon name="layers" size={17} /></span><div><h2 id="fleet-title">Pickup priority</h2><p>Select a bin to see its readings</p></div></header>
        {#if ordered.length}
          <ul class="bin-list">
            {#each ordered as bin (bin.id)}
              <li class={{ chosen: bin.id === selected?.id }}>
                <button class="bin-row" type="button" aria-pressed={bin.id === selected?.id} onclick={() => selectBin(bin.id, true)}>
                  <span class="bin-tile"><Icon name="bins" size={18} /></span>
                  <span class="bin-identity"><strong>{bin.name}</strong><small>{bin.position?.source === 'gps' ? coordinates(bin.position) : bin.location || (bin.position ? coordinates(bin.position) : 'Location unavailable')}</small></span>
                  <span class="bin-status">
                    <span class="badge" data-state={bin.status}><i></i>{labels[bin.status]}</span>
                    {#if bin.status === 'warning' || bin.status === 'critical'}<small>{alertReason(bin)}</small>{/if}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty">Add a bin in <a href={resolve('/bins') + '/'}>Manage bins</a> to start monitoring.</p>
        {/if}
      </section>
      {#if selected}
        <History readings={selected.history} warning={selected.fillWarning} critical={selected.fillCritical} stale={selected.fillStale} />
      {/if}
    </div>
  {:else}
    <p class="loading-state" role="status">Loading bins…</p>
  {/if}
</main>
