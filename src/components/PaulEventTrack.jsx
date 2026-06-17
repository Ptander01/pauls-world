import { useRef, useEffect, useState, useMemo } from 'react'
import journeyData from '../data/pauline-journeys-data.json'
import { buildStopLayout } from '../utils/stopLayout'

const SVG_H    = 130
const TRACK_Y  = 78   // horizontal track line
const ERA_Y    = 14   // era label text baseline
const ABOVE_Y  = 58   // label baseline for events above track
const BELOW_Y  = 96   // label baseline for events below track
const SUB_OFF  = 11   // sublabel offset from label

const TYPE_STYLE = {
  major:  { fill: '#c9a84c', r: 9,  glow: true  },
  minor:  { fill: '#7a6430', r: 5,  glow: false },
  arrest: { fill: '#7a3030', r: 6,  glow: false, stroke: '#c97a7a' },
  writes: { fill: '#c9a84c', r: 0,  glow: true,  diamond: true, size: 8 },
}

function cityForYear(journey, year) {
  const wps = journey.waypoints
  for (const wp of wps) {
    const dep = wp.year + (wp.durationDays || 1) / 365
    if (year >= wp.year && year <= dep) return wp.cityId
  }
  // fallback: nearest waypoint by arrival year
  return wps.reduce((best, wp) =>
    Math.abs(wp.year - year) < Math.abs(best.year - year) ? wp : best
  , wps[0])?.cityId ?? null
}

export default function PaulEventTrack({ journey, timelineYear, onCityHover, hoveredCityId }) {
  const [pulsing,   setPulsing]   = useState(new Set())
  const [hoveredId, setHoveredId] = useState(null)
  const prevYearRef = useRef(null)
  const pulsedRef   = useRef(new Set())

  const { stops, totalWidth, xFromYear } = useMemo(
    () => buildStopLayout(journey),
    [journey]
  )

  const events = useMemo(
    () => journeyData.paulEvents.filter(e => e.journeyId === journey.id),
    [journey]
  )

  const eraLabels = journey.eraLabels ?? []

  // Pulse animation when scrubber crosses an event year forward
  useEffect(() => {
    if (timelineYear === null) return
    const prev = prevYearRef.current

    events.forEach(evt => {
      if (prev !== null && prev < evt.year && timelineYear >= evt.year) {
        if (!pulsedRef.current.has(evt.id)) {
          pulsedRef.current.add(evt.id)
          setPulsing(s => new Set([...s, evt.id]))
          setTimeout(() => setPulsing(s => { const n = new Set(s); n.delete(evt.id); return n }), 700)
        }
      }
      // Reset pulsed flag when scrubbing backward past the event
      if (prev !== null && prev >= evt.year && timelineYear < evt.year) {
        pulsedRef.current.delete(evt.id)
      }
    })

    prevYearRef.current = timelineYear
  }, [timelineYear, events])

  if (!journey || stops.length === 0) return null

  return (
    <div className="pet-scroll">
      <svg width={totalWidth} height={SVG_H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <filter id="pet-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Track line */}
        <line
          x1={8} y1={TRACK_Y} x2={totalWidth - 8} y2={TRACK_Y}
          stroke="#c9a84c" strokeWidth={1} strokeOpacity={0.2} strokeDasharray="4 4"
        />

        {/* Era labels + dividers */}
        {eraLabels.map((era, i) => {
          const x0 = xFromYear(era.startYear)
          const x1 = xFromYear(era.endYear)
          const mx = (x0 + x1) / 2
          return (
            <g key={i}>
              <line x1={x0 + 2} y1={ERA_Y + 4} x2={mx - 42} y2={ERA_Y + 4} stroke="#2e3858" strokeWidth={0.5} />
              <text
                x={mx} y={ERA_Y}
                textAnchor="middle"
                fontFamily="Cinzel, serif" fontSize={8} letterSpacing={2.5}
                fill="#4a5578"
              >
                {era.label}
              </text>
              <line x1={mx + 42} y1={ERA_Y + 4} x2={x1 - 2} y2={ERA_Y + 4} stroke="#2e3858" strokeWidth={0.5} />
            </g>
          )
        })}

        {/* Event markers */}
        {events.map((evt, i) => {
          const x    = xFromYear(evt.year)
          const s    = TYPE_STYLE[evt.type] ?? TYPE_STYLE.minor
          const above = i % 2 === 0
          const evtCity    = cityForYear(journey, evt.year)
          const cityMatch  = hoveredCityId && evtCity === hoveredCityId
          const isHovered  = hoveredId === evt.id || cityMatch
          const isPulsing  = pulsing.has(evt.id)
          const labelY = above ? ABOVE_Y : BELOW_Y
          const subY   = above ? ABOVE_Y + SUB_OFF : BELOW_Y + SUB_OFF
          const connY1 = above ? TRACK_Y - s.r - 2 : TRACK_Y + s.r + 2
          const connY2 = above ? labelY + 4        : labelY - 12

          return (
            <g
              key={evt.id}
              style={{ cursor: 'default' }}
              onMouseEnter={() => { setHoveredId(evt.id); onCityHover?.(evtCity) }}
              onMouseLeave={() => { setHoveredId(null); onCityHover?.(null) }}
            >
              {/* Connector line */}
              <line
                x1={x} y1={connY1} x2={x} y2={connY2}
                stroke="#c9a84c" strokeWidth={0.8} strokeOpacity={isHovered ? 0.7 : 0.3}
              />

              {/* Marker */}
              {s.diamond ? (
                <g
                  transform={`translate(${x},${TRACK_Y}) rotate(45) ${isPulsing ? 'scale(1.6)' : ''}`}
                  style={{ transformOrigin: `${x}px ${TRACK_Y}px`, transformBox: 'fill-box' }}
                  filter={s.glow ? 'url(#pet-glow)' : undefined}
                >
                  <rect
                    x={-s.size / 2} y={-s.size / 2}
                    width={s.size} height={s.size}
                    fill={s.fill}
                    fillOpacity={isHovered ? 1 : 0.85}
                    className={isPulsing ? 'pet-pulse' : ''}
                  />
                </g>
              ) : (
                <circle
                  cx={x} cy={TRACK_Y} r={isPulsing ? s.r * 1.6 : s.r}
                  fill={s.fill}
                  fillOpacity={isHovered ? 1 : 0.85}
                  stroke={s.stroke}
                  strokeWidth={s.stroke ? 1.5 : 0}
                  filter={s.glow ? 'url(#pet-glow)' : undefined}
                  className={isPulsing ? 'pet-pulse' : ''}
                />
              )}

              {/* Labels (always shown, fade slightly when not hovered) */}
              <text
                x={x} y={above ? labelY - SUB_OFF : labelY}
                textAnchor="middle"
                fontFamily="Cinzel, serif" fontSize={8.5} letterSpacing={0.5}
                fill={isHovered ? '#e9c86c' : '#a09a8e'}
                fillOpacity={isHovered ? 1 : 0.75}
              >
                {evt.label}
              </text>
              <text
                x={x} y={above ? labelY : labelY + SUB_OFF}
                textAnchor="middle"
                fontFamily="Cormorant Garamond, serif" fontSize={9} fontStyle="italic"
                fill="#5c6078"
                fillOpacity={isHovered ? 0.9 : 0.6}
              >
                {evt.sublabel}
              </text>

              {/* Ref shown on hover */}
              {isHovered && (
                <text
                  x={x} y={above ? labelY + SUB_OFF : labelY + SUB_OFF * 2}
                  textAnchor="middle"
                  fontFamily="Cinzel, serif" fontSize={7.5} letterSpacing={0.5}
                  fill="#c9a84c" fillOpacity={0.7}
                >
                  {evt.ref}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
