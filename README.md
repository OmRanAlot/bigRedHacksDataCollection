# Ink Study — Handwriting Dataset Collector

A local React + TypeScript workspace for collecting raw handwriting trajectories for a personalized handwriting generation model. Native Canvas and Pointer Events support mouse, touch, and stylus input. The Vite development server stores the collected samples in JSON files under `data/`; ngrok can securely expose that local server to an iPad.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Keep using this exact address: browser storage belongs to the origin (scheme, hostname, and port). The server uses a fixed port and fails if it is occupied instead of silently switching to another dataset origin. On Windows PowerShell, use `npm.cmd install` and `npm.cmd run dev` if execution policy blocks `npm.ps1`.

## Use ngrok to collect from an iPad and save on the laptop

ngrok creates a temporary HTTPS address that forwards to the Vite server running on your laptop. The iPad does not need to be on the same Wi-Fi network. Samples are written by the laptop server to the project directory, not to ngrok.

1. Install ngrok from [ngrok.com/download](https://ngrok.com/download), authenticate it once with your ngrok authtoken, and confirm that `ngrok` is available in PowerShell:

   ```powershell
   ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
   ```

2. Open PowerShell in this project directory and start the Vite server. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`:

   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```

   Leave this terminal running. The app listens on `http://127.0.0.1:5173`.

3. Open a second PowerShell window in the same directory and start the tunnel:

   ```powershell
   ngrok http 5173
   ```

4. Copy the **HTTPS Forwarding** URL printed by ngrok, for example `https://example.ngrok-free.app`. Open that URL in Safari on the iPad. Do not open `localhost` or `127.0.0.1` on the iPad.

5. In the app, select **Main** for the dedicated character queue, or **Collect** for the original Glyph, Expression, and Mixed queues. Write each prompt and tap **Save & Next**. The Main queue contains the configured digits, letters, and Greek characters and stores separately from the original collection.

6. Verify that the laptop is receiving samples by checking these files while the Vite terminal is running:

   - `data\main.json` for samples collected in **Main**
   - `data\samples.json` for samples collected in **Collect**

   The files are created or updated automatically after a successful save. Do not edit them while the app is collecting.

7. Keep both the Vite and ngrok terminals running for the entire collection session. When finished, stop the tunnel with `Ctrl+C`, then stop Vite with `Ctrl+C`. Keep a backup copy of the JSON files before deleting or moving the project.

### ngrok safety and reliability

- Treat the ngrok URL like a temporary password. Anyone who has it may be able to open the app and submit handwriting to your laptop.
- Do not post the URL publicly. Stop ngrok when you are finished.
- The app allows ngrok hosts ending in `.ngrok-free.app`; if ngrok gives you a different hostname, add that host to `server.allowedHosts` in `vite.config.ts`.
- The laptop must remain awake, connected to the internet, and running both terminals. If the laptop or Vite server stops, the iPad cannot save to the JSON files.
- Use the HTTPS URL, not an HTTP forwarding URL.
- The ngrok URL can change each time unless you configure a reserved domain. Always copy the current URL from the ngrok terminal.
- The browser also keeps a local working copy for recovery, but the authoritative laptop copies are `data\main.json` and `data\samples.json`.

```sh
npm run build       # strict TypeScript checks and production output in dist/
npm run preview     # serve that build at the same origin; stop dev first
npm test            # unit tests, including a browser-compatible IndexedDB test implementation
npm run test:e2e    # Chromium browser tests; starts dev if needed
```

Install the test browser once with `npx playwright install chromium`. The application itself uses native IndexedDB; fake-indexeddb is a development-only test dependency. No whiteboard or database framework is included.

## Use on iPad with Apple Pencil or touch

1. Connect your computer and iPad to the same trusted Wi-Fi network.
2. On the computer, run `npm run dev:lan` (or `npm.cmd run dev:lan` in PowerShell). Stop any other server using port 5173 first.
3. Vite prints a **Network** URL such as `http://192.168.1.25:5173`. Open that exact URL in **Safari on your iPad**, not `localhost` or `127.0.0.1` (those would point at the iPad itself). If Windows Firewall asks, allow Node on your private network. A guest Wi-Fi network may isolate devices and block the connection.
4. Write with Apple Pencil or a finger. Enable **Pen only** to ignore fingers and palm touches while using a stylus. This preference survives refresh. Leave it off for finger/mouse drawing. Choose Expression or Mixed Collection to capture complete combinations and math expressions as well as single characters.
5. Tap **Save & Next** after each sample. When using the ngrok workflow above, the laptop server writes strokes, timestamps, and device-reported pressure to `data\main.json` or `data\samples.json`. The browser also keeps a local working copy for recovery.
6. In **Dataset / Review**, tap **Export Dataset** when you want an additional portable backup. The authoritative files for ngrok collection are the JSON files in the laptop's `data\` directory.

For long sessions, use the development server with ngrok as described above, or use the production build locally with `npm run build` followed by `npm run preview`. If you expose the production preview with ngrok, run `ngrok http 4173` instead of `ngrok http 5173`. Keep the computer running and connected while opening or reloading the app. This version does not install an offline service worker.

Use a recent iPadOS/Safari release (17+ recommended), a normal non-private tab, and the same address every time. Reserving the computer's local IP in your router keeps its address stable. Changing IP, port, browser profile, or switching from Safari to a Home Screen web app can expose a different storage area; export before making that change and import afterward. HTTP Wi-Fi operation is supported, including a secure-random UUID fallback for browsers where `crypto.randomUUID()` is unavailable.

Settings includes **Protect browser storage** where Safari exposes the persistence API. The browser decides whether to grant it, and on plain HTTP this extra API may be unavailable. The laptop JSON files remain the primary storage for ngrok collection; browser protection is only a recovery aid. Keep backups of `data\main.json` and `data\samples.json`. See [WebKit's storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) and [Home Screen storage isolation](https://webkit.org/tracking-prevention/).

The automated iPad checks use WebKit with an iPad touch viewport, including saving both sample types, reload recovery, download/import, pen-only input, and portrait/landscape layout. Install both browser engines with `npx playwright install chromium webkit` before `npm run test:e2e`. Physical Apple Pencil pressure and palm behavior still need an on-device check; pressure varies by Pencil model and browser support.

## Collection workflow

1. Choose Glyph, Expression, or Mixed Collection. Each mode keeps its own queue and progress; all contribute to one dataset.
2. Write the large target in your normal handwriting. Lift your pen between separate strokes. Baseline, center-line, and grid guides are optional and never enter the dataset.
3. Press **Enter** or **Save & Next**. The app waits for the IndexedDB transaction to commit before clearing the canvas or advancing. A failed save keeps your drawing available for retry.
4. Use **Backspace / Ctrl+Z / Cmd+Z** to undo one stroke, **C** to clear, or **S** to skip. Shortcuts do not intercept typing in controls. Enter on a focused button retains the button's native action.
5. Check Stats for underrepresented labels; adjust category repetitions in Settings. Save settings updates paper and coverage goals. **Regenerate Prompt Queue** applies queue settings and resets progress for all three original modes, after confirmation. It never removes samples. The **Main** queue has its own progress and is not regenerated by the original Settings controls.
6. Review and replay occasional samples to check label accuracy and handwriting quality. Good, Bad, and Redo are annotations; they do not remove samples, affect coverage, or automatically requeue a prompt.
7. Export backups regularly, especially after a collection session. Keep a separate copy outside the browser.

The default queue contains 1,900 glyph prompts: digits ×20, lowercase ×15, uppercase ×10, 27 math symbols ×20, and 34 Greek symbols ×15. Expression Collection contains 120 distinct expressions. Mixed combines both by default. Changing “Include expressions” affects Mixed mode only. Shuffling is deterministic from the seed and mode; preserve the same settings and seed to reproduce the order. Disabling shuffle interleaves repetitions in stable category order. Adjacent identical labels are avoided.

The separate **Main** queue is stored in `data\main.json`. It contains only digits `0–9` ×30, lowercase `a–z` ×20, an additional ×20 for the configured common lowercase letters, and the common math symbols from the Math symbols category ×20. Prompts are sequential: all `0` samples come first, then all `1` samples, then all `2` samples, and so on; the same ordering applies to letters and symbols.

## Dataset schema

```ts
type Point = {
  x: number       // CSS pixels relative to the canvas
  y: number       // CSS pixels relative to the canvas
  t: number       // milliseconds since this sample's first pointer-down
  pressure: number // original PointerEvent.pressure, normally 0–1
}
type Stroke = Point[]
type Sample = {
  id: string
  label: string
  type: 'glyph' | 'expression'
  createdAt: string // ISO timestamp at save
  canvasWidth: number
  canvasHeight: number
  strokes: Stroke[]
  strokeWidth?: number // visual CSS-pixel width; defaults to 3 for older imports
  quality?: 'good' | 'bad' | 'redo' // defaults to Good in the UI
}
type Dataset = {
  metadata: {
    version: 1
    exportedAt: string
    totalSamples: number
  }
  samples: Sample[]
}
```

Each pointer-down begins one ordered stroke. Pointer-up ends it and records its final position/pressure. Cancellation or lost capture closes the stroke with the points already received. A single-point stroke is a valid dot. Only one pointer is captured at a time to prevent overlapping touch contacts from merging into a stroke. Compatible browsers supply coalesced movement events for additional raw samples; otherwise the app records the available pointer moves. The app does not use predicted events.

Timing includes pauses between strokes. Undo removes the last stroke without retiming remaining data. Clearing, undoing all strokes, saving, or skipping starts a fresh sample clock. Event timestamps use the browser's monotonic time basis; precision depends on browser privacy settings. Nondecreasing timestamps are enforced against rare out-of-order events.

Pressure is recorded directly, without inventing pen pressure for a mouse. Mouse movement typically reports 0.5 while pressed and 0 on release; pens and touch devices vary. Pen-up zero pressure is intentionally retained. Display uses a constant configurable stroke width so replay does not depend on a particular device's pressure response; raw pressure remains available for ML.

Canvas backing pixels follow device pixel ratio, but points remain in CSS space. Before the first stroke, paper fits the available width at the configured aspect ratio. Once drawing begins, its CSS dimensions stay fixed; a smaller viewport scrolls instead of changing existing data. Captured pointers may move outside the paper, so coordinates can be negative or exceed the canvas dimensions. Such points are preserved and accepted on import.

**Raw strokes are intentionally preserved.** No coordinate normalization, point simplification, stroke merging, raster-only storage, or timing/pressure removal occurs. Normalize, resample, and prepare model inputs during ML preprocessing, keeping the original exports as source data.

## Storage and recovery

Samples live in the browser's IndexedDB database **`ink-study`**, in the **`samples`** object store. Indexes cover label, type, and creation time. The **`progress`** store contains internal queue receipts, committed in the same transaction as each sample. A receipt lets startup reconcile a save that completed just before a crash, even if localStorage still contains the old prompt index. Skips also receive durable receipts. Receipts are not exported.

Settings and mode-specific queues, seeds, indices, skipped counts, and completion states live in versioned **`ink-study.*` localStorage keys**. Dark mode uses its own key. A corrupted session can be reset from the startup recovery screen without clearing IndexedDB samples.

Unsaved drawings exist only in memory. The app asks before leaving an unsaved drawing through its navigation and requests the browser's standard unload warning. A browser or device crash can lose the current unsaved drawing. Saved samples survive normal refreshes and restarts, but clearing browser data, private browsing expiration, storage eviction, or device failure can erase browser storage. The app requests strict write durability where supported; browser storage is not a substitute for an exported backup.

Use one collection tab at a time. The app guards repeated submissions and stores idempotent progress receipts, but it is not a collaborative multi-tab editor. Data is not synchronized across devices or browser profiles.

## Review, replay, export, and import

**Dataset / Review** lists summaries with label/type filters, search, and pagination. Select a sample to load its strokes. Replay follows each point's timestamp and preserves pen lifts and inter-stroke pauses. Play, Pause, Restart, and speed controls (0.5×, 1×, 2×, 4×) are available; changing speed preserves the current position. Preview scaling does not modify data. Replay animations and observers are cleaned up when the view closes.

**Export Dataset** loads every committed IndexedDB sample into a version-1 JSON file named `handwriting-dataset-YYYY-MM-DD.json`. **Export Current Prompt Type** uses the adjacent Glyph/Expression selector, initially set from the current collection target. Filtered filenames include the type. Search and review filters do not restrict a full export. Empty exports are valid. Exporting very large datasets requires memory for the resulting JSON document.

**Import Dataset** accepts the same format, including files without the optional style/quality fields. It validates the complete file before writing: metadata version, sample identity fields, dates, canvas dimensions, stroke boundaries, finite point values, nonnegative ordered timestamps, and pressure from 0 to 1. Empty datasets are allowed; blank samples are rejected. Missing IDs receive UUIDs; collisions with stored records or other incoming records receive new UUIDs. Reimporting intentionally creates additional samples rather than deduplicating them. Imports commit atomically and preserve raw numeric values. Metadata counts are recalculated from the samples array. Imports do not alter collection queues.

Deleting a selected sample requires confirmation and does not rewind prompt progress. Deleted samples can only be recovered from an export. The UI intentionally has no bulk-delete button.

## Architecture

- `src/components`: drawing and replay canvases, target display, progress, and summary cards.
- `src/pages`: Collect, Review, Stats, and Settings.
- `src/lib`: native IndexedDB access, validation/import/export, seeded prompt generation, session recovery, shared rendering, replay timing, and statistics.
- `src/types/handwriting.ts`: shared typed data contracts.
- `src/App.tsx`: navigation, settings, persistence coordination, and user-visible errors.

Drawing buffers stay in refs instead of React state, so point capture does not rerender the application on every movement. Both capture and replay use the same line renderer. Replay advances an incremental cursor instead of rescanning every point on each frame. Dataset browsing retains compact summaries and loads full stroke arrays only for the selected sample; export deliberately reads the entire dataset.

Browser automation checks storage, raw coordinates, refresh recovery, input handling, replay, resizing, imports, deletion, and configuration. Physical Surface Pen/Apple Pencil pressure behavior should also be checked on the hardware and browser you intend to collect with.
