<script>
  import Icon from './Icon.svelte';
  let { readings, warning, critical, stale = false } = $props();
  const chartWidth = 420;
  const chartHeight = 112;
  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

  let valid = $derived(readings.filter(point => point.fill !== null));
  let start = $derived(readings[0]?.time ?? 0);
  let end = $derived(readings.at(-1)?.time ?? 0);
  let segments = $derived.by(() => {
    const paths = [];
    let current = [];
    for (const point of readings) {
      if (point.fill === null) {
        if (current.length) paths.push(current);
        current = [];
      } else {
        const x = start === end ? chartWidth / 2 : (point.time - start) / (end - start) * chartWidth;
        current.push({ x, y: yFor(point.fill), time: point.time });
      }
    }
    if (current.length) paths.push(current);
    return paths;
  });

  function yFor(fill) {
    return 4 + (1 - fill / 100) * chartHeight;
  }

  function line(segment) {
    return segment.map(({ x, y }) => `${x},${y}`).join(' ');
  }
</script>

<section class="panel history" aria-labelledby="history-title">
  <header class="panel-heading">
    <span class="section-icon"><Icon name="trend" size={17} /></span>
    <div>
      <h2 id="history-title">Fill history</h2>
      <p>{stale ? 'Last received readings' : 'Latest 30 samples'}</p>
    </div>
  </header>
  {#if valid.length}
    <div class="chart" role="img" aria-label={`Fill readings range from ${Math.min(...valid.map(point => point.fill))}% to ${Math.max(...valid.map(point => point.fill))}%. Latest recorded fill was ${valid.at(-1).fill}%.`}>
      <div class="axis" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
      <svg viewBox="0 0 420 120" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="fill-fade" x1="0%" x2="0%" y1="0%" y2="100%"><stop stop-color="var(--accent)" stop-opacity=".55"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".05"/></linearGradient></defs>
        {#each [100, 50, 0] as tick (tick)}
          <line x1="0" x2={chartWidth} y1={yFor(tick)} y2={yFor(tick)} stroke="var(--border)" vector-effect="non-scaling-stroke"/>
        {/each}
        <line x1="0" x2={chartWidth} y1={yFor(warning)} y2={yFor(warning)} stroke="#ad7b2f" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
        <line x1="0" x2={chartWidth} y1={yFor(critical)} y2={yFor(critical)} stroke="#b95759" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
        {#each segments as segment (segment[0].time)}
          {#if segment.length === 1}
            <circle cx={segment[0].x} cy={segment[0].y} r="3.5" fill="var(--accent)"/>
          {:else}
            <polygon points={`${segment[0].x},116 ${line(segment)} ${segment.at(-1).x},116`} fill="url(#fill-fade)"/>
            <polyline points={line(segment)} fill="none" stroke="var(--accent)" stroke-width="2.25" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
          {/if}
        {/each}
      </svg>
    </div>
    <div class="times"><time datetime={new Date(start).toISOString()}>{timeFormat.format(start)}</time>
      {#if end !== start}<time datetime={new Date(end).toISOString()}>{timeFormat.format(end)}</time>{/if}</div>
  {:else}
    <p class="no-history">Fill history appears when readings are available.</p>
  {/if}
</section>

<style>
  .chart { display: grid; grid-template-columns: 39px 1fr; gap: 8px; height: 120px; margin: 0 18px; }
  .chart svg { width: 100%; height: 120px; overflow: visible; }
  .axis { display: flex; flex-direction: column; justify-content: space-between; text-align: right; color: var(--muted); font-size: .75rem; }
  .times { display: flex; justify-content: space-between; margin: 6px 18px 14px 65px; color: var(--muted); font-size: .75rem; }
  .no-history { margin: 4px 18px 18px; color: var(--muted); font-size: .875rem; }
</style>
