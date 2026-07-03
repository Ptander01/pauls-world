# Timeline Books 4-State Prototype

This file captures the design and implementation of the 4-state progressive disclosure
system for the books/letters section of the timeline overview pane. It replaces the
existing "lollipop" style (diamonds on vertical stems) with an animated chip system.

## The 4 States

- **State 0**: Journey bars only (viewBox zoomed to bar height ~78px)
- **State 1**: Journey bars + book flags as dots on bars (Apple dock hover magnification)
- **State 2**: Both rows visible — flags morph to compact chips via animation
- **State 3**: Books only — full book names, flag poles connecting chips to date anchor, bars ghosted to 7% opacity

## Key Coordinate Constants

```js
const W=920, PL=56, PR=36
const xs = yr => PL + (yr-44)/24*(W-PL-PR)
const BY=24, BH=16, DR=4, FAY=8, FBY=48, AXY=62, SEP=78
const CR0_S2=88, CR1_S2=113, CH_S2=20   // state-2 compact chips
const CR0_S3=106, CR1_S3=165, CH_S3=30  // state-3 expanded chips
const ROUTE_Y = SEP+4  // = 82, horizontal routing level for displaced chips
const VB3 = [0, 75, W, 123]
const VB = [[0,0,W,78],[0,0,W,78],[0,0,W,210], VB3]
```

## Collision Resolution (Prison Epistles)

Phil, Eph, Col, Phm all cluster at AD 60–62. This algorithm spreads them horizontally:

```js
const S3_CHIPS = (() => {
  const CPX=5.5, CPAD=24, GAP=6
  const chips = B.map((b,i) => ({
    id:b.id, i, idealCx:xs(b.dt), cx:xs(b.dt),
    w: Math.max(xs(b.r[1])-xs(b.r[0]), b.n.length*CPX+CPAD),
    row: i%2,
  }))
  ;[0,1].forEach(row => {
    const rc = chips.filter(c=>c.row===row).sort((a,b)=>a.idealCx-b.idealCx)
    for(let k=1; k<rc.length; k++) { const n=rc[k-1].cx+rc[k-1].w/2+GAP+rc[k].w/2; if(rc[k].cx<n) rc[k].cx=n }
    for(let k=rc.length-2; k>=0; k--) { const m=rc[k+1].cx-rc[k+1].w/2-GAP-rc[k].w/2; if(rc[k].cx>m) rc[k].cx=m }
    rc.forEach(c => { c.cx = Math.max(PL+c.w/2, Math.min(W-PR-c.w/2, c.cx)) })
  })
  return Object.fromEntries(chips.map(c=>[c.id,c]))
})()
```

## Pole Paths (no diagonals — L-shaped routing for displaced chips)

```js
function polePath(b, i) {
  const lay = S3_CHIPS[b.id]
  const topY = i%2===0 ? CR0_S3 : CR1_S3
  const ax = xs(b.dt), cx = lay.cx
  if (Math.abs(cx-ax) < 0.5) return `M ${cx} ${topY} V ${SEP}`
  return `M ${cx} ${topY} V ${ROUTE_Y} H ${ax} V ${SEP}`
}
```

## SVG Mask for Pole Clipping

Poles go behind chips using an SVG mask — white everywhere, black over each chip body:

```js
h += `<defs><mask id="poleMask" maskUnits="userSpaceOnUse">`
h += `<rect x="0" y="0" width="${W}" height="250" fill="white"/>`
B.forEach((b,i) => {
  const lay = S3_CHIPS[b.id], cy = i%2===0 ? CR0_S3 : CR1_S3
  h += `<rect x="${lay.cx-lay.w/2+1}" y="${cy+1}" width="${lay.w-2}" height="${CH_S3-2}" rx="5" fill="black"/>`
})
h += `</mask></defs>`
// Apply to poles group:
h += `<g id="polesG" opacity="0" mask="url(#poleMask)" pointer-events="none">`
```

## Known Bug — RESOLVED (integrated 2026-07-03)

~~In state 3, only the 2 L-shaped poles are visibly rendered.~~ Did not reproduce in the
real React/D3 component: rendering each pole as a per-book `<path data-pole>` with
`mask="url(#pbw-pole-mask)"` shows all 13 poles correctly. Was a widget-sandbox artifact.

A second bug WAS found during integration: the collision algorithm clamps chips to the
horizontal bounds *after* the forward/backward passes, which reintroduces overlap at the
right edge (1 Timothy / 2 Timothy). The integrated version interleaves the clamps:
forward pass → right-boundary clamp + backward pass → left-boundary clamp + final
forward pass. See `S3_CHIPS` in `src/components/TimelineBar.jsx`.

**Status: this design is now integrated into `TimelineBar.jsx`** (x-coords adapted to the
existing `xScale` range 80–1140 with TW=1200, CPX=6.5). This file remains as the design
reference.

## State Chip Geometry (getP function)

```js
function getP(b, i, s) {
  const cx = xs(b.dt)
  if (s<=1) {
    const dy = i%2===0 ? FAY : FBY
    return {x:cx-DR, y:dy-DR, w:2*DR, h:2*DR, rx:DR, fo:s?0.28:0, so:s?0.88:0, sto:s?0.55:0}
  }
  if (s===2) {
    const rw = Math.max(xs(b.r[1])-xs(b.r[0]), 28), cy = i%2===0 ? CR0_S2 : CR1_S2
    return {x:cx-rw/2, y:cy, w:rw, h:CH_S2, rx:4, fo:0.15, so:0.55, sto:0}
  }
  const lay = S3_CHIPS[b.id], cy = i%2===0 ? CR0_S3 : CR1_S3
  return {x:lay.cx-lay.w/2, y:cy, w:lay.w, h:CH_S3, rx:6, fo:0.15, so:0.6, sto:0}
}
```

## ViewBox Animation

Each state transition animates the SVG viewBox for a vertical zoom effect:
- States 0→1: no viewBox change (both use [0,0,920,78])
- States 1→2: zoom out to [0,0,920,210] to reveal chip rows below
- States 2→3: zoom in to [0,75,920,123] — books-only band, bars ghost to 7% opacity

## Integration Notes

- The navigation dots + Next button live ABOVE the timeline card
- State is local to the timeline component (no App.jsx changes needed)
- The existing detail mode (TimelineDetail, PaulStopTrack, ChurchTrack) remains unchanged
- This 4-state system replaces only the OVERVIEW pane's books rendering
- Book diamond click behavior (selecting a book, highlighting in map) still needs to be wired
  to the state-3 chips
