# SmartBin frontend

A SvelteKit dashboard for the waste-monitoring prototype in `docs/`. It starts with one simulated bin at a sample location in Almaty. Demo readings cycle through fill and weight alerts.

## Run locally

Use Node.js 22.12 or later.

```sh
cd frontend
npm ci
npm run dev
```

`npm test` runs the map and telemetry checks. `npm run build` produces the static site in `frontend/dist/`. For a GitHub Pages project URL, build with `BASE_PATH=/repository-name npm run build`. The static build includes both page directories for direct navigation.

## Dashboard pages

- **Overview** shows sensor readings, fill history, bin locations, and pickup priority.
- **Manage bins** lists configured bins at `/bins/` and opens the editor for locations, ThingSpeak fields, and thresholds.
- **Palette** in the top bar switches between Blue, Slate, Violet, and Forest. The browser remembers the selection.

SvelteKit page and layout files live in `src/routes/`. Shared components, telemetry, and dashboard state live in `src/lib/`.

## Set up a bin

1. Open **Manage bins** and select **Edit** for the starter bin or **Add bin** for a new one.
2. Enter the ThingSpeak **Channel ID** for that bin and add a **Read API key** if its channel is private. For the three-bin setup, use one channel per bin. A blank channel ID enables demo telemetry.
3. Select the channel's fill, weight, latitude, and longitude fields. Fill uses percent, weight uses grams, and both GPS coordinates use signed decimal degrees. Publish both coordinates together in the same ThingSpeak entry.
4. Enter an optional saved location or use **Pick on map**. Overview shows it while waiting for the first GPS fix. For a bin with a fixed location, leave both GPS fields set to **None** and enter its coordinates.
5. Set the warning and critical thresholds. The defaults are 65% and 80% fill, and 0.75 kg and 1 kg weight. Either metric can trigger pickup.

For example, a bin channel might use fields 1–4 for fill, weight, latitude, and longitude respectively. Match the selectors to the actual field numbers in each channel.

The dashboard polls the latest 30 ThingSpeak entries every 20 seconds. If those entries contain no usable GPS fix and there may be older entries, it searches up to 8,000 entries once per bin configuration per session. It saves the newest valid fix in the current browser and keeps showing that position and its timestamp when the fix becomes stale after two minutes. The map's coordinate and directions links use the position shown on the dashboard. The basemap requires an internet connection.

Bin settings, including any Read API key, are saved in local storage for this browser and site origin. Configure each browser separately. Keep the Write API key in the device firmware. [ThingSpeak Read Data API](https://www.mathworks.com/help/thingspeak/readdata.html)

The map uses the standard OpenStreetMap XYZ endpoint. `VITE_MAP_TILE_URL` can set an alternative XYZ URL at build time. Update the map attribution if the chosen provider requires additional credit. [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) · [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
