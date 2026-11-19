<script>
  import { untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import BinMap from './BinMap.svelte';
  import { defaults } from '../bins.js';
  import { tracksGps } from '../positions.js';
  import { ALMATY, MAX_LATITUDE } from '../geography.js';

  let { bin, onSave, onClose, onRemove } = $props();
  let draft = $state(untrack(() => ({ ...defaults, ...bin })));
  let picking = $state(false);
  let confirming = $state(false);
  let error = $state('');
  const fields = [1, 2, 3, 4, 5, 6, 7, 8];
  let gpsEnabled = $derived(tracksGps(draft));
  let hasLatitude = $derived(draft.latitude != null);
  let hasLongitude = $derived(draft.longitude != null);
  let coordinatesValid = $derived(Number.isFinite(draft.latitude) && Math.abs(draft.latitude) <= MAX_LATITUDE
    && Number.isFinite(draft.longitude) && Math.abs(draft.longitude) <= 180);

  function show(dialog) {
    dialog.showModal();
  }

  function save(event) {
    event.preventDefault();
    if (!draft.name.trim()) {
      error = 'Enter a name for this bin.';
      return;
    }
    if (draft.fillWarning >= draft.fillCritical) {
      error = 'Fill warning must be lower than fill critical.';
      return;
    }
    if (draft.weightWarning >= draft.weightCritical || draft.weightCritical > draft.capacity) {
      error = 'Weight warning must be lower than weight critical, and critical must fit within the capacity.';
      return;
    }
    if (draft.channel && (draft.latitudeField !== null || draft.longitudeField !== null) && !gpsEnabled) {
      error = 'Choose separate latitude and longitude fields to enable GPS.';
      return;
    }
    const mappedFields = gpsEnabled
      ? [draft.fillField, draft.weightField, draft.latitudeField, draft.longitudeField]
      : [draft.fillField, draft.weightField];
    if (draft.channel && new Set(mappedFields).size !== mappedFields.length) {
      error = 'Assign each measurement to a different ThingSpeak field.';
      return;
    }
    if (!coordinatesValid && (!gpsEnabled || hasLatitude || hasLongitude)) {
      error = 'Enter both saved coordinates or leave both blank when GPS is enabled.';
      return;
    }
    onSave({
      ...$state.snapshot(draft),
      id: bin?.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      location: draft.location.trim(),
      channel: draft.channel.trim(),
      readKey: draft.channel ? draft.readKey.trim() : '',
      latitude: draft.latitude ?? undefined,
      longitude: draft.longitude ?? undefined,
      latitudeField: gpsEnabled ? draft.latitudeField : null,
      longitudeField: gpsEnabled ? draft.longitudeField : null
    });
  }

  function pick({ latitude, longitude }) {
    draft.latitude = latitude;
    draft.longitude = longitude;
  }
</script>

<dialog {@attach show} onclose={onClose} aria-labelledby="editor-title">
  <form onsubmit={save}>
    <header class="dialog-header">
      <div>
        <h2 id="editor-title">{bin ? 'Edit bin' : 'Add a bin'}</h2>
        <p>Set the location, sensor fields, and alert thresholds.</p>
      </div>
      <button class="icon-button" type="button" aria-label="Close dialog" onclick={onClose}><Icon name="close" /></button>
    </header>

    <div class="form-content">
      <fieldset>
        <legend>Bin details</legend>
        <div class="fields">
          <label>Bin name<input required maxlength="45" placeholder="Bin 01" bind:value={draft.name} /></label>
          <label>Location label<input maxlength="75" placeholder="Street or collection site" bind:value={draft.location} /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>ThingSpeak</legend>
        <p class="field-hint">Leave the channel ID blank for demo readings. Settings are stored in this browser.</p>
        <div class="fields">
          <label>Channel ID<input inputmode="numeric" pattern="[1-9][0-9]*" placeholder="1234567" bind:value={draft.channel} /></label>
          <label>Read API key<input type="password" autocomplete="off" placeholder="For private channels" bind:value={draft.readKey} disabled={!draft.channel} /></label>
          <label>Fill field (%)
            <select bind:value={draft.fillField}>
              {#each fields as number (number)}<option value={number}>Field {number}</option>{/each}
            </select>
          </label>
          <label>Weight field (grams)
            <select bind:value={draft.weightField}>
              {#each fields as number (number)}<option value={number}>Field {number}</option>{/each}
            </select>
          </label>
          <label>Latitude field (decimal degrees)
            <select bind:value={draft.latitudeField} disabled={!draft.channel}>
              <option value={null}>None</option>
              {#each fields as number (number)}<option value={number}>Field {number}</option>{/each}
            </select>
          </label>
          <label>Longitude field (decimal degrees)
            <select bind:value={draft.longitudeField} disabled={!draft.channel}>
              <option value={null}>None</option>
              {#each fields as number (number)}<option value={number}>Field {number}</option>{/each}
            </select>
          </label>
        </div>
        {#if draft.channel}
          <p class="field-hint">Assign both GPS fields and send latitude and longitude together in each position update.</p>
        {/if}
      </fieldset>

      <fieldset>
        <legend>{gpsEnabled ? 'Saved location (optional)' : 'Map location'}</legend>
        {#if gpsEnabled}<p class="field-hint">Shown until the first valid GPS fix arrives.</p>{/if}
        <div class="fields">
          <label>Latitude<input required={!gpsEnabled || hasLongitude} type="number" min={-MAX_LATITUDE} max={MAX_LATITUDE} step="any" placeholder="43.238950" bind:value={draft.latitude} /></label>
          <label>Longitude<input required={!gpsEnabled || hasLatitude} type="number" min="-180" max="180" step="any" placeholder="76.889710" bind:value={draft.longitude} /></label>
        </div>
        <button class="button map-picker-button" type="button" aria-expanded={picking} onclick={() => picking = !picking}>
          <Icon name="pin" size={17} /> {picking ? 'Hide map picker' : 'Pick on map'}
        </button>
        {#if picking}
          <p class="field-hint">Click or tap to place the pin. Drag to move the map.</p>
          <div class="picker-map">
            <BinMap onPick={pick} initialLocation={coordinatesValid ? draft : ALMATY}
              points={coordinatesValid ? [{ id: 'draft', latitude: draft.latitude, longitude: draft.longitude }] : []} />
          </div>
        {/if}
      </fieldset>
      <fieldset>
        <legend>Alert thresholds</legend>
        <div class="fields">
          <label>Fill warning (%)<input required type="number" min="0" max="100" step="any" bind:value={draft.fillWarning} /></label>
          <label>Fill critical (%)<input required type="number" min="0" max="100" step="any" bind:value={draft.fillCritical} /></label>
          <label>Weight warning (kg)<input required type="number" min="0" step="0.001" bind:value={draft.weightWarning} /></label>
          <label>Weight critical (kg)<input required type="number" min="0" step="0.001" bind:value={draft.weightCritical} /></label>
          <label>Scale capacity (kg)<input required type="number" min="0.001" step="0.001" bind:value={draft.capacity} /></label>
        </div>
      </fieldset>
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    </div>
    <footer class="dialog-footer">
      {#if bin}
        <button class="button danger-button" type="button" onclick={() => confirming = true} disabled={confirming}>Remove bin</button>
      {/if}
      <div class="dialog-actions">
        <button class="button" type="button" onclick={onClose}>Cancel</button>
        <button class="button primary" type="submit">Save bin</button>
      </div>
    </footer>
    {#if confirming}
      <div class="confirm" role="group" aria-label="Confirm bin removal">
        <span>Remove {bin.name} from this dashboard?</span>
        <button class="button" type="button" onclick={() => confirming = false}>Keep bin</button>
        <button class="button danger-button" type="button" onclick={() => onRemove(bin.id)}>Confirm removal</button>
      </div>
    {/if}
  </form>
</dialog>

<style>
  dialog { border: 1px solid var(--border); border-radius: 18px; padding: 0; color: var(--ink); width: min(610px, calc(100% - 24px)); max-height: min(90dvh, 850px); box-shadow: 0 24px 90px #0c2a2340; }
  dialog::backdrop { background: color-mix(in srgb, var(--sidebar) 80%, transparent); }
  form { display: flex; flex-direction: column; max-height: inherit; }
  .dialog-header, .dialog-footer { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 18px 22px; }
  .dialog-header { border-bottom: 1px solid var(--border); }
  .dialog-header p, .field-hint { margin: 4px 0 0; color: var(--muted); font-size: .875rem; }
  .form-content { overflow: auto; display: grid; gap: 19px; padding: 20px 22px; }
  fieldset { min-width: 0; border: 0; padding: 0; margin: 0; }
  legend { padding: 0; margin-bottom: 8px; font-weight: 730; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
  label { display: grid; gap: 4px; color: var(--muted); font-size: .875rem; font-weight: 650; }
  input, select { background: white; border: 1px solid var(--accent-border); border-radius: 7px; min-width: 0; width: 100%; padding: 8px 9px; color: var(--ink); height: 40px; }
  select { appearance: none; padding-right: 30px; background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23445e54' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center; }
  input::placeholder { color: var(--muted); }
  input:disabled { background: var(--background); }
  .field-hint { margin-bottom: 9px; }
  .map-picker-button { margin-top: 9px; }
  .picker-map { height: 220px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .form-error { margin: 0; padding: 10px; background: #fff0f0; color: #923541; border-radius: 8px; font-size: .875rem; }
  .dialog-footer { border-top: 1px solid var(--border); background: var(--background); }
  .dialog-actions { display: flex; gap: 8px; margin-left: auto; }
  .danger-button { color: #923541; }
  .confirm { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border); padding: 10px 20px 16px; font-size: .875rem; }
  @media (max-width: 450px) {
    .dialog-header, .dialog-footer, .form-content { padding-inline: 13px; }
    .fields { gap: 10px; }
  }
</style>
