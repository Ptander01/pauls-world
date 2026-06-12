import journeyData from '../data/pauline-journeys-data.json'

export default function BookDetailPanel({ book, onClose }) {
  const writingCity = book
    ? journeyData.cities.find(c => c.id === book.writingLocationId)
    : null
  const recipientCities = book
    ? (book.recipientCityIds || [])
        .map(id => journeyData.cities.find(c => c.id === id))
        .filter(Boolean)
    : []

  return (
    <div className={`bdp${book ? ' bdp--open' : ''}`}>
      {book && (
        <>
          <button className="bdp-close" onClick={onClose}>Clear ×</button>

          <h2 className="bdp-title">{book.name}</h2>

          <div className="bdp-badge">
            AD {book.dateRange[0]}–{book.dateRange[1]}
            {book.dateDebated && <span className="bdp-badge-debated"> · date debated</span>}
          </div>

          {writingCity && (
            <div className="bdp-section">
              <div className="bdp-label">Written from</div>
              <div className="bdp-writing-loc">
                <span className="bdp-city-name">{writingCity.name}</span>
                <span className="bdp-province">{writingCity.province}</span>
              </div>
            </div>
          )}

          {recipientCities.length > 0 && (
            <div className="bdp-section">
              <div className="bdp-label">Recipients</div>
              <div className="bdp-chips">
                {recipientCities.map(city => (
                  <span key={city.id} className="bdp-chip">{city.name}</span>
                ))}
              </div>
            </div>
          )}

          {book.theme && (
            <div className="bdp-section">
              <div className="bdp-label">Theme</div>
              <div className="bdp-theme">{book.theme}</div>
            </div>
          )}

          {book.keyVerse && (
            <div className="bdp-verse">
              <div className="bdp-verse-label">Key Verse</div>
              <div className="bdp-verse-ref">{book.keyVerse}</div>
            </div>
          )}

          {book.attribution === 'debated' && (
            <div className="bdp-attr-note">
              Authorship debated — not in all scholarly canons of undisputed Pauline letters.
            </div>
          )}

          <div className="bdp-study-sep" />
          {book.id === 'philippians' ? (
            <button
              className="bdp-study-btn"
              onClick={() => window.open('/philippians-study.html', '_blank')}
            >
              Study Guide
            </button>
          ) : (
            <button className="bdp-study-btn bdp-study-btn--disabled" disabled>
              Study Guide — coming soon
            </button>
          )}
        </>
      )}
    </div>
  )
}
