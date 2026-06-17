import { useMemo, useRef, useEffect } from 'react'
import PaulStopTrack from './PaulStopTrack'
import PaulEventTrack from './PaulEventTrack'
import BookTrack from './BookTrack'
import ChurchTrack from './ChurchTrack'
import journeyData from '../data/pauline-journeys-data.json'

const cityById = Object.fromEntries(journeyData.cities.map(c => [c.id, c]))

function haversineKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function JourneyStats({ journey }) {
  const { totalDays, totalKm, cityCount } = useMemo(() => {
    const wps = journey.waypoints
    let km = 0
    for (let i = 1; i < wps.length; i++) {
      const a = cityById[wps[i - 1].cityId]?.coords
      const b = cityById[wps[i].cityId]?.coords
      if (a && b) km += haversineKm(a, b)
    }
    const days = wps.reduce((s, w) => s + (w.durationDays || 0), 0)
    const unique = new Set(wps.map(w => w.cityId)).size
    return { totalDays: days, totalKm: Math.round(km), cityCount: unique }
  }, [journey])

  const years = Math.round(totalDays / 365 * 10) / 10

  return (
    <div className="jstat-bar">
      <span className="jstat-item">
        <span className="jstat-val">{totalKm.toLocaleString()}</span>
        <span className="jstat-unit">km</span>
      </span>
      <span className="jstat-sep">·</span>
      <span className="jstat-item">
        <span className="jstat-val">{years}</span>
        <span className="jstat-unit">yrs</span>
      </span>
      <span className="jstat-sep">·</span>
      <span className="jstat-item">
        <span className="jstat-val">{cityCount}</span>
        <span className="jstat-unit">cities</span>
      </span>
    </div>
  )
}

// Small SVG legend marker with a CSS tooltip
function LMark({ shape, color, size = 4, label }) {
  const w = 14, h = 14, cx = 7, cy = 7
  return (
    <span className="tld-lmark" data-tip={label}>
      <svg width={w} height={h} style={{ overflow: 'visible', display: 'block', pointerEvents: 'none' }}>
        {shape === 'circle' && (
          <circle cx={cx} cy={cy} r={size}
            fill={color} fillOpacity={0.45}
            stroke={color} strokeWidth={1} strokeOpacity={0.85} />
        )}
        {shape === 'diamond' && (
          <polygon points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
            fill={color} fillOpacity={0.35}
            stroke={color} strokeWidth={1} strokeOpacity={0.85} />
        )}
        {shape === 'bar' && (
          <rect x={1} y={cy - 3} width={12} height={6} rx={2}
            fill={color} fillOpacity={0.3}
            stroke={color} strokeWidth={1} strokeOpacity={0.65} />
        )}
      </svg>
    </span>
  )
}

function LabelCol({ sections }) {
  return (
    <div className="tld-label-col">
      {sections.map((sec, i) => (
        <div key={i} className="tld-label-section" style={sec.flex ? { flex: sec.flex } : { height: sec.height }}>
          <span className="tld-label-name">{sec.name}</span>
          <div className="tld-legend-row">
            {sec.items.map((item, j) => <LMark key={j} {...item} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TimelineDetail({
  journey,
  churchEvents,
  activeChurchTracks,
  onChurchTrackToggle,
  timelineYear,
  onCityHover,
  hoveredCityId,
  selectedBookId,
  onBookSelect,
}) {
  const journeyChurchEvents = useMemo(
    () => (journey ? churchEvents.filter(e => e.journeyId === journey.id) : []),
    [churchEvents, journey]
  )

  const churchIds = useMemo(() => {
    const seen = new Set()
    const ids  = []
    for (const ev of journeyChurchEvents) {
      if (!seen.has(ev.churchId)) { seen.add(ev.churchId); ids.push(ev.churchId) }
    }
    return ids
  }, [journeyChurchEvents])

  // Scroll sync on the inner .tld-track-area elements
  const bodyRef    = useRef(null)
  const syncingRef = useRef(false)

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const containers = Array.from(body.querySelectorAll('.tld-track-area'))
    if (containers.length < 2) return

    function onScroll(e) {
      if (syncingRef.current) return
      syncingRef.current = true
      const { scrollLeft } = e.currentTarget
      containers.forEach(el => { if (el !== e.currentTarget) el.scrollLeft = scrollLeft })
      requestAnimationFrame(() => { syncingRef.current = false })
    }

    containers.forEach(el => el.addEventListener('scroll', onScroll))
    return () => containers.forEach(el => el.removeEventListener('scroll', onScroll))
  }, [activeChurchTracks])

  if (!journey) return null

  const jColor = journey.color

  return (
    <div className="tl-detail-body" ref={bodyRef}>
      <JourneyStats journey={journey} />

      {/* Row 1: stops + events */}
      <div className="tld-journey-scroll">
        <LabelCol sections={[
          {
            name: 'STOPS',
            height: 130,
            items: [
              { shape: 'circle', color: jColor,    size: 3,   label: 'City stop (dot size = length of stay)' },
              { shape: 'circle', color: '#c9a84c', size: 5,   label: 'Major base (>3 months) — gold glow when active' },
            ],
          },
          {
            name: 'EVENTS',
            flex: 1,
            items: [
              { shape: 'circle',  color: '#c9a84c', size: 5,   label: 'Major event' },
              { shape: 'diamond', color: '#c9a84c', size: 5,   label: 'Letter written by Paul' },
              { shape: 'circle',  color: '#7a3030', size: 4,   label: 'Arrest or imprisonment' },
              { shape: 'circle',  color: '#7a6430', size: 3,   label: 'Minor event' },
            ],
          },
        ]} />
        <div className="tld-track-area">
          <PaulStopTrack journey={journey} timelineYear={timelineYear} onCityHover={onCityHover} hoveredCityId={hoveredCityId} />
          <PaulEventTrack journey={journey} timelineYear={timelineYear} onCityHover={onCityHover} hoveredCityId={hoveredCityId} />
        </div>
      </div>

      {/* Row 2: letters + church tracks */}
      {churchIds.length > 0 && (
        <div className="tld-letters-scroll">
          <LabelCol sections={[
            {
              name: 'LETTERS',
              height: undefined,
              flex: undefined,
              items: [
                { shape: 'bar',    color: '#c9a84c', label: 'Epistle — bar width = probable date range; click to open' },
              ],
            },
            {
              name: 'CHURCHES',
              flex: 1,
              items: [
                { shape: 'diamond', color: '#c9a84c', size: 5, label: 'Church founded' },
                { shape: 'diamond', color: '#4A7C6F', size: 4, label: 'Letter received by church' },
                { shape: 'circle',  color: '#c9a84c', size: 3, label: 'Financial or material support' },
                { shape: 'circle',  color: '#7B6FA0', size: 3, label: 'Leadership transition' },
              ],
            },
          ]} />
          <div className="tld-track-area tld-track-area--letters">
            <BookTrack journey={journey} selectedBookId={selectedBookId} onBookSelect={onBookSelect} />

            <div className="tld-church-section">
              <div className="ct-pills">
                {churchIds.map(churchId => {
                  const active = activeChurchTracks.has(churchId)
                  return (
                    <button
                      key={churchId}
                      className={`ct-pill${active ? ' ct-pill--active' : ''}`}
                      style={{ '--pill-color': journey.color }}
                      onClick={() => onChurchTrackToggle(churchId)}
                    >
                      <span
                        className="ct-pill-dot"
                        style={{ background: active ? journey.color : undefined }}
                      />
                      {churchId.charAt(0).toUpperCase() + churchId.slice(1)}
                    </button>
                  )
                })}
              </div>

              {churchIds.some(id => activeChurchTracks.has(id)) &&
                churchIds
                  .filter(id => activeChurchTracks.has(id))
                  .map(churchId => (
                    <ChurchTrack
                      key={churchId}
                      journey={journey}
                      churchId={churchId}
                      events={journeyChurchEvents.filter(e => e.churchId === churchId)}
                      timelineYear={timelineYear}
                    />
                  ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
