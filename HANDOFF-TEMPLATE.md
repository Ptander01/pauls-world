# Handoff Template — Building a "Paul's World"-Style Bible Atlas App

**What this is:** a complete architectural handoff for Paul's World (interactive map + timeline
+ events app for Paul's missionary journeys), written so it can seed a **sister app** on the
same engine — first target: **Jesus's life and ministry in the Gospels**. Keep this file in the
new repo's root and give it to whoever (or whatever) builds it.

**Fastest path:** fork/copy the `pauls-world` repo, rename, then swap the data file, the
domain constants (§7 checklist), and the copy. Roughly 80% of the engine is domain-agnostic.
The remaining 20% is listed explicitly below so nothing bites you.

---

## 1. The product in one paragraph

A single-page app with three synchronized surfaces: a **D3 map** (antique-atlas aesthetic,
journey routes revealed progressively), a **timeline bar** (journey capsule bars + a 4-state
progressive-disclosure "books" system + drill-down Gantt swim lanes), and a **story layer**
(a prominent Play button that animates the whole arc — the map pans with the protagonist, a
glass caption card narrates each stop from waypoint notes, letters/events appear as they
happen). Everything is driven by one JSON data file; a fractional-year scrubber
(`timelineYear`) is the single clock that all three surfaces observe.

## 2. Stack

- React 19 + Vite 8, **JSX only** (no TypeScript)
- `d3` v7 (all map/timeline rendering), `topojson-client`, `world-atlas` (Natural Earth)
- No test suite; `npm run dev` (HMR), `build`, `preview`, `lint`
- Google Fonts: **Cinzel** (display), **Cormorant Garamond** (serif italic), **Lora** (body)
- Dark theme default + full light ("parchment") theme via `data-theme` attribute +
  CSS custom properties in `src/styles/tokens.css`

## 3. Architecture

```
App.jsx                     — ALL cross-surface state lives here (see §5)
└── .map-container
    ├── FilterPanel.jsx     — journey toggles + book pills (drawer on mobile)
    ├── MapView.jsx         — the D3 map (see §4a)
    ├── StoryLayer.jsx      — "▶ Play" entry pill ⇄ narration caption card
    └── BookDetailPanel.jsx — slide-in right panel for the selected book/event
TimelineBar.jsx             — overview timeline + 4-state books system (see §4b)
└── TimelineDetail.jsx      — drill-down: PaulStopTrack + ChurchTrack swim lanes
PlayControls.jsx            — collapsible play/pause/speed strip
SearchBar.jsx, ThemeToggle.jsx
```

**The golden rule:** `timelineYear: number | null` in App is the universal clock.
`null` = idle (full routes shown, story button visible). A number = scrubbing/playing
(routes reveal up to that year, caption card tracks the protagonist, letters pop in).
Every surface derives its state from it; none owns it.

**Play loop:** `requestAnimationFrame` loop in App advances `timelineYear` at
1.5 s/year × speed (½/1/2×). Values needed inside the rAF closure are mirrored into
refs (`playSpeedRef`, `detailJourneyIdRef`, etc.) to dodge stale closures. Drill-down
mode constrains the loop to that journey's date range.

## 4a. MapView — the patterns that matter

- **SVG in a wrapper div** so React-managed tooltips can overlay it. Four effects:
  mount-only zoom setup, full render (clears + redraws on prop change), a per-frame
  progressive-reveal effect keyed on `timelineYear`, and a hover-glow effect.
- **Zoom philosophy:** `d3.zoom` transform on a `<g>`; a module-level
  `applyZoomStyling(el, k)` rescales everything each zoom tick:
  labels hold constant screen size (`font 1/k`, halo width `1/k`), strokes/dots divide
  by `k^0.6` (rendered size grows as `k^0.4` — lines stay lines, never ribbons),
  hover hit-targets stay screen-constant (`12/k`).
- **Label halos:** every map label gets `paint-order: stroke` with a theme-aware halo
  color between the land and sea tones. Cheap, transformative for legibility.
- **Basemap:** 50m atlas in the bundle for first paint; `countries-10m.json` (own
  ~1MB-gzip chunk) lazy-loads via `requestIdleCallback` and swaps in. A `.map-coast`
  stroke sharpens the land edge.
- **Journey line system (per-segment):** each journey has an invisible `.journey-spine`
  (full Catmull-Rom `alpha(1)` path — the geometry carrier) plus one **sampled sub-path
  per waypoint pair** (6px steps, preserves the curve). Sea legs render dashed `[4,3.2]`,
  land legs solid over a background-color **casing** (3.6 width) — classic atlas style.
  A "traditional/uncertain" journey renders dashed `[8,5]` throughout.
  Sea/land is **auto-classified** by sampling 3 points per pair with `d3.geoContains`
  against the 50m land (see gotcha G2!).
- **Progressive reveal:** per-segment. Solid legs reveal by `stroke-dashoffset`; dashed
  legs by a **constructed dasharray** (pattern emitted up to the reveal front, then one
  giant terminal gap — dashoffset alone cannot truncate a dash pattern). A journey state
  machine (`revealStateFor`) handles idle/pre-start/in-progress/completed(0.18 ghost).
- **Direction chevrons** every ~85 map px along the spine (skip ±16 near waypoints),
  rotated to the path tangent, revealed as the protagonist passes them.
- **Protagonist marker:** pulsing gold halo + core riding
  `spine.getPointAtLength(revealLen)` of whichever journey contains the current year.
- Map **pans to follow** the protagonist during play (throttled 250ms, 600ms eased).

## 4b. TimelineBar — the patterns that matter

- One stretched SVG (`preserveAspectRatio="none"`) — but the card height is
  **aspect-locked**: `height = cardWidth × viewBoxHeight / 1200` via ResizeObserver,
  clamped per state. This kills stretch distortion (see gotcha G4).
- **Crispness:** every stroked element carries `vector-effect: non-scaling-stroke`
  (true screen-px widths under any stretch/animation); axis-aligned lines add
  `shape-rendering: crispEdges`.
- **4-state books system** (progressive disclosure, local `bookState` 0–3):
  0 journey bars only → 1 flag dots on the bars (ringed like the state-nav dots,
  Apple-dock hover magnification) → 2 compact abbrev chips (width = date range) →
  3 full-name chips with date sublabels, bars ghosted, L-shaped flag poles to a date
  anchor line (poles pass behind chips via an SVG mask). **One `<rect>` per book morphs
  through all four states** via a `getP(book, state)` geometry function + a named d3
  transition that also morphs the SVG viewBox (owned imperatively — never set viewBox
  from JSX, React will stomp the animation).
- Chip collision: state-3 chips get per-row push-apart passes with boundary clamps
  **interleaved** between passes (clamping after both passes reintroduces overlap at
  the edges). Exact-stack pairs in state 2 get a small ±16px stagger.
- **Story row** (when a book/event is selected): every touchpoint for that
  book's city across all journeys on one thread — founding diamond, visit circles
  (sized by stay length), letter markers — plus a labeled gap bracket
  ("planted AD 50 · letter ~11 yrs later") or an origin note when the protagonist
  didn't found that community.
- **Drill-down detail mode** (click a capsule bar): duration-proportional stop
  segments (`PaulStopTrack`) + toggleable per-community event swim lanes
  (`ChurchTrack`), all sharing one x-layout util (`buildStopLayout`) and scroll-synced
  horizontally. Markers pulse once when the scrubber crosses them (forward only).
- Books reveal with a 420ms drop-in when the play head crosses their start year.

## 5. The data file — your real template

Everything lives in `src/data/<domain>-data.json`. Shapes:

```jsonc
{
  "journeys": [{               // → ministry periods for the Gospels app
    "id": "journey-2", "shortName": "2nd Journey",
    "dateRange": [49, 52], "color": "#4A7C6F",
    "waypoints": [{
      "cityId": "thessalonica", "year": 50.1, "durationDays": 21,
      "note": "Three Sabbaths in the synagogue; 'turned the world upside down'",
      "ref": "Acts 17:1–9"     // notes+refs power the story captions — write them well!
    }]
  }],
  "books": [{                  // → marquee events/discourses for the Gospels app
    "id": "1-corinthians", "abbrev": "1 Co", "name": "1 Corinthians",
    "dateRange": [53, 55], "attribution": "undisputed",  // or "debated" (renders italic)
    "dateDebated": false, "journeyId": "journey-3",
    "writingLocationId": "ephesus", "recipientCityIds": ["corinth"],
    "theme": "...", "keyVerse": "..."
  }],
  "cities": [{ "id": "...", "coords": [lon, lat], "tier": 1,   // 1/2/3 = zoom visibility
    "name": "...", "modernName": "...", "province": "...", "description": "...", "ref": "..." }],
  "churchEvents": [{           // → per-site events (miracles/teachings) for Gospels
    "id": "...", "churchId": "...", "cityId": "...", "year": 50.5, "journeyId": "...",
    "label": "Church Founded", "sublabel": "...", "type": "founding", "ref": "..." }],
    // types: founding | letter-received | support | leadership → remap freely
  "colorSystem": { "journey1": { "primary": "...", "dim": "...", "light": "..." } },
  "mapConfig": { "center": [26, 37], "scale": 950 }
}
```

Plus `public/provinces.geojson` (region boundaries, fetched at runtime, gold-tinted
fill for regions the protagonist visited).

## 6. Design system

- Tokens in `tokens.css`: dark navy surfaces (`#0c0f18` bg, `#13182a` surface), gold
  accent family (`#c9a84c` / `#7a6430` / `#e9c86c`), cream text, plus a full light
  ("parchment") override block. Journey colors: gold/teal/purple/red/blue.
- **Glass/lip system** (reused everywhere — keep it): `--glass-blur` backdrop-filter
  cards, `--pill-bg` gradient pills, and the 3-D `--lip-out` / `--lip-in` /
  `--lip-hover` / `--lip-in-gold` box-shadow stack for raised/pressed states.
- SVG depth: `pbw-chip-shadow` (drop shadow), `pbw-chip-glow` (gold selection glow),
  `pbw-chip-sheen` (luminance-only white→black gradient overlay so the journey hue
  stays true). Light theme needs explicit `[data-theme="light"]` overrides for every
  glass card — grep the bottom of `index.css` for the established pattern.

## 7. Domain-constant checklist (everything hardcoded to Paul)

Change ALL of these for the new domain:

- [ ] `xScale` domain `[44, 68]` and `YEAR_TICKS` (TimelineBar)
- [ ] `PLAY_START = 44`, `PLAY_END = 67` (App), and the 1.5 s/year pacing
      (a 3–4-year ministry wants ~8–15 s/year, or think in months)
- [ ] `mapConfig` projection center `[26, 37]` scale `950` — and the duplicated
      `d3.geoMercator()` in MapView
- [ ] `BOOK_CHURCH` map (book → community) and `ORIGIN_NOTES` (TimelineBar)
- [ ] Via Egnatia road overlay (hardcoded waypoints in MapView) → swap for era roads
- [ ] `getPaulLocationAtYear` / `getPlayZoom` helpers, `paulNote` scrubber label
- [ ] `INTRO_BEAT` in StoryLayer (pre-first-waypoint caption)
- [ ] App title, header, `index.html` `<title>`, favicon
- [ ] `provinces.geojson` → new region dataset + `normalizeProvinceName` map
- [ ] The 900px-breakpoint CSS media queries were superseded by aspect-locked heights;
      audit any leftovers

## 8. Hard-won gotchas — read before debugging anything

- **G1 · world-atlas 10m winding:** the 10m land rings are wound inverted (they sum to
  41 steradians; d3-geo fills the SEA as land — invisible on a dark theme, glaring on
  light). Fix: rewind any ring whose single-ring `geoArea > 2π`. And note
  `topojson.feature` returns a **FeatureCollection** (not a Feature) for world-atlas land.
- **G2 · rewound ≠ containable:** the rewound data fixes `geoPath` *rendering* but
  **breaks `d3.geoContains`** (returns true everywhere). Render with rewound, classify
  with the PRISTINE 50m feature. Verified empirically both directions.
- **G3 · dashed progressive reveal:** `stroke-dashoffset` shifts a dash pattern, it
  cannot truncate one. Reveal dashed lines by constructing the dasharray: emit the
  pattern up to the visible length, then append/extend one gap ≥ the remainder.
- **G4 · stretched SVGs:** `preserveAspectRatio="none"` + fixed pixel heights =
  funhouse distortion at most window widths. Aspect-lock the container height to the
  viewBox (ResizeObserver), and put `vector-effect: non-scaling-stroke` on every
  stroked element (+ `crispEdges` on axis-aligned lines).
- **G5 · viewBox ownership:** if a d3 transition animates the viewBox, do NOT also set
  it from JSX — React re-renders snap it and kill the morph. One owner, imperative.
- **G6 · rAF closures:** anything read inside the play loop needs a ref mirror
  (assigned in a `useEffect`, not during render — the React Compiler lint forbids
  render-time ref writes).
- **G7 · collision clamps:** in push-apart label/chip layout, interleave boundary
  clamps between the forward/backward passes; clamping once at the end reintroduces
  overlap at the edges.
- **G8 · Sea of Galilee (new for the Gospels app):** Natural Earth *land* does not
  carve out inland lakes, so `geoContains` auto-classification will call boat
  crossings "land." Add an optional per-waypoint override (e.g. `"legMode": "sea"`)
  and honor it before the auto-classifier — the storm crossing deserves its dashes.
- **G9 · dev-tooling quirk:** the Claude preview browser can freeze
  `requestAnimationFrame` (kills d3 transitions + the play loop while effects still
  run). Verify via attribute reads and forced re-renders, not by watching animations.

## 9. Suggested Gospels mapping ("Jesus's World")

| Paul's World | Gospels app |
|---|---|
| 5 journeys, AD 44–67 | Ministry periods, ~AD 26–30 (or 29–33): **1** Preparation & Early Ministry (baptism → Cana → early Judea) · **2** Great Galilean Ministry (Capernaum HQ, circuits, Sermon on the Mount) · **3** Withdrawals & Beyond (Tyre/Sidon, Decapolis, Caesarea Philippi, Transfiguration) · **4** Later Judean & Perean (Lazarus, Zacchaeus) · **5** Passion Week (day-resolution!) · **6** Resurrection Appearances — rendered dashed, exactly like post-Rome |
| 13 letters (books system) | ~13 marquee events/discourses as the 4-state chips: Sermon on the Mount, Feeding 5,000, Confession at Caesarea Philippi, Transfiguration, Lazarus, Triumphal Entry, Olivet Discourse, Last Supper… `dateDebated` italic = chronology disputes (John's early temple cleansing vs. the synoptics' late one is *made* for this) |
| `attribution` undisputed/debated | Attestation: in all four gospels vs. single-gospel |
| Antioch home base | Capernaum ("his own city," Mt 9:1) |
| Cities (57) | Nazareth, Capernaum, Bethsaida, Chorazin, Cana, Nain, Magdala, Sychar, Jerusalem, Bethany, Bethlehem, Jericho, Emmaus, Caesarea Philippi, Tyre, Sidon, Gerasa… |
| churchEvents per church | Per-site event tracks: healings, parables taught there, "woe" oracles (Chorazin!), resurrection appearances |
| Provinces (Roman) | Herodian tetrarchies: Galilee (Antipas), Judea (Pilate), Iturea/Trachonitis (Philip), Samaria, Decapolis, Perea |
| Via Egnatia | Via Maris + the Jordan-valley pilgrim road |
| Sea voyages (dashed) | Sea of Galilee crossings (see G8) |
| Story mode AD 44→67 | The killer feature: Passion Week at day granularity — the caption cards were built for this |
| BookDetailPanel | Event panel: passage refs per gospel, theme, key verse |
| Story-row bracket | e.g. "first visited AD 27 · 'woe' pronounced AD 29" site histories |

Map framing: projection center ≈ `[35.5, 31.9]`, scale ≈ `9000–12000` (the whole drama
fits in ~200 km — the 10m coastline swap matters even more here). Consider month
ticks on the timeline with Passovers (John 2:13, 6:4, 11:55) as the anchor years.

## 10. Recommended build order (fresh repo)

1. Data file first — periods, ~25 sites, waypoints **with notes + refs** (they power everything)
2. Basemap + projection + provinces/tetrarchies (incl. G1/G2 handling from day one)
3. Journey/period lines with per-segment sea/land + reveal machinery
4. TimelineBar overview: capsule bars + scrubber + aspect-locked heights
5. Play loop + StoryLayer captions (instant wow, validates the data quality)
6. 4-state events system on the timeline
7. Detail mode swim lanes, search, theme toggle, detail panels — in any order

*Generated from the pauls-world codebase as of commit `fb4dc8f` (July 2026). The
companion docs in that repo — `CLAUDE.md` (architecture reference) and
`src/data/TIMELINE-BOOKS-4STATE-PROTOTYPE.md` (4-state design math) — go deeper on
anything summarized here.*
