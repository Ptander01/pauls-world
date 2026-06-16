import { useState, useMemo } from 'react'
import journeyData from '../data/pauline-journeys-data.json'
import { buildStopLayout } from '../utils/stopLayout'

const MIN_W    = 24
const GAP      = 2
const MARGIN_X = 8
const SVG_H    = 100
const RECT_Y   = 22
const RECT_H   = 24
const LABEL_Y  = 15
const DUR_Y    = 60
const NOTE_Y   = 80

const cityById = Object.fromEntries(
  journeyData.cities.map(c => [c.id, c])
)

function formatDuration(days) {
  if (!days || days < 1) return ''
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
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
    const arr = layout.stops.map((s, i) => ({
      ...s,
      city: cityById[s.wp.cityId],
      i,
    }))
    const marked = arr.map((stop, i) => ({
      ...stop,
      colliding: stop.w === MIN_W && (
        (i > 0 && arr[i - 1].w === MIN_W) ||
        (i < arr.length - 1 && arr[i + 1].w === MIN_W)
      ),
    }))
    return { stops: marked, totalWidth: layout.totalWidth }
  }, [journey])

  const currentStopIdx = useMemo(() => {
    if (timelineYear === null || timelineYear === undefined || !stops.length) return -1
    for (let i = 0; i < stops.length; i++) {
      const { wp } = stops[i]
      const arrivalYear   = wp.year
      const departureYear = arrivalYear + (wp.durationDays || 1) / 365
      if (timelineYear >= arrivalYear && timelineYear <= departureYear) return i
    }
    return -1
  }, [timelineYear, stops])

  if (!journey) return null

  return (
    <div className="pst-scroll">
      <svg width={totalWidth} height={SVG_H} style={{ display: 'block' }}>
        {stops.map(({ wp, city, x, w, i, colliding }) => {
          const hovered     = hoveredIdx === i
          const significant = (wp.durationDays || 0) > 90
          const shortStop   = (wp.durationDays || 0) < 3
          const showLabel   = (!shortStop && !colliding) || hovered
          const cx          = x + w / 2

          return (
            <g
              key={`${wp.cityId}-${i}`}
              onMouseEnter={() => { setHoveredIdx(i); onCityHover?.(wp.cityId) }}
              onMouseLeave={() => { setHoveredIdx(null); onCityHover?.(null) }}
            >
              <rect
                x={x} y={RECT_Y} width={w} height={RECT_H} rx={3}
                fill={journey.color}
                fillOpacity={(hovered || i === currentStopIdx) ? 0.4 : 0.15}
                stroke={journey.color}
                strokeOpacity={(hovered || i === currentStopIdx) ? 0.85 : 0.6}
                strokeWidth={1}
                style={{ cursor: 'default' }}
              />

              {/* Tick mark for colliding min-width stops (hidden on hover) */}
              {colliding && !hovered && (
                <line
                  x1={cx} x2={cx}
                  y1={RECT_Y + 3} y2={RECT_Y + RECT_H - 3}
                  stroke={journey.color}
                  strokeOpacity={0.7}
                  strokeWidth={1.5}
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {showLabel && (
                <text
                  x={cx} y={LABEL_Y}
                  textAnchor="middle"
                  fontFamily="Cinzel, serif"
                  fill={significant ? '#c9a84c' : '#ede8dc'}
                  fillOpacity={significant ? 1 : 0.85}
                  style={{ fontSize: 'var(--pst-label-size, 10px)', pointerEvents: 'none', userSelect: 'none' }}
                >
                  {city ? city.name : wp.cityId}
                </text>
              )}
              {showLabel && (
                <text
                  x={cx} y={DUR_Y}
                  textAnchor="middle"
                  fontFamily="Cormorant Garamond, Georgia, serif"
                  fontStyle="italic"
                  fill={significant ? '#c9a84c' : '#5c6078'}
                  fillOpacity={significant ? 0.9 : 0.85}
                  style={{ fontSize: 'var(--pst-label-size, 10px)', pointerEvents: 'none', userSelect: 'none' }}
                >
                  {formatDuration(wp.durationDays)}
                </text>
              )}

              {/* Note text on hover */}
              {hovered && wp.note && (
                <text
                  x={cx} y={NOTE_Y}
                  textAnchor="middle"
                  fontFamily="Cormorant Garamond, Georgia, serif"
                  fontStyle="italic"
                  fontSize={9}
                  fill="#a09a8e"
                  fillOpacity={0.85}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {wp.note.length > 55 ? wp.note.slice(0, 52) + '…' : wp.note}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
