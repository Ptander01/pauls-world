import { useState, useMemo } from 'react'
import journeyData from '../data/pauline-journeys-data.json'
import { buildStopLayout, STOP_MARGIN_X } from '../utils/stopLayout'

const SVG_H   = 130
const TRACK_Y = 65
const SUB_OFF = 13

const cityById = Object.fromEntries(
  journeyData.cities.map(c => [c.id, c])
)

function stopRadius(durationDays) {
  if (!durationDays || durationDays < 7)  return 3.5
  if (durationDays < 30)   return 5
  if (durationDays < 90)   return 7.5
  if (durationDays < 365)  return 11
  return 17
}

function formatDuration(days) {
  if (!days || days < 1) return ''
  if (days === 1) return '1 day'
  if (days < 7)  return `${days} days`
  if (days < 14) return '1 wk'
  if (days < 30) return `${Math.round(days / 7)} wks`
  if (days < 365) return `${Math.round(days / 30)} mo`
  return `${Math.round(days / 365)} yr`
}

export default function PaulStopTrack({ journey, timelineYear, onCityHover }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const { stops, totalWidth } = useMemo(() => {
    if (!journey) return { stops: [], totalWidth: 400 }
    const layout = buildStopLayout(journey)
    return {
      stops: layout.stops.map((s, i) => ({ ...s, city: cityById[s.wp.cityId], i })),
      totalWidth: layout.totalWidth,
    }
  }, [journey])

  const currentStopIdx = useMemo(() => {
    if (timelineYear === null || timelineYear === undefined || !stops.length) return -1
    for (let i = 0; i < stops.length; i++) {
      const { wp } = stops[i]
      const dep = wp.year + (wp.durationDays || 1) / 365
      if (timelineYear >= wp.year && timelineYear <= dep) return i
    }
    return -1
  }, [timelineYear, stops])

  if (!journey) return null

  return (
    <div className="pst-scroll">
      <svg width={totalWidth} height={SVG_H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <filter id="pst-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Dashed track line */}
        <line
          x1={STOP_MARGIN_X} y1={TRACK_Y}
          x2={totalWidth - STOP_MARGIN_X} y2={TRACK_Y}
          stroke={journey.color} strokeWidth={1} strokeOpacity={0.25} strokeDasharray="4 4"
        />

        {stops.map(({ wp, city, x, w, i }) => {
          const cx       = x + w / 2
          const hovered  = hoveredIdx === i
          const active   = i === currentStopIdx
          const r        = stopRadius(wp.durationDays)
          const major    = (wp.durationDays || 0) > 90
          const above    = i % 2 === 0
          const nameY    = above ? TRACK_Y - r - 8  : TRACK_Y + r + 8 + SUB_OFF
          const durY     = above ? TRACK_Y - r - 8 + SUB_OFF : TRACK_Y + r + 8 + SUB_OFF * 2
          const noteY    = above ? nameY - SUB_OFF  : durY + SUB_OFF

          const dotColor  = (hovered || active) ? '#c9a84c' : (major ? '#c9a84c' : journey.color)
          const dotOpacity = (hovered || active) ? 1 : (major ? 0.55 : 0.35)

          return (
            <g
              key={`${wp.cityId}-${i}`}
              onMouseEnter={() => { setHoveredIdx(i); onCityHover?.(wp.cityId) }}
              onMouseLeave={() => { setHoveredIdx(null); onCityHover?.(null) }}
              style={{ cursor: 'default' }}
            >
              {/* Connector line to label */}
              <line
                x1={cx} y1={above ? TRACK_Y - r - 2 : TRACK_Y + r + 2}
                x2={cx} y2={above ? nameY + 4 : nameY - SUB_OFF - 2}
                stroke="#c9a84c" strokeWidth={0.8}
                strokeOpacity={(hovered || active) ? 0.5 : 0.2}
              />

              {/* City dot */}
              <circle
                cx={cx} cy={TRACK_Y} r={r}
                fill={dotColor}
                fillOpacity={dotColor === '#c9a84c' ? dotOpacity * 0.5 : dotOpacity * 0.3}
                stroke={dotColor}
                strokeWidth={1.2}
                strokeOpacity={dotOpacity}
                filter={(hovered || active) ? 'url(#pst-glow)' : undefined}
              />

              {/* City name */}
              <text
                x={cx} y={nameY}
                textAnchor="middle"
                fontFamily="Cinzel, serif"
                fontSize={8.5} letterSpacing={0.5}
                fill={(hovered || active) ? '#e9c86c' : (major ? '#c9a84c' : '#a09a8e')}
                fillOpacity={(hovered || active) ? 1 : (major ? 0.85 : 0.7)}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {city ? city.name : wp.cityId}
              </text>

              {/* Duration */}
              <text
                x={cx} y={durY}
                textAnchor="middle"
                fontFamily="Cormorant Garamond, Georgia, serif"
                fontStyle="italic"
                fontSize={9}
                fill={major ? '#c9a84c' : '#5c6078'}
                fillOpacity={(hovered || active) ? 0.9 : (major ? 0.7 : 0.55)}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {formatDuration(wp.durationDays)}
              </text>

              {/* Note on hover */}
              {hovered && wp.note && (
                <text
                  x={cx} y={above ? noteY - 4 : noteY + 4}
                  textAnchor="middle"
                  fontFamily="Cormorant Garamond, Georgia, serif"
                  fontStyle="italic"
                  fontSize={8.5}
                  fill="#7a8ab0"
                  fillOpacity={0.85}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {wp.note.length > 60 ? wp.note.slice(0, 57) + '…' : wp.note}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
