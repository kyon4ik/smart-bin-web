<script>
  let { label, icon, value, unit, max, warning, critical, state, detail, stale = false } = $props();

  const statusLabels = {
    normal: 'Normal',
    warning: 'Warning',
    critical: 'Critical',
    unknown: 'Unavailable',
  };

  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

  function measurement(number) {
    return `${numberFormat.format(number)}${unit === '%' ? '' : ' '}${unit}`;
  }

  let hasReading = $derived(Number.isFinite(value));
  let boundedValue = $derived(hasReading ? Math.max(0, Math.min(value, max)) : undefined);
  let position = $derived(hasReading ? `${(boundedValue / max) * 100}%` : undefined);
</script>

<article class="gauge" data-state={state}>
  <header class="gauge-header">
    <div class="gauge-title">
      <span class="gauge-icon" aria-hidden="true">{@render icon()}</span>
      <h3>{label}</h3>
    </div>
    <span class="gauge-status"><span aria-hidden="true"></span>{stale ? 'Stale' : statusLabels[state]}</span>
  </header>

  <div class="readout">
    <span class="reading">{hasReading ? numberFormat.format(value) : '—'}{#if hasReading}<span class="unit">{unit}</span>{/if}</span>
    {#if detail}<span class="detail">{detail}</span>{/if}
  </div>

  <div
    class="scale"
    style:--warning-at={`${(warning / max) * 100}%`}
    style:--critical-at={`${(critical / max) * 100}%`}
    style:--reading-at={position}
    role={hasReading ? 'meter' : undefined}
    aria-label={hasReading ? label : undefined}
    aria-valuemin={hasReading ? 0 : undefined}
    aria-valuemax={hasReading ? max : undefined}
    aria-valuenow={boundedValue}
    aria-valuetext={hasReading ? `${measurement(value)}, ${stale ? 'Stale reading' : statusLabels[state]}. Warning at ${measurement(warning)}. Critical at ${measurement(critical)}.` : undefined}
  >
    <div class="track" aria-hidden="true">
      <span class="warning-tick"></span>
      <span class="critical-tick"></span>
    </div>
    {#if hasReading}<span class="pointer" aria-hidden="true"></span>{/if}
  </div>

  <div class="thresholds">
    <span><i class="warning-dot" aria-hidden="true"></i>Warning <strong>{measurement(warning)}</strong></span>
    <span><i class="critical-dot" aria-hidden="true"></i>Critical <strong>{measurement(critical)}</strong></span>
  </div>
</article>

<style>
  .gauge {
    --status-ink: #236448;
    --status-bg: #e7f5ec;
    --status-dot: #2c8f60;
    --warning-dot: #a96813;
    --critical-dot: #be454b;
    min-width: 0;
    padding: 17px 19px 15px;
    border: 1px solid var(--border, #e2eae5);
    border-radius: 16px;
    background: var(--surface, #fff);
    color: var(--ink, #162823);
  }

  .gauge[data-state='warning'] {
    --status-ink: #805008;
    --status-bg: #fff2d9;
    --status-dot: var(--warning-dot);
  }

  .gauge[data-state='critical'] {
    --status-ink: #9b353d;
    --status-bg: #fce8e9;
    --status-dot: var(--critical-dot);
  }

  .gauge[data-state='unknown'] {
    --status-ink: #52615b;
    --status-bg: #edf1ef;
    --status-dot: #65766e;
  }

  .gauge-header,
  .gauge-title,
  .gauge-status {
    display: flex;
    align-items: center;
  }

  .gauge-header {
    justify-content: space-between;
    gap: 8px;
  }

  .gauge-title {
    gap: 10px;
  }

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
  }

  .gauge-icon {
    display: grid;
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 9px;
    background: var(--accent-soft);
    color: var(--accent-ink);
  }

  .gauge-status {
    flex-shrink: 0;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--status-bg);
    color: var(--status-ink);
    font-size: 0.8125rem;
    font-weight: 650;
    line-height: 1.3;
  }

  .gauge-status span,
  .thresholds i {
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .gauge-status span {
    background: var(--status-dot);
  }

  .readout {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 3px 10px;
    margin: 10px 0 11px;
  }

  .reading {
    font-size: 2.375rem;
    font-weight: 750;
    letter-spacing: -0.055em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .unit {
    margin-left: 4px;
    color: var(--muted, #5a6b63);
    font-size: 1rem;
    font-weight: 650;
    letter-spacing: 0;
  }

  .detail {
    color: var(--muted, #5a6b63);
    font-size: 0.8125rem;
  }

  .scale {
    position: relative;
    height: 13px;
  }

  .track {
    position: absolute;
    inset: 2px 0;
    overflow: hidden;
    border-radius: 5px;
    background: linear-gradient(
      to right,
      #c7e5d3 0% var(--warning-at),
      #f4d59b var(--warning-at) var(--critical-at),
      #efb6b9 var(--critical-at) 100%
    );
  }

  .warning-tick,
  .critical-tick {
    position: absolute;
    inset-block: 0;
    width: 1px;
    background: #fff;
  }

  .warning-tick {
    inset-inline-start: var(--warning-at);
  }

  .critical-tick {
    inset-inline-start: var(--critical-at);
  }

  .pointer {
    position: absolute;
    inset-block: 0;
    inset-inline-start: clamp(3px, var(--reading-at), calc(100% - 3px));
    width: 5px;
    border-radius: 3px;
    background: var(--status-ink);
    box-shadow: 0 0 0 2px var(--surface, #fff);
    transform: translateX(-50%);
  }

  .thresholds {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    margin-top: 9px;
    color: var(--muted, #5a6b63);
    font-size: 0.8125rem;
  }

  .thresholds span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .thresholds strong {
    color: var(--ink, #162823);
    font-weight: 650;
  }

  .warning-dot {
    background: var(--warning-dot);
  }

  .critical-dot {
    background: var(--critical-dot);
  }
</style>
