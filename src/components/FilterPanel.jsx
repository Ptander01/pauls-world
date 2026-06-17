import { useState } from 'react'
import journeyData from '../data/pauline-journeys-data.json'

export default function FilterPanel({
  activeJourneys,
  selectedBookId,
  viewMode,
  showProvinces,
  onJourneyToggle,
  onBookSelect,
  onViewModeChange,
  onShowProvincesChange,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const allActive  = journeyData.journeys.every(j => activeJourneys.has(j.id))
  const noneActive = journeyData.journeys.every(j => !activeJourneys.has(j.id))

  function selectAll() {
    journeyData.journeys.filter(j => !activeJourneys.has(j.id)).forEach(j => onJourneyToggle(j.id))
  }
  function clearAll() {
    journeyData.journeys.filter(j => activeJourneys.has(j.id)).forEach(j => onJourneyToggle(j.id))
  }

  return (
    <>
      {/* Mobile hamburger toggle — only visible on small screens */}
      <button
        className="fp-mobile-toggle"
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Toggle filters"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Backdrop — mobile only, closes panel on tap */}
      {mobileOpen && (
        <div className="fp-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fp${mobileOpen ? ' fp--open' : ''}`}>
        {/* ── Mode toggle ── */}
        <div className="fp-tabs">
          <button
            className={`fp-tab ${viewMode === 'journeys' ? 'fp-tab--active' : ''}`}
            onClick={() => onViewModeChange('journeys')}
          >Journeys</button>
          <button
            className={`fp-tab ${viewMode === 'books' ? 'fp-tab--active' : ''}`}
            onClick={() => onViewModeChange('books')}
          >Books</button>
        </div>

        {/* ── Journey mode ── */}
        {viewMode === 'journeys' && (
          <>
            <div className="fp-toolbar">
              <button className="fp-link" onClick={selectAll} disabled={allActive}>
                Select All
              </button>
              <span className="fp-sep">·</span>
              <button className="fp-link" onClick={clearAll} disabled={noneActive}>
                Clear All
              </button>
            </div>

            <div className="fp-journey-list">
              {journeyData.journeys.map(journey => {
                const active = activeJourneys.has(journey.id)
                const isPostRome = journey.id === 'post-rome'
                return (
                  <label
                    key={journey.id}
                    className={`fp-journey-row ${active ? '' : 'fp-journey-row--dim'}`}
                    style={{ '--jc': journey.color, background: `${journey.color}${active ? '1a' : '0d'}` }}
                  >
                    <input
                      type="checkbox"
                      className="fp-check"
                      checked={active}
                      onChange={() => onJourneyToggle(journey.id)}
                    />
                    <svg className="fp-line-swatch" width="36" height="10" aria-hidden="true">
                      <line
                        x1="2" y1="5" x2="34" y2="5"
                        stroke={journey.color}
                        strokeWidth={isPostRome ? 1.5 : 2.5}
                        strokeDasharray={isPostRome ? '5 3' : undefined}
                        strokeLinecap="round"
                        strokeOpacity="0.9"
                      />
                    </svg>
                    <span className="fp-journey-text">
                      <span className={`fp-journey-name ${isPostRome ? 'fp-em' : ''}`}>
                        {journey.shortName}
                        {isPostRome && <span className="fp-muted"> (traditional)</span>}
                      </span>
                      <span className="fp-journey-date">
                        AD {journey.dateRange[0]}–{journey.dateRange[1]}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </>
        )}

        {/* ── Book mode ── */}
        {viewMode === 'books' && (
          <>
            <div className="fp-book-grid">
              {journeyData.books.map(book => {
                const journey = journeyData.journeys.find(j => j.id === book.journeyId)
                const color   = journey?.color ?? '#a09a8e'
                const selected = selectedBookId === book.id
                const debated  = book.attribution === 'debated'
                return (
                  <button
                    key={book.id}
                    className={`fp-pill ${selected ? 'fp-pill--on' : ''} ${debated ? 'fp-em' : ''}`}
                    onClick={() => onBookSelect(selected ? null : book.id)}
                    title={book.name}
                  >
                    <span className="fp-pill-dot" style={{ background: color }} />
                    {book.abbrev}
                  </button>
                )
              })}
            </div>

            <div className="fp-attr-legend">
              <span className="fp-muted">Regular = undisputed authorship</span>
              <span className="fp-muted fp-em">Italic = debated attribution</span>
            </div>
          </>
        )}

        {/* ── Map layer toggles ── */}
        <div className="fp-layer-divider" />
        <label className="fp-layer-row">
          <input
            type="checkbox"
            className="fp-check"
            checked={showProvinces}
            onChange={() => onShowProvincesChange(!showProvinces)}
          />
          <span className="fp-province-swatch" />
          <span className="fp-journey-name">Provincial Boundaries</span>
        </label>
      </aside>
    </>
  )
}
