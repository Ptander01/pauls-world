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

export default function TimelineDetail({
  journey,
  churchEvents,
  activeChurchTracks,
  onChurchTrackToggle,
  timelineYear,
  onCityHover,
  selectedBookId,
  onBookSelect,
}) {
  // Church IDs that have events in this journey, in encounter order
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

  // Scroll sync: keep .pst-scroll and all .ct-track-scroll containers in lockstep.
  // Uses a DOM query on the body container so no ref props are needed on children.
  // syncingRef prevents the set-scrollLeft feedback loop; reset via rAF after each sync.
  const bodyRef    = useRef(null)
  const syncingRef = useRef(false)

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const containers = Array.from(body.querySelectorAll('.pst-scroll, .bt-scroll, .pet-scroll, .ct-track-scroll'))
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
  }, [activeChurchTracks]) // re-bind when visible church tracks change

  if (!journey) return null

  return (
    <div className="tl-detail-body" ref={bodyRef}>
      <JourneyStats journey={journey} />
      <PaulStopTrack journey={journey} timelineYear={timelineYear} onCityHover={onCityHover} />
      <BookTrack journey={journey} selectedBookId={selectedBookId} onBookSelect={onBookSelect} />
      <PaulEventTrack journey={journey} timelineYear={timelineYear} />

      {churchIds.length > 0 && (
        <>
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

          {churchIds.some(id => activeChurchTracks.has(id)) && (
            <div className="ct-tracks-area">
              {churchIds
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
          )}
        </>
      )}
    </div>
  )
}
