<script>
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Dashboard, setDashboard } from '$lib/dashboard.svelte.js';
  import Icon from '$lib/components/Icon.svelte';
  import { loadPalette, palettes, savePalette } from '$lib/palettes.js';
  import '../app.css';

  let { children } = $props();
  const dashboard = new Dashboard();
  setDashboard(dashboard);

  let palette = $state(palettes[0].id);
  let paletteSaved = $state(true);
  let activePalette = $derived(palettes.find(item => item.id === palette));
  let managing = $derived(page.route.id === '/bins');

  onMount(() => {
    palette = loadPalette();
    return dashboard.start();
  });

  function changePalette(event) {
    palette = event.currentTarget.value;
    paletteSaved = savePalette(palette);
  }
</script>

<div class="shell" data-palette={palette}>
  <aside class="sidebar" aria-label="SmartBin workspace">
    <a class="brand" href={resolve('/')} aria-label="SmartBin overview">
      <span class="brand-mark"><Icon name="bins" size={23} /></span>
      <span>Smart<span class="brand-accent">Bin</span><small>Waste monitoring</small></span>
    </a>

    <nav aria-label="Dashboard pages">
      <a class={{ active: !managing }} href={resolve('/')} aria-current={!managing ? 'page' : undefined}>
        <Icon name="grid" size={18} /> Overview
      </a>
      <a class={{ active: managing }} href={resolve('/bins') + '/'} aria-current={managing ? 'page' : undefined}>
        <Icon name="bins" size={18} /> Manage bins
      </a>
    </nav>

    <div class="sidebar-source">
      <span class="source-icon"><Icon name="radio" size={19} /></span>
      <span><strong>ThingSpeak</strong><small>{dashboard.hasConfiguredChannels ? 'Telemetry source' : 'Demo mode'}</small></span>
    </div>
  </aside>

  <div class="workspace">
    <div class="topbar">
      <div class="breadcrumb"><span>Workspace</span><Icon name="chevron" size={14} /><strong>{managing ? 'Manage bins' : 'Overview'}</strong></div>
      <div class="top-actions">
        {#if dashboard.bins.length && !managing}
          <span class="mode"><i class={{ connected: dashboard.hasFreshData }}></i>{dashboard.hasFreshData ? 'ThingSpeak live' : dashboard.hasConfiguredChannels ? 'ThingSpeak configured' : 'Demo mode'}</span>
        {/if}
        <label class="palette-choice">
          <span>Palette</span>
          <i style:background={activePalette.swatch} aria-hidden="true"></i>
          <select value={palette} onchange={changePalette} aria-label="Color palette">
            {#each palettes as option (option.id)}<option value={option.id}>{option.name}</option>{/each}
          </select>
        </label>
        {#if !paletteSaved}<span class="visually-hidden" role="status">Your browser could not save the palette.</span>{/if}
      </div>
    </div>
    {@render children()}
  </div>
</div>
