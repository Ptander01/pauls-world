# Paul's World — Timeline Drill-Down Feature Spec
## Claude Code Handoff Document

---

## Feature Overview

Add a two-mode timeline to the Paul's World app. Mode 1 is the existing overview timeline (unchanged). Mode 2 is a new detail view that activates when the user drills into a specific journey — showing Paul's stops as duration-proportional segments, parallel church/recipient tracks, and a synchronized map zoom to the journey's geographic region.

---

## The Problem This Solves

The current animation runs at the overview scale (AD 44–67) which makes short waypoint segments (island hops, 1-day stops) snap past while long ones (18 months in Corinth) crawl. Rather than engineering a speed-compensation fix, this feature gives users the context to interpret the animation correctly: when they can see that Corinth is visually 18× wider than Samothrace on the timeline, the animation speed at each location is self-explanatory.

---

## Interaction Model

### Activation
Two ways to enter detail mode:
1. **Click** a journey capsule bar in the overview timeline
2. **Scroll/pinch down** on the timeline panel (vertical scroll or trackpad pinch on the timeline element triggers zoom-in to whichever journey segment is under the cursor)

### Navigation
- A **back arrow + journey name** breadcrumb appears top-left of the timeline panel when in detail mode ("← Overview")
- Clicking it or pinching back out returns to overview
- Only one journey can be in detail mode at a time
- Switching journeys: click a different capsule bar in the mini overview strip (see Layout section)

### Map sync
- Entering detail mode for a journey automatically pans and zooms the map to that journey's geographic bounding box
- The map animation (if playing) constrains to that journey's waypoints and date range
- Exiting detail mode returns the map to its previous state

---

## Layout — Detail Mode

```
┌─────────────────────────────────────────────────────────────────────┐
│  MINI OVERVIEW STRIP  (30px tall, full width)                        │
│  Five capsule bars at compressed scale; selected journey highlighted │
│  ← Overview breadcrumb on left                                       │
├─────────────────────────────────────────────────────────────────────┤
│  PAUL'S TRACK  (top half, ~70px)                                     │
│                                                                      │
│  [ANTIOCH]──[TARSUS]──[LYSTRA]────────[TROAS]─[PHILIPPI]──────────  │
│                                 small     ↑        ↑                 │
│              duration-proportional stops  |        |                 │
│              city labels above, duration  |        |                 │
│              below ("3 days", "18 mo")    |        |                 │
│                                           |        |                 │
├───────────────────────────────────────────|────────|────────────────┤
│  CHURCH TRACK TOGGLE BAR                  |        |                 │
│  [+ Philippian Church] [+ Corinth] [+ Thessalonica] (pills)          │
├─────────────────────────────────────────────────────────────────────┤
│  CHURCH TRACKS  (bottom, ~50px each, stacked vertically)             │
│                                                                      │
│  ─ Philippian Church ──────────────────●────────────────────●─────  │
│                                         ↑                    ↑       │
│                                    "Lydia        "Epaphroditus       │
│                                    converted"    sends gift"         │
│                                                                      │
│  ─ Corinthian Church ──────────────────────────●───────────────     │
│                                                  ↑                   │
│                                          "1 Cor received"            │
└─────────────────────────────────────────────────────────────────────┘
```

**Total timeline panel height in detail mode:** expands from 180px to ~320px (animated CSS height transition). The map area shrinks correspondingly.

---

## Component Architecture

### New components:

**`TimelineDetail.jsx`**
The detail-mode view. Receives the active journey object, church track data, and active church filter set. Renders:
- Paul's duration-proportional stop track
- Church track toggle pills
- Active church tracks

**`PaulStopTrack.jsx`**
Renders Paul's journey as a horizontal sequence of labeled stops. Each stop's width is proportional to dwell time. Handles hover tooltips showing city name, dates, and scripture reference.

**`ChurchTrack.jsx`**
Renders a single church's parallel timeline as a thin horizontal line with event markers. Receives `churchId` and `events[]`. Handles hover on event markers.

### Modified components:

**`TimelineBar.jsx`**
- Add click handler on journey capsule bars → sets `detailJourneyId`
- Add scroll/pinch handler on timeline panel → activates detail mode
- Render `TimelineDetail` when `detailJourneyId` is set
- Render mini overview strip in detail mode
- Animate panel height change

**`App.jsx`**
- New state: `detailJourneyId: string | null` (null = overview mode)
- New state: `activeChurchTracks: Set<string>` (which church tracks are visible)
- Pass both to TimelineBar and MapView

**`MapView.jsx`**
- When `detailJourneyId` changes: animate zoom to journey's geographic bounds
- Use `d3.zoom().transform()` with a transition to fly to the bounding box of that journey's waypoints
- When `detailJourneyId` clears: animate back to default view

---

## Data Requirements

### New field on journeys: `waypoints[].durationDays`

Add a `durationDays` field to each waypoint in `pauline-journeys-data.json`. This is the number of days Paul spent at this location before moving to the next waypoint. Used to calculate stop width in the detail timeline.

```json
{ "cityId": "corinth", "year": 50.5, "durationDays": 548, "note": "18 months" },
{ "cityId": "philippi", "year": 49.9, "durationDays": 14, "note": "Several days" },
{ "cityId": "samothrace", "year": 49.8, "durationDays": 1, "note": "Overnight" }
```

Approximate durations to add (derived from Acts and scholarly consensus):

**Journey 1 (AD 46–48):**
- Antioch (Syria): 7 days (departure prep)
- Seleucia: 1 day
- Salamis: 3 days
- Paphos: 7 days
- Perga: 3 days
- Antioch (Pisidia): 14 days
- Iconium: 30 days
- Lystra: 21 days
- Derbe: 14 days
- Return legs: roughly half the outbound durations
- Antioch (return): 365 days (extended stay before Journey 2)

**Journey 2 (AD 49–52):**
- Derbe/Lystra: 7 days
- Iconium: 5 days
- Antioch (Pisidia): 5 days
- Troas: 3 days
- Samothrace: 1 day
- Neapolis: 1 day
- Philippi: 14 days (approx — "some days", Acts 16:12)
- Thessalonica: 21 days (3 Sabbaths minimum)
- Berea: 14 days
- Athens: 21 days
- **Corinth: 548 days (18 months — Acts 18:11)**
- Ephesus: 3 days
- Caesarea: 3 days
- Jerusalem: 7 days
- Antioch: 180 days

**Journey 3 (AD 52–57):**
- Antioch to Ephesus (overland): 30 days
- **Ephesus: 1095 days (3 years — Acts 19:8–10)**
- Troas: 7 days
- Philippi/Macedonia: 90 days
- **Corinth: 90 days (3 months — Acts 20:3)**
- Return through Macedonia: 21 days
- Troas: 7 days
- Miletus: 3 days
- Island hops (Cos, Rhodes, Patara): 1–2 days each
- Tyre: 7 days
- Ptolemais: 1 day
- Caesarea: 7 days

**Rome Journey (AD 57–62):**
- Jerusalem (arrest + hearings): 14 days
- **Caesarea (imprisonment): 730 days (2 years — Acts 24:27)**
- Sea voyage waypoints: 1–3 days each
- **Malta: 90 days (3 months — Acts 28:11)**
- Syracuse: 3 days
- Puteoli: 7 days
- **Rome (house arrest): 730 days (2 years — Acts 28:30)**

**Post-Rome (AD 62–67):**
- Use approximate durations based on traditional reconstruction

### New data structure: `churchEvents`

Add a top-level `churchEvents` array to `pauline-journeys-data.json`. Each entry is an event in a specific church's history that appears on the church track in detail mode.

```json
"churchEvents": [
  {
    "id": "lydia-conversion",
    "churchId": "philippi",
    "cityId": "philippi",
    "year": 49.9,
    "journeyId": "journey-2",
    "label": "Church founded",
    "sublabel": "Lydia & the jailer · Acts 16",
    "type": "founding",
    "ref": "Acts 16:12–40"
  },
  {
    "id": "phil-gift-thessalonica",
    "churchId": "philippi",
    "cityId": "thessalonica",
    "year": 50.1,
    "journeyId": "journey-2",
    "label": "Sends gift to Paul",
    "sublabel": "Phil. 4:16",
    "type": "support",
    "ref": "Philippians 4:16"
  },
  {
    "id": "1-thess-received",
    "churchId": "thessalonica",
    "cityId": "thessalonica",
    "year": 51.0,
    "journeyId": "journey-2",
    "label": "Receives 1 Thessalonians",
    "sublabel": "Written from Corinth",
    "type": "letter-received",
    "ref": "1 Thessalonians"
  },
  {
    "id": "1-cor-received",
    "churchId": "corinth",
    "cityId": "corinth",
    "year": 54.5,
    "journeyId": "journey-3",
    "label": "Receives 1 Corinthians",
    "sublabel": "Written from Ephesus",
    "type": "letter-received",
    "ref": "1 Corinthians"
  },
  {
    "id": "2-cor-received",
    "churchId": "corinth",
    "cityId": "corinth",
    "year": 56.0,
    "journeyId": "journey-3",
    "label": "Receives 2 Corinthians",
    "sublabel": "Written from Macedonia",
    "type": "letter-received",
    "ref": "2 Corinthians"
  },
  {
    "id": "romans-received",
    "churchId": "rome",
    "cityId": "rome",
    "year": 57.5,
    "journeyId": "journey-3",
    "label": "Receives Romans",
    "sublabel": "Carried by Phoebe",
    "type": "letter-received",
    "ref": "Romans 16:1"
  },
  {
    "id": "epaphroditus-sent",
    "churchId": "philippi",
    "cityId": "rome",
    "year": 60.5,
    "journeyId": "rome-journey",
    "label": "Sends Epaphroditus with gift",
    "sublabel": "Phil. 4:18",
    "type": "support",
    "ref": "Philippians 4:18"
  },
  {
    "id": "philippians-received",
    "churchId": "philippi",
    "cityId": "philippi",
    "year": 61.5,
    "journeyId": "rome-journey",
    "label": "Receives Philippians",
    "sublabel": "\"From the Inside Out\"",
    "type": "letter-received",
    "ref": "Philippians 1:1"
  },
  {
    "id": "colossians-received",
    "churchId": "colossae",
    "cityId": "colossae",
    "year": 61.5,
    "journeyId": "rome-journey",
    "label": "Receives Colossians",
    "sublabel": "Carried by Tychicus",
    "type": "letter-received",
    "ref": "Colossians 4:7"
  },
  {
    "id": "titus-left-crete",
    "churchId": "crete",
    "cityId": "crete",
    "year": 63.0,
    "journeyId": "post-rome",
    "label": "Titus left to appoint elders",
    "sublabel": "Titus 1:5",
    "type": "leadership",
    "ref": "Titus 1:5"
  },
  {
    "id": "timothy-left-ephesus",
    "churchId": "ephesus",
    "cityId": "ephesus",
    "year": 62.5,
    "journeyId": "post-rome",
    "label": "Timothy left to guard doctrine",
    "sublabel": "1 Tim 1:3",
    "type": "leadership",
    "ref": "1 Timothy 1:3"
  }
]
```

**Event types and their visual treatment:**
- `founding`: gold diamond, larger marker
- `letter-received`: teal diamond (matches recipient city color)
- `support`: gold circle (financial/personal support)
- `leadership`: muted purple circle

---

## Paul Stop Track — Width Calculation

```javascript
function getStopWidth(waypoint, journey, totalTrackWidth) {
  const journeyTotalDays = journey.waypoints.reduce(
    (sum, wp) => sum + (wp.durationDays || 0), 0
  );
  const fraction = (waypoint.durationDays || 1) / journeyTotalDays;
  // Minimum width so even 1-day stops are visible and clickable
  const minWidth = 24;
  return Math.max(minWidth, fraction * totalTrackWidth);
}
```

Each stop renders as a rectangle whose width reflects dwell time. City name above, duration below. Very short stops (< 3 days) show only a tick mark + city name on hover.

---

## Church Track — Which Churches Per Journey

Pre-compute which churches are relevant to each journey:

| Journey | Relevant churches |
|---|---|
| 1st Journey | — (no established churches yet; show "founding events" only) |
| 2nd Journey | Philippi, Thessalonica, Berea, Corinth |
| 3rd Journey | Ephesus, Philippi, Thessalonica, Corinth |
| Rome Journey | Philippi, Colossae, Rome |
| Post-Rome | Ephesus, Crete, Philippi |

Only churches with `churchEvents` for that journey appear as toggle options. Empty church tracks are not shown.

---

## Visual Design

**Paul's stop track:**
- Background: `var(--surface-2)`
- Stop rectangles: `fill: journey.color, opacity: 0.15` with `stroke: journey.color, opacity: 0.6`
- Active stop (hovered/scrubber position): `fill: journey.color, opacity: 0.4`
- City label: Cinzel 10px, `fill: var(--cream)`, above the stop
- Duration label: Cormorant Garamond 10px italic, `fill: var(--muted)`, below the stop
- Significant stops (durationDays > 90): label in gold

**Church track:**
- Track line: `stroke: var(--border-lt), strokeWidth: 1`
- Church name label: Cinzel 9px, letter-spacing 2, `fill: var(--accent-dim)`, left-aligned
- Event markers: 8px diamonds, colored by event type
- Event label: Cormorant Garamond 10px italic, alternating above/below

**Toggle pills:**
- Same style as existing filter pills in FilterPanel
- Color-coded to church/journey color
- Active: gold border, visible track; inactive: muted, track hidden

**Mini overview strip:**
- 28px height
- Five capsule bars at compressed scale
- Selected journey highlighted at full opacity; others at 20%
- Not interactive (just orientation reference)

---

## Animation Behavior in Detail Mode

When `detailJourneyId` is set and Play mode is active:

- Timeline scrubber is constrained to `journey.dateRange`
- Animation speed recalculated: `totalJourneyDays / playDurationSeconds`
- Map animation: line draws proportional to elapsed time within journey
- As scrubber crosses a church event's year: that event marker pulses once
- As scrubber crosses a waypoint: that stop highlights on Paul's track

This makes animation speed visually consistent with the stop widths the user sees — Corinth's wide block animates slowly, Samothrace's narrow tick animates quickly, and both are immediately interpretable.

---

## Map Zoom Behavior on Journey Drill-Down

```javascript
function getJourneyBounds(journeyId, data) {
  const journey = data.journeys.find(j => j.id === journeyId);
  const coords = journey.waypoints.map(wp =>
    data.cities.find(c => c.id === wp.cityId).coords
  );
  return {
    west:  Math.min(...coords.map(c => c[0])) - 2,
    east:  Math.max(...coords.map(c => c[0])) + 2,
    south: Math.min(...coords.map(c => c[1])) - 2,
    north: Math.max(...coords.map(c => c[1])) + 2,
  };
}

// Then use d3.zoom fitExtent to animate the map to those bounds
function flyToJourneyBounds(svgEl, projection, bounds, W, H) {
  const [[x0,y0],[x1,y1]] = [
    projection([bounds.west, bounds.north]),
    projection([bounds.east, bounds.south])
  ];
  const scale = 0.9 / Math.max((x1-x0)/W, (y1-y0)/H);
  const translate = [W/2 - scale*(x0+x1)/2, H/2 - scale*(y0+y1)/2];
  d3.select(svgEl).transition().duration(800).ease(d3.easeCubicInOut)
    .call(zoom.transform, d3.zoomIdentity.translate(...translate).scale(scale));
}
```

---

## Build Order for Claude Code

1. **Data first:** Add `durationDays` to all waypoints in `pauline-journeys-data.json`. Add `churchEvents` array. Verify data loads without errors.

2. **Paul stop track:** Build `PaulStopTrack.jsx` in isolation with mock data, verify width calculations look right visually, then wire to real journey data.

3. **Timeline drill-down shell:** Add `detailJourneyId` state, click handler on capsule bars, height animation, mini overview strip, breadcrumb. No church tracks yet.

4. **Map zoom sync:** Wire `detailJourneyId` change to `flyToJourneyBounds`. Test each journey's geographic bounds.

5. **Church tracks:** Build `ChurchTrack.jsx`, add toggle pills, wire to `churchEvents` data filtered by journey.

6. **Animation sync:** Connect Play mode to detail view — constrain scrubber range, sync stop highlight on Paul's track, pulse church event markers on crossing.

7. **Polish:** Transitions, label collision handling, responsive behavior.

---

## First Prompt to Claude Code

> "Read CLAUDE.md and src/data/PAULS-WORLD-APP-SPEC.md and src/data/TIMELINE-DRILLDOWN-SPEC.md. Start with the data layer only — no UI yet. Add a `durationDays` field to every waypoint in `pauline-journeys-data.json` using the values in the spec's duration table. Then add the `churchEvents` array to the same file using the events defined in the spec. Verify the JSON is valid and that the new fields are accessible from the existing data imports. Log the total duration days for each journey to the console so we can verify the proportions look right. Do not touch any components yet."
