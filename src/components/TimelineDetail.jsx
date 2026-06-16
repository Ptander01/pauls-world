import { useMemo, useRef, useEffect } from 'react'
import PaulStopTrack from './PaulStopTrack'
import PaulEventTrack from './PaulEventTrack'
import ChurchTrack from './ChurchTrack'

export default function TimelineDetail({
  journey,
  churchEvents,
  activeChurchTracks,
  onChurchTrackToggle,
  timelineYear,
  onCityHover,
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

    const containers = Array.from(body.querySelectorAll('.pst-scroll, .pet-scroll, .ct-track-scroll'))
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
      <PaulStopTrack journey={journey} timelineYear={timelineYear} onCityHover={onCityHover} />
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
