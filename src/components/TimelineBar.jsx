import { useRef, useEffect, useState, useCallback } from 'react'
import * as d3 from 'd3'
import journeyData from '../data/pauline-journeys-data.json'
import TimelineDetail from './TimelineDetail'

const TW = 1200
const TH = 180

const TRACK_Y  = 8
const TRACK_H  = 14

const AXIS_Y   = 46

const D0_CY    = 88
const D1_CY    = 135
const DR       = 8

const xScale = d3.scaleLinear().domain([44, 68]).range([80, 1140])

const CAPSULE_BARS = journeyData.journeys.map(j => ({
  id: j.id, color: j.color, dr: j.dateRange, dashed: j.id === 'post-rome',
}))

const YEAR_TICKS = [44, 46, 49, 52, 57, 60, 62, 67]

const jColor = {}
journeyData.journeys.forEach(j => { jColor[j.id] = j.color })

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
        stroke="#c9a84c" strokeWidth={0.8} strokeOpacity={0.18} strokeDasharray="4 4" />

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
      .attr('pointer-events', 'none')

    const tip = scrubG.append('g').attr('class', 's-tip').attr('pointer-events', 'none')
    tip.append('rect')
      .attr('x', -54).attr('y', AXIS_Y + 4).attr('width', 108).attr('height', 14).attr('rx', 3)
      .attr('fill', '#0c0f18').attr('stroke', '#c9a84c')
      .attr('stroke-width', 0.5).attr('stroke-opacity', 0.55)
    tip.append('text')
      .attr('y', AXIS_Y + 14).attr('text-anchor', 'middle')
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
        .attr('x', x1).attr('y', TRACK_Y - 2)
        .attr('width', initialW)
        .attr('height', TRACK_H + 4)
        .attr('data-bar-clip', bar.id)
    })

    // ── Capsule bars ────────────────────────────────────────────────────
    CAPSULE_BARS.forEach(bar => {
      const x1 = xScale(Math.max(44, bar.dr[0])) + 1.5
      const x2 = xScale(Math.min(68, bar.dr[1])) - 1.5
      if (x2 <= x1) return
      const active = activeJourneys.has(bar.id)

      if (bar.dashed) {
        // Background track (always visible at low opacity)
        g.append('rect')
          .attr('x', x1).attr('y', TRACK_Y).attr('width', x2 - x1).attr('height', TRACK_H).attr('rx', 5)
          .attr('fill', 'none')
          .attr('stroke', bar.color).attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '5 3')
          .attr('stroke-opacity', active ? 0.15 : 0.08)
        // Clipped foreground
        g.append('rect')
          .attr('x', x1).attr('y', TRACK_Y).attr('width', x2 - x1).attr('height', TRACK_H).attr('rx', 5)
          .attr('fill', 'none')
          .attr('stroke', bar.color).attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '5 3')
          .attr('stroke-opacity', active ? 0.65 : 0.18)
          .attr('clip-path', `url(#pbw-bar-clip-${bar.id})`)
      } else {
        // Background track
        g.append('rect')
          .attr('x', x1).attr('y', TRACK_Y).attr('width', x2 - x1).attr('height', TRACK_H).attr('rx', 5)
          .attr('fill', bar.color).attr('fill-opacity', active ? 0.12 : 0.06)
        // Clipped foreground
        g.append('rect')
          .attr('x', x1).attr('y', TRACK_Y).attr('width', x2 - x1).attr('height', TRACK_H).attr('rx', 5)
          .attr('fill', bar.color).attr('fill-opacity', active ? 0.72 : 0.18)
          .attr('clip-path', `url(#pbw-bar-clip-${bar.id})`)
      }

      // Transparent hit area — click handled by React delegation on wrapper div
      g.append('rect')
        .attr('x', x1 - 1).attr('y', TRACK_Y - 3)
        .attr('width', x2 - x1 + 2).attr('height', TRACK_H + 6).attr('rx', 5)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .attr('data-bar-hit', bar.id)
    })

    // ── Axis line + ticks + year labels ───────────────────────────────
    g.append('line')
      .attr('x1', 74).attr('x2', TW - 48).attr('y1', AXIS_Y).attr('y2', AXIS_Y)
      .attr('stroke', '#232a42').attr('stroke-width', 1)

    YEAR_TICKS.forEach(yr => {
      const x = xScale(yr)
      g.append('line')
        .attr('x1', x).attr('x2', x).attr('y1', AXIS_Y - 3).attr('y2', AXIS_Y + 3)
        .attr('stroke', '#2e3858').attr('stroke-width', 1)
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
    const SEP_Y = 54
    g.append('line')
      .attr('x1', 4).attr('x2', 76).attr('y1', SEP_Y).attr('y2', SEP_Y)
      .attr('stroke', '#2e3a58').attr('stroke-width', 1)
    ;[
      { label: 'TIMELINE', cy: (TRACK_Y + SEP_Y) / 2 },
      { label: 'BOOKS',    cy: (SEP_Y + TH) / 2      },
    ].forEach(({ label, cy }) =>
      g.append('text')
        .attr('x', 40).attr('y', cy + 3)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Cinzel, serif').attr('font-size', 7)
        .attr('letter-spacing', 1).attr('fill', '#7a8ab0')
        .attr('pointer-events', 'none')
        .text(label)
    )

    // ── Diamond spreading ─────────────────────────────────────────────
    const origCxMap = new Map(
      journeyData.books.map((book) => [book.id, xScale((book.dateRange[0] + book.dateRange[1]) / 2)])
    )
    const adjCxMap = new Map(origCxMap)
    const byCluster = new Map()
    journeyData.books.forEach((book, i) => {
      const key = `${i % 2}_${Math.round(origCxMap.get(book.id))}`
      if (!byCluster.has(key)) byCluster.set(key, [])
      byCluster.get(key).push({ book, i })
    })
    byCluster.forEach(group => {
      if (group.length < 2) return
      const base = origCxMap.get(group[0].book.id)
      const step = 13
      group.forEach(({ book }, j) =>
        adjCxMap.set(book.id, base + (j - (group.length - 1) / 2) * step)
      )
    })

    // ── Book diamond label placement ───────────────────────────────────
    const LEVELS_D0 = [60, 72, 107, 119, 154, 167]
    const LEVELS_D1 = [154, 167, 107, 119, 60, 72]
    const occMap = { 60:[], 72:[], 107:[], 119:[], 154:[], 167:[] }

    const claimY = (cx, abbrev, levels) => {
      const halfW = abbrev.length * 9 * 0.58 / 2 + 5
      for (const y of levels) {
        if (!occMap[y].some(s => cx + halfW > s.x1 && cx - halfW < s.x2)) {
          occMap[y].push({ x1: cx - halfW, x2: cx + halfW })
          return y
        }
      }
      occMap[levels[0]].push({ x1: cx - halfW, x2: cx + halfW })
      return levels[0]
    }

    const labelYMap = new Map()
    journeyData.books
      .map((book, i) => ({ book, i, cx: adjCxMap.get(book.id) }))
      .sort((a, b) => a.cx - b.cx)
      .forEach(({ book, i, cx }) =>
        labelYMap.set(book.id, claimY(cx, book.abbrev, i % 2 === 0 ? LEVELS_D0 : LEVELS_D1))
      )

    // ── Shared hover tooltip ───────────────────────────────────────────
    const tipG = g.append('g').attr('pointer-events', 'none').style('display', 'none')
    const tipRect = tipG.append('rect').attr('rx', 3)
      .attr('fill', '#0c0f18').attr('stroke', '#c9a84c')
      .attr('stroke-width', 0.5).attr('stroke-opacity', 0.75)
    const tipText = tipG.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Cinzel, serif').attr('font-size', 9)
      .attr('fill', '#c9a84c').attr('fill-opacity', 0.95)

    // ── Book groups (connector + diamond + label) ──────────────────────
    journeyData.books.forEach((book, i) => {
      const cx      = adjCxMap.get(book.id)
      const isEven  = i % 2 === 0
      const cy      = isEven ? D0_CY : D1_CY
      const col     = jColor[book.journeyId] ?? '#a09a8e'
      const sel     = selectedBookId === book.id
      const debated = book.attribution === 'debated'

      // Determine initial visibility for play mode
      const alreadyRevealed = currentYear !== null && book.dateRange[0] <= currentYear
      const initialOpacity  = (currentYear !== null && !alreadyRevealed) ? 0 : 1
      const initialTransform = (currentYear !== null && !alreadyRevealed) ? 'translate(0,-10)' : null

      const bookG = g.append('g')
        .attr('data-book-group', book.id)
        .attr('opacity', initialOpacity)

      if (initialTransform) bookG.attr('transform', initialTransform)
      if (alreadyRevealed && currentYear !== null) revealedBooks.current.add(book.id)

      // Connector line
      bookG.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', cy - DR).attr('y2', TRACK_Y + TRACK_H)
        .attr('stroke', col).attr('stroke-width', 0.8)
        .attr('stroke-opacity', 0.4)
        .attr('pointer-events', 'none')

      // Error bar for dateDebated books
      if (book.dateDebated) {
        const ex1 = xScale(book.dateRange[0])
        const ex2 = xScale(book.dateRange[1])
        bookG.append('line')
          .attr('x1', ex1).attr('x2', ex2).attr('y1', cy).attr('y2', cy)
          .attr('stroke', col).attr('stroke-width', 1).attr('stroke-opacity', 0.3)
          .attr('pointer-events', 'none')
        ;[ex1, ex2].forEach(ex =>
          bookG.append('line')
            .attr('x1', ex).attr('x2', ex).attr('y1', cy - 4).attr('y2', cy + 4)
            .attr('stroke', col).attr('stroke-width', 1).attr('stroke-opacity', 0.3)
            .attr('pointer-events', 'none')
        )
      }

      // Gold ring when selected
      if (sel) {
        bookG.append('polygon')
          .attr('points', `${cx},${cy-DR-5} ${cx+DR+5},${cy} ${cx},${cy+DR+5} ${cx-DR-5},${cy}`)
          .attr('fill', 'none')
          .attr('stroke', '#e9c86c').attr('stroke-width', 1.5).attr('stroke-opacity', 0.9)
          .attr('pointer-events', 'none')
      }

      // Diamond
      bookG.append('polygon')
        .attr('class', 'book-diamond')
        .attr('data-book', book.id)
        .attr('points', `${cx},${cy-DR} ${cx+DR},${cy} ${cx},${cy+DR} ${cx-DR},${cy}`)
        .attr('fill', sel ? col : '#13182a')
        .attr('fill-opacity', sel ? 0.9 : 0.55)
        .attr('stroke', col).attr('stroke-width', 1.2).attr('stroke-opacity', sel ? 0.15 : 0.8)
        .style('cursor', 'pointer')
        .on('click', ev => { ev.stopPropagation(); onBookClick(book.id) })
        .on('mouseenter', () => {
          tipText
            .attr('font-style', debated ? 'italic' : 'normal')
            .attr('fill', sel ? '#e9c86c' : col)
            .text(book.name)
          const tw = tipText.node().getComputedTextLength()
          const rw = tw + 16, rh = 14
          const ry = cy - DR - rh - 6
          tipRect.attr('x', cx - rw / 2).attr('y', ry).attr('width', rw).attr('height', rh)
          tipText.attr('x', cx).attr('y', ry + rh - 3)
          tipG.style('display', null)
        })
        .on('mouseleave', () => tipG.style('display', 'none'))

      // Abbreviation label
      bookG.append('text')
        .attr('x', cx).attr('y', labelYMap.get(book.id))
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Cinzel, serif').attr('font-size', 9)
        .attr('font-style', debated ? 'italic' : 'normal')
        .attr('fill', sel ? '#e9c86c' : col)
        .attr('fill-opacity', sel ? 1 : 0.75)
        .attr('pointer-events', 'none')
        .text(book.abbrev)
    })

    tipG.raise()

  }, [activeJourneys, selectedBookId, highlightRange, onBookClick, isPlaying, detailJourneyId])

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

  return (
    <div
      className={`timeline-bar${detailJourneyId ? ' timeline-bar--detail' : ''}${showStoryRow ? ' timeline-bar--story' : ''}`}
      style={tlHeight ? { height: tlHeight } : undefined}
      onClick={handleBarClick}
    >
      <div className="tl-resize-handle" onMouseDown={handleResizeStart} />

      {/* Overview area — flex column so story row shares vertical space */}
      <div className="tl-overview-area" style={{ display: detailJourneyId ? 'none' : 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Main overview SVG */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${TW} ${TH}`}
          preserveAspectRatio="none"
          style={{ width: '100%', flex: 1, cursor: 'crosshair', minHeight: 0 }}
        >
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
  )
}
