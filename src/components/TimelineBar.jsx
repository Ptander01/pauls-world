import { useRef, useEffect, useState, useCallback } from 'react'
import * as d3 from 'd3'
import journeyData from '../data/pauline-journeys-data.json'
import TimelineDetail from './TimelineDetail'

const TW = 1200
const TH = 210

// ── 4-state books layout (see src/data/TIMELINE-BOOKS-4STATE-PROTOTYPE.md) ──
const PL = 80            // left edge of the year scale
const PR = 60            // right margin (TW − 1140)
const BY = 24            // journey bar band top
const BH = 16            // journey bar band height
const FAY = 8            // state-0/1 flag dot row (even books, above bars)
const FBY = 48           // state-0/1 flag dot row (odd books, below bars)
const AXIS_Y = 62
const SEP = 78           // timeline / books band separator
const ROUTE_Y = SEP + 4  // horizontal routing level for displaced chip poles
// Flag dot radius — larger touch targets on coarse pointers (phones/tablets)
const FDR = (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) ? 7 : 4
const CR0_S2 = 88,  CR1_S2 = 113, CH_S2 = 20   // state-2 compact chip rows
const CR0_S3 = 106, CR1_S3 = 165, CH_S3 = 30   // state-3 expanded chip rows

const VIEWBOXES = [
  [0, 0, TW, 78],    // state 0 — journey bars only
  [0, 0, TW, 78],    // state 1 — bars + book flags
  [0, 0, TW, 150],   // state 2 — both rows, compact chips (chips end ~y=133)
  [0, 75, TW, 123],  // state 3 — books only
]
// Card height tracks the viewBox aspect (height = width × vbH/1200) so the
// overview scales uniformly — no funhouse stretch on the lone timeline.
// Clamps keep it usable at extreme window widths (mild stretch only there).
const H_MIN = [64, 64, 104, 96]
const H_MAX = [112, 112, 190, 160]
const STATE_LABELS  = ['Journeys', 'Letters Appear', 'Journeys + Letters', 'The Letters']

const xScale = d3.scaleLinear().domain([44, 68]).range([80, 1140])

const CAPSULE_BARS = journeyData.journeys.map(j => ({
  id: j.id, color: j.color, dr: j.dateRange, dashed: j.id === 'post-rome',
}))

const YEAR_TICKS = [44, 46, 49, 52, 57, 60, 62, 67]

const jColor = {}
journeyData.journeys.forEach(j => { jColor[j.id] = j.color })

const BOOKS = journeyData.books.map((b, i) => ({
  ...b,
  row: i % 2,
  dt: (b.dateRange[0] + b.dateRange[1]) / 2,
}))

// State-3 chip layout — collision-resolved per row (prison epistles cluster at AD 60–62)
const S3_CHIPS = (() => {
  const CPX = 6.5, CPAD = 26, GAP = 6
  const chips = BOOKS.map(b => ({
    id: b.id,
    idealCx: xScale(b.dt),
    cx: xScale(b.dt),
    w: Math.max(xScale(b.dateRange[1]) - xScale(b.dateRange[0]), b.name.length * CPX + CPAD),
    row: b.row,
  }))
  ;[0, 1].forEach(row => {
    const rc = chips.filter(c => c.row === row).sort((a, b) => a.idealCx - b.idealCx)
    // push right to clear left neighbors
    for (let k = 1; k < rc.length; k++) {
      const lo = rc[k - 1].cx + rc[k - 1].w / 2 + GAP + rc[k].w / 2
      if (rc[k].cx < lo) rc[k].cx = lo
    }
    // enforce right boundary, then push left to clear right neighbors
    const last = rc[rc.length - 1]
    last.cx = Math.min(last.cx, TW - PR - last.w / 2)
    for (let k = rc.length - 2; k >= 0; k--) {
      const hi = rc[k + 1].cx - rc[k + 1].w / 2 - GAP - rc[k].w / 2
      if (rc[k].cx > hi) rc[k].cx = hi
    }
    // enforce left boundary, push right again if needed
    rc[0].cx = Math.max(rc[0].cx, PL + rc[0].w / 2)
    for (let k = 1; k < rc.length; k++) {
      const lo = rc[k - 1].cx + rc[k - 1].w / 2 + GAP + rc[k].w / 2
      if (rc[k].cx < lo) rc[k].cx = lo
    }
  })
  return Object.fromEntries(chips.map(c => [c.id, c]))
})()

// State-2 stagger for books whose chips stack exactly (same row + same date
// midpoint — the prison epistles). ±16px keeps the date-range encoding honest
// while separating the abbrev labels and exposing both click targets.
const S2_OFFSETS = (() => {
  const clusters = new Map()
  BOOKS.forEach(b => {
    const key = `${b.row}_${Math.round(xScale(b.dt))}`
    if (!clusters.has(key)) clusters.set(key, [])
    clusters.get(key).push(b.id)
  })
  const offsets = {}
  clusters.forEach(ids => {
    if (ids.length < 2) return
    ids.forEach((id, j) => { offsets[id] = (j - (ids.length - 1) / 2) * 32 })
  })
  return offsets
})()

// Chip geometry per state — one rounded rect morphs dot → compact chip → full chip.
// fo = fill-opacity, so = stroke-opacity, sto = flag-stem opacity.
function getP(b, s) {
  const cx = xScale(b.dt)
  if (s <= 1) {
    const dy = b.row === 0 ? FAY : FBY
    return { x: cx - FDR, y: dy - FDR, w: 2 * FDR, h: 2 * FDR, rx: FDR,
             fo: s ? 0.5 : 0, so: s ? 1 : 0, sto: s ? 0.7 : 0 }
  }
  if (s === 2) {
    const rw = Math.max(xScale(b.dateRange[1]) - xScale(b.dateRange[0]), 28)
    const cy = b.row === 0 ? CR0_S2 : CR1_S2
    const off = S2_OFFSETS[b.id] ?? 0
    return { x: cx - rw / 2 + off, y: cy, w: rw, h: CH_S2, rx: 4, fo: 0.2, so: 0.8, sto: 0 }
  }
  const lay = S3_CHIPS[b.id]
  const cy  = b.row === 0 ? CR0_S3 : CR1_S3
  return { x: lay.cx - lay.w / 2, y: cy, w: lay.w, h: CH_S3, rx: 6, fo: 0.2, so: 0.85, sto: 0 }
}

// L-shaped pole routing — no diagonals; displaced chips route via ROUTE_Y
function polePath(b) {
  const lay  = S3_CHIPS[b.id]
  const topY = b.row === 0 ? CR0_S3 : CR1_S3
  const ax   = xScale(b.dt), cx = lay.cx
  if (Math.abs(cx - ax) < 0.5) return `M ${cx} ${topY} V ${SEP}`
  return `M ${cx} ${topY} V ${ROUTE_Y} H ${ax} V ${SEP}`
}

function abbrevAttrs(b, s) {
  if (s === 2) {
    const cy = b.row === 0 ? CR0_S2 : CR1_S2
    return { x: xScale(b.dt) + (S2_OFFSETS[b.id] ?? 0), y: cy + CH_S2 / 2 + 3, o: 0.9 }
  }
  if (s === 3) {
    const lay = S3_CHIPS[b.id]
    return { x: lay.cx, y: (b.row === 0 ? CR0_S3 : CR1_S3) + CH_S3 / 2 + 3, o: 0 }
  }
  return { x: xScale(b.dt), y: (b.row === 0 ? FAY : FBY) + 2.5, o: 0 }
}

function nameAttrs(b, s) {
  if (s === 3) {
    const lay = S3_CHIPS[b.id]
    return { x: lay.cx, y: (b.row === 0 ? CR0_S3 : CR1_S3) + 13, o: 0.95 }
  }
  if (s === 2) {
    const cy = b.row === 0 ? CR0_S2 : CR1_S2
    return { x: xScale(b.dt), y: cy + CH_S2 / 2 + 3.5, o: 0 }
  }
  return { x: xScale(b.dt), y: (b.row === 0 ? FAY : FBY) + 3, o: 0 }
}

function dateAttrs(b, s) {
  const na = nameAttrs(b, s)
  if (s === 3) return { x: na.x, y: (b.row === 0 ? CR0_S3 : CR1_S3) + 25, o: 0.7 }
  return { ...na, o: 0 }
}

function dateLabel(b) {
  const [r0, r1] = b.dateRange
  const s = r0 === r1 ? `AD ${r0}` : `AD ${r0}–${r1}`
  return b.dateDebated ? `c. ${s}` : s
}

// Maps a book to its primary recipient city/church
const BOOK_CHURCH = {
  'galatians':        'antioch-pisidia',
  '1-thessalonians':  'thessalonica',
  '2-thessalonians':  'thessalonica',
  '1-corinthians':    'corinth',
  '2-corinthians':    'corinth',
  'romans':           'rome',
  'philippians':      'philippi',
  'colossians':       'colossae',
  'ephesians':        'ephesus',
  'philemon':         'colossae',
  '1-timothy':        'ephesus',
  'titus':            'crete',
  '2-timothy':        'ephesus',
}

const cityById = Object.fromEntries(journeyData.cities.map(c => [c.id, c]))

// Churches Paul did not plant — story row shows this note instead of a planted→letter bracket
const ORIGIN_NOTES = {
  rome:     'Planted by others — Paul had not yet visited · Rom 1:13',
  colossae: 'Planted by Epaphras — Paul never visited · Col 1:7, 2:1',
  crete:    'Origin unrecorded — Titus appointed elders · Titus 1:5',
}

function stopR(days) {
  if (!days || days < 7)  return 4
  if (days < 30)  return 5.5
  if (days < 90)  return 7
  if (days < 365) return 9
  return 11
}

const EVENT_COLOR = {
  founding:          '#c9a84c',
  'letter-received': '#4A7C6F',
  support:           '#c9a84c',
  leadership:        '#7B6FA0',
}

function CityStoryRow({ selectedBook, onJourneyDrill }) {
  const [hovered, setHovered] = useState(null)
  const churchId = BOOK_CHURCH[selectedBook?.id]
  if (!churchId) return null

  const city = cityById[churchId]
  const cityName = city?.name ?? churchId

  // All waypoint visits to this city across all journeys
  const visits = []
  journeyData.journeys.forEach(j => {
    j.waypoints.forEach(wp => {
      if (wp.cityId === churchId) {
        visits.push({ key: `${j.id}-${wp.year}`, journeyId: j.id, year: wp.year, durationDays: wp.durationDays, color: j.color, shortName: j.shortName })
      }
    })
  })

  // Church events for this church
  const churchEvts = journeyData.churchEvents.filter(e => e.churchId === churchId)

  // Book letter marker
  const bookMid = (selectedBook.dateRange[0] + selectedBook.dateRange[1]) / 2

  // Planted → letter gap bracket (or origin note when Paul didn't plant the church)
  const founding   = churchEvts.find(e => e.type === 'founding')
  const originNote = !founding ? ORIGIN_NOTES[churchId] : null

  // Thread line spans all touchpoints
  const allYears = [...visits.map(v => v.year), ...churchEvts.map(e => e.year), selectedBook.dateRange[0], selectedBook.dateRange[1]]
  const threadX1 = xScale(Math.min(...allYears))
  const threadX2 = xScale(Math.max(...allYears))

  const SVG_H  = 64
  const TRACK_Y = 34
  const ABOVE_Y = 18
  const BELOW_Y = 52

  return (
    <svg
      className="tl-story-row"
      viewBox={`0 0 ${TW} ${SVG_H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {/* Section label */}
      <text x={40} y={TRACK_Y + 4} textAnchor="middle"
        fontFamily="Cinzel, serif" fontSize={7} letterSpacing={1.5} fill="#7a8ab0"
      >{cityName.toUpperCase()}</text>

      {/* Thread line */}
      <line x1={threadX1} y1={TRACK_Y} x2={threadX2} y2={TRACK_Y}
        stroke="#c9a84c" strokeWidth={0.8} strokeOpacity={0.18} strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke" />

      {/* Planted → letter gap bracket */}
      {founding && bookMid > founding.year && (() => {
        const xF  = xScale(founding.year)
        const xL  = xScale(bookMid)
        const gap = bookMid - founding.year
        const gapLabel = gap < 1 ? 'within the year' : `~${Math.round(gap)} yrs later`
        const BR_Y = 9
        return (
          <g pointerEvents="none">
            <path d={`M ${xF} ${BR_Y + 4} V ${BR_Y} H ${xL} V ${BR_Y + 4}`}
              fill="none" stroke="#c9a84c" strokeWidth={0.8} strokeOpacity={0.35}
              vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
            <text x={(xF + xL) / 2} y={BR_Y - 2.5} textAnchor="middle"
              fontFamily="Cormorant Garamond, serif" fontStyle="italic" fontSize={7.5}
              fill="#c9a84c" fillOpacity={0.85}
            >planted AD {Math.round(founding.year)} · letter {gapLabel}</text>
          </g>
        )
      })()}
      {originNote && (
        <text x={clamp((threadX1 + threadX2) / 2, 200, TW - 200)} y={6.5} textAnchor="middle"
          fontFamily="Cormorant Garamond, serif" fontStyle="italic" fontSize={7.5}
          fill="#4A7C6F" fillOpacity={0.9} pointerEvents="none"
        >{originNote}</text>
      )}

      {/* Journey visit markers */}
      {visits.map((v, i) => {
        const x  = xScale(v.year)
        const r  = stopR(v.durationDays)
        const isH = hovered === v.key
        const above = i % 2 === 0
        return (
          <g key={v.key} style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(v.key)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onJourneyDrill(v.journeyId)}
          >
            <circle cx={x} cy={TRACK_Y} r={isH ? r + 2 : r}
              fill={v.color} fillOpacity={isH ? 0.55 : 0.3}
              stroke={v.color} strokeWidth={1.2} strokeOpacity={isH ? 1 : 0.7}
              vectorEffect="non-scaling-stroke"
            />
            <text x={x} y={above ? ABOVE_Y : BELOW_Y}
              textAnchor="middle" fontFamily="Cinzel, serif" fontSize={6.5} letterSpacing={0.5}
              fill={v.color} fillOpacity={isH ? 1 : 0.65}
              style={{ pointerEvents: 'none' }}
            >{isH ? v.shortName : `AD ${Math.round(v.year)}`}</text>
          </g>
        )
      })}

      {/* Church event markers */}
      {churchEvts.map((ev, i) => {
        const x    = xScale(ev.year)
        const col  = EVENT_COLOR[ev.type] ?? '#a09a8e'
        const isH  = hovered === ev.id
        const sz   = 6
        return (
          <g key={ev.id} style={{ cursor: 'default' }}
            onMouseEnter={() => setHovered(ev.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <polygon
              points={`${x},${TRACK_Y-sz} ${x+sz},${TRACK_Y} ${x},${TRACK_Y+sz} ${x-sz},${TRACK_Y}`}
              fill={col} fillOpacity={isH ? 0.5 : 0.25}
              stroke={col} strokeWidth={1} strokeOpacity={isH ? 1 : 0.7}
              vectorEffect="non-scaling-stroke"
            />
            {isH && (
              <text x={x} y={i % 2 === 0 ? ABOVE_Y : BELOW_Y}
                textAnchor="middle" fontFamily="Cormorant Garamond, serif"
                fontStyle="italic" fontSize={8}
                fill={col} style={{ pointerEvents: 'none' }}
              >{ev.label}</text>
            )}
          </g>
        )
      })}

      {/* Letter / book marker — gold diamond, always labelled */}
      {(() => {
        const x  = xScale(bookMid)
        const sz = 9
        return (
          <g>
            <polygon
              points={`${x},${TRACK_Y-sz} ${x+sz},${TRACK_Y} ${x},${TRACK_Y+sz} ${x-sz},${TRACK_Y}`}
              fill="#c9a84c" fillOpacity={0.55}
              stroke="#c9a84c" strokeWidth={1.5} strokeOpacity={0.9}
              vectorEffect="non-scaling-stroke"
            />
            <text x={x} y={ABOVE_Y - 2}
              textAnchor="middle" fontFamily="Cinzel, serif" fontSize={8} letterSpacing={0.5}
              fill="#e9c86c" style={{ pointerEvents: 'none' }}
            >{selectedBook.abbrev}</text>
          </g>
        )
      })()}
    </svg>
  )
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function getSvgYear(clientX, svgEl) {
  const r = svgEl.getBoundingClientRect()
  return clamp(xScale.invert(((clientX - r.left) / r.width) * TW), 44, 68)
}

function paulNote(year) {
  for (const j of journeyData.journeys) {
    if (year < j.dateRange[0] || year > j.dateRange[1]) continue
    const wp = [...j.waypoints].reverse().find(w => w.year <= year)
    if (wp) {
      const city = journeyData.cities.find(c => c.id === wp.cityId)
      return city ? `~AD ${Math.round(year)} · ${city.name}` : `~AD ${Math.round(year)}`
    }
  }
  return `~AD ${Math.round(year)}`
}

export default function TimelineBar({
  activeJourneys,
  selectedBookId,
  timelineYear,
  onYearChange,
  onBookClick,
  highlightRange,
  isPlaying,
  detailJourneyId,
  onDetailJourneyChange,
  churchEvents,
  activeChurchTracks,
  onChurchTrackToggle,
  onCityHover,
  hoveredCityId,
}) {
  const svgRef          = useRef(null)
  const mainGRef        = useRef(null)
  const scrubGRef       = useRef(null)
  const defsRef         = useRef(null)
  const yearRef         = useRef(timelineYear)
  const timelineYearRef = useRef(timelineYear)
  const revealedBooks   = useRef(new Set())

  // 4-state books disclosure — local to the timeline (0=bars, 1=flags, 2=chips, 3=books only)
  const [bookState, setBookState] = useState(1)
  const bookStateRef      = useRef(bookState)
  const bookStateInit     = useRef(false)
  const selectedBookIdRef = useRef(selectedBookId)

  // Card width drives per-state height (aspect-locked to the viewBox)
  const rootRef = useRef(null)
  const [tlWidth, setTlWidth] = useState(1200)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w) setTlWidth(w) // React bails out when the width is unchanged
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    selectedBookIdRef.current = selectedBookId
  }, [selectedBookId])

  useEffect(() => {
    yearRef.current         = timelineYear
    timelineYearRef.current = timelineYear
  }, [timelineYear])

  // Reset revealed set when play stops so next play re-animates
  useEffect(() => {
    if (!isPlaying) revealedBooks.current.clear()
  }, [isPlaying])

  // ── Scrubber position — fast imperative update ─────────────────────────
  useEffect(() => {
    const g = d3.select(scrubGRef.current)
    if (timelineYear === null) {
      g.style('display', 'none')
      return
    }
    const x    = xScale(timelineYear)
    const tipX = clamp(x, 58, TW - 58)
    g.style('display', null)
    g.select('.s-line').attr('x1', x).attr('x2', x)
    g.select('.s-handle').attr('cx', x)
    g.select('.s-tip').attr('transform', `translate(${tipX},0)`)
    g.select('.s-tip text').text(paulNote(timelineYear))
  }, [timelineYear])

  // ── Capsule bar reveal — synchronized clipPath widths ─────────────────
  useEffect(() => {
    const defs = d3.select(defsRef.current)

    CAPSULE_BARS.forEach(bar => {
      const clipRect = defs.select(`[data-bar-clip="${bar.id}"]`)
      if (clipRect.empty()) return
      const x1    = xScale(Math.max(44, bar.dr[0])) + 1.5
      const x2    = xScale(Math.min(68, bar.dr[1])) - 1.5
      const fullW = Math.max(0, x2 - x1)

      if (timelineYear === null) {
        clipRect.attr('width', fullW)
        return
      }
      if (timelineYear <= bar.dr[0]) { clipRect.attr('width', 0); return }
      if (timelineYear >= bar.dr[1]) { clipRect.attr('width', fullW); return }

      const progress = (timelineYear - bar.dr[0]) / (bar.dr[1] - bar.dr[0])
      clipRect.attr('width', fullW * progress)
    })
  }, [timelineYear])

  // ── Book diamond reveal ────────────────────────────────────────────────
  useEffect(() => {
    const g = d3.select(mainGRef.current)

    journeyData.books.forEach(book => {
      const bookG = g.select(`[data-book-group="${book.id}"]`)
      if (bookG.empty()) return

      if (timelineYear === null) {
        bookG.interrupt('reveal').attr('opacity', 1).attr('transform', null)
        return
      }

      const revealed    = book.dateRange[0] <= timelineYear
      const wasRevealed = revealedBooks.current.has(book.id)

      if (revealed && !wasRevealed) {
        revealedBooks.current.add(book.id)
        bookG
          .attr('opacity', 0)
          .attr('transform', 'translate(0,-10)')
        bookG.transition('reveal')
          .duration(420)
          .ease(d3.easeCubicOut)
          .attr('opacity', 1)
          .attr('transform', 'translate(0,0)')
      } else if (!revealed) {
        bookG.interrupt('reveal').attr('opacity', 0).attr('transform', 'translate(0,-10)')
      }
    })
  }, [timelineYear, isPlaying])

  // ── Drag — once on mount ───────────────────────────────────────────────
  useEffect(() => {
    const svg    = d3.select(svgRef.current)
    const scrubG = d3.select(scrubGRef.current)

    scrubG.style('display', 'none')

    scrubG.append('line').attr('class', 's-line')
      .attr('y1', 0).attr('y2', TH)
      .attr('stroke', '#c9a84c').attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 3').attr('stroke-opacity', 0.7)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('shape-rendering', 'crispEdges')
      .attr('pointer-events', 'none')

    const tip = scrubG.append('g').attr('class', 's-tip').attr('pointer-events', 'none')
    tip.append('rect')
      .attr('x', -54).attr('y', AXIS_Y + 2).attr('width', 108).attr('height', 14).attr('rx', 3)
      .attr('fill', '#0c0f18').attr('stroke', '#c9a84c')
      .attr('stroke-width', 0.5).attr('stroke-opacity', 0.55)
    tip.append('text')
      .attr('y', AXIS_Y + 12).attr('text-anchor', 'middle')
      .attr('font-family', 'Cinzel, serif').attr('font-size', 8.5)
      .attr('fill', '#c9a84c').attr('fill-opacity', 0.95)

    scrubG.append('circle').attr('class', 's-handle')
      .attr('cy', AXIS_Y).attr('r', 5.5)
      .attr('fill', '#c9a84c').attr('fill-opacity', 0.9)
      .attr('stroke', '#060d1a').attr('stroke-width', 1.5)
      .attr('pointer-events', 'all').style('cursor', 'ew-resize')

    let startClientX = 0

    svg.call(
      d3.drag()
        .filter(ev => !ev.target.closest('[data-book]') && !ev.target.closest('[data-bar-hit]'))
        .on('start', ev => { startClientX = ev.sourceEvent.clientX })
        .on('drag',  ev => {
          onYearChange(getSvgYear(ev.sourceEvent.clientX, svgRef.current))
        })
        .on('end', ev => {
          const dx = Math.abs(ev.sourceEvent.clientX - startClientX)
          if (dx < 4) {
            yearRef.current !== null
              ? onYearChange(null)
              : onYearChange(getSvgYear(ev.sourceEvent.clientX, svgRef.current))
          }
        })
    )

    return () => svg.on('.drag', null)
  }, [onYearChange])

  // ── Main render — capsule bars, axis, diamonds ─────────────────────────
  useEffect(() => {
    const g    = d3.select(mainGRef.current)
    const defs = d3.select(defsRef.current)
    g.selectAll('*').remove()
    defs.selectAll('*').remove()

    const currentYear = timelineYearRef.current
    const bs = bookStateRef.current

    // ── ClipPaths for progressive bar reveal ────────────────────────────
    CAPSULE_BARS.forEach(bar => {
      const x1    = xScale(Math.max(44, bar.dr[0])) + 1.5
      const x2    = xScale(Math.min(68, bar.dr[1])) - 1.5
      const fullW = Math.max(0, x2 - x1)
      let initialW = fullW
      if (currentYear !== null) {
        if (currentYear <= bar.dr[0]) initialW = 0
        else if (currentYear < bar.dr[1]) {
          const p = (currentYear - bar.dr[0]) / (bar.dr[1] - bar.dr[0])
          initialW = fullW * p
        }
      }
      defs.append('clipPath')
        .attr('id', `pbw-bar-clip-${bar.id}`)
        .append('rect')
        .attr('x', x1).attr('y', BY - 2)
        .attr('width', initialW)
        .attr('height', BH + 4)
        .attr('data-bar-clip', bar.id)
    })

    // ── Capsule bars (grouped so state 3 can ghost them) ────────────────
    const barsG = g.append('g')
      .attr('class', 'tl-bars')
      .attr('opacity', bs === 3 ? 0.07 : 1)

    CAPSULE_BARS.forEach(bar => {
      const x1 = xScale(Math.max(44, bar.dr[0])) + 1.5
      const x2 = xScale(Math.min(68, bar.dr[1])) - 1.5
      if (x2 <= x1) return
      const active = activeJourneys.has(bar.id)

      if (bar.dashed) {
        // Background track (always visible at low opacity)
        barsG.append('rect')
          .attr('x', x1).attr('y', BY).attr('width', x2 - x1).attr('height', BH).attr('rx', 5)
          .attr('fill', 'none')
          .attr('stroke', bar.color).attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '5 3')
          .attr('stroke-opacity', active ? 0.15 : 0.08)
          .attr('vector-effect', 'non-scaling-stroke')
        // Clipped foreground
        barsG.append('rect')
          .attr('x', x1).attr('y', BY).attr('width', x2 - x1).attr('height', BH).attr('rx', 5)
          .attr('fill', 'none')
          .attr('stroke', bar.color).attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '5 3')
          .attr('stroke-opacity', active ? 0.65 : 0.18)
          .attr('vector-effect', 'non-scaling-stroke')
          .attr('clip-path', `url(#pbw-bar-clip-${bar.id})`)
      } else {
        // Background track
        barsG.append('rect')
          .attr('x', x1).attr('y', BY).attr('width', x2 - x1).attr('height', BH).attr('rx', 5)
          .attr('fill', bar.color).attr('fill-opacity', active ? 0.12 : 0.06)
        // Clipped foreground
        barsG.append('rect')
          .attr('x', x1).attr('y', BY).attr('width', x2 - x1).attr('height', BH).attr('rx', 5)
          .attr('fill', bar.color).attr('fill-opacity', active ? 0.72 : 0.18)
          .attr('clip-path', `url(#pbw-bar-clip-${bar.id})`)
          .attr('filter', active ? 'url(#pbw-chip-shadow)' : null)
        // Glass sheen overlay (luminance only — journey hue stays true)
        barsG.append('rect')
          .attr('x', x1).attr('y', BY).attr('width', x2 - x1).attr('height', BH).attr('rx', 5)
          .attr('fill', 'url(#pbw-chip-sheen)')
          .attr('opacity', active ? 1 : 0.4)
          .attr('clip-path', `url(#pbw-bar-clip-${bar.id})`)
          .attr('pointer-events', 'none')
      }

      // Transparent hit area — click handled by React delegation on wrapper div
      barsG.append('rect')
        .attr('x', x1 - 1).attr('y', BY - 3)
        .attr('width', x2 - x1 + 2).attr('height', BH + 6).attr('rx', 5)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .attr('data-bar-hit', bar.id)
    })

    // ── Axis line + ticks + year labels ───────────────────────────────
    g.append('line')
      .attr('x1', 74).attr('x2', TW - 48).attr('y1', AXIS_Y).attr('y2', AXIS_Y)
      .attr('stroke', '#232a42').attr('stroke-width', 1)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('shape-rendering', 'crispEdges')

    YEAR_TICKS.forEach(yr => {
      const x = xScale(yr)
      g.append('line')
        .attr('x1', x).attr('x2', x).attr('y1', AXIS_Y - 3).attr('y2', AXIS_Y + 3)
        .attr('stroke', '#2e3858').attr('stroke-width', 1)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'crispEdges')
      g.append('text')
        .attr('x', x).attr('y', AXIS_Y - 8)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Cinzel, serif').attr('font-size', 10)
        .attr('fill', '#5c6078')
        .text(yr)
    })

    // ── Highlight range ────────────────────────────────────────────────
    if (highlightRange) {
      const x1 = xScale(highlightRange[0])
      const x2 = xScale(highlightRange[1])
      g.append('rect')
        .attr('x', x1 - 2).attr('y', 3).attr('width', Math.max(6, x2 - x1 + 4)).attr('height', TH - 6)
        .attr('fill', '#c9a84c').attr('fill-opacity', 0.06)
        .attr('stroke', '#c9a84c').attr('stroke-width', 0.5).attr('stroke-opacity', 0.2)
        .attr('pointer-events', 'none').attr('rx', 2)
    }

    // ── Left-side section labels ───────────────────────────────────────
    g.append('line')
      .attr('x1', 4).attr('x2', 76).attr('y1', SEP).attr('y2', SEP)
      .attr('stroke', '#2e3a58').attr('stroke-width', 1)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('shape-rendering', 'crispEdges')
    ;[
      { label: 'TIMELINE', cy: (BY + AXIS_Y) / 2,   cls: 'tl-lbl-timeline' },
      { label: 'BOOKS',    cy: bs === 3 ? 150 : 110, cls: 'tl-lbl-books' },
    ].forEach(({ label, cy, cls }) =>
      g.append('text')
        .attr('class', cls)
        .attr('x', 40).attr('y', cy + 3)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Cinzel, serif').attr('font-size', 7)
        .attr('letter-spacing', 1).attr('fill', '#7a8ab0')
        .attr('pointer-events', 'none')
        .text(label)
    )

    // ── State-3 pole mask — poles pass behind chip bodies ──────────────
    const poleMask = defs.append('mask')
      .attr('id', 'pbw-pole-mask')
      .attr('maskUnits', 'userSpaceOnUse')
    poleMask.append('rect')
      .attr('x', 0).attr('y', 0).attr('width', TW).attr('height', TH + 40)
      .attr('fill', 'white')
    BOOKS.forEach(b => {
      const lay = S3_CHIPS[b.id]
      const cy  = b.row === 0 ? CR0_S3 : CR1_S3
      poleMask.append('rect')
        .attr('x', lay.cx - lay.w / 2 + 1).attr('y', cy + 1)
        .attr('width', lay.w - 2).attr('height', CH_S3 - 2)
        .attr('rx', 5).attr('fill', 'black')
    })

    // Date anchor line for the books band (visible in state 3 only)
    g.append('line')
      .attr('class', 'tl-anchor-line')
      .attr('x1', 74).attr('x2', TW - 48).attr('y1', SEP).attr('y2', SEP)
      .attr('stroke', '#232a42').attr('stroke-width', 1)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('shape-rendering', 'crispEdges')
      .attr('opacity', bs === 3 ? 1 : 0)
      .attr('pointer-events', 'none')

    // ── Shared hover tooltip ───────────────────────────────────────────
    const tipG = g.append('g').attr('pointer-events', 'none').style('display', 'none')
    const tipRect = tipG.append('rect').attr('rx', 3)
      .attr('fill', '#0c0f18').attr('stroke', '#c9a84c')
      .attr('stroke-width', 0.5).attr('stroke-opacity', 0.75)
    const tipText = tipG.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Cinzel, serif').attr('font-size', 9)
      .attr('fill', '#c9a84c').attr('fill-opacity', 0.95)

    // ── Book chips (4-state system) ────────────────────────────────────
    BOOKS.forEach(b => {
      const col     = jColor[b.journeyId] ?? '#a09a8e'
      const sel     = selectedBookId === b.id
      const debated = b.attribution === 'debated'
      const cx      = xScale(b.dt)
      const p       = getP(b, bs)

      // Determine initial visibility for play mode
      const alreadyRevealed  = currentYear !== null && b.dateRange[0] <= currentYear
      const initialOpacity   = (currentYear !== null && !alreadyRevealed) ? 0 : 1
      const initialTransform = (currentYear !== null && !alreadyRevealed) ? 'translate(0,-10)' : null

      const bookG = g.append('g')
        .attr('data-book-group', b.id)
        .attr('opacity', initialOpacity)

      if (initialTransform) bookG.attr('transform', initialTransform)
      if (alreadyRevealed && currentYear !== null) revealedBooks.current.add(b.id)

      // State-3 flag pole + date anchor dot — non-scaling strokes stay crisp
      // under the stretched viewBox; poles are pure V/H so crispEdges is safe
      bookG.append('path')
        .attr('data-pole', b.id)
        .attr('d', polePath(b))
        .attr('fill', 'none')
        .attr('stroke', col).attr('stroke-width', 1.2)
        .attr('stroke-opacity', bs === 3 ? 0.75 : 0)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'crispEdges')
        .attr('mask', 'url(#pbw-pole-mask)')
        .attr('pointer-events', 'none')
      bookG.append('circle')
        .attr('data-adot', b.id)
        .attr('cx', cx).attr('cy', SEP).attr('r', 2.4)
        .attr('fill', col)
        .attr('fill-opacity', bs === 3 ? 0.95 : 0)
        .attr('pointer-events', 'none')

      // Flag stem — connects the state-0/1 dot to the journey bar band
      bookG.append('line')
        .attr('data-stem', b.id)
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', b.row === 0 ? FAY + FDR : BY + BH)
        .attr('y2', b.row === 0 ? BY : FBY - FDR)
        .attr('stroke', col).attr('stroke-width', 1)
        .attr('stroke-opacity', p.sto)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'crispEdges')
        .attr('pointer-events', 'none')

      // Flag ring — echoes the state-nav sequencer dots (visible in state 1)
      bookG.append('circle')
        .attr('data-ring', b.id)
        .attr('cx', cx).attr('cy', b.row === 0 ? FAY : FBY)
        .attr('r', FDR + 2.4)
        .attr('fill', 'none')
        .attr('stroke', col)
        .attr('stroke-width', 1)
        .attr('stroke-opacity', bs === 1 ? 0.45 : 0)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('pointer-events', 'none')

      // Chip body — one rounded rect morphs dot → compact chip → full chip
      bookG.append('rect')
        .attr('data-chip', b.id)
        .attr('data-book', b.id)
        .attr('x', p.x).attr('y', p.y)
        .attr('width', p.w).attr('height', p.h).attr('rx', p.rx)
        .attr('fill', col)
        .attr('fill-opacity', sel ? Math.min(p.fo + 0.2, 1) : p.fo)
        .attr('stroke', sel ? '#e9c86c' : col)
        .attr('stroke-width', sel ? 1.8 : 1.25)
        .attr('stroke-opacity', sel ? Math.min(p.so + 0.3, 1) : p.so)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('filter', sel ? 'url(#pbw-chip-glow)' : 'url(#pbw-chip-shadow)')
        .style('cursor', 'pointer')
        .style('pointer-events', bs === 0 ? 'none' : 'all')
        .on('click', ev => { ev.stopPropagation(); onBookClick(b.id) })
        .on('mouseenter', () => {
          const s = bookStateRef.current
          const q = getP(b, s)
          tipText
            .attr('font-style', debated ? 'italic' : 'normal')
            .attr('fill', sel ? '#e9c86c' : col)
            .text(`${b.name} · ${dateLabel(b)}`)
          const tw  = tipText.node().getComputedTextLength()
          const rw  = tw + 16, rh = 14
          const tcx = clamp(q.x + q.w / 2, rw / 2 + 4, TW - rw / 2 - 4)
          let ry = q.y - rh - 6
          if (ry < VIEWBOXES[s][1] + 2) ry = q.y + q.h + 6
          tipRect.attr('x', tcx - rw / 2).attr('y', ry).attr('width', rw).attr('height', rh)
          tipText.attr('x', tcx).attr('y', ry + rh - 3)
          tipG.style('display', null)
        })
        .on('mouseleave', () => tipG.style('display', 'none'))

      // Glass sheen overlay — luminance-only gradient, doesn't tint the journey color
      bookG.append('rect')
        .attr('data-sheen', b.id)
        .attr('x', p.x).attr('y', p.y)
        .attr('width', p.w).attr('height', p.h).attr('rx', p.rx)
        .attr('fill', 'url(#pbw-chip-sheen)')
        .attr('opacity', p.so)
        .attr('pointer-events', 'none')

      // Abbreviation — visible in state 2
      const aa = abbrevAttrs(b, bs)
      bookG.append('text')
        .attr('data-abbrev', b.id)
        .attr('x', aa.x).attr('y', aa.y)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Cinzel, serif').attr('font-size', 9)
        .attr('font-style', debated ? 'italic' : 'normal')
        .attr('fill', sel ? '#e9c86c' : col)
        .attr('fill-opacity', aa.o)
        .attr('pointer-events', 'none')
        .text(b.abbrev)

      // Full name + date — visible in state 3
      const na = nameAttrs(b, bs)
      bookG.append('text')
        .attr('data-name', b.id)
        .attr('x', na.x).attr('y', na.y)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Cinzel, serif').attr('font-size', 10.5)
        .attr('letter-spacing', 0.5)
        .attr('font-style', debated ? 'italic' : 'normal')
        .attr('fill', sel ? '#e9c86c' : col)
        .attr('fill-opacity', na.o)
        .attr('pointer-events', 'none')
        .text(b.name)

      const da = dateAttrs(b, bs)
      bookG.append('text')
        .attr('data-date', b.id)
        .attr('x', da.x).attr('y', da.y)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Cormorant Garamond, serif')
        .attr('font-style', 'italic').attr('font-size', 8.5)
        .attr('fill', col)
        .attr('fill-opacity', da.o)
        .attr('pointer-events', 'none')
        .text(dateLabel(b))
    })

    tipG.raise()

    // ── Dock magnification for state-1 flag dots ───────────────────────
    const svgSel = d3.select(svgRef.current)
    svgSel.on('mousemove.dock', ev => {
      if (bookStateRef.current !== 1) return
      const [mx] = d3.pointer(ev, svgRef.current)
      BOOKS.forEach(b => {
        const cx = xScale(b.dt)
        const r  = FDR * (1 + 1.5 * Math.exp(-(((cx - mx) / 45) ** 2)))
        const dy = b.row === 0 ? FAY : FBY
        const x = cx - r, y = dy - r, wh = 2 * r
        g.select(`[data-chip="${b.id}"]`).attr('x', x).attr('y', y).attr('width', wh).attr('height', wh).attr('rx', r)
        g.select(`[data-sheen="${b.id}"]`).attr('x', x).attr('y', y).attr('width', wh).attr('height', wh).attr('rx', r)
        g.select(`[data-ring="${b.id}"]`).attr('r', r + 2.4)
      })
    })
    svgSel.on('mouseleave.dock', () => {
      if (bookStateRef.current !== 1) return
      BOOKS.forEach(b => {
        const q = getP(b, 1)
        g.select(`[data-chip="${b.id}"]`).attr('x', q.x).attr('y', q.y).attr('width', q.w).attr('height', q.h).attr('rx', q.rx)
        g.select(`[data-sheen="${b.id}"]`).attr('x', q.x).attr('y', q.y).attr('width', q.w).attr('height', q.h).attr('rx', q.rx)
        g.select(`[data-ring="${b.id}"]`).attr('r', FDR + 2.4)
      })
    })

  }, [activeJourneys, selectedBookId, highlightRange, onBookClick, isPlaying, detailJourneyId])

  // ── 4-state transition — morph chips, poles, bars, and viewBox ────────
  useEffect(() => {
    bookStateRef.current = bookState
    const svg = d3.select(svgRef.current)
    const g   = d3.select(mainGRef.current)

    if (!bookStateInit.current) {
      bookStateInit.current = true
      svg.attr('viewBox', VIEWBOXES[bookState].join(' '))
      return
    }

    const dur = 650, ease = d3.easeCubicInOut

    svg.transition('bookState').duration(dur).ease(ease)
      .attr('viewBox', VIEWBOXES[bookState].join(' '))

    g.select('.tl-bars').transition('bookState').duration(dur).ease(ease)
      .attr('opacity', bookState === 3 ? 0.07 : 1)
    g.select('.tl-anchor-line').transition('bookState').duration(dur).ease(ease)
      .attr('opacity', bookState === 3 ? 1 : 0)
    g.select('.tl-lbl-books').transition('bookState').duration(dur).ease(ease)
      .attr('y', (bookState === 3 ? 150 : 110) + 3)

    BOOKS.forEach(b => {
      const bookG = g.select(`[data-book-group="${b.id}"]`)
      if (bookG.empty()) return
      const sel = selectedBookIdRef.current === b.id
      const p   = getP(b, bookState)

      bookG.select('[data-chip]')
        .style('pointer-events', bookState === 0 ? 'none' : 'all')
        .transition('bookState').duration(dur).ease(ease)
        .attr('x', p.x).attr('y', p.y)
        .attr('width', p.w).attr('height', p.h).attr('rx', p.rx)
        .attr('fill-opacity', sel ? Math.min(p.fo + 0.2, 1) : p.fo)
        .attr('stroke-opacity', sel ? Math.min(p.so + 0.3, 1) : p.so)

      bookG.select('[data-sheen]').transition('bookState').duration(dur).ease(ease)
        .attr('x', p.x).attr('y', p.y)
        .attr('width', p.w).attr('height', p.h).attr('rx', p.rx)
        .attr('opacity', p.so)

      bookG.select('[data-stem]').transition('bookState').duration(dur).ease(ease)
        .attr('stroke-opacity', p.sto)
      bookG.select('[data-ring]').transition('bookState').duration(dur).ease(ease)
        .attr('stroke-opacity', bookState === 1 ? 0.45 : 0)
      bookG.select('[data-pole]').transition('bookState').duration(dur).ease(ease)
        .attr('stroke-opacity', bookState === 3 ? 0.75 : 0)
      bookG.select('[data-adot]').transition('bookState').duration(dur).ease(ease)
        .attr('fill-opacity', bookState === 3 ? 0.95 : 0)

      const aa = abbrevAttrs(b, bookState)
      bookG.select('[data-abbrev]').transition('bookState').duration(dur).ease(ease)
        .attr('x', aa.x).attr('y', aa.y).attr('fill-opacity', aa.o)
      const na = nameAttrs(b, bookState)
      bookG.select('[data-name]').transition('bookState').duration(dur).ease(ease)
        .attr('x', na.x).attr('y', na.y).attr('fill-opacity', na.o)
      const da = dateAttrs(b, bookState)
      bookG.select('[data-date]').transition('bookState').duration(dur).ease(ease)
        .attr('x', da.x).attr('y', da.y).attr('fill-opacity', da.o)
    })
  }, [bookState])

  const detailJourney  = detailJourneyId ? journeyData.journeys.find(j => j.id === detailJourneyId) : null
  const selectedBook   = selectedBookId  ? journeyData.books.find(b => b.id === selectedBookId)    : null
  const showStoryRow   = !!selectedBook && !detailJourneyId && !!BOOK_CHURCH[selectedBookId]

  function handleBarClick(ev) {
    const hit = ev.target.closest('[data-bar-hit]')
    if (!hit) return
    const id = hit.getAttribute('data-bar-hit')
    onDetailJourneyChange(detailJourneyId === id ? null : id)
  }

  const [tlHeight, setTlHeight] = useState(null)
  const dragRef = useRef(null)

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = e.currentTarget.closest('.timeline-bar').getBoundingClientRect().height
    dragRef.current = { startY, startH }

    function onMove(ev) {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      setTlHeight(Math.max(120, Math.min(600, dragRef.current.startH + delta)))
    }
    function onUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // Aspect-locked height: uniform x/y scale for the overview SVG, clamped
  const autoHeight = Math.round(Math.max(
    H_MIN[bookState],
    Math.min(H_MAX[bookState], tlWidth * VIEWBOXES[bookState][3] / TW)
  ))

  const barStyle = tlHeight
    ? { height: tlHeight }
    : detailJourneyId
      ? undefined
      : {
          height: autoHeight + (showStoryRow ? 68 : 0),
          transition: 'height 0.65s cubic-bezier(0.65, 0, 0.35, 1)',
        }

  return (
    <>
      {!detailJourneyId && (
        <div className="tl-state-nav">
          <span className="tl-state-nav__label">{STATE_LABELS[bookState]}</span>
          <div className="tl-state-nav__dots">
            {[0, 1, 2, 3].map(s => (
              <button
                key={s}
                className={`tl-state-dot${s === bookState ? ' tl-state-dot--active' : ''}`}
                onClick={() => setBookState(s)}
                aria-label={STATE_LABELS[s]}
                title={STATE_LABELS[s]}
              />
            ))}
          </div>
          <button
            className="tl-state-next"
            onClick={() => setBookState((bookState + 1) % 4)}
          >
            {bookState < 3 ? 'Next ›' : '‹ Journeys'}
          </button>
        </div>
      )}
    <div
      ref={rootRef}
      className={`timeline-bar${detailJourneyId ? ' timeline-bar--detail' : ''}${showStoryRow ? ' timeline-bar--story' : ''}`}
      style={barStyle}
      onClick={handleBarClick}
    >
      <div className="tl-resize-handle" onMouseDown={handleResizeStart} />

      {/* Overview area — flex column so story row shares vertical space */}
      <div className="tl-overview-area" style={{ display: detailJourneyId ? 'none' : 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Main overview SVG — viewBox is set imperatively (animated per book state) */}
        <svg
          ref={svgRef}
          preserveAspectRatio="none"
          style={{ width: '100%', flex: 1, cursor: 'crosshair', minHeight: 0 }}
        >
          <defs>
            {/* Soft elevation shadow — gives bars/chips a lifted, glassmorphic feel */}
            <filter id="pbw-chip-shadow" x="-40%" y="-60%" width="180%" height="260%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
            </filter>
            {/* Soft gold glow for the selected book chip */}
            <filter id="pbw-chip-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Luminance-only sheen — top highlight fading to a faint base shadow */}
            <linearGradient id="pbw-chip-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.16" />
              <stop offset="45%"  stopColor="#ffffff" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
            </linearGradient>
          </defs>
          <defs ref={defsRef} />
          <g ref={mainGRef} />
          <g ref={scrubGRef} />
        </svg>

        {/* City story row — shown when a book is selected */}
        {showStoryRow && (
          <div className="tl-story-wrap">
            <CityStoryRow
              selectedBook={selectedBook}
              onJourneyDrill={onDetailJourneyChange}
            />
          </div>
        )}
      </div>

      {/* Detail view */}
      {detailJourneyId && (
        <div className="tl-detail">
          <div className="tl-mini-header">
            <button
              className="tl-breadcrumb"
              onClick={() => onDetailJourneyChange(null)}
            >
              ← Overview
            </button>
            <svg
              className="tl-mini-strip"
              viewBox={`0 0 ${TW} 30`}
              preserveAspectRatio="none"
            >
              {CAPSULE_BARS.map(bar => {
                const x1 = xScale(Math.max(44, bar.dr[0])) + 1.5
                const x2 = xScale(Math.min(68, bar.dr[1])) - 1.5
                if (x2 <= x1) return null
                const isSelected = bar.id === detailJourneyId
                return (
                  <rect
                    key={bar.id}
                    x={x1} y={8} width={x2 - x1} height={14} rx={5}
                    fill={bar.color}
                    fillOpacity={isSelected ? 0.75 : 0.18}
                    stroke={isSelected ? bar.color : 'none'}
                    strokeOpacity={0.5}
                    strokeWidth={isSelected ? 1 : 0}
                  />
                )
              })}
            </svg>
            <span className="tl-detail-name">
              {detailJourney?.shortName}
            </span>
          </div>
          <TimelineDetail
            journey={detailJourney}
            churchEvents={churchEvents ?? []}
            activeChurchTracks={activeChurchTracks ?? new Set()}
            onChurchTrackToggle={onChurchTrackToggle ?? (() => {})}
            timelineYear={timelineYear}
            onCityHover={onCityHover}
            hoveredCityId={hoveredCityId}
            selectedBookId={selectedBookId}
            onBookSelect={onBookClick}
          />
        </div>
      )}
    </div>
    </>
  )
}
