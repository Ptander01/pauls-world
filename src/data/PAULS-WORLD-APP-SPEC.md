# Paul's World — Interactive Pauline Journey Map
## App Specification & Claude Code Handoff Document

---

## Vision

An interactive web application that maps all of Paul's missionary journeys and letters spatially and temporally. A user can filter by journey, select any of the 13 Pauline epistles to see the writing location, recipient cities, and relevant journey context simultaneously, and scrub a timeline to watch Paul's location animate across the map. The aesthetic matches the existing Philippians suite: dark navy, gold, Cinzel/Cormorant Garamond/Lora typefaces, historical-cartographic feel.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + Vite | Clean state management for timeline ↔ map sync; fast dev cycle |
| Map | D3 v7 + topojson-client | Same approach as working Philippians map; full projection control |
| Geographic data | Natural Earth 50m (npm) | Accurate at this scale; `npm install world-atlas` |
| Province data | klokantech Roman Empire GeoJSON | Free, open, accurate, downloadable |
| Styling | Tailwind CSS + CSS variables | Utility classes for layout; CSS vars for the design tokens |
| Build / Deploy | Vite → Vercel | Patrick's existing workflow |

**Do not use:** Leaflet, Mapbox, Google Maps, external tile servers. Stay D3 + SVG for full aesthetic control.

---

## Project Scaffold

```bash
npm create vite@latest pauls-world -- --template react
cd pauls-world
npm install d3 topojson-client world-atlas
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### File Structure

```
pauls-world/
├── public/
│   └── provinces.geojson          # Roman provincial boundaries (download separately — see below)
├── src/
│   ├── data/
│   │   └── pauline-journeys-data.json   # The compiled data file (provided)
│   ├── components/
│   │   ├── App.jsx                # Root: state + layout
│   │   ├── MapView.jsx            # D3 SVG map
│   │   ├── TimelineBar.jsx        # Horizontal scrubber timeline
│   │   ├── FilterPanel.jsx        # Journey checkboxes + Book selector
│   │   ├── CityTooltip.jsx        # Hover tooltip
│   │   └── BookDetailPanel.jsx    # Right-side book info panel
│   ├── hooks/
│   │   ├── useMapProjection.js    # D3 projection setup, shared
│   │   └── useProvinces.js        # Load + parse province GeoJSON
│   ├── utils/
│   │   ├── journeyHelpers.js      # Get waypoints for year, get cities for book, etc.
│   │   └── animationHelpers.js    # Letter route animation, scrubber pulse
│   ├── styles/
│   │   └── tokens.css             # Design tokens (same as Philippians suite)
│   ├── index.css
│   └── main.jsx
├── package.json
└── vite.config.js
```

---

## Province Data Setup

Download the Roman Empire provinces GeoJSON before building:

```bash
# In the project root:
curl -o public/provinces.geojson \
  "https://raw.githubusercontent.com/klokantech/roman-empire/master/data/provinces.geojson"
```

**Province field to use:** The GeoJSON `properties.name` field contains the province name in Latin. Cross-reference the `provinces.relevantProvinces[].id` in the data file to match. Some name mismatches are expected — write a normalize function:

```javascript
// utils/journeyHelpers.js
export function normalizeProvinceName(rawName) {
  const map = {
    'Asia': 'asia',
    'Macedonia': 'macedonia',
    'Achaia': 'achaia',
    'Syria': 'syria',
    'Galatia': 'galatia',
    'Cilicia': 'cilicia',
    'Cyprus': 'cyprus',
    'Italia': 'italia',
    // add others after inspecting the downloaded GeoJSON properties
  };
  return map[rawName] || rawName.toLowerCase().replace(/\s+/g, '-');
}
```

**Province rendering style:**
- Provinces Paul visited: `fill: #c9a84c, opacity: 0.07`
- Provinces Paul passed through (sea routes only): `fill: #a09a8e, opacity: 0.04`
- Province borders: `stroke: #c9a84c, stroke-width: 0.8, opacity: 0.25`
- Province labels: Cinzel 9px, `fill: #c9a84c, opacity: 0.3`, centered on polygon centroid

---

## App State (App.jsx)

```javascript
// All state lives in App.jsx and is passed down as props
const [activeJourneys, setActiveJourneys] = useState(
  new Set(['journey-1','journey-2','journey-3','rome-journey','post-rome'])
);
const [selectedBookId, setSelectedBookId]   = useState(null);  // one book at a time
const [timelineYear, setTimelineYear]       = useState(null);  // null = no scrubber active
const [hoveredCityId, setHoveredCityId]     = useState(null);
const [viewMode, setViewMode]               = useState('journeys'); // 'journeys' | 'books'
const [provincesGeo, setProvincesGeo]       = useState(null);  // loaded GeoJSON
```

**State relationships:**
- `selectedBookId` → derives `highlightedCityIds` (writing location + recipients)
- `selectedBookId` → derives `activeJourneySegment` (journey segment ± 1 year around book date)
- `timelineYear` → derives `paulLocationAtYear` (interpolated city or segment)
- `activeJourneys` → which journey lines to render on map

---

## Component Specs

### MapView.jsx

The D3 SVG map. Accepts props, never manages global state directly.

**Props:**
```typescript
{
  activeJourneys: Set<string>,
  selectedBookId: string | null,
  timelineYear: number | null,
  hoveredCityId: string | null,
  onCityHover: (cityId: string | null) => void,
  onCityClick: (cityId: string) => void,
  provincesGeo: GeoJSON | null,
}
```

**Layer rendering order (bottom to top):**
1. Ocean background rect `fill: #060d1a`
2. Ocean grid (lat/lon lines at 5° intervals, `stroke: #0c1828, opacity: 0.5`)
3. Land masses (Natural Earth 50m countries, `fill: #111d2e, stroke: #1a2840`)
4. Country borders (50m mesh, `stroke: #1e2e48, 0.7px`)
5. Province fills (from `provincesGeo`, `fill: #c9a84c, opacity: 0.07` for visited)
6. Province borders (`stroke: #c9a84c, 0.8px, opacity: 0.25`)
7. Province labels (centroid-anchored, Cinzel 9px)
8. Journey lines (one per active journey, colored per `colorSystem`)
9. Active journey segment highlight (brighter stroke when book is selected)
10. Letter route animation (writing → recipient, plays on book select)
11. City dots (tier1=10px, tier2=7px, tier3=4.5px)
12. Paul's current location pulse dot (when `timelineYear` is active)
13. City labels (Cinzel: always for tier1, hover-only for tier2-3)
14. Legend (bottom-left)

**Projection:**
```javascript
const projection = d3.geoMercator()
  .center([23, 38])
  .scale(950)
  .translate([W/2, H/2]);
// ViewBox: 0 0 1200 680
// Covers approx. -6°E to 42°E, 29°N to 48°N
// Confirms: Rome (12.5°E), Antioch (36.2°E), Jerusalem (35.2°E) all within view
```

**Journey line rendering:**
```javascript
const lineGen = d3.line()
  .x(d => proj(getCityById(d.cityId).coords)[0])
  .y(d => proj(getCityById(d.cityId).coords)[1])
  .curve(d3.curveCatmullRom.alpha(0.5));

// For each active journey:
// - Full path: dim (opacity 0.35), dashed when no book selected
// - Highlighted segment: bright (opacity 0.9), solid, +1.5px wider, for book context
// - Inactive journeys: very dim (opacity 0.12)
```

**Book selection → map behavior:**
```javascript
function handleBookSelect(bookId) {
  const book = data.books.find(b => b.id === bookId);

  // 1. Pulse the writing location city (gold glow ring)
  setHighlightedCity(book.writingLocationId, 'writing');

  // 2. Highlight recipient cities (teal glow ring)
  book.recipientCityIds.forEach(id => setHighlightedCity(id, 'recipient'));

  // 3. Animate letter route: writing location → first recipient
  animateLetterRoute(book.writingLocationId, book.recipientCityIds[0]);

  // 4. Dim all journeys except the relevant one
  // Show only the journey segment within book.dateRange ± 1.5 years at full brightness
  setActiveSegment(book.journeyId, book.dateRange[0] - 0.5, book.dateRange[1] + 0.5);

  // 5. Timeline: highlight the book's date range in gold
  setTimelineHighlight(book.dateRange);
}
```

**Timeline scrubber → map behavior:**
```javascript
function getPaulLocationAtYear(year, data) {
  // Find which journey contains this year
  const journey = data.journeys.find(j =>
    year >= j.dateRange[0] && year <= j.dateRange[1]
  );
  if (!journey) return null;

  // Find bracketing waypoints
  const wps = journey.waypoints;
  const before = [...wps].reverse().find(w => w.year <= year);
  const after  = wps.find(w => w.year > year);
  if (!before) return null;
  if (!after) return data.cities.find(c => c.id === before.cityId).coords;

  // Linear interpolation between two cities
  const t = (year - before.year) / (after.year - before.year);
  const [ax, ay] = data.cities.find(c => c.id === before.cityId).coords;
  const [bx, by] = data.cities.find(c => c.id === after.cityId).coords;
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}
```

**Paul's location pulse dot (CSS animation):**
```css
@keyframes paulPulse {
  0%, 100% { r: 8; opacity: 1; }
  50%       { r: 16; opacity: 0.3; }
}
.paul-pulse { animation: paulPulse 1.4s ease-in-out infinite; }
```

---

### TimelineBar.jsx

Horizontal timeline spanning AD 33–68. Two visual tracks above the axis line.

**Props:**
```typescript
{
  activeJourneys: Set<string>,
  selectedBookId: string | null,
  timelineYear: number | null,
  onYearChange: (year: number | null) => void,
  onBookClick: (bookId: string) => void,
  highlightRange: [number, number] | null,
}
```

**SVG Layout (viewBox: 0 0 1200 160):**
```
y=10–50:   Journey span bars (colored rectangles per journey)
y=65:      Horizontal axis line
y=67–105:  Book event diamonds (positioned at midpoint of dateRange)
y=112–130: Year labels: 33, 36, 40, 46, 49, 52, 57, 60, 62, 67
y=50–120:  Scrubber (vertical line + draggable handle)
```

**Year scale:**
```javascript
const xScale = d3.scaleLinear().domain([33, 68]).range([80, 1140]);
```

**Journey span bars:**
```javascript
// For each journey: colored rect from dateRange[0] to dateRange[1]
// Dim to 30% opacity if not in activeJourneys
// Post-Rome bar: dashed stroke-dasharray to indicate uncertainty
// Hover: show journey name tooltip
```

**Book diamonds:**
```javascript
// Position: x = xScale((dateRange[0] + dateRange[1]) / 2)
// Shape: <polygon> rotated 45°, 11px
// Color: match the journey color for that book
// Label: abbreviation, Cinzel 8px, above or below alternating
// Debated date books: thin error bar showing full dateRange span
// Click: call onBookClick(bookId)
// Selected: bright fill + gold ring
```

**Scrubber:**
```javascript
// D3 drag behavior on a circle handle
// On drag: setTimelineYear(xScale.invert(event.x))
// On drag end with click (no drag): setTimelineYear(null) to clear
// Tooltip above handle: "AD 50 · Corinth (Acts 18)"
// The scrubber line: full-height vertical rule, gold dashed
```

---

### FilterPanel.jsx

Left sidebar panel, 260px wide.

**Props:**
```typescript
{
  activeJourneys: Set<string>,
  selectedBookId: string | null,
  viewMode: 'journeys' | 'books',
  onJourneyToggle: (journeyId: string) => void,
  onBookSelect: (bookId: string | null) => void,
  onViewModeChange: (mode: string) => void,
}
```

**Journey mode:**
- Toggle buttons: "Journeys" | "Books" (top of panel)
- Select All / Clear All link
- One row per journey: colored dot, name, date range, checkbox
- Post-Rome: italic label + "(traditional)" annotation in muted text

**Book mode:**
- Book grid: 2–3 columns of pills
- Each pill: abbreviation + small colored dot
- Italic pills = debated attribution
- Click to select (click again to deselect)
- Attribution legend at bottom of panel

---

### BookDetailPanel.jsx

Slides in from the right when a book is selected (or expands as a panel section below FilterPanel on narrower views).

**Content sections:**
1. Book name (Cinzel 28px, gold)
2. Date range badge ("AD 56–57")
3. Writing location (city name link, province, journey badge)
4. Recipients (city name chips, green)
5. Theme (italic, 14px)
6. Key verse (verse block, green left border)
7. Attribution note (if debated, muted italic)
8. Scripture reference (Cinzel, small)
9. "Clear selection ×" button

---

### CityTooltip.jsx

Follows mouse position. Renders on `hoveredCityId` change.

**Content:**
- City name (Cinzel 12px uppercase, gold)
- Full name + modern name (italic muted)
- Province name
- Paul's visits: list of journey names + year + brief note
- Written here: book names (gold pills)
- Received here: book names (teal pills)
- Scripture reference

---

## Key Utility Functions

```javascript
// utils/journeyHelpers.js

export function getCityById(cityId, data) {
  return data.cities.find(c => c.id === cityId);
}

export function getCitiesForJourney(journeyId, data) {
  const journey = data.journeys.find(j => j.id === journeyId);
  return [...new Set(journey.waypoints.map(w => w.cityId))]
    .map(id => getCityById(id, data));
}

export function getJourneysForCity(cityId, data) {
  return data.journeys.filter(j =>
    j.waypoints.some(w => w.cityId === cityId)
  );
}

export function getBooksWrittenAt(cityId, data) {
  return data.books.filter(b => b.writingLocationId === cityId);
}

export function getBooksReceivedAt(cityId, data) {
  return data.books.filter(b => b.recipientCityIds?.includes(cityId));
}

export function getWaypointsInRange(journeyId, startYear, endYear, data) {
  const journey = data.journeys.find(j => j.id === journeyId);
  if (!journey) return [];
  return journey.waypoints.filter(w => w.year >= startYear && w.year <= endYear);
}

export function getBooksForJourney(journeyId, data) {
  return data.books.filter(b =>
    b.journeyId === journeyId || b.journeyIdAlt === journeyId
  );
}

export function getPaulNoteAtYear(year, data) {
  // Returns a tooltip string describing Paul's likely location at a given year
  for (const journey of data.journeys) {
    if (year < journey.dateRange[0] || year > journey.dateRange[1]) continue;
    const wps = journey.waypoints;
    const wp = [...wps].reverse().find(w => w.year <= year);
    if (wp) {
      const city = getCityById(wp.cityId, data);
      return `~AD ${Math.round(year)} · ${city.name} (${wp.ref})`;
    }
  }
  return `~AD ${Math.round(year)}`;
}
```

---

## Animation Helpers

```javascript
// utils/animationHelpers.js

export function animateLetterRoute(svgSelection, fromCoords, toCoords, projection, color = '#e9c86c') {
  // Remove any existing letter route
  svgSelection.select('.letter-route').remove();

  const [x1, y1] = projection(fromCoords);
  const [x2, y2] = projection(toCoords);

  // Midpoint with slight arc
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - 30;

  const pathData = `M ${x1},${y1} Q ${mx},${my} ${x2},${y2}`;

  const path = svgSelection.append('path')
    .attr('class', 'letter-route')
    .attr('d', pathData)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 2.5)
    .attr('stroke-dasharray', '6,3');

  const totalLength = path.node().getTotalLength();
  path
    .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
    .attr('stroke-dashoffset', totalLength)
    .transition()
    .duration(1800)
    .ease(d3.easeQuadInOut)
    .attr('stroke-dashoffset', 0);
}
```

---

## Map Projection & Reference Coordinates

```
Projection: geoMercator
Center:     [23, 38]      (eastern Mediterranean)
Scale:      ~950
ViewBox:    0 0 1200 680

Approximate SVG pixel positions at this projection:
  Rome       [12.5, 41.9]  → (~240, ~195)
  Corinth    [22.9, 37.9]  → (~500, ~290)
  Athens     [23.7, 38.0]  → (~515, ~288)
  Philippi   [24.3, 41.0]  → (~530, ~210)
  Thessalonica [22.9, 40.6]→ (~500, ~225)
  Ephesus    [27.3, 37.9]  → (~590, ~290)
  Antioch    [36.2, 36.2]  → (~800, ~325)
  Jerusalem  [35.2, 31.8]  → (~775, ~435)
  Tarsus     [34.9, 36.9]  → (~760, ~305)
  Malta      [14.5, 35.9]  → (~260, ~340)

Factor: ~1° lon ≈ 19.5px, ~1° lat ≈ 25px at this projection/scale
```

---

## Design Tokens (tokens.css)

```css
:root {
  /* Base palette — identical to Philippians suite */
  --bg:           #0c0f18;
  --surface:      #13182a;
  --surface-2:    #1a2035;
  --surface-3:    #212842;
  --accent:       #c9a84c;
  --accent-dim:   #7a6430;
  --accent-lt:    #e9c86c;
  --cream:        #ede8dc;
  --cream-dim:    #a09a8e;
  --muted:        #5c6078;
  --border:       #232a42;
  --border-lt:    #2e3858;

  /* Typography */
  --font-body:    'Lora', Georgia, serif;
  --font-display: 'Cinzel', serif;
  --font-serif:   'Cormorant Garamond', Georgia, serif;

  /* Journey colors */
  --j1:     #c9a84c;   /* 1st Journey — gold */
  --j2:     #4A7C6F;   /* 2nd Journey — sage */
  --j3:     #7B6FA0;   /* 3rd Journey — muted purple */
  --j-rom:  #B85042;   /* To Rome — muted red */
  --j-pst:  #5B8DB8;   /* Post-Rome — muted blue */

  /* City states */
  --city-writing:   #e9c86c;  /* Writing location glow */
  --city-recipient: #4A7C6F;  /* Recipient city glow */
  --city-major:     #c9a84c;
  --city-minor:     #2a3d5a;
}
```

**Google Fonts import (index.html):**
```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
```

---

## Layout Specification

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER: "Paul's World" — full-width, same dark header as Philippians │
├──────────┬───────────────────────────────────────────┬───────────────┤
│ FILTER   │                                           │  BOOK DETAIL  │
│ PANEL    │         D3 MAP  (MapView.jsx)             │  PANEL        │
│ 260px    │         1200×680 SVG viewBox              │  320px        │
│          │                                           │               │
│ Journey  │  [provinces → land → borders →            │  (slides in   │
│ toggles  │   journey lines → cities →                │   when book   │
│          │   paul dot → annotations]                 │   selected)   │
│ ──────── │                                           │               │
│ Book     │                                           │  (hidden by   │
│ selector │                                           │   default)    │
├──────────┴───────────────────────────────────────────┴───────────────┤
│  TIMELINE BAR (TimelineBar.jsx) — full-width, AD 33–68, h=160px      │
│  [journey spans] [book diamonds] [year axis] [scrubber]              │
└──────────────────────────────────────────────────────────────────────┘

Total app height: ~100vh
Map area: calc(100vh - header - timeline - padding)
```

**Responsive breakpoints:**
- `>= 1024px`: three-column layout as above
- `768–1023px`: Filter panel collapses to top accordion; book detail becomes bottom sheet
- `< 768px`: Filter panel behind hamburger menu; timeline touch-draggable; map full-width

---

## Complete Interaction Model

### Default state
- All 5 journey lines visible at 40% opacity, dashed
- All city dots visible (tier1 gold, tier2/3 muted)
- Province fills on, labels on
- Timeline shows all spans + book diamonds
- Filter panel: all journeys checked, "Journeys" mode

### Toggle a journey off
- That journey's line disappears from map
- Its segment bar dims on the timeline
- Books from that journey dim in book mode (but remain selectable)

### Select a book (e.g., Romans)
- Writing city (Corinth) gets pulsing gold ring + "Author" label
- Recipient city (Rome) gets pulsing teal ring + "Recipients" label
- Letter route animates: Corinth → Rome (dashed gold arc with arrowhead)
- All journey lines dim except journey-3; journey-3 highlights only AD 55.5–57.5
- Timeline highlights AD 56–57 in gold
- Book detail panel slides in
- Book pill activates in filter panel
- "Clear ×" button appears

### Scrub timeline to AD 50
- Paul's pulse dot appears between Thessalonica and Berea
- Scrubber tooltip: "~AD 50 · Berea (Acts 17:10)"
- Journey lines before AD 50 slightly brighter; after slightly dimmer
- No book selection interaction during scrub (scrub and book select are independent)

### Click a city (e.g., Ephesus)
- City tooltip expands to show all Paul visits + books written/received
- Timeline highlights all years when Paul was in Ephesus (AD 52.1, 55.5, 62.5)

### Switch to "Books" view in filter panel
- Journey lines dim globally
- Book pills become the primary navigation
- Selecting a book re-brightens the relevant journey segment

---

## Data Loading Strategy

```javascript
// App.jsx — all data loaded at startup

// Bundled via npm (no fetch needed):
import countries50m from 'world-atlas/countries-50m.json';
import journeyData from './data/pauline-journeys-data.json';

// Province data — fetch from public/ at runtime:
useEffect(() => {
  fetch('/provinces.geojson')
    .then(r => r.json())
    .then(setProvincesGeo)
    .catch(err => console.warn('Province data unavailable — rendering without provinces'));
}, []);

// Topojson processing (do once, memoize):
const land    = useMemo(() => topojson.feature(countries50m, countries50m.objects.land), []);
const borders = useMemo(() =>
  topojson.mesh(countries50m, countries50m.objects.countries, (a,b) => a !== b), []
);
```

---

## Build Notes for Claude Code

1. **Map first, interactivity second.** Get land + provinces + one journey line rendering before adding state.
2. **Projection test early.** `console.log(projection([12.5, 41.9]))` to verify Rome is in the right place.
3. **D3 + React pattern.** Use `useRef` on the SVG element; run all D3 DOM code inside `useEffect`. Let React handle prop changes → D3 updates.
4. **Province GeoJSON.** Inspect the downloaded file's `properties` fields first: `jq '[.features[].properties]' public/provinces.geojson | head -20`
5. **Journey line deduplication.** Some cities appear as both departure and arrival in consecutive waypoints — deduplicate before drawing.
6. **Paul location interpolation.** The `getPaulLocationAtYear` function needs to handle the gap between journeys (e.g., AD 48–49 between journey 1 and 2) gracefully — return null, don't interpolate across journey boundaries.
7. **Letter route animation.** Use the same `stroke-dasharray` technique as the Philippians map; it's proven to work.
8. **Post-Rome journey.** Render its line with a slight opacity reduction and `stroke-dasharray: 8, 5` to visually indicate the higher uncertainty.

---

## Handoff Checklist

**Prepare before opening Claude Code:**

- [x] `pauline-journeys-data.json` — compiled and in this folder
- [x] `PAULS-WORLD-APP-SPEC.md` — this document
- [ ] Run: `npm create vite@latest pauls-world -- --template react`
- [ ] Run: `npm install d3 topojson-client world-atlas`
- [ ] Run: `curl -o public/provinces.geojson "https://raw.githubusercontent.com/klokantech/roman-empire/master/data/provinces.geojson"`
- [ ] Create GitHub repo, push initial scaffold, connect to Vercel

**First prompt to Claude Code (copy this exactly):**

> "I'm building a React + D3 interactive map of Paul's missionary journeys called Paul's World. I have two reference files: `src/data/pauline-journeys-data.json` (all city coordinates, journey waypoints, and book triplets) and `PAULS-WORLD-APP-SPEC.md` (full technical spec). Read both files first, then build the MapView component that renders: (1) Natural Earth 50m land masses in dark navy per the spec's design tokens, (2) Roman province fills from `public/provinces.geojson`, (3) all five journey lines using a geoMercator projection centered on [23, 38] at scale 950 in a 1200×680 viewBox. Use the color system from the data file's `colorSystem` field. Do not add interactivity yet — just rendering. Start by reading both reference files."
