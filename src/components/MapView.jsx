import { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import countries50m from 'world-atlas/countries-50m.json'
import journeyData from '../data/pauline-journeys-data.json'

const W = 1200
const H = 680

const JOURNEY_MAP = {
  'journey-1':    journeyData.colorSystem.journey1,
  'journey-2':    journeyData.colorSystem.journey2,
  'journey-3':    journeyData.colorSystem.journey3,
  'rome-journey': journeyData.colorSystem.romeJourney,
  'post-rome':    journeyData.colorSystem.postRome,
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
  g.selectAll('.province-label').attr('font-size', 9 / k)
  g.selectAll('.label-t1').attr('font-size', 13 / k)
  g.selectAll('.label-t2').attr('font-size', 11 / k).attr('opacity', k >= 2   ? 0.85 : 0)
  g.selectAll('.label-t3').attr('font-size',  9 / k).attr('opacity', k >= 3.5 ? 0.75 : 0)
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
}) {
  const svgRef      = useRef(null)
  const mapGRef     = useRef(null)
  const kRef        = useRef(1)
  const zoomRef     = useRef(null)
  const lineDataRef = useRef({})   // journey.id → { node, total, wps, wpLengths }
  const lastPanRef  = useRef(0)

  const land = useMemo(
    () => topojson.feature(countries50m, countries50m.objects.land),
    []
  )
  const borders = useMemo(
    () => topojson.mesh(countries50m, countries50m.objects.countries, (a, b) => a !== b),
    []
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

  const visitedIds = useMemo(() => new Set(
    journeyData.provinces.relevantProvinces
      .filter(p => p.paulVisited)
      .map(p => p.id)
  ), [])

  const lineGen = useMemo(() =>
    d3.line()
      .x(d => projection(cityById[d.cityId].coords)[0])
      .y(d => projection(cityById[d.cityId].coords)[1])
      .curve(d3.curveCatmullRom.alpha(0.5)),
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

    return () => svg.on('.zoom', null)
  }, [])

  // ── Map render — re-runs when data or props change ─────────────────────
  useEffect(() => {
    const mapG = d3.select(mapGRef.current)
    mapG.selectAll('*').remove()
    lineDataRef.current = {}

    // ── Graticule
    mapG.append('path')
      .datum(d3.geoGraticule().step([5, 5])())
      .attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', '#0c1828')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.5)

    // ── Land
    mapG.append('path')
      .datum(land)
      .attr('d', pathGen)
      .attr('fill', '#111d2e')
      .attr('stroke', 'none')

    // ── Country borders
    mapG.append('path')
      .datum(borders)
      .attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', '#1e2e48')
      .attr('stroke-width', 0.7)

    // ── Province fills, borders, labels
    if (provincesGeo && showProvinces) {
      mapG.append('g')
        .selectAll('path')
        .data(provincesGeo.features)
        .join('path')
        .attr('d', pathGen)
        .attr('fill', d => visitedIds.has(normalizeProvinceName(d.properties.name)) ? '#c9a84c' : '#a09a8e')
        .attr('fill-opacity', d => visitedIds.has(normalizeProvinceName(d.properties.name)) ? 0.07 : 0.04)
        .attr('stroke', 'none')

      mapG.append('g')
        .selectAll('path')
        .data(provincesGeo.features)
        .join('path')
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
          .attr('fill', '#c9a84c')
          .attr('fill-opacity', 0.3)
          .text(feature.properties.name)
      })
    }

    // ── Via Egnatia road
    const viaEgnatiaWaypoints = [[19.47, 41.32], [24.29, 41.01], [26.67, 41.67]]
    const viaEgnatiaProjected = viaEgnatiaWaypoints.map(c => projection(c))
    const roadG = mapG.append('g').attr('pointer-events', 'none')
    roadG.append('path')
      .attr('d', `M ${viaEgnatiaProjected.map(p => p.join(',')).join(' L ')}`)
      .attr('fill', 'none')
      .attr('stroke', '#c9a84c')
      .attr('stroke-width', 0.8)
      .attr('stroke-opacity', 0.25)
      .attr('stroke-dasharray', '6 4')
      .attr('stroke-linecap', 'round')
    const midPt = viaEgnatiaProjected[1]
    roadG.append('text')
      .attr('x', midPt[0])
      .attr('y', midPt[1] - 7)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Cinzel, serif')
      .attr('font-size', 9)
      .attr('letter-spacing', 3)
      .attr('fill', '#c9a84c')
      .attr('fill-opacity', 0.35)
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
        baseOpacity = isBookJourney ? (isActive ? 0.3 : 0.07) : (isActive ? 0.08 : 0.03)
      } else {
        baseOpacity = isActive ? 0.45 : 0.1
      }

      const waypoints = journey.waypoints
        .filter((wp, i) => i === 0 || wp.cityId !== journey.waypoints[i - 1].cityId)
        .filter(wp => cityById[wp.cityId])

      if (waypoints.length < 2) return

      const pathEl = linesG.append('path')
        .attr('class', 'journey-line')
        .attr('data-journey', journey.id)
        .datum(waypoints)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', colors.primary)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', baseOpacity)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')

      if (journey.id === 'post-rome') pathEl.attr('stroke-dasharray', '8 5')

      // Precompute arc lengths for progressive reveal
      const node  = pathEl.node()
      const total = node.getTotalLength()
      // For dashed post-rome path, dasharray will conflict with reveal — handle in progressive effect
      const wpLengths = waypoints.map(wp => {
        const [px, py] = projection(cityById[wp.cityId].coords)
        return getArcLengthAtPoint(node, px, py, total)
      })
      lineDataRef.current[journey.id] = { node, total, wps: waypoints, wpLengths, colors, baseOpacity }

      // Prime dasharray for reveal (only when no post-rome dashes; post-rome handled separately)
      if (journey.id !== 'post-rome') {
        pathEl
          .attr('stroke-dasharray', `${total} ${total}`)
          .attr('stroke-dashoffset', 0)
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

      const r    = city.tier === 1 ? 5 : city.tier === 2 ? 3.5 : 2.25
      const fill = city.tier === 1 ? '#c9a84c' : '#a09a8e'
      const fo   = city.tier === 1 ? 1 : city.tier === 2 ? 0.75 : 0.55

      dotsG.append('circle')
        .attr('class', 'city-dot')
        .attr('data-city', city.id)
        .attr('cx', x).attr('cy', y).attr('r', r)
        .attr('fill', fill).attr('fill-opacity', fo)
        .attr('stroke', '#060d1a').attr('stroke-width', city.tier === 1 ? 1 : 0.5)

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
          .attr('opacity', 0)
          .text(city.name)
        placedBoxes.push(labelBox(lx, ly, city.name, 9, ta))
      }
    })

    applyZoomStyling(mapGRef.current, kRef.current)

  }, [projection, pathGen, land, borders, provincesGeo, showProvinces, activeJourneys, selectedBookId, cityById, visitedIds, lineGen])

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

    // ── Journey line dashoffset
    journeyData.journeys.forEach(journey => {
      const data = lineDataRef.current[journey.id]
      if (!data) return
      const { node, total, wps, wpLengths, baseOpacity } = data

      if (timelineYear === null) {
        // Full line — restore normal dasharray and opacity
        if (journey.id !== 'post-rome') {
          d3.select(node)
            .attr('stroke-dasharray', `${total} ${total}`)
            .attr('stroke-dashoffset', 0)
        }
        d3.select(node).attr('stroke-opacity', activeJourneys.has(journey.id) ? baseOpacity : 0.1)
        return
      }

      if (!activeJourneys.has(journey.id)) return

      if (timelineYear < journey.dateRange[0]) {
        if (journey.id !== 'post-rome')
          d3.select(node).attr('stroke-dashoffset', total)
        else
          d3.select(node).attr('stroke-opacity', 0)
        return
      }

      // Completed journey — show full at reduced opacity
      if (journey.dateRange[1] <= timelineYear) {
        if (journey.id !== 'post-rome') {
          d3.select(node)
            .attr('stroke-dashoffset', 0)
            .attr('stroke-opacity', 0.18)
        } else {
          d3.select(node).attr('stroke-opacity', 0.18)
        }
        return
      }

      // Interpolate arc length for current year
      const nextIdx = wps.findIndex(wp => wp.year > timelineYear)
      let len
      if (nextIdx === -1) {
        len = total
      } else if (nextIdx === 0) {
        len = 0
      } else {
        const prevIdx = nextIdx - 1
        const denom   = wps[nextIdx].year - wps[prevIdx].year
        const t       = denom > 0 ? Math.max(0, Math.min(1, (timelineYear - wps[prevIdx].year) / denom)) : 1
        len = wpLengths[prevIdx] + t * (wpLengths[nextIdx] - wpLengths[prevIdx])
      }

      if (journey.id !== 'post-rome') {
        d3.select(node)
          .attr('stroke-dashoffset', Math.max(0, total - len))
          .attr('stroke-opacity', baseOpacity * (activeJourneys.has(journey.id) ? 1 : 0.22))
      } else {
        // post-rome uses stroke-dasharray for the dash style; clip via opacity only
        d3.select(node).attr('stroke-opacity', baseOpacity * 0.9)
      }
    })

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

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width={W} height={H} fill="#060d1a" />
      <g ref={mapGRef} />
    </svg>
  )
}
