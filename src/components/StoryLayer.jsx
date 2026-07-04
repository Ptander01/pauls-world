import { useMemo } from 'react'
import journeyData from '../data/pauline-journeys-data.json'

const cityById = Object.fromEntries(journeyData.cities.map(c => [c.id, c]))

// All waypoints across journeys, sorted by year — the story "beats"
const BEATS = journeyData.journeys
  .flatMap(j =>
    j.waypoints.map(wp => ({
      ...wp,
      journeyId: j.id,
      journeyName: j.shortName,
      color: j.color,
    }))
  )
  .sort((a, b) => a.year - b.year)

// Shown before the first journey begins (AD 44 up to the first waypoint)
const INTRO_BEAT = {
  key: 'intro',
  cityName: 'Antioch',
  note: 'The church at Antioch sets apart Paul and Barnabas for the work the Spirit has called them to.',
  ref: 'Acts 13:1–3',
  journeyName: 'Before the Journeys',
  color: '#c9a84c',
}

export default function StoryLayer({ timelineYear, onStoryPlay }) {
  const beat = useMemo(() => {
    if (timelineYear === null) return null
    let cur = null
    for (const b of BEATS) {
      if (b.year <= timelineYear) cur = b
      else break
    }
    if (!cur) return INTRO_BEAT
    const city = cityById[cur.cityId]
    return {
      key: `${cur.journeyId}-${cur.cityId}-${cur.year}`,
      cityName: city?.name ?? cur.cityId,
      note: cur.note,
      ref: cur.ref,
      journeyName: cur.journeyName,
      color: cur.color,
    }
  }, [timelineYear])

  const writing = useMemo(() => {
    if (timelineYear === null) return []
    return journeyData.books.filter(
      b => b.dateRange[0] <= timelineYear && timelineYear <= b.dateRange[1]
    )
  }, [timelineYear])

  if (timelineYear === null) {
    return (
      <button className="story-btn" onClick={onStoryPlay}>
        <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
          <path d="M0 0 L10 6 L0 12 Z" fill="currentColor" />
        </svg>
        <span>Paul&rsquo;s Story</span>
        <span className="story-btn__sub">AD 44–67</span>
      </button>
    )
  }

  if (!beat) return null

  return (
    <div className="story-caption" key={beat.key}>
      <div className="story-caption__top">
        <span className="story-caption__badge" style={{ color: beat.color }}>
          {beat.journeyName}
        </span>
        <span className="story-caption__year">AD {Math.round(timelineYear)}</span>
      </div>
      <div className="story-caption__city">{beat.cityName}</div>
      {beat.note && <div className="story-caption__note">{beat.note}</div>}
      <div className="story-caption__foot">
        {beat.ref ? <span className="story-caption__ref">{beat.ref}</span> : <span />}
        {writing.length > 0 && (
          <span className="story-caption__writing">
            ✍ {writing.map(b => b.abbrev).join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}
