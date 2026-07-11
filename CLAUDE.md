# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server with HMR (localhost:5173)
npm run build     # production build to dist/
npm run preview   # preview production build locally
npm run lint      # run ESLint
```

There is no test suite configured.

## Architecture

Single-page React 19 + Vite 8 app. Entry point is `src/main.jsx`, which mounts `src/App.jsx` into `#root` in `index.html`. No TypeScript — JSX only.

Key dependencies: `d3` v7, `topojson-client`, `world-atlas` (Natural Earth 50m land/borders).

### Component tree

```
App.jsx                     — root state: activeJourneys, selectedBookId, selectedBook,
                              viewMode, timelineYear, hoveredCityId, provincesGeo,
                              showProvinces, isPlaying, playSpeed, detailJourneyId,
                              activeChurchTracks
└── .map-container (div)    — position:relative; contains all overlays + map
    ├── FilterPanel.jsx     — floating overlay top-left; journey toggles + book pill selector
    ├── MapView.jsx         — D3 SVG map; fills map-container
    ├── StoryLayer.jsx      — bottom-center map overlay: "▶ Paul's Story" entry button when
    │                         timelineYear is null, else a glass caption card tracking Paul's
    │                         current waypoint (journey badge, city, note, ref, "✍ books being
    │                         written"). Beats = all waypoints flattened+sorted (module-level
    │                         BEATS); INTRO_BEAT covers AD 44 until the first waypoint. Card
    │                         remounts per beat (React key) to replay the storyBeatIn CSS
    │                         animation. onStoryPlay → App.handleStoryPlay (clears detail/book
    │                         focus incl. detailJourneyIdRef, then handlePlay from AD 44)
    └── BookDetailPanel.jsx — slide-in panel from right when a book is selected
TimelineBar.jsx             — D3 SVG timeline below the map (sibling of .app-body);
                              clicking a capsule bar enters detail mode (detailJourneyId)
└── TimelineDetail.jsx      — rendered in place of overview SVG when detailJourneyId is set;
                              contains PaulStopTrack + church toggle pills + ChurchTracks
    ├── PaulStopTrack.jsx   — duration-proportional stop segments; horizontally scrollable
    └── ChurchTrack.jsx     — thin SVG track with event markers per church; one per active
                              church in activeChurchTracks
PlayControls.jsx            — collapsible play controls below timeline; collapsed by default,
                              expands via a caret tab; contains rewind, play/pause, speed pills
```

### State flow

- `activeJourneys` — `Set<string>` of journey IDs currently shown; toggled by FilterPanel and passed to MapView + TimelineBar
- `selectedBookId` — single book ID or `null`; selecting in FilterPanel or clicking a diamond in TimelineBar both toggle it
- `selectedBook` — `useMemo` derived from `selectedBookId`; full book object passed to BookDetailPanel
- `timelineYear` — `number | null`; null means scrubber hidden; set by dragging/clicking TimelineBar or advanced by play loop
- `highlightRange` — `[start, end] | null` derived from `selectedBook.dateRange`; passed to TimelineBar for the gold overlay
- `showProvinces` — `boolean` (default `true`); toggles province fill/border layers in MapView; controlled by the "Provincial Boundaries" checkbox in FilterPanel
- `isPlaying` — `boolean`; true while the rAF animation loop is running; paused by any user interaction with journeys/books/scrubber
- `playSpeed` — `0.5 | 1 | 2`; multiplier applied to the 1.5s-per-year base rate; mirrored to `playSpeedRef` for use inside the rAF closure
- `detailJourneyId` — `string | null`; when set, TimelineBar switches to detail mode showing PaulStopTrack + church tracks for that journey; set by clicking a capsule bar, cleared by "← Overview" breadcrumb
- `activeChurchTracks` — `Set<string>` of church IDs whose tracks are currently visible in detail mode; reset to empty Set whenever `detailJourneyId` changes

### Play mode refs (App.jsx)

- `playFrameRef` — holds the current `requestAnimationFrame` id; cancelled on pause/reset
- `playStartTimeRef` — `performance.now()` timestamp when the current play segment began
- `playStartYearRef` — the `timelineYear` value at the moment play/resume started
- `playSpeedRef` — mirror of `playSpeed` state, readable inside the rAF closure without stale closure issues
- `playEndRef` — effective end year for the current play session; defaults to `PLAY_END=67` but is set to `journey.dateRange[1]` when `detailJourneyId` is set, constraining the loop to the active journey's range
- `detailJourneyIdRef` — mirror of `detailJourneyId` state, readable inside the rAF closure; read by `handlePlay` to compute `playEndRef` and the effective start year when entering detail play
- `lastActivatedRef` — `Set<string>` tracking which journeys have been auto-activated; prevents redundant `setActiveJourneys` calls on every frame

**Detail mode play constraint:** when `detailJourneyId` is set and Play is pressed, `handlePlay` reads `detailJourneyIdRef.current`, sets `playEndRef.current = journey.dateRange[1]`, and starts from `journey.dateRange[0]` unless `timelineYear` is already within the journey's range. Both the `startPlayLoop` tick and the `handleSpeedChange` tick clamp to `playEndRef.current` instead of the hardcoded global constant.

### Data

All map/journey/book/city data lives in `src/data/pauline-journeys-data.json`. The spec is `src/data/PAULS-WORLD-APP-SPEC.md`.

- `journeys` — 5 entries with `id`, `shortName`, `dateRange`, `color`, `waypoints[]`; each waypoint has `cityId`, `year`, `durationDays`, `note`, `ref`
- `books` — 13 entries with `id`, `abbrev`, `dateRange`, `attribution` (`"undisputed"` | `"debated"`), `dateDebated` (bool), `journeyId`
- `cities` — 57 entries with `id`, `coords [lon, lat]`, `tier` (1/2/3), `name`, `fullName`, `modernName`, `province`, `description`, `ref`
- `churchEvents` — 11 entries with `id`, `churchId`, `cityId`, `year`, `journeyId`, `label`, `sublabel`, `type`, `ref`; types: `"founding"`, `"letter-received"`, `"support"`, `"leadership"`
- `colorSystem` — journey color objects (`primary`, `dim`, `light`)
- `mapConfig` — projection center `[26, 37]`, scale `950`

Province boundaries from `public/provinces.geojson` (klokantech Roman Empire dataset, 53 features, `properties.name` in Latin). Fetched at runtime in App.jsx.

### MapView D3 pattern

The SVG is wrapped in a `div` (with `containerRef`) so React-managed tooltip overlays can be positioned absolutely over it. The `<svg>` itself fills the div via `width/height: 100%`.

Four separate `useEffect` hooks:

1. **Mount-only** — sets up `d3.zoom()` with `scaleExtent([0.5, 8])`. Zoom transform is applied to `mapGRef` (`<g>`); zoom k is stored in `kRef`. The zoom instance is stored in `zoomRef` for use by the progressive pan effect.
2. **Render effect** — runs on prop/data changes; calls `mapG.selectAll('*').remove()` (clears children only). Gives each journey path `class="journey-line" data-journey={id}` and primes `stroke-dasharray = "total total"`. After each path is drawn, precomputes arc-length at each waypoint using ternary-search (`getArcLengthAtPoint`) and stores the result in `lineDataRef.current[journey.id]`. Also appends invisible 12px-wide per-segment hit-target paths over each waypoint pair for distance hover. City dots get `class="city-dot" data-city={id}` and `mouseover`/`mouseout` handlers that set `tooltipCity` + `tooltipPos` state. Calls `applyZoomStyling` at the end.
3. **Progressive reveal effect** `[timelineYear, activeJourneys, isPlaying, cityById, projection]` — runs every frame during play (and on manual scrub). Updates `stroke-dashoffset` on each active journey path to `total − interpolatedArcLength`, dimming unreached city dots, and (throttled every 250 ms during play) pans the map to Paul's interpolated location via `d3.select(svgRef).transition('pan').duration(600).call(zoomRef.current.transform, ...)`.
4. **`[hoveredCityId]` glow effect** — imperatively finds the `.city-dot[data-city=hoveredCityId]`, raises it, applies `filter: url(#city-glow)` and gold stroke; clears glow on all other dots. Driven by `hoveredCityId` from App state, which is set by PaulStopTrack stop hover (timeline → map link).

`applyZoomStyling` is a module-level function shared by both effects. All labels scale inversely with k so they hold a constant screen size:
- Province labels: `font-size = 9/k`
- Tier-1 city labels: `font-size = 13/k` (base 13px)
- Tier-2 city labels: `font-size = 11/k`, visible at k ≥ 2
- Tier-3 city labels: `font-size = 9/k`, visible at k ≥ 3.5

**Zoom-aware strokes/dots:** `applyZoomStyling` also divides journey-line widths, city dot radii (+ their strokes, via `data-r0`/`data-sw0` attrs), graticule/border/coast/province-border/Via Egnatia widths by `k^0.6` (rendered size grows as `k^0.4` — lines stay lines under zoom, not ribbons), and keeps `.seg-hit` distance-hover targets screen-constant at `12/k`. All labels carry a `paint-order: stroke` halo (`haloColor`: dark `#0a1220`, light `#d3c9ae`) whose width scales `1/k` alongside the font.

**Basemap:** 50m atlas ships in the bundle for first paint; `countries-10m.json` (~3.5MB raw, code-split) lazy-loads via `requestIdleCallback` and swaps into the `land`/`borders` memos. The 10m land rings have inverted spherical windings (sum to 41 sr — d3-geo fills the sea), so `rewindRings` reverses any ring whose single-ring `geoArea > 2π`; note `topojson.feature` returns a *FeatureCollection* for world-atlas land, which `rewindRings` walks. **Gotcha:** rewound land fixes `geoPath` rendering but breaks `d3.geoContains` — the `segModes` classification must use the PRISTINE 50m feature (verified empirically both ways). A `.map-coast` stroke (theme-aware) outlines the land edge. Journey `lineGen` uses `curveCatmullRom.alpha(1)` (chordal) to avoid overshoot loops at sharp waypoint turns.

**Journey line system (per-segment):** each journey renders an invisible `.journey-spine` (full Catmull-Rom path — geometry carrier for arc lengths, sampling, and the Paul marker) plus one sampled sub-path per waypoint pair (`samplePath`, 6px steps). `segModes` (useMemo) classifies each pair sea/land by sampling 3 points along the straight lon/lat lerp with `d3.geoContains` against pristine 50m land. Land legs: solid `.journey-line` over a `.journey-case` casing (theme bg color, 3.6 width); sea legs: dashed `[4, 3.2]`, butt caps, no casing; post-rome: dashed `[8, 5]` throughout (traditional). Progressive reveal is per-segment via `revealStateFor` (journey state machine: null-year full / pre-start len 0 / completed op 0.18 / mid interpolated) + `applyRevealState`; solid segs reveal by dashoffset, dashed segs by `dashedRevealArray` (emits the dash pattern up to `visible`, then swallows the rest in a terminal gap — dashoffset can't truncate a pattern). `.route-chevron` direction markers sit every 85 map px (skipping ±16 of waypoints), rotated to the path tangent, transforms rebuilt in `applyZoomStyling` (`translate rotate scale(1/k^0.6)`), revealed once Paul passes them. `.paul-marker` (pulsing gold halo + core, `paulHalo` keyframes in index.css) rides `getPointAtLength(revealLen)` on the spine of the journey containing the current year; positioned by the progressive effect and replayed in the render effect via `timelineYearRef`.

**Journey line opacity:** two-mode system. Normal view: active journeys `stroke-opacity: 0.85`, inactive `0` (invisible). Book focus mode: the book's journey `0.3` full line + `0.9` highlighted segment; all other journeys `0` regardless of toggle state.

**City dot and label visibility:** only cities visited by at least one currently-active journey (or the selected book's journey) render with full dots and labels. All other journey cities render as ghost outlines only (`fill: none`, `stroke-opacity: 0.15`) with no label.

**`ScaleBar` component** (defined above `MapView`): a separate SVG overlay (`position: absolute, inset: 0, pointerEvents: none`) showing a 500 km reference bar at bottom-right. Pixel width computed from Haversine: `dLon` for 500 km at 37°N center latitude, projected to screen pixels. Styled in Cinzel 9px `#7a8ab0`.

**Haversine helper** `haversineKm([lon1,lat1], [lon2,lat2])` — module-level, returns integer km using Earth radius 6371 km. Used by segment hit targets to populate the distance tooltip.

Province name normalization: Italian admin regions named `"I"`–`"XI"` in GeoJSON all map to `"italia"`. `"Galatia et Cappadocia"` → `"galatia"`, `"Creta et Cyrene"` → `"creta-cyrenaica"`.

Via Egnatia road layer: rendered between the province group and the journey lines group. Three hardcoded waypoints `[19.47,41.32] → [24.29,41.01] → [26.67,41.67]` (Dyrrachium → Philippi → Byzantium). Dashed gold stroke at 25% opacity, 0.8px width. Label 'VIA EGNATIA' in Cinzel 9px letter-spacing 3 placed above the midpoint (Philippi). Always rendered; not affected by `showProvinces`.

**Tooltip overlays (React state, not D3):**
- `tooltipCity` / `tooltipPos` — set by city dot `mouseover`; renders `.city-tooltip` card with `name`, `modernName`, `description`, `ref`
- `segmentTip` — set by journey segment hit-target `mouseover`; renders a compact `.city-tooltip` card showing `From → To · ~N km`; suppressed when `tooltipCity` is active (city hover takes priority)

### TimelineBar D3 pattern

Six `useEffect` hooks:

1. **Mount-only** — builds scrubber DOM (line, tooltip pill, handle circle) inside `scrubGRef`; attaches `d3.drag()` to the SVG. Drag filter: `!event.target.closest('[data-book]')` so chip clicks don't start a drag. Click-without-drag (dx < 4px) toggles the scrubber on/off.
2. **`[timelineYear]`** — fast imperative update: moves the scrubber line/handle/tooltip without re-rendering everything.
3. **`[timelineYear]` clipPath effect** — updates each `<rect data-bar-clip={id}>` width inside the `<defs>` to `fullWidth × progress`, making capsule bars expand in real-time in sync with timelineYear.
4. **`[timelineYear, isPlaying]` book reveal effect** — hides/shows `<g data-book-group={id}>` wrappers. When a book's `dateRange[0]` is first crossed, triggers a D3 `transition('reveal')` (420 ms, easeCubicOut) animating `opacity 0→1` and `transform translate(0,-10)→translate(0,0)`. Uses `revealedBooks` ref to only animate newly-revealed books.
5. **Main render** `[activeJourneys, selectedBookId, highlightRange, onBookClick, isPlaying, detailJourneyId]` — clears and redraws everything at the *current* `bookStateRef` geometry (no animation). Creates `<defs>` with one `<clipPath id="pbw-bar-clip-{id}">` per journey plus the `#pbw-pole-mask` mask. Capsule bars live in `<g class="tl-bars">` (ghosted to 0.07 opacity in state 3). Each book's elements (pole, anchor dot, stem, chip rect, abbrev/name/date texts) are grouped under `<g data-book-group={id}>` with initial opacity/transform set based on current year. Also attaches `mousemove.dock`/`mouseleave.dock` handlers on the SVG for state-1 dock magnification.
6. **`[bookState]` transition effect** — mirrors `bookState` into `bookStateRef`, then runs a named `'bookState'` transition (650 ms, easeCubicInOut) morphing the SVG `viewBox`, `.tl-bars` / `.tl-anchor-line` opacity, and every book's chip rect / stem / pole / texts to the `getP`-derived geometry for the new state. First run (mount) sets the viewBox instantly and returns. The viewBox is **not** set via JSX — it is owned imperatively by this effect.

**4-state books system** (from `src/data/TIMELINE-BOOKS-4STATE-PROTOTYPE.md`): local `bookState` (0–3, default 1) replaces the old lollipop diamonds. State 0 = journey bars only; 1 = bars + flag dots (with stems, Apple-dock hover magnification); 2 = both rows, compact abbrev chips (width = date range, min 28); 3 = books only — full-name chips with date sublabels, bars ghosted, L-shaped flag poles (`polePath`) connecting each chip to its date anchor on the `SEP` line, passing behind chip bodies via `#pbw-pole-mask`. One rounded `<rect data-chip>` per book morphs across all states via `getP(b, s)`. Nav UI (`.tl-state-nav`: state label + 4 dots + Next button) renders as a sibling strip *above* the `.timeline-bar` card, hidden in detail mode. Card height is aspect-locked to the state's viewBox: `height = cardWidth × vbH/1200` (ResizeObserver feeds `tlWidth`), clamped to `H_MIN=[64,64,104,96]` / `H_MAX=[112,112,190,160]` so the overview scales uniformly (no stretch distortion; mild stretch only at clamped extremes), +68 when the story row is open; manual resize (`tlHeight`) overrides.

ViewBox per state (`VIEWBOXES`): `[0,0,1200,78]` for states 0/1, `[0,0,1200,150]` for state 2, `[0,75,1200,123]` for state 3. `preserveAspectRatio="none"`. xScale: `d3.scaleLinear().domain([44, 68]).range([80, 1140])`. Key layout constants: `TH=210`, `BY=24`, `BH=16` (bars `y=24–40`), `FAY=8`/`FBY=48` (flag dot rows), `AXIS_Y=62`, `SEP=78`, `ROUTE_Y=82`, `FDR=4` (7 on coarse pointers), state-2 chip rows `CR0_S2=88`/`CR1_S2=113` (`CH_S2=20`), state-3 rows `CR0_S3=106`/`CR1_S3=165` (`CH_S3=30`). Even-index books (`row=0`) use the upper row, odd-index the lower. The left "BOOKS" label is state-aware (`.tl-lbl-books`, y `110`/`150` in states ≤2/3). `S2_OFFSETS` staggers state-2 chips that stack exactly (same row + same date midpoint — Phil/Eph and Col/Phm) by ±16px so both labels and click targets stay exposed.

`S3_CHIPS` (module-level IIFE): state-3 chip layout with per-row collision resolution — chip width `max(dateRange px, name.length×6.5+26)`, then a forward push-right pass, right-boundary clamp + backward push-left pass, left-boundary clamp + final push-right pass (the boundary clamps are interleaved with the passes deliberately; clamping after both passes reintroduces overlap at the right edge — 1 Ti/2 Ti). Prison epistles (Phil/Eph at AD 60–62 row 0, Col/Phm row 1) are the main cluster this resolves.

Left-side section labels "TIMELINE" (centered over the bars/axis band) and "BOOKS" (centered in `y=78–210`) at `x=40` in Cinzel 7px `#7a8ab0`, separated by a `1px` rule at `y=SEP`.

Chip hover shows `name · date` in a pill tooltip (flips below the chip when the state's viewBox would clip it above). Chips are click targets for `onBookClick`; selection styling = gold stroke `#e9c86c` + boosted fill/stroke opacity.

**Crispness:** the overview SVG stretches (`preserveAspectRatio="none"`), so all stroked elements (chips, stems, poles, rings, axis/ticks/separators, scrubber, story-row markers) carry `vector-effect: non-scaling-stroke` — stroke widths are true screen px. Axis-aligned lines (axis, ticks, SEP, anchor line, stems, poles) add `shape-rendering: crispEdges`. State-1 flag dots have a `data-ring` circle (r `FDR+2.4`, journey color at 0.45) echoing the `.tl-state-dot` sequencer look; rings track dock magnification and fade out in other states.

### Timeline detail mode

Activated by clicking any capsule bar in the overview (`data-bar-hit` hit area). TimelineBar hides the overview SVG and renders `.tl-detail` in its place. `.timeline-bar--detail` expands the panel height to 320px.

`.tl-detail` (flex column):
- `.tl-mini-header` (30px) — "← Overview" breadcrumb + compressed mini overview strip (5 colored capsule rects) + journey name badge
- `TimelineDetail` (flex: 1) — contains all scrollable track content

`TimelineDetail` renders:
1. `PaulStopTrack` — duration-proportional stop segments inside `.pst-scroll` (70px fixed height, `overflow-x: auto`)
2. `.ct-pills` (32px) — toggle pills for each church that has `churchEvents` filtered to the active journey; pill color uses `--pill-color` CSS var set to `journey.color`
3. `.ct-tracks-area` (flex: 1, `overflow-y: auto`) — one `ChurchTrack` per active church ID

Receives `timelineYear` and `onCityHover` from `TimelineBar` and passes them through to `PaulStopTrack` and `ChurchTrack` respectively to drive the stop highlight, event pulse animations, and map city glow.

**Scroll sync:** `TimelineDetail` holds `bodyRef` on `.tl-detail-body` and a `syncingRef` flag. A `useEffect` (dependency: `activeChurchTracks`) queries `body.querySelectorAll('.pst-scroll, .ct-track-scroll')` after each render, attaches `scroll` listeners to all matched containers, and syncs `scrollLeft` across the rest on each event. `requestAnimationFrame` resets `syncingRef` after each sync batch to prevent feedback loops without blocking natural scroll events.

### PaulStopTrack

Stop width = `max(24px, durationDays/totalDays × 1100)`. City name above in Cinzel (`--pst-label-size`, default 10px, 8px at <900px viewport), duration below in Cormorant Garamond italic same size (gold if `durationDays > 90`). Short stops (< 3 days) hide labels until hover. Uses `buildStopLayout` from `src/utils/stopLayout.js`.

**Label collision:** `stops` useMemo runs a two-pass build — first pass computes widths, second pass marks each stop `colliding = true` when `stop.w === MIN_W` and at least one immediate neighbor also equals `MIN_W`. Colliding stops show a centered vertical tick mark instead of inline labels; labels appear normally on hover.

Accepts `timelineYear` and `onCityHover` props. Computes `currentStopIdx` (via `useMemo`) as the index of the stop whose dwell window brackets the current year: `wp.year ≤ timelineYear ≤ wp.year + durationDays/365`. The matching stop rect gets `fillOpacity=0.4 / strokeOpacity=0.85` (same as hover) — no match returns `-1` so no stop is highlighted (e.g. during transit or outside the journey range). Stop `onMouseEnter` calls `onCityHover(wp.cityId)`; `onMouseLeave` calls `onCityHover(null)` — this sets `hoveredCityId` in App, which MapView uses to glow the corresponding city dot.

### ChurchTrack

One SVG track (56px tall) per active church. Track line at y=28 in `#2e3858`. Church name in Cinzel 9px letter-spacing 2 at `#7a6430` above the track. Event marker types:
- `founding` — gold diamond, size 8
- `letter-received` — teal (`#4A7C6F`) diamond, size 7
- `support` — gold circle, size 5
- `leadership` — purple (`#7B6FA0`) circle, size 5

Labels alternate above/below by event index. Sublabel shown on hover. X positions derived from `buildStopLayout(journey).xFromYear(event.year)` — same function used by PaulStopTrack, so markers align temporally with Paul's stops above.

Accepts `timelineYear` prop. When the scrubber crosses a church event's year (forward only), that marker pulses once: the `<polygon>` or `<circle>` element gets class `ct-marker-pulse` which triggers a 600ms CSS `scale(1 → 1.8 → 1)` animation (`transform-box: fill-box; transform-origin: center`). Implementation uses three refs — `prevYearRef` (last year seen), `pulsedRef` (Set of event IDs already fired this forward pass, cleared per-event when scrubbing backward past them) — and a `pulsing` state Set that holds IDs of currently-animating markers; each ID is removed via `setTimeout` at 700ms. Scrubbing backward resets `pulsedRef` entries for events whose year is now in the future so they can re-pulse.

### stopLayout utility (`src/utils/stopLayout.js`)

Shared by PaulStopTrack and ChurchTrack. `buildStopLayout(journey)` returns:
- `stops` — array of `{wp, x, w}` with accumulated x positions
- `totalWidth` — total SVG pixel width (same value used for both `<svg width>` attributes, ensuring identical coordinate space)
- `xFromYear(year)` — converts a fractional AD year to an x pixel position by interpolating within the waypoint that contains the year, or within the gap between waypoints for transit periods

Constants: `STOP_MIN_W=24`, `STOP_GAP=2`, `STOP_MARGIN_X=8`, scale factor `1100`.

### PlayControls

Collapsible panel rendered below `TimelineBar` as a sibling of `.app-body`. Default state is **collapsed** — only a small `.pc-toggle` tab is visible (18px pill with `border-radius: 0 0 8px 8px`, hanging below the timeline border). Clicking the tab expands the full card via a `max-height` CSS transition (`0 → 80px`, 0.28s cubic-bezier).

Local state only: `isOpen` (`useState(false)`) lives entirely in `PlayControls.jsx` — no changes to App.jsx required for open/close.

**Toggle tab** (`.pc-toggle`): shows "PLAY" label in Cinzel 8px + a caret chevron that flips direction when open. While `isPlaying`, gains `.pc-toggle--active` (gold tint, `border-color: rgba(201,168,76,0.4)`) and a pulsing `.pc-dot` (4px gold circle, `pcDotPulse` keyframe animation).

**Expanded card** (`.pc-card`): dark pill `rgba(19,24,42,0.95)`, `border: 1px solid rgba(201,168,76,0.35)`, `border-radius: 6px`. Contains:
- `.pc-rewind` — icon button (back-arrow + vertical bar SVG), calls `onReset`
- `.pc-playbtn` — 42px gold circle (`background: var(--accent)`); triangle SVG when paused, dual-rect pause bars when playing; `.pc-playbtn--playing` adds `box-shadow: 0 0 14px rgba(201,168,76,0.45)` glow
- `.pc-speeds` — row of three `.pc-speed` pills (`½×`, `1×`, `2×`); active pill gets `.pc-speed--active` (gold background)

Props: `isPlaying`, `playSpeed`, `onPlay`, `onPause`, `onReset`, `onSpeedChange`.

### BookDetailPanel

Absolutely positioned over the right edge of `.map-container`. Always in the DOM; CSS `transform: translateX(100%)` hides it when no book is selected; `.bdp--open` (`translateX(0)`) slides it in with a 0.25s ease transition. Width 320px, full map height. Receives `book` (full object or null) and `onClose`. Looks up writing city and recipient cities from `journeyData.cities` internally.

Sections rendered when open: close button → book name (Cinzel 28px gold) → date badge → writing city + province → recipient chips (teal) → theme (italic) → key verse block (green left border) → attribution note (debated books only).

### FilterPanel layout

Positioned `absolute` inside `.map-container` (top-left, `12px` inset). Width 240px, auto height, `max-height: calc(100% - 24px)`, `overflow-y: auto`. Background `rgba(19,24,42,0.92)` with `border: 1px solid var(--border-lt)` and `border-radius: 4px`. `z-index: 20` (above map SVG and BookDetailPanel). Does not affect map layout — map SVG always fills the full container.

Below both view-mode sections, always visible: a thin `fp-layer-divider` border followed by an `fp-layer-row` checkbox labeled "Provincial Boundaries" with a gold square swatch (`fp-province-swatch`). Toggles `showProvinces` in App.jsx.

### Styles

- `src/styles/tokens.css` — CSS custom properties for colors, fonts, journey colors (`--j1`–`--j-pst`), city colors
- `src/index.css` — imports tokens, base reset, layout (`.app`, `.app-header`, `.app-body`, `.map-container`, `.timeline-bar`), all `fp-*` FilterPanel styles, all `bdp-*` BookDetailPanel styles, all `pc-*` PlayControls styles, all `tl-*` timeline detail styles, all `ct-*` church track styles including `@keyframes ctMarkerPulse` and `.ct-marker-pulse` (scale 1→1.8→1 over 600ms, `transform-box: fill-box`), `.city-tooltip` and child classes (`.city-tooltip__name`, `__modern`, `__desc`, `__ref`) for city and segment distance tooltips. `.map-container > div` and `.map-container > div > svg` replace the old `> svg` selectors since MapView now wraps its SVG in a container div.
- `src/utils/stopLayout.js` — `buildStopLayout(journey)` shared utility for duration-proportional x layout
- Google Fonts: Cinzel (display/headings), Cormorant Garamond (serif), Lora (body) — linked in `index.html`
- `public/icons.svg` — SVG sprite sheet (referenced via `<use href="/icons.svg#...">` if needed)
