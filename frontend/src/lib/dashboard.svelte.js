import { createContext } from 'svelte';
import { binStatus, demoHistory, HISTORY_LENGTH, loadBins, metricStatus, POLL_MS, sourceKey, STALE_MS, STORAGE_KEY } from './bins.js';
import { binPosition, GPS_HISTORY_LENGTH, gpsKey, latestGpsFix, loadGpsFixes, saveGpsFixes, tracksGps } from './positions.js';
import { channelHistory, readChannel } from './telemetry.js';

export const [getDashboard, setDashboard] = createContext();

export class Dashboard {
  bins = $state.raw([]);
  selectedId = $state();
  refreshing = $state(false);
  storageIssue = $state(false);
  ready = $state(false);
  #channels = $state.raw({});
  #gpsFixes = $state.raw({});
  #gpsScanned = new Set();
  #now = $state(0);
  #request;

  cards = $derived(this.bins.map(bin => {
    const feed = this.#channels[sourceKey(bin)];
    const history = bin.channel
      ? channelHistory(bin, feed?.entries ?? []).filter(reading => reading.fill !== null || reading.weight !== null)
      : demoHistory(bin, this.#now);
    const latest = history.at(-1);
    const fillReading = history.findLast(reading => reading.fill !== null);
    const weightReading = history.findLast(reading => reading.weight !== null);
    const fill = fillReading?.fill ?? null;
    const weight = weightReading?.weight ?? null;
    const fillStale = this.#isStale(bin, fillReading);
    const weightStale = this.#isStale(bin, weightReading);
    const stale = this.#isStale(bin, latest);
    const fillStatus = metricStatus(fillStale ? null : fill, bin.fillWarning, bin.fillCritical);
    const weightStatus = metricStatus(weightStale ? null : weight, bin.weightWarning, bin.weightCritical);
    const status = binStatus(fillStatus, weightStatus);
    const position = binPosition(bin, this.#gpsFixes[gpsKey(bin)], this.#now);
    return {
      ...bin, history, latest, fill, weight, stale, fillStale, weightStale, fillStatus, weightStatus,
      status, position, gpsEnabled: tracksGps(bin), error: feed?.error
    };
  }));

  selected = $derived(this.cards.find(bin => bin.id === this.selectedId) ?? this.cards[0]);
  hasConfiguredChannels = $derived(this.bins.some(bin => bin.channel));
  hasFreshData = $derived(this.cards.some(bin => bin.channel && !bin.error
    && ((bin.latest && !bin.stale) || (bin.position?.source === 'gps' && !bin.position.stale))));

  start() {
    this.bins = loadBins();
    this.#gpsFixes = loadGpsFixes();
    this.selectedId = this.bins[0]?.id;
    this.ready = true;
    this.refresh();
    const timer = window.setInterval(() => this.refresh(), POLL_MS);
    return () => {
      window.clearInterval(timer);
      this.#request?.abort();
    };
  }

  async refresh(force = false) {
    this.#now = Date.now();
    if (this.refreshing && !force) return;
    this.#request?.abort();
    const controller = new AbortController();
    this.#request = controller;
    const sources = new Map();
    for (const bin of this.bins.filter(bin => bin.channel)) {
      const key = sourceKey(bin);
      if (!sources.has(key)) sources.set(key, []);
      sources.get(key).push(bin);
    }
    if (!sources.size) {
      this.#channels = {};
      this.refreshing = false;
      return;
    }

    this.refreshing = true;
    const results = await Promise.all([...sources].map(async ([key, [bin]]) => {
      try {
        const entries = await readChannel(bin.channel, bin.readKey, controller.signal);
        return [key, { entries }];
      } catch (error) {
        const message = error.name === 'TypeError' || error.name === 'TimeoutError'
          ? 'Could not reach ThingSpeak. Check your connection.'
          : error.message;
        return [key, { entries: this.#channels[key]?.entries ?? [], error: message }];
      }
    }));
    if (controller.signal.aborted) return;
    this.#channels = Object.fromEntries(results);
    this.#now = Date.now();

    const gpsSources = [...sources].map(([key, bins]) => ({
      feed: this.#channels[key],
      bins: bins.filter(tracksGps)
    })).filter(({ feed, bins }) => !feed.error && bins.length);
    for (const { feed, bins } of gpsSources) this.#rememberGps(bins, feed.entries);
    await Promise.all(gpsSources.map(({ feed, bins }) => this.#backfillGps(bins, feed.entries, controller.signal)));
    if (controller.signal.aborted) return;
    this.refreshing = false;
  }

  #isStale(bin, reading) {
    return Boolean(bin.channel && reading && this.#now - reading.time >= STALE_MS);
  }

  #rememberGps(bins, entries) {
    const fixes = { ...this.#gpsFixes };
    let changed = false;
    for (const bin of bins) {
      const key = gpsKey(bin);
      const fix = latestGpsFix(bin, entries);
      if (fix && (!fixes[key] || fix.time > fixes[key].time)) {
        fixes[key] = fix;
        changed = true;
      }
    }
    if (changed) {
      this.#gpsFixes = fixes;
      saveGpsFixes(fixes);
    }
  }

  async #backfillGps(bins, recent, signal) {
    if (recent.length < HISTORY_LENGTH) return;
    const earliest = Math.min(...recent.map(entry => Date.parse(entry?.created_at)).filter(Number.isFinite));
    const pending = bins.filter(bin => {
      const key = gpsKey(bin);
      const fix = this.#gpsFixes[key];
      return !this.#gpsScanned.has(key) && (!fix || fix.time < earliest);
    });
    if (!pending.length) return;

    const [bin] = pending;
    try {
      const entries = await readChannel(bin.channel, bin.readKey, signal, GPS_HISTORY_LENGTH);
      if (signal.aborted) return;
      this.#rememberGps(pending, entries);
      for (const tracked of pending) this.#gpsScanned.add(gpsKey(tracked));
    } catch {
      // Keep the best fix available and retry after a successful normal poll.
    }
  }

  #saveToBrowser(next) {
    this.bins = next;
    const activeGpsKeys = new Set(next.filter(tracksGps).map(gpsKey));
    const fixes = Object.entries(this.#gpsFixes).filter(([key]) => activeGpsKeys.has(key));
    if (fixes.length !== Object.keys(this.#gpsFixes).length) {
      this.#gpsFixes = Object.fromEntries(fixes);
      saveGpsFixes(this.#gpsFixes);
    }
    for (const key of this.#gpsScanned) if (!activeGpsKeys.has(key)) this.#gpsScanned.delete(key);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.storageIssue = false;
    } catch {
      this.storageIssue = true;
    }
    this.refresh(true);
  }

  saveBin(bin) {
    const next = this.bins.some(item => item.id === bin.id)
      ? this.bins.map(item => item.id === bin.id ? bin : item)
      : [...this.bins, bin];
    this.selectedId = bin.id;
    this.#saveToBrowser(next);
  }

  removeBin(id) {
    const next = this.bins.filter(bin => bin.id !== id);
    if (id === this.selectedId) this.selectedId = next[0]?.id;
    this.#saveToBrowser(next);
  }
}
