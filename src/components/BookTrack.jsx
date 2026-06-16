import { useMemo } from 'react'
import journeyData from '../data/pauline-journeys-data.json'
import { buildStopLayout } from '../utils/stopLayout'

const ROW_H    = 22
const BAR_H    = 14
const PAD_TOP  = 8
const PAD_BOT  = 6
const MIN_BAR_W = 6  // minimum bar width in px before we skip the label

function assignRows(books, xFromYear) {
  const placed = []
  const rowEnds = [] // tracks the rightmost x1 of each row

  books.forEach(book => {
    const x0 = xFromYear(book.dateRange[0])
    const x1 = Math.max(x0 + MIN_BAR_W, xFromYear(book.dateRange[1]))

    let row = rowEnds.findIndex(end => x0 >= end + 4)
    if (row === -1) {
      row = rowEnds.length
      rowEnds.push(0)
    }
    rowEnds[row] = x1
    placed.push({ book, x0, x1, row })
  })

  return placed
}

export default function BookTrack({ journey, selectedBookId, onBookSelect }) {
  const { xFromYear, totalWidth } = useMemo(
    () => buildStopLayout(journey),
    [journey]
  )

  const books = useMemo(
    () => journeyData.books.filter(b => b.journeyId === journey.id),
    [journey]
  )

  const placed = useMemo(
    () => assignRows(books, xFromYear),
    [books, xFromYear]
  )

  const numRows = placed.reduce((max, p) => Math.max(max, p.row + 1), 1)
  const svgH    = PAD_TOP + numRows * ROW_H + PAD_BOT

  if (!books.length) return null

  return (
    <div className="bt-scroll">
      <div className="bt-label">LETTERS</div>
      <svg width={totalWidth} height={svgH} style={{ display: 'block', overflow: 'visible' }}>
        {placed.map(({ book, x0, x1, row }) => {
          const isSelected = book.id === selectedBookId
          const barW = x1 - x0
          const barY = PAD_TOP + row * ROW_H
          const cx   = x0 + barW / 2
          const showAbbrev = barW >= 22

          return (
            <g
              key={book.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onBookSelect?.(book.id)}
            >
              {/* Bar background */}
              <rect
                x={x0} y={barY}
                width={barW} height={BAR_H}
                rx={3}
                fill={isSelected ? '#c9a84c' : '#7a6430'}
                fillOpacity={isSelected ? 0.55 : 0.25}
                stroke={isSelected ? '#c9a84c' : '#7a6430'}
                strokeWidth={isSelected ? 1.5 : 1}
                strokeOpacity={isSelected ? 0.9 : 0.5}
              />

              {/* Abbreviation inside bar */}
              {showAbbrev && (
                <text
                  x={cx} y={barY + BAR_H / 2 + 3.5}
                  textAnchor="middle"
                  fontFamily="Cinzel, serif"
                  fontSize={7.5}
                  letterSpacing={0.5}
                  fill={isSelected ? '#e9c86c' : '#c9a84c'}
                  fillOpacity={isSelected ? 1 : 0.8}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {book.abbrev}
                </text>
              )}

              {/* Date-debated marker */}
              {book.dateDebated && (
                <text
                  x={x0 + barW - 3} y={barY + 5}
                  textAnchor="end"
                  fontFamily="Cinzel, serif"
                  fontSize={6}
                  fill="#a09a8e"
                  fillOpacity={0.6}
                  style={{ pointerEvents: 'none' }}
                >
                  ?
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
