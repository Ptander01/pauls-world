import { useRef, useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import countries50m from 'world-atlas/countries-50m.json'
import journeyData from '../data/pauline-journeys-data.json'

const W = 1200
const H = 680

function haversineKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)))
}

const JOURNEY_MAP = {
  'journey-1':    journeyData.colorSystem.journey1,
  'journey-2':    journeyData.colorSystem.journey2,
  'journey-3':    journeyData.colorSystem.journey3,
  'rome-journey': journeyData.colorSystem.romeJourney,
  'post-rome':    journeyData.colorSystem.postRome,
}

// d3-geo treats polygon rings spherically: a ring wound the "wrong" way fills
// everything OUTSIDE it (the 10m land rings sum to 41 steradians — sea renders
// as land). Rewind any ring that claims more than half the sphere. Note
// topojson.feature returns a FeatureCollection for world-atlas land (it's a
// GeometryCollection object), so walk that shape too.
function rewindRings(node) {
  if (node.type === 'FeatureCollection') {
    node.features.forEach(rewindRings)
    return node
  }
  const fixPoly = polyCoords => polyCoords.map(ring =>
    d3.geoArea({ type: 'Polygon', coordinates: [ring] }) > 2 * Math.PI
      ? ring.slice().reverse()
      : ring
  )
  const geom = node.geometry ?? node
  if (geom.type === 'Polygon') geom.coordinates = fixPoly(geom.coordinates)
  else if (geom.type === 'MultiPolygon') geom.coordinates = geom.coordinates.map(fixPoly)
  return node
}

// ── Journey segment helpers (sea/land split rendering + progressive reveal) ──

// Sample a sub-range of a path into a polyline that matches the curve shape
function samplePath(node, l0, l1, step = 6) {
  const pts = []
  const n = Math.max(2, Math.ceil((l1 - l0) / step))
  for (let i = 0; i <= n; i++) {
    const p = node.getPointAtLength(l0 + ((l1 - l0) * i) / n)
    pts.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`)
  }
  return 'M' + pts.join('L')
}

// Progressive reveal for a dashed segment: emit the dash pattern up to
// `visible`, then extend/append a gap large enough to swallow the rest.
// (stroke-dashoffset only shifts a pattern — it can't truncate one.)
function dashedRevealArray(visible, segLen, dash, gap) {
  if (visible <= 0.1) return `0 ${Math.ceil(segLen) + 12}`
  if (visible >= segLen - 0.5) return `${dash} ${gap}`
  const parts = []
  let acc = 0
  while (acc < visible) {
    const d = Math.min(dash, visible - acc)
    parts.push(d.toFixed(1))
    acc += d
    if (acc >= visible) break
    const g = Math.min(gap, visible - acc)
    parts.push(g.toFixed(1))
    acc += g
  }
  const rest = Math.ceil(segLen - acc) + 12
  if (parts.length % 2 === 1) parts.push(rest)
  else parts[parts.length - 1] = (parseFloat(parts[parts.length - 1]) + rest).toFixed(1)
  return parts.join(' ')
}

// Reveal state for a journey at a year (null year = no scrub → full route).
// Returns { len, op }, or null when the journey should keep its current state.
function revealStateFor(journey, jd, year, isActive) {
  if (year === null) return { len: jd.total, op: jd.baseOpacity }
  if (!isActive) return null
  if (year < journey.dateRange[0]) return { len: 0, op: jd.baseOpacity }
  if (journey.dateRange[1] <= year) return { len: jd.total, op: 0.18 }
  const wps = jd.wps
  const nextIdx = wps.findIndex(wp => wp.year > year)
  let len
  if (nextIdx === -1) len = jd.total
  else if (nextIdx === 0) len = 0
  else {
    const prevIdx = nextIdx - 1
    const denom   = wps[nextIdx].year - wps[prevIdx].year
    const t       = denom > 0 ? Math.max(0, Math.min(1, (year - wps[prevIdx].year) / denom)) : 1
    len = jd.wpLengths[prevIdx] + t * (jd.wpLengths[nextIdx] - jd.wpLengths[prevIdx])
  }
  return { len, op: jd.baseOpacity }
}

// Apply a reveal state to every segment, casing, and chevron of a journey
function applyRevealState(jd, revealLen, opacity) {
  jd.segs.forEach(seg => {
    const segLen = seg.l1 - seg.l0
    const vis = Math.max(0, Math.min(segLen, revealLen - seg.l0))
    const el = d3.select(seg.el)
    if (seg.dash) el.attr('stroke-dasharray', dashedRevealArray(vis, segLen, seg.dash[0], seg.dash[1]))
    else el.attr('stroke-dashoffset', segLen - vis)
    el.attr('stroke-opacity', opacity)
    if (seg.caseEl) {
      d3.select(seg.caseEl)
        .attr('stroke-dashoffset', segLen - vis)
        .attr('stroke-opacity', opacity)
    }
  })
  jd.chevrons.forEach(c => {
    d3.select(c.el).attr('opacity',
      opacity > 0.1 && c.len <= revealLen ? Math.min(0.6, opacity * 0.7) : 0)
  })
}

function normalizeProvinceName(rawName) {
  const map = {
    'Asia':                  'asia',
    'Macedonia':             'macedonia',
    'Achaia':                'achaia',
    'Syria':                 'syria',
    'Galatia et Cappadocia': 'galatia',
    'Galatia':               'galatia',
    'Cilicia':               'cilicia',
    'Cyprus':                'cyprus',
    'Sicilia':               'sicilia',
    'Dalmatia':              'dalmatia',
    'Thracia':               'thracia',
    'Bithynia et Pontus':    'bithynia-pontus',
    'Lycia et Pamphylia':    'lycia-pamphylia',
    'Creta et Cyrene':       'creta-cyrenaica',
    'Africa Proconsularis':  'africa-proconsularis',
    'Iudaea':                'iudaea',
    'I':   'italia', 'II':  'italia', 'III': 'italia', 'IV': 'italia',
    'V':   'italia', 'VI':  'italia', 'VII': 'italia', 'VIII': 'italia',
    'IX':  'italia', 'X':   'italia', 'XI':  'italia',
  }
  return map[rawName] ?? rawName.toLowerCase().replace(/\s+/g, '-')
}

function applyZoomStyling(mapGEl, k) {
  const g = d3.select(mapGEl)
  // Labels hold constant screen size (1/k); halo width tracks the font
  g.selectAll('.province-label').attr('font-size', 9 / k).attr('stroke-width', 2.4 / k)
  g.selectAll('.label-t1').attr('font-size', 13 / k).attr('stroke-width', 3 / k)
  g.selectAll('.label-t2').attr('font-size', 11 / k).attr('stroke-width', 2.6 / k).attr('opacity', k >= 2   ? 0.85 : 0)
  g.selectAll('.label-t3').attr('font-size',  9 / k).attr('stroke-width', 2.2 / k).attr('opacity', k >= 3.5 ? 0.75 : 0)
  g.selectAll('.road-label').attr('font-size', 9 / k).attr('stroke-width', 2.4 / k).attr('letter-spacing', 3 / k)

  // Strokes and dots thin gently under zoom: rendered size grows as k^0.4
  // instead of k, so zoomed-in lines stay lines rather than ribbons.
  const s = Math.pow(k, 0.6)
  g.selectAll('.journey-line').attr('stroke-width', 2 / s)
  g.selectAll('.journey-case').attr('stroke-width', 3.6 / s)
  g.selectAll('.paul-marker-halo').attr('r', 7 / s)
  g.selectAll('.paul-marker-core').attr('r', 2.8 / s).attr('stroke-width', 0.9 / s)
  g.selectAll('.route-chevron').each(function () {
    const d = this.dataset
    d3.select(this).attr('transform', `translate(${d.x},${d.y}) rotate(${d.a}) scale(${1 / s})`)
  })
  g.selectAll('.map-graticule').attr('stroke-width', 0.5 / s)
  g.selectAll('.map-borders').attr('stroke-width', 0.7 / s)
  g.selectAll('.map-coast').attr('stroke-width', 0.6 / s)
  g.selectAll('.province-border').attr('stroke-width', 0.8 / s)
  g.selectAll('.via-egnatia').attr('stroke-width', 0.8 / s)
  g.selectAll('.seg-hit').attr('stroke-width', 12 / k) // hit zone stays screen-constant

  g.selectAll('.city-dot').each(function () {
    const el  = d3.select(this)
    const r0  = parseFloat(this.dataset.r0 ?? this.getAttribute('r'))
    const sw0 = parseFloat(this.dataset.sw0 ?? this.getAttribute('stroke-width'))
    el.attr('r', r0 / s).attr('stroke-width', sw0 / s)
  })
}

function labelBox(lx, ly, text, fontSize, ta) {
  const w = text.length * fontSize * 0.62
  const h = fontSize
  let x1 = lx
  if (ta === 'end')    x1 = lx - w
  else if (ta === 'middle') x1 = lx - w / 2
  return { x1, y1: ly - h * 0.85, x2: x1 + w, y2: ly + h * 0.2 }
}

function boxesOverlap(a, b) {
  return a.x1 < b.x2 + 2 && a.x2 > b.x1 - 2 && a.y1 < b.y2 + 2 && a.y2 > b.y1 - 2
}

const LABEL_TRIES = [
  { dx:  5, dy:  3, ta: 'start'  },
  { dx: -5, dy:  3, ta: 'end'    },
  { dx:  5, dy: -7, ta: 'start'  },
  { dx: -5, dy: -7, ta: 'end'    },
  { dx:  5, dy: 13, ta: 'start'  },
  { dx: -5, dy: 13, ta: 'end'    },
  { dx:  0, dy: -9, ta: 'middle' },
  { dx:  0, dy: 14, ta: 'middle' },
]

function greedyLabelPos(cx, cy, text, fontSize, placed) {
  for (const { dx, dy, ta } of LABEL_TRIES) {
    const box = labelBox(cx + dx, cy + dy, text, fontSize, ta)
    if (!placed.some(b => boxesOverlap(box, b))) {
      placed.push(box)
      return { lx: cx + dx, ly: cy + dy, ta }
    }
  }
  return { lx: cx + LABEL_TRIES[0].dx, ly: cy + LABEL_TRIES[0].dy, ta: LABEL_TRIES[0].ta }
}

const ANCHOR_OFFSETS = {
  'right':        { dx:  7, dy:  4, ta: 'start'  },
  'left':         { dx: -7, dy:  4, ta: 'end'    },
  'top':          { dx:  0, dy: -9, ta: 'middle' },
  'bottom':       { dx:  0, dy: 16, ta: 'middle' },
  'top-right':    { dx:  6, dy: -6, ta: 'start'  },
  'top-left':     { dx: -6, dy: -6, ta: 'end'    },
  'bottom-right': { dx:  6, dy: 16, ta: 'start'  },
  'bottom-left':  { dx: -6, dy: 16, ta: 'end'    },
}

// ── Ternary search: arc length at closest point to (tx, ty) on pathNode
function getArcLengthAtPoint(pathNode, tx, ty, total) {
  if (total === 0) return 0
  const pS = pathNode.getPointAtLength(0)
  const pE = pathNode.getPointAtLength(total)
  if ((pS.x - tx) ** 2 + (pS.y - ty) ** 2 < 4) return 0
  if ((pE.x - tx) ** 2 + (pE.y - ty) ** 2 < 4) return total
  let lo = 0, hi = total
  for (let i = 0; i < 20; i++) {
    const pA = pathNode.getPointAtLength(lo + (hi - lo) * 0.25)
    const pB = pathNode.getPointAtLength(lo + (hi - lo) * 0.75)
    if ((pA.x - tx) ** 2 + (pA.y - ty) ** 2 < (pB.x - tx) ** 2 + (pB.y - ty) ** 2) hi = (lo + hi) / 2
    else lo = (lo + hi) / 2
    if (hi - lo < 0.5) break
  }
  return (lo + hi) / 2
}

function getPaulLocationAtYear(year, cityById) {
  if (year < 46) return cityById['antioch-syria']?.coords ?? null
  const candidates = [...journeyData.journeys].reverse()
  for (const journey of candidates) {
    if (year < journey.dateRange[0] || year > journey.dateRange[1]) continue
    const wps = journey.waypoints.filter(wp => cityById[wp.cityId])
    if (!wps.length) continue
    const before = [...wps].reverse().find(wp => wp.year <= year)
    const after   = wps.find(wp => wp.year > year)
    if (!before && !after) continue
    if (!before) return cityById[after.cityId].coords
    if (!after)  return cityById[before.cityId].coords
    const t = (year - before.year) / (after.year - before.year)
    const [blon, blat] = cityById[before.cityId].coords
    const [alon, alat] = cityById[after.cityId].coords
    return [blon + (alon - blon) * t, blat + (alat - blat) * t]
  }
  return null
}

function getPlayZoom(location) {
  if (!location) return 1.5
  const [lon, lat] = location
  if (lon < 20 || (lat < 37 && lon < 28)) return 1.2
  if (lon >= 20 && lon <= 27 && lat >= 37 && lat <= 42) return 2.0
  return 1.6
}

// Scale bar showing a fixed 500 km reference in the bottom-right corner
function ScaleBar({ projection, theme }) {
  const barColor = theme === 'light' ? '#4a5a6a' : '#7a8ab0'
  const TARGET_KM = 500
  const R = 6371
  // Compute pixel width for TARGET_KM at the map's center latitude (37°N)
  const centerLat = 37 * Math.PI / 180
  const dLon = (TARGET_KM / R) / Math.cos(centerLat) * (180 / Math.PI)
  const [x0] = projection([26, 37])
  const [x1] = projection([26 + dLon, 37])
  const barW = Math.round(x1 - x0)

  // Position in SVG units, bottom-right
  const bx = W - barW - 40
  const by = H - 28

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <line x1={bx} y1={by} x2={bx + barW} y2={by} stroke={barColor} strokeWidth={1.5} />
      <line x1={bx} y1={by - 5} x2={bx} y2={by + 5} stroke={barColor} strokeWidth={1.5} />
      <line x1={bx + barW} y1={by - 5} x2={bx + barW} y2={by + 5} stroke={barColor} strokeWidth={1.5} />
      <text x={bx + barW / 2} y={by - 8} textAnchor="middle"
        fontFamily="Cinzel, serif" fontSize={9} letterSpacing={2} fill={barColor}>
        {TARGET_KM} KM
      </text>
    </svg>
  )
}

export default function MapView({
  activeJourneys,
  selectedBookId,
  timelineYear,
  hoveredCityId,
  onCityHover,
  onCityClick,
  provincesGeo,
  showProvinces,
  isPlaying,
  detailJourneyId,
  onMapReady,
  theme,
}) {
  const isLight = theme === 'light'
  const svgRef      = useRef(null)
  const mapGRef     = useRef(null)
  const containerRef = useRef(null)
  const kRef        = useRef(1)
  const zoomRef     = useRef(null)
  const lineDataRef = useRef({})   // journey.id → { node, total, wps, wpLengths }
  const lastPanRef  = useRef(0)

  const [tooltipCity,   setTooltipCity]   = useState(null)
  const [tooltipPos,    setTooltipPos]    = useState({ x: 0, y: 0 })
  const [segmentTip,    setSegmentTip]    = useState(null)  // { from, to, km, x, y }


  // 50m atlas ships in the bundle for first paint; 10m (~3MB) lazy-loads
  // during idle and swaps in for crisper Aegean coastlines.
  const [hiAtlas, setHiAtlas] = useState(null)
  useEffect(() => {
    let cancelled = false
    const load = () =>
      import('world-atlas/countries-10m.json')
        .then(m => { if (!cancelled) setHiAtlas(m.default) })
        .catch(() => {}) // 50m stays if the fetch fails
    const ric = window.requestIdleCallback
    const id = ric ? ric(load, { timeout: 8000 }) : setTimeout(load, 3000)
    return () => {
      cancelled = true
      ;(ric ? window.cancelIdleCallback : clearTimeout)(id)
    }
  }, [])

  const atlas = hiAtlas ?? countries50m
  const land = useMemo(
    () => rewindRings(topojson.feature(atlas, atlas.objects.land)),
    [atlas]
  )
  const borders = useMemo(
    () => topojson.mesh(atlas, atlas.objects.countries, (a, b) => a !== b),
    [atlas]
  )
  const projection = useMemo(
    () => d3.geoMercator().center([26, 37]).scale(950).translate([W / 2, H / 2]),
    []
  )
  const pathGen = useMemo(() => d3.geoPath(projection), [projection])

  const cityById = useMemo(() => {
    const map = {}
    journeyData.cities.forEach(c => { map[c.id] = c })
    return map
  }, [])

  // Mirror of timelineYear for the render effect (which must not re-run per frame)
  const timelineYearRef = useRef(timelineYear)
  useEffect(() => { timelineYearRef.current = timelineYear }, [timelineYear])
  const paulMarkerRef = useRef(null)

  // Sea vs land per journey segment — sampled with spherical point-in-polygon
  // against the 50m land (always bundled; independent of the lazy 10m swap).
  // NOTE: use the PRISTINE feature here — rewindRings fixes geoPath *rendering*
  // of the 10m data but breaks d3.geoContains (verified empirically both ways).
  const segModes = useMemo(() => {
    const landTest = topojson.feature(countries50m, countries50m.objects.land)
    const onLand = pt => landTest.features.some(f => d3.geoContains(f, pt))
    const modes = {}
    journeyData.journeys.forEach(j => {
      const wps = j.waypoints
        .filter((wp, i) => i === 0 || wp.cityId !== j.waypoints[i - 1].cityId)
        .filter(wp => cityById[wp.cityId])
      for (let i = 0; i < wps.length - 1; i++) {
        const a = cityById[wps[i].cityId].coords
        const b = cityById[wps[i + 1].cityId].coords
        let sea = 0
        ;[0.25, 0.5, 0.75].forEach(t => {
          if (!onLand([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) sea++
        })
        modes[`${j.id}:${i}`] = sea >= 2 ? 'sea' : 'land'
      }
    })
    return modes
  }, [cityById])

  const visitedIds = useMemo(() => new Set(
    journeyData.provinces.relevantProvinces
      .filter(p => p.paulVisited)
      .map(p => p.id)
  ), [])

  const lineGen = useMemo(() =>
    d3.line()
      .x(d => projection(cityById[d.cityId].coords)[0])
      .y(d => projection(cityById[d.cityId].coords)[1])
      .curve(d3.curveCatmullRom.alpha(1)), // chordal — less overshoot at sharp turns than 0.5
  [projection, cityById])

  // ── Zoom — runs once on mount ──────────────────────────────────────────
  useEffect(() => {
    const svg  = d3.select(svgRef.current)
    const mapG = d3.select(mapGRef.current)

    const zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      .on('zoom', event => {
        const t = event.transform
        kRef.current = t.k
        mapG.attr('transform', t)
        applyZoomStyling(mapGRef.current, t.k)
      })

    zoomRef.current = zoom
    svg.call(zoom)
    svg.on('dblclick.zoom', null)

    // Expose panToCity so App can call it from search
    onMapReady?.((cityId) => {
      const city = cityById[cityId]
      if (!city || !zoomRef.current || !svgRef.current) return
      const [px, py] = projection(city.coords)
      const svgEl = svgRef.current
      const { width, height } = svgEl.getBoundingClientRect()
      const scale = Math.max(kRef.current, 3)
      const t = d3.zoomIdentity.translate(width / 2 - scale * px, height / 2 - scale * py).scale(scale)
      d3.select(svgEl).transition('search-pan').duration(700).call(zoomRef.current.transform, t)
    })

    return () => svg.on('.zoom', null)
  }, [])

  // ── Map render — re-runs when data or props change ─────────────────────
  useEffect(() => {
    const mapG = d3.select(mapGRef.current)
    mapG.selectAll('*').remove()
    lineDataRef.current = {}

    // Halo behind labels — sits between the theme's land and sea tones
    const haloColor = isLight ? '#d3c9ae' : '#0a1220'
    // Casing under land route segments — background tone lifts routes off the map
    const caseColor = isLight ? '#f5f0e8' : '#060d1a'

    // ── Graticule
    mapG.append('path')
      .datum(d3.geoGraticule().step([5, 5])())
      .attr('d', pathGen)
      .attr('class', 'map-graticule')
      .attr('fill', 'none')
      .attr('stroke', isLight ? '#8a9eb0' : '#0c1828')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.4)

    // ── Land
    mapG.append('path')
      .datum(land)
      .attr('d', pathGen)
      .attr('fill', isLight ? '#cbbfa0' : '#111d2e')
      .attr('stroke', 'none')

    // ── Coastline stroke — sharpens the sea/land edge
    mapG.append('path')
      .datum(land)
      .attr('d', pathGen)
      .attr('class', 'map-coast')
      .attr('fill', 'none')
      .attr('stroke', isLight ? '#8fa4b4' : '#24364e')
      .attr('stroke-width', 0.6)
      .attr('stroke-opacity', 0.8)

    // ── Country borders
    mapG.append('path')
      .datum(borders)
      .attr('d', pathGen)
      .attr('class', 'map-borders')
      .attr('fill', 'none')
      .attr('stroke', isLight ? '#9aacb8' : '#1e2e48')
      .attr('stroke-width', 0.7)

    // ── Province fills, borders, labels
    if (provincesGeo && showProvinces) {
      mapG.append('g')
        .selectAll('path')
        .data(provincesGeo.features)
        .join('path')
        .attr('d', pathGen)
        .attr('fill', d => visitedIds.has(normalizeProvinceName(d.properties.name)) ? '#c9a84c' : (isLight ? '#7a6a50' : '#a09a8e'))
        .attr('fill-opacity', d => visitedIds.has(normalizeProvinceName(d.properties.name)) ? (isLight ? 0.14 : 0.07) : (isLight ? 0.06 : 0.04))
        .attr('stroke', 'none')

      mapG.append('g')
        .selectAll('path')
        .data(provincesGeo.features)
        .join('path')
        .attr('class', 'province-border')
        .attr('d', pathGen)
        .attr('fill', 'none')
        .attr('stroke', '#c9a84c')
        .attr('stroke-width', 0.8)
        .attr('stroke-opacity', 0.25)

      const provLabelG = mapG.append('g').attr('pointer-events', 'none')
      provincesGeo.features.forEach(feature => {
        let centroid
        try { centroid = pathGen.centroid(feature) } catch { return }
        if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return
        if (centroid[0] < 0 || centroid[0] > W || centroid[1] < 0 || centroid[1] > H) return
        provLabelG.append('text')
          .attr('class', 'province-label')
          .attr('x', centroid[0])
          .attr('y', centroid[1])
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-family', 'Cinzel, serif')
          .attr('font-size', 9 / kRef.current)
          .attr('fill', isLight ? '#6a5830' : '#c9a84c')
          .attr('fill-opacity', isLight ? 0.45 : 0.3)
          .attr('paint-order', 'stroke')
          .attr('stroke', haloColor)
          .attr('stroke-opacity', 0.4)
          .attr('stroke-linejoin', 'round')
          .text(feature.properties.name)
      })
    }

    // ── Via Egnatia road
    const viaEgnatiaWaypoints = [[19.47, 41.32], [24.29, 41.01], [26.67, 41.67]]
    const viaEgnatiaProjected = viaEgnatiaWaypoints.map(c => projection(c))
    const roadG = mapG.append('g').attr('pointer-events', 'none')
    roadG.append('path')
      .attr('class', 'via-egnatia')
      .attr('d', `M ${viaEgnatiaProjected.map(p => p.join(',')).join(' L ')}`)
      .attr('fill', 'none')
      .attr('stroke', '#c9a84c')
      .attr('stroke-width', 0.8)
      .attr('stroke-opacity', 0.25)
      .attr('stroke-dasharray', '6 4')
      .attr('stroke-linecap', 'round')
    const midPt = viaEgnatiaProjected[1]
    roadG.append('text')
      .attr('class', 'road-label')
      .attr('x', midPt[0])
      .attr('y', midPt[1] - 7)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Cinzel, serif')
      .attr('font-size', 9)
      .attr('letter-spacing', 3)
      .attr('fill', '#c9a84c')
      .attr('fill-opacity', 0.35)
      .attr('paint-order', 'stroke')
      .attr('stroke', haloColor)
      .attr('stroke-opacity', 0.4)
      .attr('stroke-linejoin', 'round')
      .text('VIA EGNATIA')

    // ── Journey lines
    const linesG = mapG.append('g')

    const selectedBook = selectedBookId
      ? journeyData.books.find(b => b.id === selectedBookId)
      : null

    journeyData.journeys.forEach(journey => {
      const colors = JOURNEY_MAP[journey.id]
      if (!colors) return

      const isActive      = activeJourneys.has(journey.id)
      const isBookJourney = selectedBook && journey.id === selectedBook.journeyId

      let baseOpacity
      if (selectedBook) {
        baseOpacity = isBookJourney ? 0.3 : 0
      } else {
        baseOpacity = isActive ? 0.85 : 0
      }

      const waypoints = journey.waypoints
        .filter((wp, i) => i === 0 || wp.cityId !== journey.waypoints[i - 1].cityId)
        .filter(wp => cityById[wp.cityId])

      if (waypoints.length < 2) return

      // Spine — invisible geometry carrier for arc lengths, sampling, and the Paul marker
      const spine = linesG.append('path')
        .attr('class', 'journey-spine')
        .datum(waypoints)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', 'none')

      const node  = spine.node()
      const total = node.getTotalLength()
      const wpLengths = waypoints.map(wp => {
        const [px, py] = projection(cityById[wp.cityId].coords)
        return getArcLengthAtPoint(node, px, py, total)
      })

      // Visible route: one sampled sub-path per waypoint pair — sea legs dashed,
      // land legs solid over a casing; post-rome stays dashed throughout (traditional)
      const caseG = linesG.append('g')
      const segG  = linesG.append('g')
      const segs = []
      const dStrings = []
      for (let i = 0; i < waypoints.length - 1; i++) {
        const l0 = wpLengths[i], l1 = wpLengths[i + 1]
        if (l1 - l0 < 0.5) { dStrings.push(null); continue }
        const d = samplePath(node, l0, l1)
        dStrings.push(d)
        const segLen = l1 - l0
        const dash = journey.id === 'post-rome'
          ? [8, 5]
          : segModes[`${journey.id}:${i}`] === 'sea' ? [4, 3.2] : null
        let caseEl = null
        if (!dash) {
          caseEl = caseG.append('path')
            .attr('class', 'journey-case')
            .attr('d', d)
            .attr('fill', 'none')
            .attr('stroke', caseColor)
            .attr('stroke-width', 3.6)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('stroke-dasharray', `${segLen} ${segLen}`)
            .node()
        }
        const el = segG.append('path')
          .attr('class', 'journey-line')
          .attr('data-journey', journey.id)
          .attr('d', d)
          .attr('fill', 'none')
          .attr('stroke', colors.primary)
          .attr('stroke-width', 2)
          .attr('stroke-linecap', dash ? 'butt' : 'round')
          .attr('stroke-linejoin', 'round')
        if (!dash) el.attr('stroke-dasharray', `${segLen} ${segLen}`)
        segs.push({ el: el.node(), caseEl, l0, l1, dash })
      }

      // Direction-of-travel chevrons, skipping the immediate vicinity of stops
      const chevG = linesG.append('g').attr('pointer-events', 'none')
      const chevrons = []
      for (let l = 48; l < total - 20; l += 85) {
        if (wpLengths.some(wl => Math.abs(wl - l) < 16)) continue
        const p  = node.getPointAtLength(l)
        const p2 = node.getPointAtLength(Math.min(total, l + 2))
        const angle = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI
        const chev = chevG.append('path')
          .attr('class', 'route-chevron')
          .attr('d', 'M -3.4 -2.8 L 2.4 0 L -3.4 2.8')
          .attr('fill', 'none')
          .attr('stroke', colors.primary)
          .attr('stroke-width', 1.2)
          .attr('stroke-linecap', 'round')
          .attr('opacity', 0)
        chev.node().dataset.x = p.x.toFixed(2)
        chev.node().dataset.y = p.y.toFixed(2)
        chev.node().dataset.a = angle.toFixed(1)
        chevrons.push({ el: chev.node(), len: l })
      }

      const jd = { node, total, wps: waypoints, wpLengths, colors, baseOpacity, segs, chevrons }
      lineDataRef.current[journey.id] = jd

      // Initial reveal for the current scrub year (or full route when idle)
      const st = revealStateFor(journey, jd, timelineYearRef.current, isActive)
        ?? { len: total, op: baseOpacity }
      applyRevealState(jd, st.len, st.op)

      // Invisible per-segment hit targets for distance hover
      if (isActive && baseOpacity > 0) {
        for (let i = 0; i < waypoints.length - 1; i++) {
          const cityA = cityById[waypoints[i].cityId]
          const cityB = cityById[waypoints[i + 1].cityId]
          if (!cityA || !cityB) continue
          const segWps = [waypoints[i], waypoints[i + 1]]
          linesG.append('path')
            .attr('class', 'seg-hit')
            .attr('d', dStrings[i] ?? lineGen(segWps))
            .attr('fill', 'none')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 12)
            .attr('cursor', 'crosshair')
            .on('mouseover', function(event) {
              const rect = containerRef.current?.getBoundingClientRect()
              if (!rect) return
              const km = haversineKm(cityA.coords, cityB.coords)
              setSegmentTip({
                from: cityA.name,
                to:   cityB.name,
                km,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              })
            })
            .on('mousemove', function(event) {
              const rect = containerRef.current?.getBoundingClientRect()
              if (!rect) return
              setSegmentTip(t => t ? { ...t, x: event.clientX - rect.left, y: event.clientY - rect.top } : t)
            })
            .on('mouseout', function() {
              setSegmentTip(null)
            })
        }
      }

      if (isBookJourney && selectedBook) {
        const segStart  = selectedBook.dateRange[0] - 0.5
        const segEnd    = selectedBook.dateRange[1] + 0.5
        const beforeIdx = waypoints.reduce((acc, wp, i) => wp.year <= segStart ? i : acc, -1)
        const afterIdx  = waypoints.findIndex(wp => wp.year >= segEnd)
        const startIdx  = Math.max(0, beforeIdx)
        const endIdx    = afterIdx === -1 ? waypoints.length - 1 : afterIdx
        const segWps    = waypoints.slice(startIdx, endIdx + 1)

        if (segWps.length >= 2) {
          const segEl = linesG.append('path')
            .datum(segWps)
            .attr('d', lineGen)
            .attr('fill', 'none')
            .attr('stroke', colors.primary)
            .attr('stroke-width', 3.5)
            .attr('stroke-opacity', isActive ? 0.9 : 0.5)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
          if (journey.id === 'post-rome') segEl.attr('stroke-dasharray', '8 5')
        }
      }
    })

    // ── Letter route arc
    if (selectedBook) {
      const fromCity = cityById[selectedBook.writingLocationId]
      const toCity   = selectedBook.recipientCityIds.length > 0
        ? cityById[selectedBook.recipientCityIds[0]]
        : null

      if (fromCity && toCity && fromCity.id !== toCity.id) {
        const [x1, y1] = projection(fromCity.coords)
        const [x2, y2] = projection(toCity.coords)
        const mx = (x1 + x2) / 2
        const my = Math.min(y1, y2) - 40

        const arcG      = mapG.append('g').attr('pointer-events', 'none')
        const routePath = arcG.append('path')
          .attr('d', `M ${x1},${y1} Q ${mx},${my} ${x2},${y2}`)
          .attr('fill', 'none')
          .attr('stroke', '#e9c86c')
          .attr('stroke-width', 2.5)
          .attr('stroke-linecap', 'round')

        const totalLength = routePath.node().getTotalLength()
        routePath
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(1800)
          .ease(d3.easeQuadInOut)
          .attr('stroke-dashoffset', 0)
      }
    }

    // ── City glow rings (writing & recipient)
    const glowG = mapG.append('g').attr('pointer-events', 'none')

    if (selectedBook) {
      const writingCity = cityById[selectedBook.writingLocationId]
      if (writingCity) {
        const [wx, wy] = projection(writingCity.coords)
        glowG.append('circle')
          .attr('cx', wx).attr('cy', wy).attr('r', 18)
          .attr('fill', 'none')
          .attr('stroke', '#e9c86c').attr('stroke-width', 1)
          .attr('class', 'writing-glow-outer')
        glowG.append('circle')
          .attr('cx', wx).attr('cy', wy).attr('r', 12)
          .attr('fill', 'none')
          .attr('stroke', '#e9c86c').attr('stroke-width', 2)
          .attr('class', 'writing-glow')
      }

      selectedBook.recipientCityIds.forEach(cityId => {
        const city = cityById[cityId]
        if (!city) return
        const [rx, ry] = projection(city.coords)
        glowG.append('circle')
          .attr('cx', rx).attr('cy', ry).attr('r', 12)
          .attr('fill', 'none')
          .attr('stroke', '#4A7C6F').attr('stroke-width', 2)
          .attr('class', 'recipient-glow')
      })
    }

    // ── City dots + labels
    const dotsG = mapG.append('g')
    const labsG = mapG.append('g').attr('pointer-events', 'none')

    // Cities visited by any currently-active journey, or the selected book's journey
    const relevantJourneyIds = new Set([
      ...activeJourneys,
      ...(selectedBook ? [selectedBook.journeyId] : []),
    ])
    const activeCityIds = new Set(
      journeyData.journeys
        .filter(j => relevantJourneyIds.has(j.id))
        .flatMap(j => j.waypoints.map(w => w.cityId))
    )

    const usedIds = new Set(
      journeyData.journeys.flatMap(j => j.waypoints.map(w => w.cityId))
    )
    const seen = new Set()
    const cities = journeyData.cities.filter(c => {
      if (!usedIds.has(c.id) || seen.has(c.id)) return false
      seen.add(c.id)
      return true
    }).sort((a, b) => a.tier - b.tier)

    const placedBoxes = []

    cities.forEach(city => {
      const pt = projection(city.coords)
      if (!pt) return
      const [x, y] = pt
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return

      const isActive = activeCityIds.has(city.id)

      const r    = city.tier === 1 ? 5 : city.tier === 2 ? 3.5 : 2.25
      const fill = isActive ? (city.tier === 1 ? '#c9a84c' : '#a09a8e') : 'none'
      const fo   = isActive ? (city.tier === 1 ? 1 : city.tier === 2 ? 0.75 : 0.55) : 0

      const sw = isActive ? (city.tier === 1 ? 1 : 0.5) : 0.5
      dotsG.append('circle')
        .attr('class', 'city-dot')
        .attr('data-city', city.id)
        .attr('data-r0', r)
        .attr('data-sw0', sw)
        .attr('cx', x).attr('cy', y).attr('r', r)
        .attr('fill', fill).attr('fill-opacity', fo)
        .attr('stroke', isActive ? '#060d1a' : '#a09a8e')
        .attr('stroke-width', sw)
        .attr('stroke-opacity', isActive ? 1 : 0.15)
        .attr('cursor', isActive ? 'pointer' : 'default')
        .on('mouseover', function(event) {
          if (!isActive) return
          const rect = containerRef.current?.getBoundingClientRect()
          if (!rect) return
          setTooltipCity(city)
          setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
          onCityHover?.(city.id)
        })
        .on('mousemove', function(event) {
          if (!isActive) return
          const rect = containerRef.current?.getBoundingClientRect()
          if (!rect) return
          setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
        })
        .on('mouseout', function() {
          setTooltipCity(null)
          onCityHover?.(null)
        })

      if (!isActive) return

      if (city.tier === 1) {
        const off = ANCHOR_OFFSETS[city.labelAnchor] ?? ANCHOR_OFFSETS['right']
        const lx = x + off.dx, ly = y + off.dy
        labsG.append('text')
          .attr('class', 'city-label label-t1')
          .attr('x', lx).attr('y', ly)
          .attr('text-anchor', off.ta)
          .attr('font-family', 'Cinzel, serif')
          .attr('font-size', 13)
          .attr('fill', '#c9a84c')
          .attr('fill-opacity', 0.85)
          .attr('paint-order', 'stroke')
          .attr('stroke', haloColor)
          .attr('stroke-opacity', 0.75)
          .attr('stroke-linejoin', 'round')
          .text(city.name)
        placedBoxes.push(labelBox(lx, ly, city.name, 13, off.ta))
      }

      if (city.tier === 2) {
        const { lx, ly, ta } = greedyLabelPos(x, y, city.name, 11, placedBoxes)
        labsG.append('text')
          .attr('class', 'city-label label-t2')
          .attr('x', lx).attr('y', ly)
          .attr('text-anchor', ta)
          .attr('font-family', 'Cinzel, serif')
          .attr('font-size', 11)
          .attr('fill', '#c9a84c')
          .attr('fill-opacity', 0.75)
          .attr('paint-order', 'stroke')
          .attr('stroke', haloColor)
          .attr('stroke-opacity', 0.65)
          .attr('stroke-linejoin', 'round')
          .attr('opacity', 0)
          .text(city.name)
        placedBoxes.push(labelBox(lx, ly, city.name, 11, ta))
      }

      if (city.tier === 3) {
        const { lx, ly, ta } = greedyLabelPos(x, y, city.name, 9, placedBoxes)
        labsG.append('text')
          .attr('class', 'city-label label-t3')
          .attr('x', lx).attr('y', ly)
          .attr('text-anchor', ta)
          .attr('font-family', 'Cinzel, serif')
          .attr('font-size', 9)
          .attr('fill', '#a09a8e')
          .attr('fill-opacity', 0.7)
          .attr('paint-order', 'stroke')
          .attr('stroke', haloColor)
          .attr('stroke-opacity', 0.65)
          .attr('stroke-linejoin', 'round')
          .attr('opacity', 0)
          .text(city.name)
        placedBoxes.push(labelBox(lx, ly, city.name, 9, ta))
      }
    })

    // ── Paul marker — comet head at the reveal front (positioned by the
    // progressive effect; initial position replayed here for re-renders mid-scrub)
    const markerG = mapG.append('g')
      .attr('class', 'paul-marker')
      .attr('display', 'none')
      .attr('pointer-events', 'none')
    markerG.append('circle')
      .attr('class', 'paul-marker-halo')
      .attr('r', 7).attr('fill', '#e9c86c').attr('fill-opacity', 0.22)
    markerG.append('circle')
      .attr('class', 'paul-marker-core')
      .attr('r', 2.8).attr('fill', '#e9c86c')
      .attr('stroke', '#060d1a').attr('stroke-width', 0.9)
    paulMarkerRef.current = markerG.node()

    const yearNow = timelineYearRef.current
    if (yearNow !== null) {
      for (const journey of journeyData.journeys) {
        const jd2 = lineDataRef.current[journey.id]
        if (!jd2 || !activeJourneys.has(journey.id)) continue
        if (yearNow >= journey.dateRange[0] && yearNow < journey.dateRange[1]) {
          const stM = revealStateFor(journey, jd2, yearNow, true)
          if (stM) {
            const p = jd2.node.getPointAtLength(stM.len)
            markerG.attr('display', null).attr('transform', `translate(${p.x},${p.y})`)
          }
          break
        }
      }
    }

    applyZoomStyling(mapGRef.current, kRef.current)

  }, [projection, pathGen, land, borders, provincesGeo, showProvinces, activeJourneys, selectedBookId, cityById, visitedIds, lineGen, theme, isLight, segModes])

  // ── Progressive reveal — synchronized to timelineYear ─────────────────
  useEffect(() => {
    const mapG = d3.select(mapGRef.current)

    // ── City dot visibility
    const cityFirstYear = {}
    if (timelineYear !== null) {
      journeyData.journeys.forEach(journey => {
        if (!activeJourneys.has(journey.id)) return
        journey.waypoints.forEach(wp => {
          if (!cityFirstYear[wp.cityId] || wp.year < cityFirstYear[wp.cityId])
            cityFirstYear[wp.cityId] = wp.year
        })
      })
    }

    mapG.selectAll('.city-dot').each(function() {
      const cityId = d3.select(this).attr('data-city')
      const city   = cityById[cityId]
      if (!city) return
      const full = city.tier === 1 ? 1 : city.tier === 2 ? 0.75 : 0.55
      if (timelineYear === null) {
        d3.select(this).attr('fill-opacity', full)
        return
      }
      const fy      = cityFirstYear[cityId]
      const reached = fy !== undefined && fy <= timelineYear
      d3.select(this).attr('fill-opacity', reached ? full : full * 0.2)
    })

    // ── Journey line reveal (per-segment: solid legs via dashoffset,
    // dashed sea/post-rome legs via constructed dasharray)
    let paulPos = null
    journeyData.journeys.forEach(journey => {
      const jd = lineDataRef.current[journey.id]
      if (!jd) return
      const isActive = activeJourneys.has(journey.id)
      const st = revealStateFor(journey, jd, timelineYear, isActive)
      if (st) applyRevealState(jd, st.len, st.op)

      // Paul rides the reveal front of the journey containing the current year
      if (st && isActive && timelineYear !== null &&
          timelineYear >= journey.dateRange[0] && timelineYear < journey.dateRange[1]) {
        const p = jd.node.getPointAtLength(st.len)
        paulPos = [p.x, p.y]
      }
    })

    if (paulMarkerRef.current) {
      const m = d3.select(paulMarkerRef.current)
      if (paulPos) m.attr('display', null).attr('transform', `translate(${paulPos[0]},${paulPos[1]})`)
      else m.attr('display', 'none')
    }

    // ── Map pan to follow Paul during play (throttled)
    if (isPlaying && timelineYear !== null) {
      const now = performance.now()
      if (now - lastPanRef.current > 250 && zoomRef.current && svgRef.current) {
        lastPanRef.current = now
        const loc = getPaulLocationAtYear(timelineYear, cityById)
        if (loc) {
          const [px, py] = projection(loc)
          const targetK  = getPlayZoom(loc)
          const tx = W / 2 - px * targetK
          const ty = H * 0.38 - py * targetK
          d3.select(svgRef.current)
            .transition('pan').duration(600).ease(d3.easeQuadOut)
            .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(targetK))
        }
      }
    }

  }, [timelineYear, activeJourneys, isPlaying, cityById, projection])

  // ── Journey bounds zoom — fires when detailJourneyId changes ──────────
  useEffect(() => {
    if (!zoomRef.current || !svgRef.current) return

    if (detailJourneyId === null) {
      d3.select(svgRef.current)
        .transition('zoom-to-journey').duration(800).ease(d3.easeCubicInOut)
        .call(zoomRef.current.transform, d3.zoomIdentity)
      return
    }

    const journey = journeyData.journeys.find(j => j.id === detailJourneyId)
    if (!journey) return

    const coords = journey.waypoints
      .map(wp => cityById[wp.cityId]?.coords)
      .filter(Boolean)
    if (coords.length === 0) return

    const lons = coords.map(c => c[0])
    const lats = coords.map(c => c[1])
    const west  = Math.min(...lons) - 2
    const east  = Math.max(...lons) + 2
    const south = Math.min(...lats) - 2
    const north = Math.max(...lats) + 2

    const [x0, y0] = projection([west, north])
    const [x1, y1] = projection([east, south])
    const scale = 0.9 / Math.max((x1 - x0) / W, (y1 - y0) / H)
    const tx = W / 2 - scale * (x0 + x1) / 2
    const ty = H / 2 - scale * (y0 + y1) / 2

    d3.select(svgRef.current)
      .transition('zoom-to-journey').duration(800).ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))

  }, [detailJourneyId, projection, cityById])

  // ── Timeline stop hover → glow city dot on map ────────────────────────
  useEffect(() => {
    if (!mapGRef.current) return
    const g = d3.select(mapGRef.current)

    g.selectAll('.city-dot').each(function() {
      const el     = d3.select(this)
      const cityId = el.attr('data-city')
      const isHovered = cityId === hoveredCityId

      if (isHovered) {
        el.raise()
          .transition('glow').duration(120)
          .attr('r', function() { return parseFloat(el.attr('r')) * 1.0 }) // preserve r, just trigger filter
          .attr('filter', 'url(#city-glow)')
          .attr('stroke', '#c9a84c')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 1)
      } else {
        el.transition('glow').duration(200)
          .attr('filter', null)
          .attr('stroke', '#060d1a')
          .attr('stroke-width', el.attr('data-city') ? 0.5 : 0.5)
          .attr('stroke-opacity', 1)
      }
    })
  }, [hoveredCityId])

  return (
    <div ref={containerRef} className="map-svg-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <filter id="city-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={W} height={H} fill={isLight ? '#b8c8d4' : '#060d1a'} />
        <g ref={mapGRef} />
      </svg>

      {/* Scale bar — fixed 500 km reference, bottom-right */}
      <ScaleBar projection={projection} theme={theme} />

      {segmentTip && !tooltipCity && (
        <div className="city-tooltip" style={{
          position: 'absolute',
          left: segmentTip.x + 16,
          top:  segmentTip.y - 12,
          pointerEvents: 'none',
        }}>
          <div className="city-tooltip__name" style={{ fontSize: 11 }}>
            {segmentTip.from} → {segmentTip.to}
          </div>
          <div className="city-tooltip__desc" style={{ fontSize: 13, marginBottom: 0 }}>
            ~{segmentTip.km.toLocaleString()} km
          </div>
        </div>
      )}

      {tooltipCity && (
        <div className="city-tooltip" style={{
          position: 'absolute',
          left: tooltipPos.x + 16,
          top:  tooltipPos.y - 12,
          pointerEvents: 'none',
        }}>
          <div className="city-tooltip__name">{tooltipCity.name}</div>
          {tooltipCity.modernName && (
            <div className="city-tooltip__modern">{tooltipCity.modernName}</div>
          )}
          <div className="city-tooltip__desc">{tooltipCity.description}</div>
          {tooltipCity.ref && (
            <div className="city-tooltip__ref">{tooltipCity.ref}</div>
          )}
        </div>
      )}
    </div>
  )
}
