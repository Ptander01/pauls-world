import { useState, useRef, useEffect } from 'react'
import journeyData from '../data/pauline-journeys-data.json'

const allCities = journeyData.cities
const allBooks  = journeyData.books
const jById     = Object.fromEntries(journeyData.journeys.map(j => [j.id, j]))

function scoreMatch(text, query) {
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (t.startsWith(q)) return 2
  if (t.includes(q))   return 1
  return 0
}

function search(query) {
  if (!query.trim()) return []
  const q = query.trim()

  const cities = allCities
    .map(c => ({ score: Math.max(scoreMatch(c.name, q), scoreMatch(c.modernName ?? '', q), scoreMatch(c.fullName ?? '', q)), item: c }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(x => ({ type: 'city', id: x.item.id, label: x.item.name, sub: x.item.modernName, item: x.item }))

  const books = allBooks
    .map(b => ({ score: Math.max(scoreMatch(b.abbrev, q), scoreMatch(b.id.replace(/-/g, ' '), q)), item: b }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(x => {
      const j = jById[x.item.journeyId]
      return { type: 'book', id: x.item.id, label: x.item.abbrev, sub: `AD ${x.item.dateRange[0]}–${x.item.dateRange[1]}`, color: j?.color, item: x.item }
    })

  return [...cities, ...books]
}

export default function SearchBar({ onCitySelect, onBookSelect }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef  = useRef(null)
  const wrapRef   = useRef(null)

  useEffect(() => {
    setResults(search(query))
    setActiveIdx(-1)
  }, [query])

  useEffect(() => {
    function onClickOutside(e) {
      if (!wrapRef.current?.contains(e.target)) setFocused(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function select(result) {
    if (result.type === 'city') onCitySelect(result.id)
    else                        onBookSelect(result.id)
    setQuery('')
    setFocused(false)
    inputRef.current?.blur()
  }

  function onKeyDown(e) {
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && activeIdx >= 0) select(results[activeIdx])
    if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur() }
  }

  const showDropdown = focused && results.length > 0

  return (
    <div className="sb-wrap" ref={wrapRef}>
      <div className="sb-input-row">
        <svg className="sb-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="7.8" y1="7.8" x2="11" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          className="sb-input"
          type="text"
          placeholder="Search cities or letters…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button className="sb-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }}>✕</button>
        )}
      </div>

      {showDropdown && (
        <div className="sb-dropdown">
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}`}
              className={`sb-result${i === activeIdx ? ' sb-result--active' : ''}`}
              onMouseDown={e => { e.preventDefault(); select(r) }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="sb-result-icon">
                {r.type === 'city'
                  ? <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="currentColor" fillOpacity="0.6"/></svg>
                  : <svg width="8" height="8" viewBox="0 0 8 8"><polygon points="4,0 8,4 4,8 0,4" fill={r.color ?? 'currentColor'} fillOpacity="0.7"/></svg>
                }
              </span>
              <span className="sb-result-label">{r.label}</span>
              {r.sub && <span className="sb-result-sub">{r.sub}</span>}
              <span className="sb-result-type">{r.type === 'city' ? 'CITY' : 'LETTER'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
